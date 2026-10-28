import type { CardCatalog } from "@strawhat/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackPicker } from "./BackPicker.js";
import { Board } from "./Board.js";
import { backImage, loadBack, saveBack, type BackChoice } from "./card-backs.js";
import { loadCardData, type CardData } from "./card-data.js";
import { DeckBuilder } from "./DeckBuilder.js";
import { FriendLobby, FriendSetup } from "./Friend.js";
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
import { newLocalGame, timeOut, type LocalGame } from "./local-game.js";
import {
  DuelLink,
  loadDuel,
  newGameCode,
  newSave,
  onlineRoom,
  roomName,
  storeDuel,
  type DuelSave,
  type DuelStatus,
} from "./online.js";
import {
  cardList,
  copyOf,
  loadDecks,
  newDeck,
  playable,
  saveDecks,
  type SavedDeck,
} from "./my-decks.js";
import { matImage } from "./mat-art.js";
import { looksToShare } from "./share-looks.js";
import { loadMat, saveMat, type MatSeat } from "./playmat.js";
import { Scenery } from "./Scenery.js";
import { cuesBetween } from "./game-sounds.js";
import { sound } from "./sound.js";
import { loadSound, saveSound, type SoundSettings } from "./sound-settings.js";
import { SoundPanel } from "./SoundPanel.js";
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

