import {
  legalActions,
  opponentOf,
  viewFor,
  type Action,
  type CardInstance,
  type GameView,
  type PlayerId,
} from "@strawhat/engine";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Backs, Mats } from "./App.js";
import { officialText, type Card, type CardData } from "./card-data.js";
import { CardView, DonCard, type Glow } from "./CardView.js";
import { formatClock, running, timeLeft } from "./clock.js";
import { cardText } from "./describe.js";
import { botStep, botToAct, humanAct, outOfTime, type LocalGame } from "./local-game.js";
import { MIN_TURNS, qualifies, TIER_POINTS, trophyById } from "./trophies.js";
import { Medal } from "./TrophyToasts.js";

interface Props {
  data: CardData;
  game: LocalGame;
  mats: Mats;
  /** Card back pictures for each side; null is the classic back. */
  backs: Backs;
  /** Trophies this game earned, once it is over. */
  trophies?: string[];
  onChange: (game: LocalGame) => void;
  /** Ends the game because this player's clock ran out. */
  onTimeout: (player: PlayerId) => void;
  /** Starts another game; none for a game against a friend. */
  onRestart?: () => void;
  onExit: () => void;
  /** A line shown over the table, such as a friend who lost their connection. */
  notice?: string | undefined;
  /** Music and sound settings, opened from the Sound button. */
  soundPanel?: ReactNode;
}

type Mode =
  | { kind: "none" }
  | { kind: "attack"; attacker: string }
  | { kind: "replace"; card: string };

interface MenuItem {
  label: string;
  run: () => void;
}

interface Menu {
  uid: string;
  x: number;
  y: number;
  items: MenuItem[];
}

const BOT_DELAY_MS = 650;

const CHOOSE_TEXT: Record<string, string> = {
  ko: "Choose cards to K.O.",
  rest: "Choose cards to rest",
  setActive: "Choose cards to set as active",
  returnToHand: "Choose cards to return to the owner's hand",
  returnToDeckBottom: "Choose cards to place at the bottom of the deck",
  powerUp: "Choose who gets the power",
  grantKeyword: "Choose who gains the ability",
  noBlockers: "Choose the attacker that can't be blocked",
  giveRestedDon: "Choose who gets the DON!!",
  searchDeck: "The cards from the top of your deck",
  trashFromHand: "Choose cards to trash from your hand",
  trashCharacter: "Choose a Character to trash",
  playFromHand: "Choose a card to play",
  playFromTrash: "Choose a card to play from your trash",
  lookAtOpponentDeck: "The top card of your opponent's deck",
};

type DefOf = (card: CardInstance | null | undefined) => Card | undefined;

