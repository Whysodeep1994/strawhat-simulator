import { copyLimit, type CardCatalog } from "@strawhat/engine";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CardData, PlayableDeck } from "./card-data.js";
import { deckTitle, readyDecks } from "./Home.js";
import { deckGroups, LeaderPicker } from "./LeaderPicker.js";
import {
  bestSwaps,
  cardImpact,
  gain,
  gapMargin,
  margin,
  percent,
  swapShortlist,
  verdict,
  winRate,
  withSwap,
  type Swap,
  type SwapResult,
  type Tally,
} from "./matchup.js";
import { MatchupPool } from "./matchup-pool.js";
import { fromList, newDeck, type SavedDeck } from "./my-decks.js";

/** Game counts to choose from. More games, smaller margin of error. */
const GAME_COUNTS = [100, 500, 1000, 5000];
/** Games each shortlisted swap gets in the quick first look. */
const SCREEN_GAMES = 200;
/** How many of the best-looking swaps are tested again with the full game count. */
const FINALISTS = 5;
/** Extra cards the player can ask the lab to try. */
const MAX_EXTRAS = 5;

interface Running {
  label: string;
  done: number;
  total: number;
}

interface Results {
  a: PlayableDeck;
  b: PlayableDeck;
  base: Tally;
  swaps?: SwapResult[];
}

/**
 * The Matchup Lab: pick two decks, let the computer play them against each other many times, and
 * see each deck's win rate and which card swaps might help deck A.
 */
