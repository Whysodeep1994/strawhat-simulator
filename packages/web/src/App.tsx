import { useState } from "react";
import { Board } from "./Board.js";
import { DEMO_CATALOG, DEMO_DECKS } from "./demo-cards.js";
import { newLocalGame, type LocalGame } from "./local-game.js";

type DeckKey = keyof typeof DEMO_DECKS;

export function App() {
  const [deck, setDeck] = useState<DeckKey>("red");
  const [game, setGame] = useState<LocalGame | null>(null);

  const start = () => {
    const other: DeckKey = deck === "red" ? "green" : "red";
    const seed = Math.floor(Math.random() * 2 ** 31);
    setGame(newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS[deck], bot: DEMO_DECKS[other] }, seed));
  };

  if (game) {
    return (
      <Board
        catalog={DEMO_CATALOG}
        game={game}
        onChange={setGame}
        onRestart={start}
        onExit={() => setGame(null)}
      />
    );
  }

  return (
    <main className="menu">
      <h1>
        Strawhat <span>Simulator</span>
      </h1>
      <p className="tagline">A free, open-source One Piece Card Game simulator.</p>
      <section className="menu-card">
        <h2>Choose your deck</h2>
        <div className="deck-options">
          {(Object.keys(DEMO_DECKS) as DeckKey[]).map((key) => (
            <button
              key={key}
              className={`deck-option ${key} ${deck === key ? "chosen" : ""}`}
              onClick={() => setDeck(key)}
              aria-pressed={deck === key}
            >
              <strong>{DEMO_DECKS[key].name.split(" (")[0]}</strong>
              <span>{DEMO_DECKS[key].name.match(/\((.*)\)/)?.[1]}</span>
            </button>
          ))}
        </div>
        <button className="primary big" onClick={start}>
          Play against the computer
        </button>
        <p className="note">
          Prototype with made-up demo cards. Real cards arrive with the card data.
        </p>
      </section>
    </main>
  );
}
