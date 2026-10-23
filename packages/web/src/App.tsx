import { setOf, type CardCatalog } from "@strawhat/engine";
import { useEffect, useState, type ChangeEvent } from "react";
import { Board } from "./Board.js";
import { loadCardData, setLabel, type CardData, type PlayableDeck } from "./card-data.js";
import { newLocalGame, type LocalGame } from "./local-game.js";
import { loadMat, readMatImage, saveMat, type MatSeat } from "./playmat.js";
import { Scenery } from "./Scenery.js";

export type Mats = Record<MatSeat, string | null>;

const RANDOM = "random";

export function App() {
  const [data, setData] = useState<CardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [opponentId, setOpponentId] = useState(RANDOM);
  const [mats, setMats] = useState<Mats>(() => ({
    you: loadMat("you"),
    opponent: loadMat("opponent"),
  }));
  const [game, setGame] = useState<LocalGame | null>(null);

  useEffect(() => {
    let live = true;
    loadCardData().then(
      (loaded) => {
        if (!live) return;
        setData(loaded);
        setDeckId((id) => id ?? loaded.decks[0]?.id ?? null);
      },
      (e: unknown) => live && setLoadError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, []);

  const start = () => {
    if (!data) return;
    const mine = data.decks.find((d) => d.id === deckId);
    if (!mine) return;
    const others = data.decks.filter((d) => d.id !== mine.id);
    const theirs =
      opponentId === RANDOM
        ? (others[Math.floor(Math.random() * others.length)] ?? mine)
        : (data.decks.find((d) => d.id === opponentId) ?? mine);
    const seed = Math.floor(Math.random() * 2 ** 31);
    setGame(newLocalGame(data.catalog as CardCatalog, { human: mine, bot: theirs }, seed));
  };

  const setMat = (seat: MatSeat, image: string | null) => {
    setMats((m) => ({ ...m, [seat]: image }));
    return saveMat(seat, image);
  };

  if (game && data) {
    return (
      <Board
        data={data}
        game={game}
        mats={mats}
        onChange={setGame}
        onRestart={start}
        onExit={() => setGame(null)}
      />
    );
  }

  return (
    <>
      <Scenery />
      <main className="home">
        <header className="home-title">
          <h1>
            Strawhat <span>Simulator</span>
          </h1>
          <p>Set sail for a game of the One Piece Card Game.</p>
        </header>

        {loadError ? (
          <section className="panel">
            <h2>The cards didn't load</h2>
            <p className="note">{loadError}</p>
            <button onClick={() => window.location.reload()}>Try again</button>
          </section>
        ) : !data ? (
          <section className="panel loading" aria-busy="true">
            Loading cards…
          </section>
        ) : (
          <div className="home-grid">
            <section className="panel decks" aria-labelledby="deck-heading">
              <div className="panel-head">
                <h2 id="deck-heading">Choose your deck</h2>
                <span className="count">{data.decks.length} ready</span>
              </div>
              <div className="deck-grid">
                {data.decks.map((deck) => (
                  <DeckTile
                    key={deck.id}
                    deck={deck}
                    data={data}
                    chosen={deck.id === deckId}
                    onChoose={() => setDeckId(deck.id)}
                  />
                ))}
              </div>
              <p className="note">
                More official starter decks are on their way. A practice deck is built from its
                set's cards until the official list is added.
              </p>
            </section>

            <aside className="home-side">
              <section className="panel">
                <h2>Opponent</h2>
                <label className="field">
                  <span>The computer plays</span>
                  <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
                    <option value={RANDOM}>A random deck</option>
                    {data.decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deckTitle(deck, data)} · {deckSubtitle(deck)}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="panel">
                <h2>Playmats</h2>
                <div className="mat-pickers">
                  <MatPicker
                    seat="you"
                    label="Your playmat"
                    image={mats.you}
                    onChange={(image) => setMat("you", image)}
                  />
                  <MatPicker
                    seat="opponent"
                    label="Opponent's playmat"
                    image={mats.opponent}
                    onChange={(image) => setMat("opponent", image)}
                  />
                </div>
              </section>

              <button className="primary big" onClick={start} disabled={!deckId}>
                Play against the computer
              </button>
            </aside>
          </div>
        )}

        <footer className="legal">
          A free, fan-made, open-source simulator. Not affiliated with Bandai. Card images and text
          © Eiichiro Oda/Shueisha, Toei Animation, Bandai.
        </footer>
      </main>
    </>
  );
}

function deckTitle(deck: PlayableDeck, data: CardData): string {
  return data.catalog[deck.leader]?.name ?? deck.name;
}

function deckSubtitle(deck: PlayableDeck): string {
  return deck.official ? deck.name : `${setLabel(setOf(deck.leader))} practice`;
}

function DeckTile({
  deck,
  data,
  chosen,
  onChoose,
}: {
  deck: PlayableDeck;
  data: CardData;
  chosen: boolean;
  onChoose: () => void;
}) {
  const leader = data.catalog[deck.leader];
  const art = data.imageUrl(leader);
  const colors = leader?.colors ?? [];
  return (
    <button
      className={`deck-tile ${chosen ? "chosen" : ""}`}
      onClick={onChoose}
      aria-pressed={chosen}
      style={{
        ["--deck-color" as string]: `var(--c-${colors[0] ?? "black"})`,
        ["--deck-color-2" as string]: `var(--c-${colors[1] ?? colors[0] ?? "black"})`,
      }}
    >
      <span className="deck-art">
        {art ? <img src={art} alt="" loading="lazy" draggable={false} /> : null}
      </span>
      <span className="deck-info">
        <strong>{deckTitle(deck, data)}</strong>
        <span>{deckSubtitle(deck)}</span>
      </span>
      <span className={`badge ${deck.official ? "official" : "practice"}`}>
        {deck.official ? "Official" : "Practice"}
      </span>
    </button>
  );
}

function MatPicker({
  seat,
  label,
  image,
  onChange,
}: {
  seat: MatSeat;
  label: string;
  image: string | null;
  /** Returns false when the picture can't be kept for next time. */
  onChange: (image: string | null) => boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const saved = onChange(await readMatImage(file));
      setMessage(saved ? null : "Using it for now, but this browser won't keep it for next time.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mat-picker">
      <div
        className={`mat-preview ${seat} ${image ? "custom" : ""}`}
        style={image ? { backgroundImage: `url("${image}")` } : undefined}
        aria-label={image ? `${label}: your picture` : `${label}: the default mat`}
        role="img"
      />
      <div className="mat-picker-text">
        <strong>{label}</strong>
        <div className="row">
          <label className="button small">
            Upload image
            <input type="file" accept="image/*" onChange={(e) => void upload(e)} />
          </label>
          {image && (
            <button
              className="ghost small"
              onClick={() => {
                onChange(null);
                setMessage(null);
              }}
            >
              Use default
            </button>
          )}
        </div>
        {message && <p className="note">{message}</p>}
      </div>
    </div>
  );
}
