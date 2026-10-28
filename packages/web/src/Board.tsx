import {
  legalActions,
  opponentOf,
  viewFor,
  type Action,
  type CardInstance,
  type GameView,
  type PlayerId,
} from "@strawhat/engine";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Backs, Mats } from "./App.js";
import { officialText, type Card, type CardData } from "./card-data.js";
import { CardView, DonCard, type Glow } from "./CardView.js";
import { formatClock, running, timeLeft } from "./clock.js";
import { cardText, timingTag } from "./describe.js";
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
  /** A question the menu answers, such as "Attack Nami with Luffy?". */
  title?: string;
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
  const [banner, setBanner] = useState<number | null>(null);
  const wide = useMediaQuery(WIDE);
  const [showLog, setShowLog] = useState(() => readFlag(LOG_KEY, true));
  const toggleLog = () =>
    setShowLog((open) => {
      writeFlag(LOG_KEY, !open);
      return !open;
    });

  const def: DefOf = (card) => (card ? data.catalog[card.cardId] : undefined);
  const art = (card: CardInstance | null | undefined) => data.imageUrl(def(card));
  const prompt = view.prompt;
  const myPrompt = prompt.kind !== "gameOver" && prompt.player === me ? prompt : null;
  const pickedPower = picked.reduce((sum, uid) => sum + (view.powers[uid] ?? 0), 0);
  const hand = view.players[me].hand ?? [];
  const yourTurn = view.turnPlayer === me;
  const theyAreThinking = prompt.kind !== "gameOver" && prompt.player !== me;
  const safe = view.battle ? powerNeeded(view, view.battle) === 0 : false;

  // The card whose effect is asking you to choose, and which of its effects is running.
  const running = useMemo(() => {
    if (!myPrompt || !("source" in myPrompt)) return null;
    const frame = [...game.state.stack]
      .reverse()
      .find((f) => f.kind === "effect" && f.source === myPrompt.source);
    const card =
      frame?.kind === "effect"
        ? data.catalog[frame.cardId]
        : def(findInView(view, myPrompt.source));
    if (!card) return null;
    const effect =
      frame?.kind === "effect" && !frame.rule ? card.effects?.[frame.effect] : undefined;
    return { card, tag: effect ? timingTag(effect.timing) : "" };
  }, [myPrompt, game.state.stack, view]);
  const effectBanner = running && (
    <EffectBanner
      card={running.card}
      image={data.imageUrl(running.card)}
      tag={running.tag}
      onHover={() => setDetail(running.card)}
    />
  );

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

  // A banner sweeps across the table when the turn changes, so you can't miss whose it is.
  useEffect(() => {
    if (view.phase === "setup" || view.winner !== null) return;
    setBanner(view.turn);
    const timer = setTimeout(() => setBanner(null), 1500);
    return () => clearTimeout(timer);
  }, [view.turn]);

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

    // Finishing an attack or a replacement takes priority over opening a menu, and asks first.
    const cancel = { label: "Cancel", run: () => setMode({ kind: "none" }) };
    if (mode.kind === "attack") {
      if (!attackTargets.has(uid)) return setMode({ kind: "none" });
      const attacker = findInView(view, mode.attacker);
      const action: Action = { type: "attack", player: me, attacker: mode.attacker, target: uid };
      return showMenu(uid, event, [{ label: "Attack", run: () => act(action) }, cancel], {
        title: `Attack ${d?.name ?? "this card"} (${view.powers[uid] ?? 0}) with ${
          def(attacker)?.name ?? "your card"
        } (${view.powers[mode.attacker] ?? 0})?`,
      });
    }
    if (mode.kind === "replace") {
      if (!replaceTargets.has(uid)) return setMode({ kind: "none" });
      const action: Action = { type: "playCard", player: me, card: mode.card, trash: uid };
      return showMenu(uid, event, [{ label: "Trash and play", run: () => act(action) }, cancel], {
        title: `Trash ${d?.name ?? "this card"} to make room for ${nameOf(def, view, mode.card)}?`,
      });
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

    showMenu(uid, event, items);
  }

  function showMenu(uid: string, event: MouseEvent, items: MenuItem[], extra?: { title: string }) {
    if (items.length === 0) {
      setMenu(null);
      return;
    }
    const height = 44 * items.length + 12 + (extra ? 60 : 0);
    let x = Math.max(8, Math.min(event.clientX - 90, window.innerWidth - 200));
    const above = event.clientY - height - 16;
    let y = above > 8 ? above : Math.min(event.clientY + 16, window.innerHeight - height - 8);
    // A question about a card sits beside it, so the card and the attack arrow stay in view.
    const card = extra && document.querySelector(`[data-uid="${CSS.escape(uid)}"] .card`);
    if (card) {
      const r = card.getBoundingClientRect();
      const width = 290;
      x =
        r.right + 12 + width < window.innerWidth ? r.right + 12 : Math.max(8, r.left - 12 - width);
      y = Math.max(8, Math.min(r.top, window.innerHeight - height - 8));
    }
    setMenu({ uid, x, y, items, ...extra });
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

  const statusBar = (
    <StatusBar
      view={view}
      me={me}
      def={def}
      mode={mode}
      friend={game.opponent === "friend"}
      onCancel={() => setMode({ kind: "none" })}
      defense={
        myPrompt?.kind === "counter" || myPrompt?.kind === "block" ? (
          <Defense
            view={view}
            me={me}
            def={def}
            step={myPrompt.kind}
            hasCounters={hasCounters}
            onPass={() => act({ type: "pass", player: me })}
          />
        ) : null
      }
    >
      <Clocks game={game} onTimeout={onTimeout} />
    </StatusBar>
  );

  return (
    <div className="game" onClick={() => setMenu(null)}>
      <div className="board">
        <Mat
          view={view}
          player={them}
          side="opponent"
          turn={view.turnPlayer === them && view.phase !== "setup" && view.winner === null}
          image={mats.opponent}
          back={backs.opponent}
          renderCard={(card) => (
            <Clickable key={card.uid} uid={card.uid} onClick={(e) => openMenu(card.uid, e)}>
              {fieldCard(card, them)}
            </Clickable>
          )}
          def={def}
          art={art}
          onTrash={() => setTrashOf(them)}
          onDetail={setDetail}
        />
        <div className="opponent-info">
          <div
            className="opponent-hand"
            aria-label={`Opponent's hand: ${view.players[them].handCount} cards`}
          >
            {Array.from({ length: view.players[them].handCount }, (_, i) => (
              <CardView key={i} faceDown back={backs.opponent} size="small" />
            ))}
          </div>
          <span className="hand-count" aria-hidden="true">
            {view.players[them].handCount} in hand
          </span>
          {theyAreThinking && (
            <Thinking className="pill">
              {game.opponent === "friend" ? "Your friend is thinking" : "Opponent is thinking"}
            </Thinking>
          )}
        </div>

        {!wide && statusBar}
        {notice && (
          <p className="table-notice" role="status">
            {notice}
          </p>
        )}

        <Mat
          view={view}
          player={me}
          side="you"
          turn={view.turnPlayer === me && view.phase !== "setup" && view.winner === null}
          image={mats.you}
          back={backs.you}
          renderCard={(card) => (
            <Clickable key={card.uid} uid={card.uid} onClick={(e) => openMenu(card.uid, e)}>
              {fieldCard(card, me)}
            </Clickable>
          )}
          def={def}
          art={art}
          onTrash={() => setTrashOf(me)}
          onDetail={setDetail}
        />

        <HandTray
          raised={myPrompt?.kind === "counter" || hand.some((card) => card.uid === menu?.uid)}
        >
          {hand.map((card, i) => {
            const counter = myPrompt?.kind === "counter" ? byCard.get(card.uid) : undefined;
            return (
              <Clickable
                key={card.uid}
                uid={card.uid}
                style={fan(i, hand.length)}
                onClick={(e) => openMenu(card.uid, e)}
              >
                <CardView
                  def={def(card)}
                  image={art(card)}
                  glow={glowFor(card.uid)}
                  dim={!byCard.has(card.uid) && myPrompt?.kind === "counter"}
                  onHover={() => setDetail(def(card) ?? null)}
                />
                {counter && (
                  <span className="counter-tag">
                    {counter.some((a) => a.type === "counter")
                      ? `+${def(card)?.counter ?? 0}`
                      : "Event"}
                  </span>
                )}
              </Clickable>
            );
          })}
        </HandTray>
      </div>

      {mode.kind === "attack" ? (
        <AttackArrow from={mode.attacker} to={menu?.uid} targets={attackTargets} />
      ) : view.battle ? (
        <AttackArrow from={view.battle.attacker} to={view.battle.target} />
      ) : null}

      {myPrompt?.kind === "counter" || myPrompt?.kind === "block" ? (
        <div className="danger-edge" aria-hidden="true" />
      ) : null}

      {banner !== null && (
        <div key={banner} className={`turn-banner ${yourTurn ? "yours" : "theirs"}`} role="status">
          <span>
            {yourTurn
              ? "Your turn"
              : game.opponent === "friend"
                ? "Friend's turn"
                : "Opponent's turn"}
          </span>
        </div>
      )}

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
              {!hasCounters ? "No counters…" : safe ? "Done countering" : "Take the hit"}
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
        {wide && statusBar}
        <Detail card={detail} image={data.imageUrl(detail ?? undefined)} />
        <Log game={game} open={showLog} onToggle={toggleLog} />
      </aside>

      {menu && (
        <div
          className="menu-pop"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label={menu.title}
        >
          {menu.title && <p className="menu-title">{menu.title}</p>}
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
        <Modal title={CHOOSE_TEXT[myPrompt.reason] ?? "Choose cards"} banner={effectBanner}>
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
          {myPrompt.max > 0 && (
            <p className={`choose-question ${picked.length ? "" : "empty"}`} role="status">
              {picked.length === 0
                ? myPrompt.min === 0
                  ? "Nothing selected. Tap a glowing card to select it, or choose none."
                  : "Tap a glowing card to select it."
                : chooseVerb(
                    myPrompt.reason,
                    data.catalog[findInView(view, myPrompt.source)?.cardId ?? ""],
                  ).ask(
                    myPrompt.hidden
                      ? `${picked.length} face-down card${picked.length > 1 ? "s" : ""}`
                      : listNames(picked.map((uid) => nameOf(def, view, uid))),
                  )}
            </p>
          )}
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
                  : `Yes, ${chooseVerb(myPrompt.reason, data.catalog[findInView(view, myPrompt.source)?.cardId ?? ""]).button.toLowerCase()}`}
            </button>
            {picked.length > 0 && myPrompt.max > 0 && (
              <button onClick={() => setPicked([])}>Clear selection</button>
            )}
          </div>
        </Modal>
      )}

      {myPrompt?.kind === "confirm" && (
        <Modal
          title={myPrompt.reason === "trigger" ? "Activate this [Trigger]?" : "Use this effect?"}
        >
          <div className="card-row">
            {view.promptCards.map((card) => (
              <CardView
                key={card.uid}
                def={def(card)}
                image={art(card)}
                size="large"
                onHover={() => setDetail(def(card) ?? null)}
              />
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
        <Modal title="Choose one" banner={effectBanner}>
          <div className="card-row">
            {view.promptCards.map((card) => (
              <CardView
                key={card.uid}
                def={def(card)}
                image={art(card)}
                size="large"
                onHover={() => setDetail(def(card) ?? null)}
              />
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

/** The wide-screen layout in styles.css, where the turn panel sits in the side bar. */
const WIDE = "(min-width: 1000px) and (min-aspect-ratio: 7/5)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setMatches(list.matches);
    change();
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}

const LOG_KEY = "strawhat.showMoves";

/** A remembered on/off choice in this browser. Private windows may block storage; then it resets. */
function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Not remembered, which is fine.
  }
}

function Clickable({
  children,
  uid,
  style,
  onClick,
}: {
  children: ReactNode;
  /** The card's id, so an attack arrow can find it on the screen. */
  uid?: string;
  style?: CSSProperties;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <div
      className="slot-click"
      data-uid={uid}
      style={style}
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
  turn,
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
  /** Whether it's this player's turn: their mat lights up. */
  turn: boolean;
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
      className={`mat ${side} ${image ? "custom" : ""} ${turn ? "turn" : ""}`}
      style={image ? { ["--mat-image" as string]: `url("${image}")` } : undefined}
      aria-label={side === "you" ? "Your side" : "Opponent's side"}
    >
      {turn && (
        <div className="turn-tag" aria-hidden="true">
          <strong>{side === "you" ? "Your turn" : "Their turn"}</strong>
          <span>{phaseName(view.phase)}</span>
        </div>
      )}
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
  defense,
  children,
}: {
  view: GameView;
  me: PlayerId;
  def: DefOf;
  mode: Mode;
  friend: boolean;
  onCancel: () => void;
  /** Takes the message's place while you're being attacked. */
  defense?: ReactNode;
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
    message = friend ? "Your friend is thinking" : "Opponent is thinking";
  else message = YOUR_PROMPT_TEXT[prompt.kind];
  const thinking = prompt.kind !== "gameOver" && prompt.player !== me && mode.kind === "none";

  const battle = view.battle;
  const attacker = battle ? findInView(view, battle.attacker) : null;
  const target = battle ? findInView(view, battle.target) : null;

  return (
    <div className={`status ${yourTurn ? "yours" : "theirs"} ${defense ? "under-attack" : ""}`}>
      <div className="phase">
        <strong>{yourTurn ? "Your turn" : "Opponent's turn"}</strong>
        <span>
          Turn {view.turn} · {phaseName(view.phase)}
        </span>
      </div>
      {defense ??
        (battle && attacker && target ? (
          <div className="battle">
            <span className="atk">
              {def(attacker)?.name} {view.powers[attacker.uid]}
            </span>
            <span className="vs">⚔</span>
            <span className="def">
              {def(target)?.name} {view.powers[target.uid]}
            </span>
          </div>
        ) : null)}
      {!defense && (
        <div className="message">
          {thinking ? <Thinking>{message}</Thinking> : message}
          {mode.kind !== "none" && (
            <button className="ghost small" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The power your card still needs to survive the attack, in whole thousands: the attack wins on
 * equal power (rule 7-1-4-1), so the defender must end up higher. 0 means it's safe already.
 */
function powerNeeded(view: GameView, battle: NonNullable<GameView["battle"]>): number {
  const attack = view.powers[battle.attacker] ?? 0;
  const defense = view.powers[battle.target] ?? 0;
  return attack < defense ? 0 : Math.ceil((attack - defense + 1) / 1000) * 1000;
}

/**
 * The decision when you're attacked, spelled out: who hits what, how much power you're short,
 * what happens if the attack lands, and the one button that lets it through.
 */
function Defense({
  view,
  me,
  def,
  step,
  hasCounters,
  onPass,
}: {
  view: GameView;
  me: PlayerId;
  def: DefOf;
  step: "counter" | "block";
  hasCounters: boolean;
  onPass: () => void;
}) {
  const battle = view.battle;
  const attacker = battle ? findInView(view, battle.attacker) : null;
  const target = battle ? findInView(view, battle.target) : null;
  if (!battle || !attacker || !target) return null;
  const need = powerNeeded(view, battle);
  const leader = target.uid === view.players[me].leader.uid;
  const life = view.players[me].lifeCount;
  const targetName = def(target)?.name ?? "card";
  const hit = leader
    ? life === 0
      ? "If it hits, you lose the game!"
      : def(attacker)?.keywords?.includes("doubleAttack")
        ? "If it hits, you take 2 damage ([Double Attack])."
        : "If it hits, you take 1 damage (lose 1 Life)."
    : `If it hits, your ${targetName} is K.O.'d.`;
  return (
    <div className="defense" role="alert">
      <strong className="defense-title">You're being attacked!</strong>
      <div className="defense-fight">
        <span className="atk">
          {def(attacker)?.name ?? "Attacker"} <b>{view.powers[attacker.uid]}</b>
        </span>
        <span className="defense-arrow" aria-label="attacks">
          ➜
        </span>
        <span className="def">
          {leader ? "Your Leader" : "Your"} {targetName} <b>{view.powers[target.uid]}</b>
        </span>
      </div>
      <p className={need ? "defense-need" : "defense-safe"}>
        {need ? `You need +${need} power to survive.` : "Safe! Your card has more power."}
      </p>
      {need > 0 && <p className="defense-hit">{hit}</p>}
      <p className="defense-how">
        {step === "block"
          ? "Tap a glowing [Blocker] to take the hit in its place, or don't block."
          : hasCounters
            ? "Tap a glowing card in your hand to add its counter power."
            : "You have no counter cards, so the attack goes through…"}
      </p>
      {(step === "block" || hasCounters) && (
        <button className={need ? "danger" : "primary"} onClick={onPass}>
          {step === "block" ? "Don't block" : need ? "Take the hit" : "Done countering"}
        </button>
      )}
    </div>
  );
}

/** "Thinking" with three dots that bounce, while the other player decides. */
function Thinking({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`thinking ${className}`} role="status">
      {children}
      <span className="dots" aria-hidden="true">
        <i>.</i>
        <i>.</i>
        <i>.</i>
      </span>
    </span>
  );
}

/**
 * Your hand, held along the bottom of the screen like real cards: fanned and partly hidden until
 * you point at it. The card you point at lifts and grows, and the mouse wheel scrolls a long hand.
 */
function HandTray({ raised, children }: { raised: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  return (
    <div className={`hand-tray ${raised ? "raised" : ""}`}>
      <div ref={ref} className="hand" aria-label="Your hand">
        {children}
      </div>
    </div>
  );
}

/** Each card's tilt and drop in the fan: the middle card stands straight, the ends lean out. */
function fan(index: number, count: number): CSSProperties {
  const offset = index - (count - 1) / 2;
  const step = Math.min(4, 30 / Math.max(count, 1));
  return {
    ["--tilt" as string]: `${(offset * step).toFixed(2)}deg`,
    ["--drop" as string]: (offset * offset * Math.min(1, 6 / Math.max(count, 1))).toFixed(2),
  };
}

interface Point {
  x: number;
  y: number;
}

function cardCenter(uid: string): Point | null {
  const slot = document.querySelector(`[data-uid="${CSS.escape(uid)}"]`);
  const el = slot?.querySelector(".card") ?? slot;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * An arrow over the table from the attacking card to its target. While you choose a target it
 * follows the pointer, and snaps to a card you can attack when you point at one.
 */
function AttackArrow({
  from,
  to,
  targets,
}: {
  from: string;
  to?: string | undefined;
  targets?: Set<string>;
}) {
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  useEffect(() => {
    let pointer: Point | null = null;
    let hovered: string | null = null;
    const move = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      const uid = (e.target as Element | null)?.closest?.("[data-uid]")?.getAttribute("data-uid");
      hovered = uid && targets?.has(uid) ? uid : null;
    };
    window.addEventListener("pointermove", move);
    let frame = 0;
    // Cards move (resting, resizing), so the ends are measured again every frame.
    const tick = () => {
      const a = cardCenter(from);
      const end = to ?? hovered;
      const b = end ? cardCenter(end) : pointer;
      setLine((prev) => {
        if (!a || !b) return null;
        const same =
          prev &&
          Math.abs(prev.a.x - a.x) < 0.5 &&
          Math.abs(prev.a.y - a.y) < 0.5 &&
          Math.abs(prev.b.x - b.x) < 0.5 &&
          Math.abs(prev.b.y - b.y) < 0.5;
        return same ? prev : { a, b };
      });
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, [from, to, targets]);

  if (!line) return null;
  const { a, b } = line;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 20) return null;
  // Bend the arrow a little to one side, so it reads as a throw rather than a ruler line.
  const bend = Math.min(80, length * 0.18);
  const cx = (a.x + b.x) / 2 + (-dy / length) * bend;
  const cy = (a.y + b.y) / 2 + (dx / length) * bend;
  const path = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  return (
    <svg className={`attack-arrow ${to ? "locked" : "aiming"}`} aria-hidden="true">
      <defs>
        <marker
          id="arrow-head"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff4d6d" />
        </marker>
        <linearGradient
          id="arrow-fade"
          gradientUnits="userSpaceOnUse"
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
        >
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff4d6d" />
        </linearGradient>
      </defs>
      <path className="arrow-glow" d={path} />
      <path
        className="arrow-line"
        d={path}
        stroke="url(#arrow-fade)"
        markerEnd="url(#arrow-head)"
      />
      <path className="arrow-flow" d={path} />
      <circle className="arrow-start" cx={a.x} cy={a.y} r="7" />
    </svg>
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

/**
 * The card whose effect is running, across the top of a pop-up, so you can read what you're
 * choosing for. The effect that is running right now is lit up.
 */
function EffectBanner({
  card,
  image,
  tag,
  onHover,
}: {
  card: Card;
  image: string | undefined;
  /** The running effect's tag, e.g. "[On Play]"; empty when it can't be told apart. */
  tag: string;
  onHover: () => void;
}) {
  // Official text sometimes runs two effects together ("...power.[On Play] ..."); split them.
  const lines = textOf(card).flatMap((line) => line.split(/(?<=[.)])(?=\[)/));
  const lit = tag ? lines.findIndex((line) => line.includes(tag)) : -1;
  return (
    <div className="effect-banner" aria-label={`Effect of ${card.name}`}>
      <CardView def={card} image={image} size="small" showName={false} onHover={onHover} />
      <div className="effect-banner-text">
        <p className="effect-source">
          <strong>{card.name}</strong> <span className="card-id">{card.id}</span>
        </p>
        {lines.length ? (
          <ul className="effect-text">
            {lines.map((line, i) => (
              <li key={i} className={i === lit ? "running" : undefined}>
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No effect text.</p>
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

/** The list of moves so far, which folds away to a single button to give the table more room. */
function Log({ game, open, onToggle }: { game: LocalGame; open: boolean; onToggle: () => void }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Newer browsers return a promise here, so it must not be the effect's return value.
    void end.current?.scrollIntoView({ block: "nearest" });
  }, [game.log, open]);
  const toggle = (
    <button className="ghost small log-toggle" onClick={onToggle} aria-expanded={open}>
      {open ? "Hide moves ▾" : `Show moves (${game.log.length}) ▸`}
    </button>
  );
  if (!open) return toggle;
  return (
    <>
      {toggle}
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
    </>
  );
}

function Modal({
  title,
  banner,
  children,
  onClose,
}: {
  title: string;
  /** Shown across the top, above the title: the effect the pop-up is for. */
  banner?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {banner}
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

interface Verb {
  /** The question asked once cards are selected, e.g. "Add Nami to your hand?". */
  ask: (names: string) => string;
  /** The button that answers yes, e.g. "Add to hand". */
  button: string;
}

const verb = (button: string, ask: (names: string) => string): Verb => ({ button, ask });

/** What a choice does, in words, so the confirmation can say it. */
const CHOOSE_VERBS: Record<string, Verb> = {
  ko: verb("K.O.", (n) => `K.O. ${n}?`),
  rest: verb("Rest", (n) => `Rest ${n}?`),
  setActive: verb("Set active", (n) => `Set ${n} as active?`),
  returnToHand: verb("Return to hand", (n) => `Return ${n} to the owner's hand?`),
  returnToDeckBottom: verb("Place at bottom", (n) => `Place ${n} at the bottom of the deck?`),
  powerUp: verb("Give power", (n) => `Give the power to ${n}?`),
  grantKeyword: verb("Give ability", (n) => `Give the ability to ${n}?`),
  noBlockers: verb("Choose", (n) => `Make ${n} unable to be blocked?`),
  giveRestedDon: verb("Give DON!!", (n) => `Give the DON!! to ${n}?`),
  giveDon: verb("Give DON!!", (n) => `Give the DON!! to ${n}?`),
  trashFromHand: verb("Trash", (n) => `Trash ${n} from your hand?`),
  trashCharacter: verb("Trash", (n) => `Trash ${n}?`),
  playFromHand: verb("Play", (n) => `Play ${n}?`),
  playFromTrash: verb("Play", (n) => `Play ${n} from your trash?`),
  lifeToHand: verb("Add to hand", (n) => `Add ${n} to your hand?`),
};

const SEARCH_VERBS: Record<string, Verb> = {
  hand: verb("Add to hand", (n) => `Add ${n} to your hand?`),
  play: verb("Play", (n) => `Play ${n}?`),
  life: verb("Add to Life", (n) => `Add ${n} to the top of your Life?`),
  lifeFaceUp: verb("Add to Life", (n) => `Add ${n} face-up to the top of your Life?`),
  trash: verb("Trash", (n) => `Trash ${n}?`),
};

/** The verb for a choice. A deck search says where its card goes, read from the source card. */
function chooseVerb(reason: string, source: Card | undefined): Verb {
  if (reason === "searchDeck") {
    const step = (source?.effects ?? []).flatMap((e) => e.steps).find((s) => s.do === "searchDeck");
    const to = step?.do === "searchDeck" ? (step.play ? "play" : (step.to ?? "hand")) : "hand";
    return SEARCH_VERBS[to] ?? SEARCH_VERBS.hand!;
  }
  return CHOOSE_VERBS[reason] ?? verb("Choose", (n) => `Choose ${n}?`);
}

/** "Nami", "Nami and Zoro", "Nami, Zoro and Usopp". */
function listNames(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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
