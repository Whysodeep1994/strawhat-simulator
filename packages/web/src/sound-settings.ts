/**
 * The player's music and sound effect choices. They stay in this browser only (localStorage),
 * like playmats and card backs.
 */
export interface SoundSettings {
  musicOn: boolean;
  /** 0 to 1. */
  musicVolume: number;
  effectsOn: boolean;
  /** 0 to 1. */
  effectsVolume: number;
}

export const DEFAULT_SOUND: SoundSettings = {
  musicOn: true,
  musicVolume: 0.4,
  effectsOn: true,
  effectsVolume: 0.7,
};

const KEY = "strawhat.sound";

/** Reads saved settings, keeping the default for anything missing or broken. */
export function parseSound(saved: string | null): SoundSettings {
  let raw: Partial<Record<keyof SoundSettings, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(saved ?? "null");
    if (parsed && typeof parsed === "object") raw = parsed;
  } catch {
    // Broken settings fall back to the defaults.
  }
  const flag = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const level = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
  return {
    musicOn: flag(raw.musicOn, DEFAULT_SOUND.musicOn),
    musicVolume: level(raw.musicVolume, DEFAULT_SOUND.musicVolume),
    effectsOn: flag(raw.effectsOn, DEFAULT_SOUND.effectsOn),
    effectsVolume: level(raw.effectsVolume, DEFAULT_SOUND.effectsVolume),
  };
}

export function loadSound(): SoundSettings {
  try {
    return parseSound(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_SOUND;
  }
}

/** Returns false when the browser refused to store it (private mode or out of space). */
export function saveSound(settings: SoundSettings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
