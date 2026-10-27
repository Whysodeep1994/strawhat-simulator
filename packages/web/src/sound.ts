/**
 * Music and sound effects. Every sound is made on the spot by the code in this file with the
 * browser's Web Audio API: there are no audio files to download and no recordings from anywhere
 * else, so all of it is this project's own work under its licence (see docs/AUDIO.md).
 *
 * Browsers only allow sound after the player has clicked or pressed a key, so nothing plays
 * until then.
 */
import type { Cue } from "./game-sounds.js";
import { DEFAULT_SOUND, type SoundSettings } from "./sound-settings.js";

/** Background music: the calm piece for the menus, or the livelier one for a game. */
export type Track = "menu" | "game";

interface Song {
  bpm: number;
  /** Each chord lasts two bars: the bass note, then the notes of the pad (MIDI numbers). */
  chords: { bass: number; pad: number[] }[];
  /** Notes the melody wanders over, low to high. */
  scale: number[];
  /** Chance of a melody note on the beat and off the beat. */
  onBeat: number;
  offBeat: number;
  /** How long a melody note rings, in seconds. */
  ring: number;
  /** Eighth notes within a bar (0-7) where the bass plays. */
  bass: number[];
  /** A soft shaker on the off-beats. */
  shaker: boolean;
}

const SONGS: Record<Track, Song> = {
  // "Calm Harbour": D major, slow and warm.
  menu: {
    bpm: 68,
    chords: [
      { bass: 50, pad: [62, 66, 69, 73] },
      { bass: 47, pad: [59, 62, 66, 69] },
      { bass: 43, pad: [55, 59, 62, 66] },
      { bass: 45, pad: [57, 62, 64, 66] },
    ],
    scale: [69, 71, 74, 76, 78, 81, 83, 86],
    onBeat: 0.4,
    offBeat: 0.12,
    ring: 1.1,
    bass: [0],
    shaker: false,
  },
  // "Open Sea": A minor, a little more movement, still in the background.
  game: {
    bpm: 92,
    chords: [
      { bass: 45, pad: [57, 60, 64, 67] },
      { bass: 41, pad: [53, 57, 60, 64] },
      { bass: 48, pad: [55, 60, 64, 67] },
      { bass: 43, pad: [55, 59, 62, 64] },
    ],
    scale: [64, 67, 69, 72, 74, 76, 79, 81],
    onBeat: 0.35,
    offBeat: 0.18,
    ring: 0.6,
    bass: [0, 3, 6],
    shaker: true,
  },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A small seeded random number generator, so each phrase of the music is the same every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}

interface Bus {
  /** Sounds go here dry... */
  dry: GainNode;
  /** ...and here for a touch of room echo. */
  wet: GainNode;
  volume: GainNode;
}

interface Playing {
  track: Track;
  out: GainNode;
  timer: ReturnType<typeof setInterval>;
}

const MUSIC_LEVEL = 1;
const EFFECTS_LEVEL = 0.9;

class Mixer {
  private ctx: AudioContext | null = null;
  private music: Bus | null = null;
  private effects: Bus | null = null;
  private noise: AudioBuffer | null = null;
  private settings: SoundSettings = DEFAULT_SOUND;
  private wanted: Track | null = null;
  private playing: Playing | null = null;
  private listening = false;

  /** Starts sound on the player's first click or key press, and pauses it in hidden tabs. */
  listen(): void {
    if (this.listening || typeof window === "undefined") return;
    this.listening = true;
    const wake = () => this.wake();
    for (const type of ["pointerdown", "keydown", "touchend"]) {
      window.addEventListener(type, wake, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else this.wake();
    });
  }

  configure(settings: SoundSettings): void {
    this.settings = settings;
    this.sync();
  }

  /** The music to play; null for silence. */
  setTrack(track: Track | null): void {
    this.wanted = track;
    this.sync();
  }

