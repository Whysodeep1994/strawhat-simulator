import { sound } from "./sound.js";
import type { SoundSettings } from "./sound-settings.js";

/** Music and sound effect switches and volumes, for the Settings screen. */
export function SoundPanel({
  settings,
  onChange,
}: {
  settings: SoundSettings;
  onChange: (settings: SoundSettings) => void;
}) {
  const set = (change: Partial<SoundSettings>) => onChange({ ...settings, ...change });
  return (
    <section className="panel">
      <h2>Sound</h2>
      <p className="note">
        Soft background music, and quiet table sounds when a card is played, a card is trashed, an
        attack starts or the turn changes.
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
