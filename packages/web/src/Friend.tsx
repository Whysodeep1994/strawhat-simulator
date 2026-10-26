import { useState } from "react";
import type { CardData } from "./card-data.js";
import { DeckChooser, readyDecks } from "./Home.js";
import type { SavedDeck } from "./my-decks.js";
import { cleanGameCode, type DuelSave, type DuelStatus } from "./online.js";

/** Pick a deck, then host a game (and get a code) or type a friend's code to join theirs. */
export function FriendSetup({
  data,
  myDecks,
  deckId,
  online,
  saved,
  onDeck,
  onBuild,
  onHost,
  onJoin,
  onRejoin,
  onForget,
}: {
  data: CardData;
  myDecks: SavedDeck[];
  deckId: string | null;
  /** null while checking, false when this page can't reach the online room. */
  online: boolean | null;
  /** An online game this browser was in before. */
  saved: DuelSave | null;
  onDeck: (id: string) => void;
  onBuild: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  onRejoin: () => void;
  onForget: () => void;
}) {
  const [typed, setTyped] = useState("");
  const code = cleanGameCode(typed);
  const chosen = [...readyDecks(myDecks, data), ...data.decks].find((d) => d.id === deckId);
  const ready = online === true && !!chosen;

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
        {online === false && (
          <section className="panel">
            <h2>Online play isn't available here</h2>
            <p className="note">
              Playing a friend works on the game's website or its claude.ai link. Open the game from
              one of those, and make sure your friend uses the same one.
            </p>
          </section>
        )}
        {online === null && (
          <p className="loading-line" aria-busy="true">
            Connecting…
          </p>
        )}

        {saved && (
          <section className="panel">
            <h2>Your last game</h2>
            <p className="note">
              You were playing game <strong className="game-code">{saved.code}</strong>. Rejoin to
              carry on where you left off.
            </p>
            <div className="row">
              <button className="primary" onClick={onRejoin} disabled={online !== true}>
                Rejoin
              </button>
              <button onClick={onForget}>Forget it</button>
            </div>
          </section>
        )}

        <section className="panel">
          <h2>Start a game</h2>
          <p className="note">You'll get a code to send your friend.</p>
          <button className="primary big" onClick={onHost} disabled={!ready}>
            Create a game
          </button>
        </section>

        <section className="panel">
          <h2>Join a friend</h2>
          <label className="field">
            <span>Type the code your friend sent you</span>
            <input
              className="code-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code && ready && onJoin(code)}
              placeholder="e.g. k7m2qx"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              maxLength={16}
            />
          </label>
          <button onClick={() => code && onJoin(code)} disabled={!ready || !code}>
            Join game
          </button>
        </section>
      </aside>
    </div>
  );
}

/** While the two players find each other. */
export function FriendLobby({
  code,
  host,
  status,
  onCancel,
}: {
  code: string;
  host: boolean;
  status: DuelStatus | null;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <section className="panel friend-lobby">
      {status?.kind === "error" ? (
        <>
          <h2>Something went wrong</h2>
          <p>{status.message}</p>
        </>
      ) : status?.kind === "full" ? (
        <>
          <h2>That game is full</h2>
          <p>
            Game <strong className="game-code">{code}</strong> already has two players. Check the
            code with your friend.
          </p>
        </>
      ) : host ? (
        <>
          <h2>Waiting for your friend</h2>
          <p>Send your friend this code. The game starts as soon as they join.</p>
          <div className="row">
            <strong className="game-code big-code">{code}</strong>
            <button onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <p className="note">
            They open the game from the same link, choose Play a Friend, pick a deck and type the
            code.
          </p>
        </>
      ) : (
        <>
          <h2>Looking for game {code}</h2>
          <p aria-busy="true">Waiting for your friend's game to answer…</p>
          <p className="note">
            If this takes long, check the code and that your friend is still on the waiting screen.
          </p>
        </>
      )}
      <div className="row">
        <button onClick={onCancel}>{status?.kind === "error" ? "Back" : "Cancel"}</button>
      </div>
    </section>
  );
}
