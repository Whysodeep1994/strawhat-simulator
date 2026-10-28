import { useState } from "react";
import type { CardData, PlayableDeck } from "./card-data.js";
import type { Mistake, Review } from "./coach-review.js";
import type { Tip } from "./coach-tips.js";
import type { Suggestion } from "./coach.js";
import { DeckChooser, RANDOM, readyDecks } from "./Home.js";
import type { Training } from "./local-game.js";
import type { SavedDeck } from "./my-decks.js";
import { LEARNING_DECKS, LEARNING_OPPONENT, type Guide, type RuleNote } from "./tutor.js";

type Track = "newPlayer" | "drills";

/** What a Player Development game is played with. */
export interface TrainingSetup {
  mine: PlayableDeck;
  theirs: PlayableDeck;
  training: Training;
}

/**
 * The Player Development screen: New Player (a guided first game with a Luffy deck) or
 * Pro Drills (your own deck, with live coaching or an error report at the end).
 */
export function DevelopScreen({
  data,
  myDecks,
  deckId,
  onDeck,
  onBuild,
  onStart,
}: {
  data: CardData;
  myDecks: SavedDeck[];
  deckId: string | null;
  onDeck: (id: string) => void;
  onBuild: () => void;
  onStart: (setup: TrainingSetup) => void;
}) {
  const [track, setTrack] = useState<Track>("newPlayer");
  const learning = LEARNING_DECKS.flatMap((id) => data.decks.filter((d) => d.id === id));
  const teacher = data.decks.find((d) => d.id === LEARNING_OPPONENT);
  const [lessonDeck, setLessonDeck] = useState(learning[0]?.id ?? "");
  const [liveCoaching, setLiveCoaching] = useState(true);
  const [opponentId, setOpponentId] = useState(RANDOM);
  const mine = readyDecks(myDecks, data);
  const all = [...mine, ...data.decks];
  const drillDeck = all.find((d) => d.id === deckId);

  const startLesson = () => {
    const deck = learning.find((d) => d.id === lessonDeck);
    if (deck && teacher) onStart({ mine: deck, theirs: teacher, training: { mode: "newPlayer" } });
  };
  const startDrill = () => {
    if (!drillDeck) return;
    const others = data.decks.filter((d) => d.id !== drillDeck.id);
    const theirs =
      opponentId === RANDOM
        ? (others[Math.floor(Math.random() * others.length)] ?? drillDeck)
        : (all.find((d) => d.id === opponentId) ?? drillDeck);
    onStart({ mine: drillDeck, theirs, training: { mode: "drills", liveCoaching } });
  };

  return (
    <>
      <div className="tabs develop-tabs" role="group" aria-label="Player Development">
        <button
          className={track === "newPlayer" ? "on" : ""}
          aria-pressed={track === "newPlayer"}
          onClick={() => setTrack("newPlayer")}
        >
          New Player
        </button>
        <button
          className={track === "drills" ? "on" : ""}
          aria-pressed={track === "drills"}
          onClick={() => setTrack("drills")}
        >
          Pro Drills
        </button>
      </div>

      {track === "newPlayer" ? (
        <div className="home-grid">
          <section className="panel" aria-labelledby="new-player">
            <h2 id="new-player">New Player: learn to play</h2>
            <p className="note">
              A guided game against an easy, one-colour deck. A coach explains the rules as they
              come up, suggests a good move at every step and tells you why. No game clock.
            </p>
            {learning.length === 0 ? (
              <p className="note">The Luffy starter decks aren't in the card data yet.</p>
            ) : (
              <>
                <div className="lesson-decks" role="radiogroup" aria-label="Your Luffy deck">
                  {learning.map((deck) => (
                    <button
                      key={deck.id}
                      role="radio"
                      aria-checked={lessonDeck === deck.id}
                      className={`lesson-deck ${lessonDeck === deck.id ? "chosen" : ""}`}
                      onClick={() => setLessonDeck(deck.id)}
                    >
                      <DeckTile deck={deck} data={data} blurb={BLURBS[deck.id] ?? ""} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
          <aside className="home-side">
            {teacher && (
              <section className="panel">
                <h2>Your opponent</h2>
                <div className="lesson-deck static">
                  <DeckTile
                    deck={teacher}
                    data={data}
                    blurb="An all-red deck with big, simple Characters and a Leader that's easy to read."
                  />
                </div>
              </section>
            )}
            <button
              className="primary big"
              onClick={startLesson}
              disabled={!teacher || learning.length === 0}
            >
              Start the lesson
            </button>
          </aside>
        </div>
      ) : (
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
              <h2>Pro Drills</h2>
              <label className="field">
                <span>The computer plays</span>
                <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
                  <option value={RANDOM}>A random Quick deck</option>
                  {mine.length > 0 && (
                    <optgroup label="My decks">
                      {mine.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Quick decks">
                    {data.decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {data.catalog[deck.leader]?.name ?? deck.name} · {deck.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={liveCoaching}
                  onChange={(e) => setLiveCoaching(e.target.checked)}
                />
                <span>
                  <strong>Live coaching {liveCoaching ? "on" : "off"}</strong>
                  {liveCoaching
                    ? "Tips before each of your turns on the matchup and the board, and advice when you're attacked."
                    : "No help during the game: play it your way, like a real match."}
                </span>
              </label>
              <p className="note">
                After the game you get a report of every error you made, which turn it was in, and
                why it was an error.
              </p>
            </section>
            <button className="primary big" onClick={startDrill} disabled={!drillDeck}>
              Start the drill
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

/** A deck shown as its Leader's art, names and a line about how it plays. */
function DeckTile({ deck, data, blurb }: { deck: PlayableDeck; data: CardData; blurb: string }) {
  const leader = data.catalog[deck.leader];
  const art = data.imageUrl(leader);
  return (
    <>
      <span className="lesson-deck-art">
        {art ? <img src={art} alt="" draggable={false} /> : null}
      </span>
      <span className="lesson-deck-text">
        <strong>{leader?.name ?? deck.name}</strong>
        <span className="note">
          {deck.name} · Life {leader?.life ?? "?"}
        </span>
        <span>{blurb}</span>
      </span>
    </>
  );
}

const BLURBS: Record<string, string> = {
  ST01: "Red. The classic Straw Hat Crew. Simple attackers and counters: the best first deck.",
  ST18: "Purple. Luffy ramps extra DON!! to play big cards early.",
  ST21: "Red. Gear 5 Luffy hands DON!! to his crew for huge attacks.",
};

/** The New Player tutor's box: what's happening, and the suggested move with a button. */
export function TutorBox({
  guide,
  note,
  onNote,
  onDo,
}: {
  guide: Guide;
  note: RuleNote | null;
  onNote: () => void;
  onDo: (suggestion: Suggestion) => void;
}) {
  return (
    <div className="coach tutor" role="status">
      {note && (
        <div className="coach-note">
          <strong>New rule: {note.title}</strong>
          <p>{note.text}</p>
          <button className="small" onClick={onNote}>
            Got it
          </button>
        </div>
      )}
      <strong className="coach-title">{guide.title}</strong>
      {guide.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {guide.suggestion && (
        <div className="coach-suggest">
          <p>
            <b>Coach suggests:</b> {guide.suggestion.say}.
          </p>
          <p className="coach-why">{guide.suggestion.why}</p>
          <button className="primary small" onClick={() => onDo(guide.suggestion!)}>
            Do it for me
          </button>
        </div>
      )}
    </div>
  );
}

const TIP_LABEL: Record<Tip["kind"], string> = {
  matchup: "Matchup",
  plan: "Plan",
  watch: "Watch for",
  danger: "Danger",
};

/** Pro Drills live coaching: the tips for this turn, which you can fold away. */
export function CoachTips({ title, tips }: { title: string; tips: Tip[] }) {
  const [open, setOpen] = useState(true);
  if (tips.length === 0) return null;
  return (
    <div className="coach drills">
      <button className="coach-fold ghost small" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Show"}
      </button>
      <strong className="coach-title">{title}</strong>
      {open && (
        <ul className="coach-tips">
          {tips.map((tip) => (
            <li key={tip.text} className={`tip-${tip.kind}`}>
              <b>{TIP_LABEL[tip.kind]}:</b> {tip.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The end-of-drill report: every error, which turn it was in, and why. */
export function ReportView({ review }: { review: Review }) {
  const major = review.mistakes.filter((m) => m.severity === "major").length;
  const minor = review.mistakes.length - major;
  const byTurn = new Map<number, Mistake[]>();
  for (const m of review.mistakes) byTurn.set(m.turn, [...(byTurn.get(m.turn) ?? []), m]);
  return (
    <div className="report">
      <p className="report-score">
        <strong>
          {review.cleanTurns} of {review.turns}
        </strong>{" "}
        of your turns had no errors · {major} big {major === 1 ? "error" : "errors"}, {minor} small
      </p>
      {review.mistakes.length === 0 ? (
        <p className="note">
          No errors found. Clean sailing! Try a tougher matchup or turn live coaching off.
        </p>
      ) : (
        <ol className="report-list">
          {[...byTurn].map(([turn, list]) => (
            <li key={turn}>
              <h3>
                Turn {turn} · {list[0]!.round}
              </h3>
              <ul>
                {list.map((m, i) => (
                  <li key={i} className={`mistake ${m.severity}`}>
                    <span className="mistake-tag">{m.severity === "major" ? "Big" : "Small"}</span>
                    <strong>{m.title}</strong>
                    <p>
                      <b>Why it's an error:</b> {m.why}
                    </p>
                    <p>
                      <b>Better:</b> {m.better}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
