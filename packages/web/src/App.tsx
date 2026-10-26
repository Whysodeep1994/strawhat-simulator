import type { CardCatalog } from "@strawhat/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackPicker } from "./BackPicker.js";
import { Board } from "./Board.js";
import { backImage, loadBack, saveBack, type BackChoice } from "./card-backs.js";
import { loadCardData, type CardData } from "./card-data.js";
import { DeckBuilder } from "./DeckBuilder.js";
import {
  deckTitle,
  MatPicker,
  MyDecksScreen,
  PlaySetup,
  RANDOM,
  SubScreen,
  TitleMenu,
  TrophiesScreen,
  type Screen,
} from "./Home.js";
import { newLocalGame, type LocalGame } from "./local-game.js";
import {
  cardList,
  copyOf,
  loadDecks,
  newDeck,
  playable,
  saveDecks,
  type SavedDeck,
} from "./my-decks.js";
import { loadMat, saveMat, type MatSeat } from "./playmat.js";
import { Scenery } from "./Scenery.js";
import { TrophyToasts } from "./TrophyToasts.js";
import {
  abandonGame,
  award,
  loadProgress,
  recordGame,
  saveProgress,
  type GameInfo,
  type TrophyProgress,
} from "./trophies.js";

export type Mats = Record<MatSeat, string | null>;
/** The card back picture for each side; null is the classic back. */
export type Backs = Record<MatSeat, string | null>;

