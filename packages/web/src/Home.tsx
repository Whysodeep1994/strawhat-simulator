import { setOf } from "@strawhat/engine";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { setLabel, type CardData, type PlayableDeck } from "./card-data.js";
import { moveHighlight } from "./menu.js";
import { cardList, playable, problemsOf, type SavedDeck } from "./my-decks.js";
import { matImage, presetImage } from "./mat-art.js";
import {
  isUpload,
  MAT_PRESETS,
  presetChoice,
  presetOf,
  readMatImage,
  type MatSeat,
} from "./playmat.js";
import {
  pointsOf,
  progressOf,
  TIER_POINTS,
  TOTAL_POINTS,
  TROPHIES,
  MIN_TURNS,
  type TrophyProgress,
} from "./trophies.js";
import { Medal } from "./TrophyToasts.js";

export type Screen = "title" | "play" | "develop" | "friend" | "decks" | "trophies" | "settings";

export const RANDOM = "random";

interface MenuItem {
  /** Where it leads; none for a menu item that isn't built yet. */
  screen?: Exclude<Screen, "title">;
  label: string;
  hint: string;
  disabled?: boolean;
}

/** The title screen: a game-style menu you can click or drive with the arrow keys and Enter. */
export function TitleMenu({
  ready,
  deckCount,
  progress,
  onPick,
}: {
  /** False while the cards are loading: only Settings can be opened. */
  ready: boolean;
  deckCount: number;
  progress: TrophyProgress;
  onPick: (screen: Exclude<Screen, "title">) => void;
}) {
  const items: MenuItem[] = [
    {
      screen: "play",
      label: "Play",
      hint: "Duel the computer with one of your decks or a Quick deck.",
      disabled: !ready,
    },
    {
      screen: "develop",
      label: "Player Development",
      hint: "New to the game? Learn it in a guided match. Getting good? Sharpen up in Pro Drills.",
      disabled: !ready,
    },
    {
      screen: "friend",
      label: "Play a Friend",
      hint: "Play a friend online. One of you makes a game and sends the other its code.",
      disabled: !ready,
    },
    {
      screen: "decks",
      label: "Deck Builder",
      hint:
        deckCount > 0
          ? `Build, edit and save your decks. You have ${deckCount} saved.`
          : "Build and save your own decks from every card in the game.",
      disabled: !ready,
    },
    {
      screen: "trophies",
      label: "Trophies",
      hint: `${Object.keys(progress.earned).length} of ${TROPHIES.length} earned · ${pointsOf(progress)} / ${TOTAL_POINTS} points.`,
    },
    { screen: "settings", label: "Settings", hint: "Playmats, card backs, music and sound." },
  ];
  const enabled = items.map((item) => !item.disabled);
  const [current, setCurrent] = useState(() => Math.max(0, enabled.indexOf(true)));
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // When the cards finish loading, Play becomes the highlighted choice.
  useEffect(() => {
    if (ready) setCurrent(0);
  }, [ready]);

  useEffect(() => {
    buttons.current[current]?.focus({ preventScroll: true });
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrent((i) => moveHighlight(enabled, i, e.key === "ArrowDown" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <nav className="title-menu" aria-label="Main menu">
      <ul>
        {items.map((item, i) => (
          <li key={item.label}>
            <button
              ref={(el) => {
                buttons.current[i] = el;
              }}
              className={`menu-item ${i === current ? "current" : ""}`}
              disabled={item.disabled}
              onClick={() => item.screen && onPick(item.screen)}
              onMouseEnter={() => !item.disabled && setCurrent(i)}
              onFocus={() => setCurrent(i)}
            >
              <span className="menu-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="menu-hint" aria-live="polite">
        {items[current]?.hint}
      </p>
    </nav>
  );
}

/** A screen under the title menu: a Back button, a heading and its panels. */
export function SubScreen({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sub-screen">
      <header className="sub-head">
        <button className="ghost" onClick={onBack} aria-label="Back to the main menu">
          ← Back
        </button>
        <h1>{title}</h1>
      </header>
      {children}
    </div>
  );
}

type Source = "mine" | "quick";

/** The player's own decks that are ready to play. */
export function readyDecks(myDecks: SavedDeck[], data: CardData): PlayableDeck[] {
  return myDecks.flatMap((d) => {
    const deck = playable(d, data);
    return deck ? [deck] : [];
  });
}

/** Choose your deck: one of yours, or a Quick deck. */
export function DeckChooser({
  data,
  myDecks,
  deckId,
  onDeck,
  onBuild,
}: {
  data: CardData;
  myDecks: SavedDeck[];
  deckId: string | null;
  onDeck: (id: string) => void;
  onBuild: () => void;
}) {
  const mine = readyDecks(myDecks, data);
  const unready = myDecks.length - mine.length;
  const quick = data.decks;
  const [source, setSource] = useState<Source>(() =>
    mine.some((d) => d.id === deckId) || (mine.length > 0 && !quick.some((d) => d.id === deckId))
      ? "mine"
      : "quick",
  );
  const list = source === "mine" ? mine : quick;
  const chosen = list.find((d) => d.id === deckId);

  const pickSource = (next: Source) => {
    setSource(next);
    const first = next === "mine" ? mine[0] : (quick.find((d) => d.official) ?? quick[0]);
    if (first) onDeck(first.id);
  };

  return (
    <section className="panel" aria-labelledby="your-deck">
      <h2 id="your-deck">Your deck</h2>
      <div className="tabs" role="group" aria-label="Which decks">
        <button
          className={source === "mine" ? "on" : ""}
          aria-pressed={source === "mine"}
          onClick={() => pickSource("mine")}
        >
          My decks <span className="count">{mine.length}</span>
        </button>
        <button
          className={source === "quick" ? "on" : ""}
          aria-pressed={source === "quick"}
          onClick={() => pickSource("quick")}
        >
          Quick decks <span className="count">{quick.length}</span>
        </button>
      </div>

      {source === "mine" && mine.length === 0 ? (
        <div className="empty-decks">
          <p>
            {unready > 0
              ? `None of your ${unready} saved decks are ready to play yet. Open them in the Deck Builder to see what to fix.`
              : "You haven't built a deck yet. Build one, or play a Quick deck while you get started."}
          </p>
          <div className="row">
            <button className="primary" onClick={onBuild}>
              Open the Deck Builder
            </button>
            <button onClick={() => pickSource("quick")}>Use a Quick deck</button>
          </div>
        </div>
      ) : (
        <>
          <label className="field">
            <span>
              {source === "mine" ? "Choose one of your decks" : "Choose a ready-made deck"}
            </span>
            <select
              value={chosen?.id ?? ""}
              onChange={(e) => onDeck(e.target.value)}
              aria-label="Your deck"
            >
              {!chosen && <option value="">Choose a deck…</option>}
              {source === "mine" ? (
                mine.map((deck) => <DeckOption key={deck.id} deck={deck} data={data} />)
              ) : (
                <QuickOptions decks={quick} data={data} />
              )}
            </select>
          </label>
          {chosen && <DeckPreview deck={chosen} data={data} />}
          {source === "mine" && unready > 0 && (
            <p className="note">
              {unready} more {unready === 1 ? "deck needs" : "decks need"} fixing in the Deck
              Builder before {unready === 1 ? "it" : "they"} can be played.
            </p>
          )}
          {source === "quick" && (
            <p className="note">
              Quick decks are official starter decks, played as printed. A practice deck stands in
              for sets whose official list isn't added yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Choose your deck (one of yours, or a Quick deck) and the computer's, then start. */
export function PlaySetup({
  data,
  myDecks,
  deckId,
  opponentId,
  onDeck,
  onOpponent,
  onStart,
  onBuild,
}: {
  data: CardData;
  myDecks: SavedDeck[];
  deckId: string | null;
  opponentId: string;
  onDeck: (id: string) => void;
  onOpponent: (id: string) => void;
  onStart: () => void;
  onBuild: () => void;
}) {
  const mine = readyDecks(myDecks, data);
  const quick = data.decks;
  const chosen = [...mine, ...quick].find((d) => d.id === deckId);

  return (
    <div className="home-grid">
      <DeckChooser
        data={data}
        myDecks={myDecks}
        deckId={deckId}
        onDeck={onDeck}
        onBuild={onBuild}
      />

      <aside className="home-side">
        <section className="panel">
          <h2>Opponent</h2>
          <label className="field">
            <span>The computer plays</span>
            <select value={opponentId} onChange={(e) => onOpponent(e.target.value)}>
              <option value={RANDOM}>A random Quick deck</option>
              {mine.length > 0 && (
                <optgroup label="My decks">
                  {mine.map((deck) => (
                    <DeckOption key={deck.id} deck={deck} data={data} />
                  ))}
                </optgroup>
              )}
              <QuickOptions decks={quick} data={data} />
            </select>
          </label>
        </section>
        <button className="primary big" onClick={onStart} disabled={!chosen}>
          Set sail!
        </button>
      </aside>
    </div>
  );
}

function DeckOption({ deck, data }: { deck: PlayableDeck; data: CardData }) {
  return (
    <option value={deck.id}>
      {deckTitle(deck, data)} · {deckSubtitle(deck)}
    </option>
  );
}

/** Quick decks in a dropdown: the official starters first, then the practice decks. */
function QuickOptions({ decks, data }: { decks: PlayableDeck[]; data: CardData }) {
  const official = decks.filter((d) => d.official);
  const practice = decks.filter((d) => !d.official);
  return (
    <>
      <optgroup label="Official starter decks">
        {official.map((deck) => (
          <DeckOption key={deck.id} deck={deck} data={data} />
        ))}
      </optgroup>
      {practice.length > 0 && (
        <optgroup label="Practice decks">
          {practice.map((deck) => (
            <DeckOption key={deck.id} deck={deck} data={data} />
          ))}
        </optgroup>
      )}
    </>
  );
}

/** The chosen deck, shown big: its Leader's art, name and colours. */
function DeckPreview({ deck, data }: { deck: PlayableDeck; data: CardData }) {
  const leader = data.catalog[deck.leader];
  const art = data.imageUrl(leader);
  const colors = leader?.colors ?? [];
  return (
    <div
      className="deck-preview"
      style={{
        ["--deck-color" as string]: `var(--c-${colors[0] ?? "black"})`,
        ["--deck-color-2" as string]: `var(--c-${colors[1] ?? colors[0] ?? "black"})`,
      }}
    >
      <span className="deck-preview-art">
        {art ? <img src={art} alt="" draggable={false} /> : null}
      </span>
      <span className="deck-preview-info">
        <span className={`badge static ${deck.mine || deck.official ? "official" : "practice"}`}>
          {deck.mine ? "Mine" : deck.official ? "Official" : "Practice"}
        </span>
        <strong>{deckTitle(deck, data)}</strong>
        <span>{deckSubtitle(deck)}</span>
        <span>
          {colors.map((c) => c[0]!.toUpperCase() + c.slice(1)).join(" / ")} · Life{" "}
          {leader?.life ?? "?"} · {deck.deck.length} cards
        </span>
      </span>
    </div>
  );
}

/** Every deck you've saved: open one to edit it, start a new one, or copy a Quick deck. */
export function MyDecksScreen({
  data,
  myDecks,
  saveFailed,
  onEdit,
  onNew,
  onCopy,
}: {
  data: CardData;
  myDecks: SavedDeck[];
  saveFailed: boolean;
  onEdit: (id: string) => void;
  onNew: () => void;
  onCopy: (deck: PlayableDeck) => void;
}) {
  const [copyId, setCopyId] = useState("");
  const toCopy = data.decks.find((d) => d.id === copyId);
  return (
    <section className="panel decks" aria-labelledby="deck-heading">
      <div className="panel-head">
        <h2 id="deck-heading">My decks</h2>
        <span className="count">Standard format</span>
      </div>
      <div className="deck-grid">
        <button className="deck-tile new-deck" onClick={onNew}>
          <span className="plus" aria-hidden="true">
            +
          </span>
          <span className="deck-info">
            <strong>Build a deck</strong>
            <span>Search every card and save your own</span>
          </span>
        </button>
        {myDecks.map((saved) => (
          <MyDeckTile
            key={saved.id}
            saved={saved}
            data={data}
            problems={playable(saved, data) ? 0 : problemsOf(saved, data).length}
            onEdit={() => onEdit(saved.id)}
          />
        ))}
      </div>
      {saveFailed && (
        <p className="note">This browser isn't letting us save decks (private mode?).</p>
      )}

      <div className="panel-head">
        <h2>Start from a Quick deck</h2>
      </div>
      <div className="copy-row">
        <select value={copyId} onChange={(e) => setCopyId(e.target.value)} aria-label="Quick deck">
          <option value="">Choose a Quick deck to copy…</option>
          <QuickOptions decks={data.decks} data={data} />
        </select>
        <button disabled={!toCopy} onClick={() => toCopy && onCopy(toCopy)}>
          Copy and edit
        </button>
      </div>
      <p className="note">
        Makes a copy in My decks that you can change. Some starter cards have rotated out of
        Standard, so the Deck Builder will show you what to swap.
      </p>
    </section>
  );
}

export function deckTitle(deck: PlayableDeck, data: CardData): string {
  return data.catalog[deck.leader]?.name ?? deck.name;
}

function deckSubtitle(deck: PlayableDeck): string {
  if (deck.mine) return deck.name;
  return deck.official ? deck.name : `${setLabel(setOf(deck.leader))} practice`;
}

function MyDeckTile({
  saved,
  data,
  problems,
  onEdit,
}: {
  saved: SavedDeck;
  data: CardData;
  problems: number;
  onEdit: () => void;
}) {
  const leader = saved.leader ? data.catalog[saved.leader] : undefined;
  const art = data.imageUrl(leader);
  const colors = leader?.colors ?? [];
  const count = cardList(saved).length;
  return (
    <button
      className={`deck-tile ${problems ? "unready" : ""}`}
      onClick={onEdit}
      aria-label={`Edit ${saved.name}`}
      style={{
        ["--deck-color" as string]: `var(--c-${colors[0] ?? "black"})`,
        ["--deck-color-2" as string]: `var(--c-${colors[1] ?? colors[0] ?? "black"})`,
      }}
    >
      <span className="deck-art">
        {art ? <img src={art} alt="" loading="lazy" draggable={false} /> : null}
      </span>
      <span className="deck-info">
        <strong>{saved.name}</strong>
        <span>
          {leader?.name ?? "No Leader yet"} · {count}/50
        </span>
      </span>
      <span className={`badge ${problems ? "practice" : "official"}`}>
        {problems ? `${problems} to fix` : "Ready"}
      </span>
    </button>
  );
}

export function MatPicker({
  seat,
  label,
  choice,
  onChange,
}: {
  seat: MatSeat;
  label: string;
  /** The saved choice: a ready-made mat, an uploaded picture, or null for the default. */
  choice: string | null;
  /** Returns false when the choice can't be kept for next time. */
  onChange: (choice: string | null) => boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const image = matImage(choice);
  const preset = presetOf(choice);
  const name = preset
    ? MAT_PRESETS.find((p) => p.id === preset)?.name
    : isUpload(choice)
      ? "your picture"
      : "the default mat";

  function pick(next: string | null) {
    const saved = onChange(next);
    setMessage(saved ? null : "Using it for now, but this browser won't keep it for next time.");
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      pick(await readMatImage(file));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mat-picker">
      <div className="mat-picker-head">
        <div
          className={`mat-preview ${seat} ${image ? "custom" : ""}`}
          style={image ? { backgroundImage: `url("${image}")` } : undefined}
          aria-label={`${label}: ${name}`}
          role="img"
        />
        <div className="mat-picker-text">
          <strong>{label}</strong>
          <span className="note">{name}</span>
          <div className="row">
            <label className="button small">
              Upload image
              <input type="file" accept="image/*" onChange={(e) => void upload(e)} />
            </label>
            {choice && (
              <button className="ghost small" onClick={() => pick(null)}>
                Use default
              </button>
            )}
          </div>
          {message && <p className="note">{message}</p>}
        </div>
      </div>
      <div className="mat-presets" role="radiogroup" aria-label={`${label}: ready-made mats`}>
        {MAT_PRESETS.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={preset === p.id}
            className={`mat-preset ${preset === p.id ? "chosen" : ""}`}
            onClick={() => pick(presetChoice(p.id))}
          >
            <span
              className="mat-preset-art"
              style={{ backgroundImage: `url("${presetImage(p.id) ?? ""}")` }}
            />
            <span className="mat-preset-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TIER_NAME = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };

/** Every trophy: earned ones lit up with their date, locked ones greyed with any progress. */
export function TrophiesScreen({ progress }: { progress: TrophyProgress }) {
  const points = pointsOf(progress);
  const earned = TROPHIES.filter((t) => progress.earned[t.id]).length;
  return (
    <section className="panel" aria-labelledby="trophy-heading">
      <div className="trophy-summary">
        <div>
          <h2 id="trophy-heading">Your trophies</h2>
          <p className="trophy-score">
            <strong>{points}</strong> / {TOTAL_POINTS} points · {earned} of {TROPHIES.length} earned
          </p>
        </div>
        <div className="meter" role="img" aria-label={`${points} of ${TOTAL_POINTS} points`}>
          <span style={{ width: `${(points / TOTAL_POINTS) * 100}%` }} />
        </div>
      </div>
      <p className="note">
        A game counts once you've taken at least {MIN_TURNS} of your own turns and played it to the
        end without conceding. Trophies are saved in this browser.
      </p>
      <ul className="trophy-list">
        {TROPHIES.map((trophy) => {
          const when = progress.earned[trophy.id];
          const count = when ? null : progressOf(trophy, progress);
          return (
            <li key={trophy.id} className={`trophy ${when ? "earned" : "locked"}`}>
              <Medal tier={trophy.tier} locked={!when} />
              <div className="trophy-text">
                <strong>{trophy.name}</strong>
                <span>{trophy.text}</span>
                {when ? (
                  <span className="trophy-when">Earned {new Date(when).toLocaleDateString()}</span>
                ) : count ? (
                  <span className="trophy-count">
                    <span className="meter small">
                      <span style={{ width: `${(count[0] / count[1]) * 100}%` }} />
                    </span>
                    {count[0]} / {count[1]}
                  </span>
                ) : null}
              </div>
              <span className={`trophy-points ${trophy.tier}`}>
                {TIER_NAME[trophy.tier]} · {TIER_POINTS[trophy.tier]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