  /** Plays table sounds, one after another when a single move makes several. */
  cue(cues: readonly Cue[]): void {
    const ctx = this.ctx;
    if (!ctx || !this.settings.effectsOn || !this.effects || document.hidden) return;
    // The very first click may still be waking the sound up.
    if (ctx.state !== "running") {
      void ctx.resume().then(() => this.cue(cues));
      return;
    }
    cues.forEach((c, i) => this.effect(c, ctx.currentTime + 0.02 + i * 0.14));
  }

  private wake(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.build(this.ctx);
    }
    if (this.ctx.state === "running") this.sync();
    else if (!document.hidden) void this.ctx.resume().then(() => this.sync());
  }

  private build(ctx: AudioContext): void {
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    const rand = seeded(7);
    for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
    this.noise = noise;

    // A short, soft room: decaying noise used as the echo of a small wooden cabin.
    const room = (seconds: number) => {
      const length = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buffer.getChannelData(ch);
        const r = seeded(11 + ch);
        for (let i = 0; i < length; i++) d[i] = (r() * 2 - 1) * (1 - i / length) ** 3;
      }
      const conv = ctx.createConvolver();
      conv.buffer = buffer;
      return conv;
    };
    const bus = (seconds: number, wetLevel: number): Bus => {
      const volume = ctx.createGain();
      volume.gain.value = 0;
      volume.connect(ctx.destination);
      const dry = ctx.createGain();
      dry.connect(volume);
      const wet = ctx.createGain();
      wet.gain.value = wetLevel;
      const conv = room(seconds);
      wet.connect(conv);
      conv.connect(volume);
      return { dry, wet, volume };
    };
    this.music = bus(2.8, 0.35);
    this.effects = bus(0.9, 0.2);
  }

  /** Brings volumes and the music in line with the settings and the screen. */
  private sync(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music || !this.effects) return;
    const s = this.settings;
    const now = ctx.currentTime;
    // Volume sliders feel more even squared.
    const level = (on: boolean, v: number, max: number) => (on ? v * v * max : 0);
    this.music.volume.gain.setTargetAtTime(level(s.musicOn, s.musicVolume, MUSIC_LEVEL), now, 0.1);
    this.effects.volume.gain.setTargetAtTime(
      level(s.effectsOn, s.effectsVolume, EFFECTS_LEVEL),
      now,
      0.05,
    );

    const track = s.musicOn && ctx.state === "running" ? this.wanted : null;
    if (this.playing?.track === track) return;
    if (this.playing) this.stopMusic(this.playing);
    this.playing = track ? this.startMusic(ctx, track) : null;
  }

  private startMusic(ctx: AudioContext, track: Track): Playing {
    const song = SONGS[track];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5);
    out.connect(this.music!.dry);
    out.connect(this.music!.wet);

    const eighth = 60 / song.bpm / 2;
    let step = 0;
    let next = ctx.currentTime + 0.1;
    let rand = seeded(1);
    let note = 3;
    const tick = () => {
      // Plan a little ahead, so the music stays steady when the page is busy.
      while (next < ctx.currentTime + 0.6) {
        const inBar = step % 8;
        const bar = Math.floor(step / 8);
        const chord = song.chords[Math.floor(bar / 2) % song.chords.length]!;
        // Four phrases of eight bars, each with its own seeded melody, then round again.
        if (step % 64 === 0) {
          rand = seeded(101 + (Math.floor(step / 64) % 4) * 37 + (track === "game" ? 500 : 0));
          note = 3;
        }
        if (step % 16 === 0) this.pad(out, chord.pad, next, eighth * 16);
        if (song.bass.includes(inBar)) {
          this.pluck(out, hz(chord.bass), next, inBar === 0 ? 1.6 : 0.7, 0.16, "sine");
        }
        const chance = inBar % 2 === 0 ? song.onBeat : song.offBeat;
        const roll = rand();
        const move = rand();
        if (roll < chance) {
          note = Math.max(0, Math.min(song.scale.length - 1, note + Math.round(move * 4 - 2)));
          this.pluck(out, hz(song.scale[note]!), next, song.ring, 0.07, "triangle");
        }
        if (song.shaker && inBar % 2 === 1) {
          this.noiseHit(out, next, "highpass", 7000, 0.7, 0.004, 0.05, inBar === 3 ? 0.03 : 0.018);
        }
        next += eighth;
        step++;
      }
    };
    tick();
    return { track, out, timer: setInterval(tick, 150) };
  }

  private stopMusic(playing: Playing): void {
    const ctx = this.ctx!;
    clearInterval(playing.timer);
    playing.out.gain.cancelScheduledValues(ctx.currentTime);
    playing.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => playing.out.disconnect(), 2500);
  }

  // --- Instruments -------------------------------------------------------------------------

  /** A soft, slowly swelling chord. */
  private pad(dest: AudioNode, notes: number[], t: number, length: number): void {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 1.4);
    gain.gain.setValueAtTime(0.05, t + length - 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.6);
    filter.connect(gain);
    gain.connect(dest);
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = hz(n);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + length + 0.7);
      }
    }
  }

  /** A plucked note, like a kalimba or a soft guitar string. */
  private pluck(
    dest: AudioNode,
    freq: number,
    t: number,
    ring: number,
    peak: number,
    type: OscillatorType,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + ring + 0.05);
  }

  /** A burst of filtered noise: the raw material of paper, card and air sounds. */
  private noiseHit(
    dest: AudioNode,
    t: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    attack: number,
    decay: number,
    peak: number,
    freqTo?: number,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t + attack + decay);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    // Start somewhere different in the noise each time, so no two sounds are identical.
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + decay + 0.05);
  }

  /** A short low knock, like a card landing on a wooden table. */
  private thump(dest: AudioNode, t: number, from: number, to: number, decay: number, peak: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + decay);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  private effect(cue: Cue, t: number): void {
    const { dry, wet } = this.effects!;
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.connect(dry);
    out.connect(wet);
    setTimeout(() => out.disconnect(), 3000);
    const r = Math.random;
    switch (cue) {
      case "play":
        // A light slide, then the card's edge and its body landing on the mat.
        this.noiseHit(out, t, "bandpass", 3500, 0.7, 0.02, 0.05, 0.06);
        this.noiseHit(out, t + 0.05, "bandpass", 2200 + r() * 600, 0.9, 0.002, 0.07, 0.45);
        this.noiseHit(out, t + 0.05, "lowpass", 700, 0.7, 0.002, 0.06, 0.35);
        this.thump(out, t + 0.05, 150, 70, 0.09, 0.22);
        break;
      case "discard":
        // A handful of tiny crinkles over a soft swish of paper.
        this.noiseHit(out, t, "bandpass", 1800, 0.5, 0.06, 0.22, 0.12);
        for (let i = 0; i < 6; i++) {
          const at = t + i * 0.035 + r() * 0.025;
          this.noiseHit(
            out,
            at,
            "bandpass",
            2500 + r() * 4000,
            1.6,
            0.003,
            0.025 + r() * 0.04,
            0.18 + r() * 0.2,
          );
        }
        break;
      case "attack":
        // A soft swoosh through the air that ends in a muffled knock.
        this.noiseHit(out, t, "bandpass", 300, 1.8, 0.2, 0.14, 0.32, 1900);
        this.thump(out, t + 0.24, 120, 55, 0.2, 0.3);
        this.noiseHit(out, t + 0.24, "lowpass", 450, 0.7, 0.003, 0.12, 0.22);
        break;
      case "yourTurn":
      case "theirTurn": {
        // Two gentle bell notes: rising for your turn, falling for your opponent's.
        const notes = cue === "yourTurn" ? [79, 86] : [81, 74];
        notes.forEach((n, i) => {
          const at = t + i * 0.13;
          this.pluck(out, hz(n), at, 1.3, 0.09, "sine");
          this.pluck(out, hz(n + 12), at, 0.5, 0.02, "sine");
        });
        break;
      }
    }
  }
}

/** The one mixer for the whole app. */
export const sound = new Mixer();
