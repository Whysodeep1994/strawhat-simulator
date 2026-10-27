/**
 * The background music, written as data: chords, a scale for the melody, and which instruments
 * play when. sound.ts turns each piece into sound on the spot, with a seeded melody so every
 * piece sounds the same each time. All of it is original to this project (see docs/AUDIO.md).
 */

/** Where a piece plays: on the title screen and menus, or during a game. */
export type Scene = "menu" | "game";

export interface Song {
  id: string;
  name: string;
  scene: Scene;
  /** A few words for the Settings screen. */
  mood: string;
  /** Eighth notes per minute, divided by two (so a normal tempo). */
  bpm: number;
  /** Eighth notes in a bar: 8 for 4/4, 6 for a lilting 6/8. */
  bar: 6 | 8;
  /** How many bars each chord lasts. */
  chordBars: 1 | 2;
  /** The bass note and the notes of the pad for each chord (MIDI numbers). */
  chords: { bass: number; pad: number[] }[];
  /** Eighth notes in a bar where the bass plays; the ones in `fifths` play the fifth instead. */
  bass: number[];
  fifths?: number[];
  /** Notes the melody wanders over, low to high. */
  scale: number[];
  /** Chance of a melody note on the beat and off the beat. */
  onBeat: number;
  offBeat: number;
  /** How long a melody note rings, in seconds. */
  ring: number;
  /** The melody's voice: a kalimba pluck, a bright marimba bell, or a soft accordion-like reed. */
  lead: "pluck" | "bell" | "reed";
  /** Percussion: none, a soft shaker, a gentle kick and clap, or a jig's kick and shaker. */
  drums: "none" | "shaker" | "beat" | "jig";
  /** How loud the held chords are. */
  pad: number;
  seed: number;
}

export const SONGS: Song[] = [
  {
    id: "set-sail",
    name: "Set Sail!",
    scene: "menu",
    mood: "Bright and bouncy",
    bpm: 132,
    bar: 8,
    chordBars: 1,
    // G, D, Em, C.
    chords: [
      { bass: 43, pad: [59, 62, 67] },
      { bass: 50, pad: [57, 62, 66] },
      { bass: 52, pad: [59, 64, 67] },
      { bass: 48, pad: [60, 64, 67] },
    ],
    bass: [0, 2, 4, 6],
    fifths: [2, 6],
    scale: [67, 69, 71, 74, 76, 79, 81, 83, 86],
    onBeat: 0.62,
    offBeat: 0.3,
    ring: 0.35,
    lead: "bell",
    drums: "beat",
    pad: 0.03,
    seed: 11,
  },
  {
    id: "calm-harbour",
    name: "Calm Harbour",
    scene: "menu",
    mood: "Slow and peaceful",
    bpm: 68,
    bar: 8,
    chordBars: 2,
    chords: [
      { bass: 50, pad: [62, 66, 69, 73] },
      { bass: 47, pad: [59, 62, 66, 69] },
      { bass: 43, pad: [55, 59, 62, 66] },
      { bass: 45, pad: [57, 62, 64, 66] },
    ],
    bass: [0],
    scale: [69, 71, 74, 76, 78, 81, 83, 86],
    onBeat: 0.4,
    offBeat: 0.12,
    ring: 1.1,
    lead: "pluck",
    drums: "none",
    pad: 0.05,
    seed: 101,
  },
  {
    id: "open-sea",
    name: "Open Sea",
    scene: "game",
    mood: "Steady and thoughtful",
    bpm: 92,
    bar: 8,
    chordBars: 2,
    chords: [
      { bass: 45, pad: [57, 60, 64, 67] },
      { bass: 41, pad: [53, 57, 60, 64] },
      { bass: 48, pad: [55, 60, 64, 67] },
      { bass: 43, pad: [55, 59, 62, 64] },
    ],
    bass: [0, 3, 6],
    scale: [64, 67, 69, 72, 74, 76, 79, 81],
    onBeat: 0.35,
    offBeat: 0.18,
    ring: 0.6,
    lead: "pluck",
    drums: "shaker",
    pad: 0.05,
    seed: 601,
  },
  {
    id: "shanty-jig",
    name: "Shanty Jig",
    scene: "game",
    mood: "A cheerful sea shanty",
    bpm: 168,
    bar: 6,
    chordBars: 1,
    // D, G, A, D.
    chords: [
      { bass: 50, pad: [62, 66, 69] },
      { bass: 43, pad: [62, 67, 71] },
      { bass: 45, pad: [61, 64, 69] },
      { bass: 50, pad: [62, 66, 69] },
    ],
    bass: [0, 3],
    fifths: [3],
    scale: [62, 64, 66, 69, 71, 74, 76, 78],
    onBeat: 0.55,
    offBeat: 0.35,
    ring: 0.3,
    lead: "reed",
    drums: "jig",
    pad: 0.025,
    seed: 77,
  },
  {
    id: "storm-front",
    name: "Storm Front",
    scene: "game",
    mood: "Tense, for a close game",
    bpm: 108,
    bar: 8,
    chordBars: 2,
    // Dm, Bb, C, A.
    chords: [
      { bass: 38, pad: [57, 62, 65] },
      { bass: 46, pad: [58, 62, 65] },
      { bass: 48, pad: [55, 60, 64] },
      { bass: 45, pad: [57, 61, 64] },
    ],
    bass: [0, 3, 4, 6],
    fifths: [3],
    scale: [62, 65, 67, 69, 72, 74, 77],
    onBeat: 0.4,
    offBeat: 0.2,
    ring: 0.45,
    lead: "pluck",
    drums: "beat",
    pad: 0.045,
    seed: 313,
  },
  {
    id: "island-breeze",
    name: "Island Breeze",
    scene: "game",
    mood: "Light and sunny",
    bpm: 100,
    bar: 8,
    chordBars: 2,
    // F, Dm, Bb, C.
    chords: [
      { bass: 41, pad: [57, 60, 65] },
      { bass: 50, pad: [57, 62, 65] },
      { bass: 46, pad: [58, 62, 65] },
      { bass: 48, pad: [55, 60, 64] },
    ],
    bass: [0, 3, 6],
    fifths: [6],
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
    onBeat: 0.45,
    offBeat: 0.25,
    ring: 0.5,
    lead: "bell",
    drums: "shaker",
    pad: 0.035,
    seed: 905,
  },
];

/** The game music setting that plays every game piece in turn. */
export const SHUFFLE = "shuffle";

export const songsFor = (scene: Scene) => SONGS.filter((s) => s.scene === scene);
export const songById = (id: string) => SONGS.find((s) => s.id === id);