export function App() {
  const [data, setData] = useState<CardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [opponentId, setOpponentId] = useState(RANDOM);
  const [mats, setMats] = useState<Mats>(() => ({
    you: loadMat("you"),
    opponent: loadMat("opponent"),
  }));
  const [backChoices, setBackChoices] = useState<Record<MatSeat, BackChoice>>(() => ({
    you: loadBack("you"),
    opponent: loadBack("opponent"),
  }));
  const [game, setGame] = useState<LocalGame | null>(null);
  const [myDecks, setMyDecks] = useState<SavedDeck[]>(loadDecks);
  const [editing, setEditing] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>("title");
  const [progress, setProgress] = useState<TrophyProgress>(loadProgress);
  /** Trophies waiting to pop up on screen. */
  const [toasts, setToasts] = useState<string[]>([]);
  /** Trophies earned in the game just finished, for its result screen. */
  const [gameTrophies, setGameTrophies] = useState<string[]>([]);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const recorded = useRef(false);

  // Every deck that can start a game: the starter decks, then the player's own legal decks.
  const decks = useMemo(
    () =>
      data
        ? [
            ...data.decks,
            ...myDecks.flatMap((d) => {
              const deck = playable(d, data);
              return deck ? [deck] : [];
            }),
          ]
        : [],
    [data, myDecks],
  );

  const storeProgress = (next: { progress: TrophyProgress; newly: string[] }) => {
    setProgress(next.progress);
    saveProgress(next.progress);
    if (next.newly.length > 0) setToasts((t) => [...t, ...next.newly]);
  };

  // A finished game is recorded once: its win counts and its trophies are awarded.
  useEffect(() => {
    if (!game || game.state.winner === null || recorded.current || !gameInfo) return;
    recorded.current = true;
    const result = recordGame(progress, game.stats, game.state, game.human, gameInfo);
    setGameTrophies(result.newly);
    storeProgress(result);
  }, [game]);

  /** Leaving a game before it ends breaks a winning streak. */
  const leaveGame = () => {
    if (game && game.state.winner === null && game.state.turn > 0) {
      storeProgress({ progress: abandonGame(progress), newly: [] });
    }
  };

  const storeDecks = (next: SavedDeck[]) => {
    setMyDecks(next);
    setSaveFailed(!saveDecks(next));
  };

  useEffect(() => {
    let live = true;
    loadCardData().then(
      (loaded) => {
        if (!live) return;
        setData(loaded);
        // Start on the player's own first ready deck, else the first official starter deck.
        const ready = loadDecks().find((d) => playable(d, loaded));
        const starter = loaded.decks.find((d) => d.official) ?? loaded.decks[0];
        setDeckId((id) => id ?? ready?.id ?? starter?.id ?? null);
      },
      (e: unknown) => live && setLoadError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, []);

  const start = () => {
    if (!data) return;
    const mine = decks.find((d) => d.id === deckId);
    if (!mine) return;
    const others = data.decks.filter((d) => d.id !== mine.id);
    const theirs =
      opponentId === RANDOM
        ? (others[Math.floor(Math.random() * others.length)] ?? mine)
        : (decks.find((d) => d.id === opponentId) ?? mine);
    const seed = Math.floor(Math.random() * 2 ** 31);
    leaveGame();
    recorded.current = false;
    setGameTrophies([]);
    setGameInfo({ mine: !!mine.mine, leader: mine.leader, opponentLeader: theirs.leader });
    setGame(newLocalGame(data.catalog as CardCatalog, { human: mine, bot: theirs }, seed));
  };

  const addDeck = (deck: SavedDeck) => {
    storeDecks([...myDecks, deck]);
    setEditing(deck.id);
    if (data && !progress.earned.shipwright && playable(deck, data)) {
      storeProgress(award(progress, ["shipwright"]));
    }
  };

  // Escape steps back from a menu screen to the title menu, like a game's "back" button.
  useEffect(() => {
    if (screen === "title" || game || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScreen("title");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, game, editing]);

  const setMat = (seat: MatSeat, image: string | null) => {
    setMats((m) => ({ ...m, [seat]: image }));
    return saveMat(seat, image);
  };

  const setBack = (seat: MatSeat, choice: BackChoice) => {
    setBackChoices((b) => ({ ...b, [seat]: choice }));
    return saveBack(seat, choice);
  };
  const backs: Backs = {
    you: backImage(backChoices.you),
    opponent: backImage(backChoices.opponent),
  };

  const toastLayer = <TrophyToasts ids={toasts} onDone={() => setToasts((t) => t.slice(1))} />;

  const editingDeck = myDecks.find((d) => d.id === editing);
  if (editingDeck && data) {
    return (
      <>
        <DeckBuilder
          data={data}
          deck={editingDeck}
          saveFailed={saveFailed}
          onChange={(deck) => {
            storeDecks(myDecks.map((d) => (d.id === deck.id ? deck : d)));
            if (!progress.earned.shipwright && playable(deck, data)) {
              storeProgress(award(progress, ["shipwright"]));
            }
          }}
          onDelete={() => {
            storeDecks(myDecks.filter((d) => d.id !== editingDeck.id));
            setEditing(null);
          }}
          onDone={() => {
            // An untouched new deck isn't worth keeping.
            if (!editingDeck.leader && cardList(editingDeck).length === 0) {
              storeDecks(myDecks.filter((d) => d.id !== editingDeck.id));
            } else if (playable(editingDeck, data)) {
              setDeckId(editingDeck.id);
            }
            setEditing(null);
          }}
        />
        {toastLayer}
      </>
    );
  }

  if (game && data) {
    return (
      <>
        <Board
          data={data}
          game={game}
          mats={mats}
          backs={backs}
          trophies={gameTrophies}
          onChange={setGame}
          onRestart={start}
          onExit={() => {
            leaveGame();
            setGame(null);
          }}
        />
        {toastLayer}
      </>
    );
  }

  const back = () => setScreen("title");
  const playmats = (
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
  );
  const cardBacks = (
    <section className="panel">
      <h2>Card backs</h2>
      <p className="note">
        The picture on the back of face-down cards: the Deck, Life and the hand your opponent sees.
      </p>
      <BackPicker
        label="Your card backs"
        choice={backChoices.you}
        onChange={(choice) => setBack("you", choice)}
      />
      <BackPicker
        label="Opponent's card backs"
        choice={backChoices.opponent}
        onChange={(choice) => setBack("opponent", choice)}
      />
    </section>
  );

  return (
    <>
      <Scenery />
      <main className={`home ${screen === "title" ? "at-title" : ""}`}>
        {screen === "title" ? (
          <>
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
            ) : (
              <TitleMenu
                ready={!!data}
                deckCount={myDecks.length}
                progress={progress}
                onPick={setScreen}
              />
            )}
            {!data && !loadError && (
              <p className="loading-line" aria-busy="true">
                Loading cards…
              </p>
            )}
          </>
        ) : screen === "trophies" ? (
          <SubScreen title="Trophies" onBack={back}>
            <TrophiesScreen progress={progress} />
          </SubScreen>
        ) : screen === "settings" ? (
          <SubScreen title="Settings" onBack={back}>
            <div className="settings-grid">
              {playmats}
              {cardBacks}
            </div>
          </SubScreen>
        ) : !data ? null : screen === "play" ? (
          <SubScreen title="Play" onBack={back}>
            <PlaySetup
              data={data}
              myDecks={myDecks}
              deckId={deckId}
              opponentId={opponentId}
              onDeck={setDeckId}
              onOpponent={setOpponentId}
              onStart={start}
              onBuild={() => setScreen("decks")}
            />
          </SubScreen>
        ) : (
          <SubScreen title="Deck Builder" onBack={back}>
            <MyDecksScreen
              data={data}
              myDecks={myDecks}
              saveFailed={saveFailed}
              onEdit={setEditing}
              onNew={() => addDeck(newDeck())}
              onCopy={(deck) => addDeck(copyOf(deck, `My ${deckTitle(deck, data)}`))}
            />
          </SubScreen>
        )}

        <footer className="legal">
          A free, fan-made, open-source simulator. Not affiliated with Bandai. Card images and text
          © Eiichiro Oda/Shueisha, Toei Animation, Bandai.
        </footer>
      </main>
      {toastLayer}
    </>
  );
}