/** Each seat's saved playmat choice (see playmat.ts), or the picture to show for it on the board. */
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
  /** Whether this page can play online: null until the room service answers. */
  const [online, setOnline] = useState<boolean | null>(null);
  /** The online game being set up or played. */
  const [duel, setDuel] = useState<{ save: DuelSave; status: DuelStatus | null } | null>(null);
  const [savedDuel, setSavedDuel] = useState<DuelSave | null>(loadDuel);
  const link = useRef<DuelLink | null>(null);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(loadSound);
  /** The token of the online game in progress, so a cancelled one stops connecting. */
  const duelToken = useRef<string | null>(null);

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

  useEffect(() => {
    let live = true;
    onlineRoom().then((room) => live && setOnline(!!room));
    return () => {
      live = false;
    };
  }, []);

  /** Joins the online game `save` describes: a new one, or one this browser was in. */
  const startDuel = async (save: DuelSave) => {
    if (!data) return;
    void link.current?.close();
    link.current = null;
    duelToken.current = save.token;
    setSavedDuel(save);
    storeDuel(save);
    setDuel({ save, status: null });
    const fail = (message: string) =>
      setDuel((d) =>
        d?.save.token === save.token ? { ...d, status: { kind: "error", message } } : d,
      );
    // Your playmat and card backs go to your friend, so they see your side as you do.
    const looks = looksToShare(mats.you, backChoices.you);
    const room = await onlineRoom();
    if (!room) return fail("Online play isn't available on this page.");
    let joined;
    try {
      joined = await room.join(roomName(save.code));
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      return fail(
        code === "not_permitted"
          ? "This link doesn't allow online games for you. Ask the game's owner to share it with you."
          : "Couldn't reach the game room. Check your connection and try again.",
      );
    }
    // The player may have cancelled while the room was opening.
    if (duelToken.current !== save.token) {
      void joined.leave();
      return;
    }
    const mine = await looks;
    if (duelToken.current !== save.token) {
      void joined.leave();
      return;
    }
    link.current = new DuelLink(
      joined,
      save,
      data.catalog as CardCatalog,
      (status, next) => {
        storeDuel(next);
        setSavedDuel(next);
        setDuel((d) => (d?.save.token === next.token ? { save: next, status } : d));
      },
      mine,
    );
  };

  const hostDuel = () => {
    const mine = decks.find((d) => d.id === deckId);
    if (mine) void startDuel(newSave(newGameCode(), "host", mine));
  };

  const joinDuel = (code: string) => {
    const mine = decks.find((d) => d.id === deckId);
    if (mine) void startDuel(newSave(code, "guest", mine));
  };

  /** Leaves the online game. One that isn't over can still be rejoined from the Play a Friend screen. */
  const leaveDuel = () => {
    void link.current?.close();
    link.current = null;
    duelToken.current = null;
    const over = duel?.status?.kind === "playing" && duel.status.game.state.winner !== null;
    const unstarted = duel?.status?.kind !== "playing";
    if (over || unstarted) {
      storeDuel(null);
      setSavedDuel(null);
    }
    setDuel(null);
    setScreen("friend");
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
    if (screen === "title" || game || duel || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScreen("title");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, game, duel, editing]);

  // Music: the calm piece in the menus, the livelier one at the table.
  const table = duel?.status?.kind === "playing" ? duel.status.game : game;
  useEffect(() => sound.listen(), []);
  useEffect(() => sound.configure(soundSettings), [soundSettings]);
  useEffect(() => sound.setScene(table ? "game" : "menu"), [!!table]);

  // Table sounds for every move, whoever made it: you, the computer, or a friend online.
  const lastState = useRef(table?.state ?? null);
  useEffect(() => {
    const before = lastState.current;
    lastState.current = table?.state ?? null;
    if (before && table) sound.cue(cuesBetween(before, table.state, table.human));
  }, [table?.state]);

  const changeSound = (next: SoundSettings) => {
    setSoundSettings(next);
    saveSound(next);
  };
  const inGameSound = (
    <SoundPanel settings={soundSettings} onChange={changeSound} heading={false} />
  );

  const setMat = (seat: MatSeat, choice: string | null) => {
    setMats((m) => ({ ...m, [seat]: choice }));
    return saveMat(seat, choice);
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

  if (duel?.status?.kind === "playing" && data) {
    const playing = duel.status;
    // The friend's own playmat and card backs once they've arrived; until then, the ones you set
    // for opponents.
    const theirs = duel.save.theirs ?? {};
    return (
      <Board
        data={data}
        game={playing.game}
        mats={{
          you: matImage(mats.you),
          opponent: matImage(theirs.mat !== undefined ? theirs.mat : mats.opponent),
        }}
        backs={{
          you: backs.you,
          opponent: theirs.back !== undefined ? backImage(theirs.back) : backs.opponent,
        }}
        soundPanel={inGameSound}
        onChange={(next) => link.current?.play(next)}
        onTimeout={(player) => link.current?.timeOut(player)}
        onExit={leaveDuel}
        notice={
          playing.partnerHere || playing.game.state.winner !== null
            ? undefined
            : "Your friend lost their connection. The game carries on when they're back."
        }
      />
    );
  }

  if (game && data) {
    return (
      <>
        <Board
          data={data}
          game={game}
          mats={{ you: matImage(mats.you), opponent: matImage(mats.opponent) }}
          backs={backs}
          soundPanel={inGameSound}
          trophies={gameTrophies}
          onChange={setGame}
          onTimeout={(player) => setGame((g) => g && timeOut(g, player))}
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
      <p className="note">
        When you play a friend online, they see your playmat and card backs, and you see theirs.
      </p>
      <div className="mat-pickers">
        <MatPicker
          seat="you"
          label="Your playmat"
          choice={mats.you}
          onChange={(choice) => setMat("you", choice)}
        />
        <MatPicker
          seat="opponent"
          label="Opponent's playmat"
          choice={mats.opponent}
          onChange={(choice) => setMat("opponent", choice)}
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
              <SoundPanel settings={soundSettings} onChange={changeSound} />
              {playmats}
              {cardBacks}
            </div>
          </SubScreen>
        ) : !data ? null : screen === "friend" ? (
          <SubScreen
            title="Play a Friend"
            onBack={() => {
              if (duel) leaveDuel();
              back();
            }}
          >
            {duel ? (
              <FriendLobby
                code={duel.save.code}
                host={duel.save.role === "host"}
                status={duel.status}
                onCancel={leaveDuel}
              />
            ) : (
              <FriendSetup
                data={data}
                myDecks={myDecks}
                deckId={deckId}
                online={online}
                saved={savedDuel}
                onDeck={setDeckId}
                onBuild={() => setScreen("decks")}
                onHost={hostDuel}
                onJoin={joinDuel}
                onRejoin={() => savedDuel && void startDuel(savedDuel)}
                onForget={() => {
                  storeDuel(null);
                  setSavedDuel(null);
                }}
              />
            )}
          </SubScreen>
        ) : screen === "play" ? (
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
