import { useEffect } from "react";
import { SHUFFLE, songsFor, type Scene } from "./music.js";
import { sound } from "./sound.js";
import type { SoundSettings } from "./sound-settings.js";

/** Music and sound effect switches and volumes, for the Settings screen. */
export function SoundPanel({
  settings,
  onChange,
  heading = true,
}: {
  settings: SoundSettings;
  onChange: (settings: SoundSettings) => void;
  /** False inside a window that already has its own title. */
  heading?: boolean;
}) {
  const set = (change: Partial<SoundSettings>) => onChange({ ...settings, ...change });
  // Picking a piece plays it straight away, until the panel closes.
  useEffect(() => () => sound.preview(null), []);
  const pickSong = (scene: Scene, id: string) => {
    set(scene === "menu" ? { menuSong: id } : { gameSong: id });
    sound.preview(id === SHUFFLE ? null : id);
  };
  return (
    <section className={heading ? "panel" : "sound-panel"}>
      {heading && <h2>Sound</h2>}
      <p className="note">
        Background music, and quiet table sounds when a card is played, a card is trashed, an attack
        starts or the turn changes. Picking a piece of music plays it so you can hear it.
      </p>
      <div className="sound-row">
        <label className="check">
          <input
            type="checkbox"
            checked={settings.musicOn}
            onChange={(e) => set({ musicOn: e.target.checked })}
          />
          Music
        </label>
        <input
          type="range"
          min={0}
          max={100}
          aria-label="Music volume"
          value={Math.round(settings.musicVolume * 100)}
          disabled={!settings.musicOn}
          onChange={(e) => set({ musicVolume: Number(e.target.value) / 100 })}
        />
      </div>
      <div className="sound-row">
        <label htmlFor="menu-song">Menu music</label>
        <select
          id="menu-song"
          value={settings.menuSong}
          disabled={!settings.musicOn}
          onChange={(e) => pickSong("menu", e.target.value)}
        >
          {songsFor("menu").map((song) => (
            <option key={song.id} value={song.id}>
              {song.name} ({song.mood.toLowerCase()})
            </option>
          ))}
        </select>
      </div>
      <div className="sound-row">
        <label htmlFor="game-song">Game music</label>
        <select
          id="game-song"
          value={settings.gameSong}
          disabled={!settings.musicOn}
          onChange={(e) => pickSong("game", e.target.value)}
        >
          <option value={SHUFFLE}>Shuffle (play each in turn)</option>
          {songsFor("game").map((song) => (
            <option key={song.id} value={song.id}>
              {song.name} ({song.mood.toLowerCase()})
            </option>
          ))}
        </select>
      </div>
      <div className="sound-row">
        <label className="check">
          <input
            type="checkbox"
            checked={settings.effectsOn}
            onChange={(e) => set({ effectsOn: e.target.checked })}
          />
          Sound effects
        </label>
        <input
          type="range"
          min={0}
          max={100}
          aria-label="Sound effects volume"
          value={Math.round(settings.effectsVolume * 100)}
          disabled={!settings.effectsOn}
          onChange={(e) => set({ effectsVolume: Number(e.target.value) / 100 })}
          onPointerUp={() => sound.cue(["play"])}
        />
      </div>
      <div className="row">
        {(
          [
            ["play", "Play a card"],
            ["attack", "Attack"],
            ["discard", "Trash"],
            ["yourTurn", "Your turn"],
          ] as const
        ).map(([cue, label]) => (
          <button
            key={cue}
            className="small"
            disabled={!settings.effectsOn}
            onClick={() => sound.cue([cue])}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