export function Board({
  data,
  game,
  mats,
  backs,
  trophies = [],
  onChange,
  onTimeout,
  onRestart,
  onExit,
  notice,
  soundPanel,
}: Props) {
  const me = game.human;
  const them = opponentOf(me);
  const view = useMemo(() => viewFor(game.state, me), [game.state, me]);
  const legal = useMemo(
    () => legalActions(game.state, me).filter((a) => a.type !== "concede"),
    [game.state, me],
  );
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [menu, setMenu] = useState<Menu | null>(null);
  const [detail, setDetail] = useState<Card | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [trashOf, setTrashOf] = useState<PlayerId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [showSound, setShowSound] = useState(false);

  const def: DefOf = (card) => (card ? data.catalog[card.cardId] : undefined);
  const art = (card: CardInstance | null | undefined) => data.imageUrl(def(card));
  const prompt = view.prompt;
  const myPrompt = prompt.kind !== "gameOver" && prompt.player === me ? prompt : null;
  const pickedPower = picked.reduce((sum, uid) => sum + (view.powers[uid] ?? 0), 0);

  // A new decision resets anything half-done.
  useEffect(() => {
    setMode({ kind: "none" });
    setMenu(null);
    setPicked([]);
  }, [game.state]);

  // The computer acts on its own, a little slowly so you can follow along.
  useEffect(() => {
    if (!botToAct(game)) return;
    const timer = setTimeout(() => onChange(botStep(game)), BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, onChange]);

  // With no Counter cards to use, skip the Counter Step after a moment (Master Duel style).
  const hasCounters = legal.some((a) => a.type === "counter" || a.type === "counterEvent");
  useEffect(() => {
    if (myPrompt?.kind !== "counter" || hasCounters) return;
    const timer = setTimeout(() => act({ type: "pass", player: me }), 1100);
    return () => clearTimeout(timer);
  }, [myPrompt?.kind, hasCounters, game.state]);

  function act(action: Action) {
    try {
      setError(null);
      onChange(humanAct(game, action));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Which actions each card offers, so playable cards glow and a tap opens their options.
  const byCard = useMemo(() => {
    const map = new Map<string, Action[]>();
    const add = (uid: string, a: Action) => map.set(uid, [...(map.get(uid) ?? []), a]);
    for (const a of legal) {
      if (a.type === "playCard" || a.type === "activate" || a.type === "counterEvent")
        add(a.card, a);
      else if (a.type === "counter") add(a.card, a);
      else if (a.type === "giveDon") add(a.target, a);
      else if (a.type === "attack") add(a.attacker, a);
      else if (a.type === "block") add(a.blocker, a);
    }
    return map;
  }, [legal]);

  const attackTargets = useMemo(() => {
    if (mode.kind !== "attack") return new Set<string>();
    return new Set(
      legal.flatMap((a) => (a.type === "attack" && a.attacker === mode.attacker ? [a.target] : [])),
    );
  }, [legal, mode]);

  const replaceTargets = useMemo(() => {
    if (mode.kind !== "replace") return new Set<string>();
    return new Set(
      legal.flatMap((a) =>
        a.type === "playCard" && a.card === mode.card && a.trash ? [a.trash] : [],
      ),
    );
  }, [legal, mode]);

  function openMenu(uid: string, event: MouseEvent) {
    const card = findInView(view, uid);
    const d = def(card);
    if (d) setDetail(d);

    // Finishing an attack or a replacement takes priority over opening a menu.
    if (mode.kind === "attack") {
      if (attackTargets.has(uid))
        act({ type: "attack", player: me, attacker: mode.attacker, target: uid });
      else setMode({ kind: "none" });
      return;
    }
    if (mode.kind === "replace") {
      if (replaceTargets.has(uid))
        act({ type: "playCard", player: me, card: mode.card, trash: uid });
      else setMode({ kind: "none" });
      return;
    }

    const items: MenuItem[] = [];
    const actions = byCard.get(uid) ?? [];
    const plays = actions.filter((a) => a.type === "playCard");
    const direct = plays.find((a) => a.type === "playCard" && a.trash === undefined);
    if (direct) items.push({ label: `Play (cost ${d?.cost ?? 0})`, run: () => act(direct) });
    else if (plays.length) {
      items.push({
        label: "Play, replacing a Character",
        run: () => setMode({ kind: "replace", card: uid }),
      });
    }
    actions
      .filter((a) => a.type === "activate")
      .forEach((a) => items.push({ label: "Activate effect", run: () => act(a) }));
    const give = actions.find((a) => a.type === "giveDon");
    if (give) items.push({ label: "Give 1 DON!!", run: () => act(give) });
    if (actions.some((a) => a.type === "attack")) {
      items.push({ label: "Attack", run: () => setMode({ kind: "attack", attacker: uid }) });
    }
    const block = actions.find((a) => a.type === "block");
    if (block) items.push({ label: "Block with this", run: () => act(block) });
    const counter = actions.find((a) => a.type === "counter");
    if (counter) items.push({ label: `Counter +${d?.counter ?? 0}`, run: () => act(counter) });
    const counterEvent = actions.find((a) => a.type === "counterEvent");
    if (counterEvent) items.push({ label: "Play Counter Event", run: () => act(counterEvent) });

    if (items.length === 0) {
      setMenu(null);
      return;
    }
    // Open the menu just above the card, so it doesn't cover what you tapped.
    const height = 44 * items.length + 12;
    const x = Math.max(8, Math.min(event.clientX - 90, window.innerWidth - 200));
    const above = event.clientY - height - 16;
    const y = above > 8 ? above : Math.min(event.clientY + 16, window.innerHeight - height - 8);
    setMenu({ uid, x, y, items });
  }

  function glowFor(uid: string): Glow {
    if (view.battle?.attacker === uid) return "attacker";
    if (view.battle?.target === uid) return "defender";
    if (mode.kind === "attack") {
      if (uid === mode.attacker) return "selected";
      return attackTargets.has(uid) ? "target" : null;
    }
    if (mode.kind === "replace") return replaceTargets.has(uid) ? "target" : null;
    if (menu?.uid === uid) return "selected";
    return byCard.has(uid) ? "playable" : null;
  }

  const fieldCard = (card: CardInstance, owner: PlayerId) => (
    <CardView
      key={card.uid}
      def={def(card)}
      image={art(card)}
      rested={card.rested}
      don={card.givenDon}
      power={view.powers[card.uid]}
      glow={glowFor(card.uid)}
      onHover={() => setDetail(def(card) ?? null)}
      label={`${owner === me ? "Your" : "Opponent's"} ${def(card)?.name ?? "card"}`}
    />
  );

  return (
    <div className="game" onClick={() => setMenu(null)}>
      <div className="board">
        <Mat
          view={view}
          player={them}
          side="opponent"
          image={mats.opponent}
          back={backs.opponent}
          renderCard={(card) => (
            <Clickable key={card.uid} onClick={(e) => openMenu(card.uid, e)}>
              {fieldCard(card, them)}
            </Clickable>
          )}
          def={def}
          art={art}
          onTrash={() => setTrashOf(them)}
          onDetail={setDetail}
        />
        <div
          className="opponent-hand"
          aria-label={`Opponent's hand: ${view.players[them].handCount} cards`}
        >
          {Array.from({ length: view.players[them].handCount }, (_, i) => (
            <CardView key={i} faceDown back={backs.opponent} size="small" />
          ))}
        </div>

        <StatusBar
          view={view}
          me={me}
          def={def}
          mode={mode}
          friend={game.opponent === "friend"}
          onCancel={() => setMode({ kind: "none" })}
        >
          <Clocks game={game} onTimeout={onTimeout} />
        </StatusBar>
        {notice && (
          <p className="table-notice" role="status">
            {notice}
          </p>
        )}

        <Mat
          view={view}
          player={me}
          side="you"
          image={mats.you}
          back={backs.you}
          renderCard={(card) => (
            <Clickable key={card.uid} onClick={(e) => openMenu(card.uid, e)}>
              {fieldCard(card, me)}
            </Clickable>
          )}
          def={def}
          art={art}
          onTrash={() => setTrashOf(me)}
          onDetail={setDetail}
        />

        <div className="hand" aria-label="Your hand">
          {(view.players[me].hand ?? []).map((card) => (
            <Clickable key={card.uid} onClick={(e) => openMenu(card.uid, e)}>
              <CardView
                def={def(card)}
                image={art(card)}
                glow={glowFor(card.uid)}
                dim={!byCard.has(card.uid) && myPrompt?.kind === "counter"}
                onHover={() => setDetail(def(card) ?? null)}
              />
            </Clickable>
          ))}
        </div>
      </div>

      <aside className="side">
        <div className="side-actions">
          {myPrompt?.kind === "main" && (
            <button className="primary" onClick={() => act({ type: "endTurn", player: me })}>
              End turn
            </button>
          )}
          {myPrompt?.kind === "block" && (
            <button className="primary" onClick={() => act({ type: "pass", player: me })}>
              Don't block
            </button>
          )}
          {myPrompt?.kind === "counter" && (
            <button className="primary" onClick={() => act({ type: "pass", player: me })}>
              {hasCounters ? "Done countering" : "No counters…"}
            </button>
          )}
          {soundPanel && (
            <button className="ghost" onClick={() => setShowSound(true)}>
              Sound
            </button>
          )}
          <button className="ghost" onClick={() => setConfirmConcede(true)}>
            Concede
          </button>
        </div>
        <Detail card={detail} image={data.imageUrl(detail ?? undefined)} />
        <Log game={game} />
      </aside>

      {menu && (
        <div
          className="menu-pop"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {menu.items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setMenu(null);
                item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {myPrompt?.kind === "chooseTurnOrder" && (
        <Modal title="You won Rock-Paper-Scissors!">
          <p>Do you want to go first or second? The first player doesn't draw on turn 1.</p>
          <div className="row">
            <button
              className="primary"
              onClick={() => act({ type: "chooseTurnOrder", player: me, goFirst: true })}
            >
              Go first
            </button>
            <button onClick={() => act({ type: "chooseTurnOrder", player: me, goFirst: false })}>
              Go second
            </button>
          </div>
        </Modal>
      )}

      {myPrompt?.kind === "mulligan" && (
        <Modal title="Your opening hand">
          <div className="card-row">
            {(view.players[me].hand ?? []).map((card) => (
              <CardView
                key={card.uid}
                def={def(card)}
                image={art(card)}
                onHover={() => setDetail(def(card) ?? null)}
              />
            ))}
          </div>
          <p>Keep this hand, or shuffle it back and draw 5 new cards (once only)?</p>
          <div className="row">
            <button className="primary" onClick={() => act({ type: "keepHand", player: me })}>
              Keep
            </button>
            <button onClick={() => act({ type: "mulligan", player: me })}>Redraw</button>
          </div>
        </Modal>
      )}

      {myPrompt?.kind === "choose" && (
        <Modal title={CHOOSE_TEXT[myPrompt.reason] ?? "Choose cards"}>
          <p>
            {myPrompt.max === 0
              ? myPrompt.reason === "searchDeck"
                ? "None of these can be chosen. Look, then continue."
                : "Look, then continue."
              : myPrompt.min === myPrompt.max
                ? `Choose ${myPrompt.max}.`
                : `Choose ${myPrompt.min === 0 ? "up to" : `${myPrompt.min} to`} ${myPrompt.max}.`}{" "}
            From {nameOf(def, view, myPrompt.source)}.
            {myPrompt.max > 0 &&
              (myPrompt.revealed ?? []).some((uid) => !myPrompt.options.includes(uid)) &&
              " Darkened cards can't be chosen."}
            {myPrompt.maxTotalPower !== undefined &&
              ` Their total power can be up to ${myPrompt.maxTotalPower} (now ${pickedPower}).`}
          </p>
          <div className="card-row wrap">
            {/* "Your opponent chooses 1 card from your hand": the options are face-down. */}
            {myPrompt.hidden &&
              myPrompt.options.map((uid) => {
                const chosen = picked.includes(uid);
                return (
                  <CardView
                    key={uid}
                    faceDown
                    back={backs.opponent}
                    glow={chosen ? "selected" : "playable"}
                    onClick={() =>
                      setPicked((p) =>
                        p.includes(uid)
                          ? p.filter((u) => u !== uid)
                          : p.length < myPrompt.max
                            ? [...p, uid]
                            : p,
                      )
                    }
                  />
                );
              })}
            {view.promptCards.map((card) => {
              const option = myPrompt.options.includes(card.uid);
              const chosen = picked.includes(card.uid);
              return (
                <CardView
                  key={card.uid}
                  def={def(card)}
                  image={art(card)}
                  power={view.powers[card.uid]}
                  dim={!option}
                  glow={chosen ? "selected" : option ? "playable" : null}
                  onHover={() => setDetail(def(card) ?? null)}
                  onClick={
                    option
                      ? () =>
                          setPicked((p) =>
                            p.includes(card.uid)
                              ? p.filter((u) => u !== card.uid)
                              : p.length < myPrompt.max
                                ? [...p, card.uid]
                                : p,
                          )
                      : undefined
                  }
                />
              );
            })}
          </div>
          <div className="row">
            <button
              className="primary"
              disabled={
                picked.length < myPrompt.min ||
                picked.length > myPrompt.max ||
                (myPrompt.maxTotalPower !== undefined && pickedPower > myPrompt.maxTotalPower)
              }
              onClick={() => act({ type: "choose", player: me, cards: picked })}
            >
              {myPrompt.max === 0
                ? "Continue"
                : picked.length === 0
                  ? "Choose none"
                  : `Confirm (${picked.length})`}
            </button>
          </div>
        </Modal>
      )}

      {myPrompt?.kind === "confirm" && (
        <Modal
          title={myPrompt.reason === "trigger" ? "Activate this [Trigger]?" : "Use this effect?"}
        >
          <div className="card-row">
            {view.promptCards.map((card) => (
              <CardView key={card.uid} def={def(card)} image={art(card)} size="large" />
            ))}
          </div>
          <ul className="effect-text">
            {view.promptCards.flatMap((card) => {
              const d = def(card);
              return d ? textOf(d).map((line) => <li key={line}>{line}</li>) : [];
            })}
          </ul>
          <div className="row">
            <button
              className="primary"
              onClick={() => act({ type: "confirm", player: me, accept: true })}
            >
              Yes
            </button>
            <button onClick={() => act({ type: "confirm", player: me, accept: false })}>No</button>
          </div>
        </Modal>
      )}

      {myPrompt?.kind === "chooseOne" && (
        <Modal title="Choose one">
          <div className="card-row">
            {view.promptCards.map((card) => (
              <CardView key={card.uid} def={def(card)} image={art(card)} size="large" />
            ))}
          </div>
          <p>From {nameOf(def, view, myPrompt.source)}.</p>
          <div className="row">
            {myPrompt.labels.map((label, option) => (
              <button
                key={option}
                className={option === 0 ? "primary" : undefined}
                onClick={() => act({ type: "chooseOne", player: me, option })}
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {trashOf && (
        <Modal
          title={`${trashOf === me ? "Your" : "Opponent's"} trash`}
          onClose={() => setTrashOf(null)}
        >
          <div className="card-row wrap">
            {view.players[trashOf].trash.length === 0 && <p>Empty.</p>}
            {view.players[trashOf].trash.map((card) => (
              <CardView
                key={card.uid}
                def={def(card)}
                image={art(card)}
                size="small"
                onHover={() => setDetail(def(card) ?? null)}
              />
            ))}
          </div>
        </Modal>
      )}

      {showSound && (
        <Modal title="Sound" onClose={() => setShowSound(false)}>
          {soundPanel}
        </Modal>
      )}

      {confirmConcede && view.winner === null && (
        <Modal title="Concede this game?" onClose={() => setConfirmConcede(false)}>
          <div className="row">
            <button
              className="danger"
              onClick={() => {
                setConfirmConcede(false);
                act({ type: "concede", player: me });
              }}
            >
              Concede
            </button>
            <button onClick={() => setConfirmConcede(false)}>Keep playing</button>
          </div>
        </Modal>
      )}

      {view.winner !== null && (
        <Modal title={view.winner === me ? "Victory!" : view.winner === "draw" ? "Draw" : "Defeat"}>
          <p className={`result ${view.winner === me ? "win" : "lose"}`}>
            {game.timedOut
              ? game.timedOut === me
                ? "You ran out of time."
                : `${game.opponent === "friend" ? "Your friend" : "Your opponent"} ran out of time.`
              : view.winner === me
                ? "You knocked out the opponent's Leader."
                : view.winner === "draw"
                  ? "Both players lost at the same time."
                  : "Better luck next time."}
          </p>
          {trophies.length > 0 ? (
            <ul className="result-trophies">
              {trophies.map((id) => {
                const trophy = trophyById(id);
                return trophy ? (
                  <li key={id}>
                    <Medal tier={trophy.tier} />
                    <strong>{trophy.name}</strong>
                    <span>+{TIER_POINTS[trophy.tier]}</span>
                  </li>
                ) : null;
              })}
            </ul>
          ) : !qualifies(game.stats, game.state) ? (
            <p className="note">
              {game.timedOut === me
                ? "Games lost on time don't count toward trophies."
                : game.stats.conceded
                  ? "Conceded games don't count toward trophies."
                  : `Games count toward trophies after ${MIN_TURNS} of your own turns.`}
            </p>
          ) : null}
          <div className="row">
            {onRestart && (
              <button className="primary" onClick={onRestart}>
                Play again
              </button>
            )}
            <button className={onRestart ? "" : "primary"} onClick={onExit}>
              Main menu
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Clickable({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <div
      className="slot-click"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </div>
  );
}

type MatSide = "you" | "opponent";

/**
 * One player's side of the table, laid out like the official playmat: Life on the left, the
 * Character Area on top, the Leader in the middle with the Stage beside it, the Deck and Trash
 * on the right, and the DON!! deck and cost area along the bottom. The opponent's side is the
 * same mat turned around.
 */
function Mat({
  view,
  player,
  side,
  image,
  back,
  renderCard,
  def,
  art,
  onTrash,
  onDetail,
}: {
  view: GameView;
  player: PlayerId;
  side: MatSide;
  image: string | null;
  back: string | null;
  renderCard: (card: CardInstance) => ReactNode;
  def: DefOf;
  art: (card: CardInstance | null | undefined) => string | undefined;
  onTrash: () => void;
  onDetail: (card: Card | null) => void;
}) {
  const p = view.players[player];
  const topTrash = p.trash[0];
  const owner = side === "you" ? "Your" : "Opponent's";
  return (
    <section
      className={`mat ${side} ${image ? "custom" : ""}`}
      style={image ? { ["--mat-image" as string]: `url("${image}")` } : undefined}
      aria-label={side === "you" ? "Your side" : "Opponent's side"}
    >
      <Zone area="chars" label="Character Area">
        <div className="characters">
          {p.characters.map(renderCard)}
          {Array.from({ length: Math.max(0, 5 - p.characters.length) }, (_, i) => (
            <div key={`empty-${i}`} className="slot empty" />
          ))}
        </div>
      </Zone>
      <Zone area="leader" label="Leader">
        {renderCard(p.leader)}
      </Zone>
      <Zone area="stage" label="Stage">
        {p.stage ? renderCard(p.stage) : <div className="slot empty" />}
      </Zone>
      <Zone area="life" label={`Life ${p.lifeCount}`}>
        <div
          className="life-stack"
          aria-label={`${owner} Life: ${p.lifeCount}`}
          style={{ ["--n" as string]: Math.max(p.lifeCount, 1) }}
        >
          {Array.from({ length: p.lifeCount }, (_, i) => (
            <div key={i} className="life-card" style={{ ["--i" as string]: i }}>
              <CardView faceDown back={back} size="small" />
            </div>
          ))}
        </div>
      </Zone>
      <Zone area="deck" label={`Deck ${p.deckCount}`}>
        <div className="pile" aria-label={`${owner} deck: ${p.deckCount} cards`}>
          {p.deckCount > 0 ? <CardView faceDown back={back} /> : <div className="slot empty" />}
        </div>
      </Zone>
      <Zone area="trash" label={`Trash ${p.trash.length}`}>
        <button
          className="pile trash"
          onClick={(e) => {
            e.stopPropagation();
            onTrash();
          }}
          onMouseEnter={() => onDetail(def(topTrash) ?? null)}
          aria-label={`${owner} trash: ${p.trash.length} cards`}
        >
          {topTrash ? (
            <CardView def={def(topTrash)} image={art(topTrash)} size="small" showName={false} />
          ) : (
            <div className="slot empty small" />
          )}
        </button>
      </Zone>
      <Zone area="dondeck" label={`DON!! deck ${p.donDeck}`}>
        <div className="pile" aria-label={`${owner} DON!! deck: ${p.donDeck}`}>
          {p.donDeck > 0 ? <DonCard back /> : <div className="slot empty don" />}
        </div>
      </Zone>
      <Zone area="cost" label={`Cost Area · ${p.donActive} active, ${p.donRested} rested`}>
        <div
          className="cost-row"
          aria-label={`${owner} DON!!: ${p.donActive} active, ${p.donRested} rested`}
        >
          {Array.from({ length: p.donActive }, (_, i) => (
            <DonCard key={`a${i}`} />
          ))}
          {Array.from({ length: p.donRested }, (_, i) => (
            <DonCard key={`r${i}`} rested />
          ))}
        </div>
      </Zone>
    </section>
  );
}

function Zone({ area, label, children }: { area: string; label: string; children: ReactNode }) {
  return (
    <div className={`zone zone-${area}`}>
      <span className="zone-label">{label}</span>
      {children}
    </div>
  );
}

function StatusBar({
  view,
  me,
  def,
  mode,
  friend,
  onCancel,
  children,
}: {
  view: GameView;
  me: PlayerId;
  def: DefOf;
  mode: Mode;
  friend: boolean;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const yourTurn = view.turnPlayer === me;
  const prompt = view.prompt;
  let message = "";
  if (view.phase === "setup") message = "Getting ready…";
  else if (prompt.kind === "gameOver") message = "Game over";
  else if (mode.kind === "attack") message = "Choose what to attack.";
  else if (mode.kind === "replace") message = "Choose a Character to trash to make room.";
  else if (prompt.player !== me)
    message = friend ? "Your friend is thinking…" : "Opponent is thinking…";
  else message = YOUR_PROMPT_TEXT[prompt.kind];

  const battle = view.battle;
  const attacker = battle ? findInView(view, battle.attacker) : null;
  const target = battle ? findInView(view, battle.target) : null;

  return (
    <div className={`status ${yourTurn ? "yours" : "theirs"}`}>
      <div className="phase">
        <strong>{yourTurn ? "Your turn" : "Opponent's turn"}</strong>
        <span>
          Turn {view.turn} · {phaseName(view.phase)}
        </span>
      </div>
      {battle && attacker && target ? (
        <div className="battle">
          <span className="atk">
            {def(attacker)?.name} {view.powers[attacker.uid]}
          </span>
          <span className="vs">⚔</span>
          <span className="def">
            {def(target)?.name} {view.powers[target.uid]}
          </span>
        </div>
      ) : null}
      <div className="message">
        {message}
        {mode.kind !== "none" && (
          <button className="ghost small" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Under a minute left, a clock turns red. */
const LOW_TIME_MS = 60 * 1000;

/** Both players' game clocks. The one that's running glows; at zero, that player loses. */
function Clocks({ game, onTimeout }: { game: LocalGame; onTimeout: (player: PlayerId) => void }) {
  const [now, setNow] = useState(Date.now);
  const live = running(game.state);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [live]);

  const out = outOfTime(game, now);
  useEffect(() => {
    if (out) onTimeout(out);
  }, [out]);

  const me = game.human;
  const them = opponentOf(me);
  const friend = game.opponent === "friend";
  const clock = (player: PlayerId, label: string) => {
    const left = timeLeft(game.clock, game.state, player, now);
    const state = live === player ? "on" : "off";
    return (
      <div
        className={`clock ${state} ${left < LOW_TIME_MS ? "low" : ""}`}
        aria-label={`${label} time left: ${formatClock(left)}${live === player ? ", running" : ""}`}
      >
        <span>{label}</span>
        <strong>{formatClock(left)}</strong>
      </div>
    );
  };
  return (
    <div className="clocks" role="timer">
      {clock(them, friend ? "Friend" : "Opponent")}
      {clock(me, "You")}
    </div>
  );
}

/** Official text when the card data has it, otherwise text written from the effect data. */
function textOf(card: Card): string[] {
  return card.text === undefined ? cardText(card) : officialText(card);
}

function Detail({ card, image }: { card: Card | null; image: string | undefined }) {
  if (!card) {
    return (
      <div className="detail empty">
        <p>Point at or tap a card to read it here.</p>
      </div>
    );
  }
  const lines = textOf(card);
  return (
    <div className="detail">
      <CardView def={card} image={image} size="large" />
      <div className="detail-text">
        <h3>{card.name}</h3>
        <p className="meta">
          <span className="card-id">{card.id}</span> · {CATEGORY_NAMES[card.category]}
          {card.cost !== undefined ? ` · cost ${card.cost}` : ""}
          {card.power !== undefined ? ` · ${card.power} power` : ""}
          {card.counter ? ` · counter +${card.counter}` : ""}
          {card.life !== undefined ? ` · ${card.life} Life` : ""}
        </p>
        {card.types?.length ? <p className="types">{card.types.join(" / ")}</p> : null}
        {lines.length ? (
          <ul className="effect-text">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="meta">No effect.</p>
        )}
      </div>
    </div>
  );
}

const CATEGORY_NAMES: Record<Card["category"], string> = {
  leader: "Leader",
  character: "Character",
  event: "Event",
  stage: "Stage",
};

function Log({ game }: { game: LocalGame }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Newer browsers return a promise here, so it must not be the effect's return value.
    void end.current?.scrollIntoView({ block: "nearest" });
  }, [game.log]);
  return (
    <ol className="log" aria-label="Game log">
      {game.log.slice(-60).map((entry) => (
        <li
          key={entry.id}
          className={entry.player === game.human ? "mine" : entry.player ? "theirs" : "system"}
        >
          {entry.text}
        </li>
      ))}
      <li ref={end} className="end" />
    </ol>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        {onClose && (
          <button className="ghost close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function findInView(view: GameView, uid: string): CardInstance | null {
  for (const player of ["p1", "p2"] as const) {
    const p = view.players[player];
    const all = [
      p.leader,
      ...p.characters,
      ...(p.stage ? [p.stage] : []),
      ...p.trash,
      ...(p.hand ?? []),
    ];
    const found = all.find((c) => c.uid === uid);
    if (found) return found;
  }
  return (
    view.promptCards.find((c) => c.uid === uid) ?? (view.limbo?.uid === uid ? view.limbo : null)
  );
}

/**
 * What to do for each of your decisions. Every kind of decision needs an entry, and a way to
 * answer it on the board, or the game would wait for you with nothing to click.
 */
const YOUR_PROMPT_TEXT: Record<Exclude<GameView["prompt"]["kind"], "gameOver">, string> = {
  chooseTurnOrder: "Choose who goes first.",
  mulligan: "Keep your hand or redraw it.",
  main: "Your Main Phase: play cards, give DON!!, and attack.",
  block: "You're being attacked! Tap a glowing [Blocker], or don't block.",
  counter: "Counter Step: tap glowing cards in your hand to add power.",
  choose: "Choose cards.",
  confirm: "Use this effect?",
  chooseOne: "Choose one.",
};

function nameOf(def: DefOf, view: GameView, uid: string): string {
  return def(findInView(view, uid))?.name ?? "a card";
}

const PHASE_NAMES: Record<GameView["phase"], string> = {
  setup: "Setup",
  refresh: "Refresh Phase",
  draw: "Draw Phase",
  don: "DON!! Phase",
  main: "Main Phase",
  end: "End Phase",
  gameOver: "Game over",
};

function phaseName(phase: GameView["phase"]): string {
  return PHASE_NAMES[phase];
}