export function MatchupLab({
  data,
  myDecks,
  onSave,
}: {
  data: CardData;
  myDecks: SavedDeck[];
  onSave: (deck: SavedDeck) => void;
}) {
  const mine = useMemo(() => readyDecks(myDecks, data), [myDecks, data]);
  const all = useMemo(() => [...mine, ...data.decks], [mine, data]);
  const groups = useMemo(() => deckGroups(mine, data.decks), [mine, data]);
  // Start with your first deck (or an official one) against a different official deck.
  const official = data.decks.filter((d) => d.official);
  const [aId, setAId] = useState(() => (mine[0] ?? official[0] ?? all[0])?.id ?? "");
  const [bId, setBId] = useState(
    () => (official.find((d) => d.id !== aId) ?? all.find((d) => d.id !== aId) ?? all[0])?.id ?? "",
  );
  const [games, setGames] = useState(1000);
  const [extras, setExtras] = useState<string[]>([]);
  const [running, setRunning] = useState<Running | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const pool = useRef<MatchupPool | null>(null);

  const a = all.find((d) => d.id === aId);
  const b = all.find((d) => d.id === bId);
  const catalog = data.catalog as CardCatalog;

  useEffect(() => () => pool.current?.stop(), []);

  const start = () => {
    pool.current?.stop();
    pool.current = new MatchupPool(catalog);
    setError(null);
    return pool.current;
  };
  const stop = () => {
    pool.current?.stop();
    pool.current = null;
    setRunning(null);
  };
  const failed = (e: unknown) => {
    setRunning(null);
    setError(`Something went wrong while playing: ${String(e)}`);
  };

  const runMatchup = async () => {
    if (!a || !b) return;
    const p = start();
    setResults(null);
    setSaved([]);
    const label = `Playing ${games.toLocaleString()} games`;
    setRunning({ label, done: 0, total: games });
    try {
      const [base] = await p.run([{ a, b, from: 0, to: games }], (done) =>
        setRunning({ label, done, total: games }),
      );
      setResults({ a, b, base: base! });
      setRunning(null);
    } catch (e) {
      failed(e);
    }
  };

  const findSwaps = async () => {
    if (!results) return;
    const { a, b, base } = results;
    const shortlist = swapShortlist(catalog, data.format, a, base, extras);
    if (shortlist.length === 0) {
      setResults({ ...results, swaps: [] });
      return;
    }
    const p = start();
    try {
      // 1. A quick look at every shortlisted swap, next to the deck as it is.
      const screenTotal = SCREEN_GAMES * (shortlist.length + 1);
      const label1 = `Step 1 of 2: trying ${shortlist.length} swaps`;
      setRunning({ label: label1, done: 0, total: screenTotal });
      const [screenBase, ...screened] = await p.run(
        [a, ...shortlist.map((s) => withSwap(a, s))].map((deck) => ({
          a: deck,
          b,
          // Fresh games, so the final check below isn't flattered by the luck that picked them.
          from: games,
          to: games + SCREEN_GAMES,
        })),
        (done) => setRunning({ label: label1, done, total: screenTotal }),
      );
      const first = shortlist.map((swap, i) => ({ swap, tally: screened[i]!, base: screenBase! }));

      // 2. The best few again, with as many games as the matchup itself.
      const finalists: Swap[] = bestSwaps(first, Math.min(FINALISTS, first.length));
      const total = games * finalists.length;
      const label2 = `Step 2 of 2: checking the best ${finalists.length} with ${games.toLocaleString()} games each`;
      setRunning({ label: label2, done: 0, total });
      const checked = await p.run(
        finalists.map((s) => ({ a: withSwap(a, s), b, from: 0, to: games })),
        (done) => setRunning({ label: label2, done, total }),
      );
      const swaps = finalists
        .map((swap, i) => ({ swap, tally: checked[i]!, base }))
        .sort((x, y) => gain(y) - gain(x));
      setResults({ ...results, swaps });
      setRunning(null);
    } catch (e) {
      failed(e);
    }
  };

  const saveSwap = (r: SwapResult) => {
    if (!results) return;
    const deck = withSwap(results.a, r.swap);
    const name = `${deckTitle(results.a, data)} (Lab: −${r.swap.out} +${r.swap.in})`;
    onSave({ ...fromList(newDeck(), deck.leader, deck.deck), name });
    setSaved((s) => [...s, `${r.swap.out}>${r.swap.in}`]);
  };

  const busy = running !== null;
  return (
    <div className="lab">
      <section className="panel">
        <h2>Decks</h2>
        <div className="lab-decks">
          <div className="field">
            <span>Deck A: the deck you want to improve</span>
            <LeaderPicker
              data={data}
              groups={groups}
              value={aId}
              onChange={(id) => {
                setAId(id);
                setExtras([]);
              }}
              label="Deck A"
            />
          </div>
          <span className="lab-vs">vs</span>
          <div className="field">
            <span>Deck B: the opponent</span>
            <LeaderPicker
              data={data}
              groups={groups}
              value={bId}
              onChange={setBId}
              label="Deck B"
            />
          </div>
        </div>
        <div className="field">
          <span>Games to play</span>
          <div className="tabs lab-games" role="group" aria-label="Games to play">
            {GAME_COUNTS.map((n) => (
              <button
                key={n}
                className={games === n ? "on" : ""}
                aria-pressed={games === n}
                onClick={() => setGames(n)}
                disabled={busy}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="primary big" onClick={runMatchup} disabled={!a || !b || busy}>
            Run {games.toLocaleString()} games
          </button>
          {busy && <button onClick={stop}>Stop</button>}
        </div>
        <p className="note">
          The computer plays both decks, so results show how the decks do in the computer's hands.
          It plays simply, so a strong player may get different results. Use the numbers as a guide,
          not a promise.
        </p>
      </section>

      {running && <Progress running={running} />}
      {error && (
        <section className="panel">
          <p className="note">{error}</p>
        </section>
      )}

      {results && (
        <MatchupResults results={results} data={data}>
          <section className="panel">
            <h2>Find better cards for deck A</h2>
            <p className="note">
              The lab takes out one copy of a card that did badly when drawn, puts in one copy of a
              card that did well (or one you pick below), and plays the new deck. First it tries
              each swap {SCREEN_GAMES} times, then it plays the best {FINALISTS} again{" "}
              {games.toLocaleString()} times each.
            </p>
            <ExtraCards
              data={data}
              deck={results.a}
              extras={extras}
              onChange={setExtras}
              disabled={busy}
            />
            <button className="primary" onClick={findSwaps} disabled={busy}>
              Find better cards
            </button>
            {results.swaps && (
              <SwapList results={results.swaps} data={data} saved={saved} onSave={saveSwap} />
            )}
          </section>
        </MatchupResults>
      )}
    </div>
  );
}

function Progress({ running }: { running: Running }) {
  const share = running.total ? running.done / running.total : 0;
  return (
    <section className="panel" aria-live="polite">
      <h2>{running.label}</h2>
      <div className="lab-bar" role="progressbar" aria-valuenow={Math.round(share * 100)}>
        <span style={{ width: `${share * 100}%` }} />
      </div>
      <p className="note">
        {running.done.toLocaleString()} of {running.total.toLocaleString()} games played.
      </p>
    </section>
  );
}

function MatchupResults({
  results,
  data,
  children,
}: {
  results: Results;
  data: CardData;
  children: ReactNode;
}) {
  const { a, b, base } = results;
  const rate = winRate(base);
  const name = (d: PlayableDeck) => deckTitle(d, data);
  const firstRate = base.aFirstGames ? base.aFirstWins / base.aFirstGames : 0;
  const secondRate = base.aSecondGames ? base.aSecondWins / base.aSecondGames : 0;
  const impact = cardImpact(a, base);
  return (
    <>
      <section className="panel">
        <h2>Result after {base.games.toLocaleString()} games</h2>
        <div className="lab-score">
          <div>
            <strong>{percent(rate)}</strong>
            <span>{name(a)}</span>
          </div>
          <div>
            <strong>{percent(1 - rate)}</strong>
            <span>{name(b)}</span>
          </div>
        </div>
        <div className="lab-bar split" aria-hidden="true">
          <span style={{ width: `${rate * 100}%` }} />
        </div>
        <ul className="lab-facts">
          <li>
            Margin of error: ±{percent(margin(base))}. Luck alone can move the result this much, so
            smaller gaps don't mean much.
          </li>
          <li>
            Deck A going first: {percent(firstRate)} wins ({base.aFirstGames} games). Going second:{" "}
            {percent(secondRate)} ({base.aSecondGames} games).
          </li>
          <li>
            Games last {(base.turns / Math.max(1, base.games)).toFixed(1)} turns on average.
            {base.draws > 0 && ` ${base.draws} games were stopped as draws.`}
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Deck A's cards: win rate when drawn</h2>
        <p className="note">
          How often deck A won in games where it drew each card (or played it). This hints at which
          cards pull their weight. It isn't proof: longer games draw more cards.
        </p>
        <table className="lab-table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Copies</th>
              <th>Drawn in</th>
              <th>Win rate when drawn</th>
            </tr>
          </thead>
          <tbody>
            {impact.map((c) => (
              <tr key={c.card}>
                <td>
                  <CardName id={c.card} data={data} />
                </td>
                <td>{c.copies}</td>
                <td>{percent(c.drawn / Math.max(1, base.games), 0)} of games</td>
                <td>{c.rate === null ? "too few games" : percent(c.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {children}
    </>
  );
}

function SwapList({
  results,
  data,
  saved,
  onSave,
}: {
  results: SwapResult[];
  data: CardData;
  saved: string[];
  onSave: (r: SwapResult) => void;
}) {
  if (results.length === 0)
    return <p className="note">No swaps to try: no card has room for another copy.</p>;
  const better = results.filter((r) => verdict(r) === "better");
  return (
    <>
      <p className="note">
        {better.length > 0
          ? `${better.length} ${better.length === 1 ? "swap" : "swaps"} clearly helped deck A.`
          : "No swap helped by more than luck could explain. Deck A may already be close to its best against this deck, or more games are needed to tell."}
      </p>
      <ul className="lab-swaps">
        {results.map((r) => {
          const v = verdict(r);
          const key = `${r.swap.out}>${r.swap.in}`;
          return (
            <li key={key} className={v}>
              <span className="lab-swap-cards">
                <span className="out">
                  −1 <CardName id={r.swap.out} data={data} />
                </span>
                <span className="in">
                  +1 <CardName id={r.swap.in} data={data} />
                </span>
              </span>
              <span className="lab-swap-result">
                <strong>
                  {gain(r) >= 0 ? "+" : ""}
                  {percent(gain(r))}
                </strong>{" "}
                (±{percent(gapMargin(r.tally, r.base))}) ·{" "}
                {v === "better" ? "Better" : v === "worse" ? "Worse" : "Too close to call"}
              </span>
              <button onClick={() => onSave(r)} disabled={saved.includes(key)}>
                {saved.includes(key) ? "Saved to My decks" : "Save as a new deck"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Cards the player wants the lab to try putting in deck A. */
function ExtraCards({
  data,
  deck,
  extras,
  onChange,
  disabled,
}: {
  data: CardData;
  deck: PlayableDeck;
  extras: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const leader = data.catalog[deck.leader];
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !leader) return [];
    const catalog = data.catalog as CardCatalog;
    return Object.values(data.catalog)
      .filter(
        (c) =>
          c.category !== "leader" &&
          !deck.deck.includes(c.id) &&
          !extras.includes(c.id) &&
          c.colors.every((col) => leader.colors.includes(col)) &&
          copyLimit(data.format, catalog, c.id) > 0 &&
          (c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [query, data, deck, extras, leader]);

  return (
    <div className="field">
      <span>
        Cards to try that aren't in deck A yet (up to {MAX_EXTRAS}, optional). They must fit the
        Leader's colours and be legal in Standard.
      </span>
      {extras.length > 0 && (
        <ul className="lab-extras">
          {extras.map((id) => (
            <li key={id}>
              <CardName id={id} data={data} />
              <button
                className="ghost"
                aria-label={`Remove ${id}`}
                onClick={() => onChange(extras.filter((x) => x !== id))}
                disabled={disabled}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {extras.length < MAX_EXTRAS && (
        <>
          <input
            type="search"
            placeholder="Search by name or card number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
          />
          {matches.length > 0 && (
            <ul className="lab-matches">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      onChange([...extras, c.id]);
                      setQuery("");
                    }}
                  >
                    <CardName id={c.id} data={data} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CardName({ id, data }: { id: string; data: CardData }) {
  const card = data.catalog[id];
  const art = data.imageUrl(card);
  return (
    <span className="lab-card">
      {art && <img src={art} alt="" loading="lazy" draggable={false} />}
      <span>
        {card?.name ?? id} <small>{id}</small>
      </span>
    </span>
  );
}
