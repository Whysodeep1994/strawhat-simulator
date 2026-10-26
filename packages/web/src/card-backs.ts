/**
 * Card backs: the picture on the back of each player's cards (their Deck, Life and the opponent's
 * hand). A player picks one of the built-in designs, all drawn for this app, or uploads their own
 * picture. The choice stays in this browser only (localStorage), like playmats.
 */
import type { MatSeat } from "./playmat.js";

export interface BackPreset {
  id: string;
  name: string;
  /** The design as a picture URL; null for the classic back, which is drawn by the stylesheet. */
  image: string | null;
}

/** What a seat has chosen: a preset ("preset:<id>") or an uploaded picture (a data URL). */
export type BackChoice = string;

export const CLASSIC = "classic";

const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 126 176" preserveAspectRatio="xMidYMid slice">${body}</svg>`,
  )}`;

const SERIF = `font-family="Georgia, 'Times New Roman', serif" font-weight="bold" text-anchor="middle"`;

const frame = (color: string) =>
  `<rect x="6" y="6" width="114" height="164" rx="6" fill="none" stroke="${color}" stroke-width="2"/>`;

const parchment = `<defs><radialGradient id="p" r="75%"><stop offset="0.55" stop-color="#ecd7a6"/><stop offset="1" stop-color="#b98f4f"/></radialGradient></defs><rect width="126" height="176" fill="url(#p)"/>`;

/** Points of a compass star, as a path centred on 0,0. */
function star(long: number, short: number) {
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? long : short;
    points.push(`${(r * Math.cos(angle)).toFixed(1)} ${(r * Math.sin(angle)).toFixed(1)}`);
    const mid = angle + Math.PI / 8;
    points.push(`${(5 * Math.cos(mid)).toFixed(1)} ${(5 * Math.sin(mid)).toFixed(1)}`);
  }
  return `M${points.join("L")}Z`;
}

/** The spokes of a ship's wheel, centred on 0,0. */
function spokes() {
  let out = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const [x, y] = [Math.cos(a), Math.sin(a)];
    out += `<line x1="${(6 * x).toFixed(1)}" y1="${(6 * y).toFixed(1)}" x2="${(36 * x).toFixed(1)}" y2="${(36 * y).toFixed(1)}"/>`;
    out += `<circle cx="${(38 * x).toFixed(1)}" cy="${(38 * y).toFixed(1)}" r="3.5" fill="#e0b84a" stroke="none"/>`;
  }
  return out;
}

export const BACK_PRESETS: BackPreset[] = [
  { id: CLASSIC, name: "Classic", image: null },
  {
    id: "grand-line",
    name: "Grand Line",
    image: svg(
      `<defs><radialGradient id="g" r="70%"><stop offset="0" stop-color="#1f5592"/><stop offset="1" stop-color="#091831"/></radialGradient></defs>` +
        `<rect width="126" height="176" fill="url(#g)"/>${frame("#d4af37")}` +
        `<g transform="translate(63 84)"><circle r="42" fill="none" stroke="#d4af37" stroke-width="2"/>` +
        `<circle r="35" fill="none" stroke="#d4af37" stroke-dasharray="2 3"/>` +
        `<path d="${star(46, 24)}" fill="#d4af37"/><circle r="4" fill="#091831" stroke="#d4af37" stroke-width="1.5"/></g>` +
        `<text x="63" y="35" ${SERIF} font-size="8" fill="#d4af37">N</text>` +
        `<text x="63" y="155" ${SERIF} font-size="11" letter-spacing="2" fill="#d4af37">GRAND LINE</text>`,
    ),
  },
  {
    id: "straw-hat",
    name: "Straw Hat",
    image: svg(
      `<defs><linearGradient id="r" x2="1" y2="1"><stop offset="0" stop-color="#b3202a"/><stop offset="1" stop-color="#5a0d14"/></linearGradient></defs>` +
        `<rect width="126" height="176" fill="url(#r)"/>${frame("#f2d36b")}` +
        `<ellipse cx="63" cy="98" rx="48" ry="13" fill="#e2b94f" stroke="#9c7420" stroke-width="1.5"/>` +
        `<path d="M32 97Q33 56 63 54Q93 56 94 97Q63 104 32 97Z" fill="#f2d36b" stroke="#9c7420" stroke-width="1.5"/>` +
        `<path d="M33 84Q63 77 93 84L94 95Q63 101 32 95Z" fill="#c8202b"/>` +
        `<path d="M42 64Q63 58 84 64M37 74Q63 66 89 74" fill="none" stroke="#c99a32" stroke-width="1"/>` +
        `<text x="63" y="146" ${SERIF} font-size="12" letter-spacing="2" fill="#f2d36b">STRAW HAT</text>`,
    ),
  },
  {
    id: "jolly-roger",
    name: "Jolly Roger",
    image: svg(
      `<rect width="126" height="176" fill="#111"/>${frame("#e8e8e8")}` +
        `<g stroke="#f4f4f4" stroke-width="7" stroke-linecap="round"><line x1="32" y1="98" x2="94" y2="132"/><line x1="94" y1="98" x2="32" y2="132"/></g>` +
        `<g fill="#f4f4f4"><circle cx="29" cy="94" r="5"/><circle cx="35" cy="96" r="5"/><circle cx="97" cy="94" r="5"/><circle cx="91" cy="96" r="5"/>` +
        `<circle cx="29" cy="136" r="5"/><circle cx="35" cy="134" r="5"/><circle cx="97" cy="136" r="5"/><circle cx="91" cy="134" r="5"/>` +
        `<circle cx="63" cy="74" r="24"/><rect x="50" y="88" width="26" height="18" rx="5"/></g>` +
        `<g fill="#111"><circle cx="54" cy="74" r="7"/><circle cx="72" cy="74" r="7"/><path d="M63 82L59 90H67Z"/></g>` +
        `<g stroke="#111" stroke-width="1.5"><line x1="57" y1="98" x2="57" y2="106"/><line x1="63" y1="98" x2="63" y2="106"/><line x1="69" y1="98" x2="69" y2="106"/></g>`,
    ),
  },
  {
    id: "wanted",
    name: "Wanted Poster",
    image: svg(
      `${parchment}${frame("#6b4a22")}` +
        `<text x="63" y="34" ${SERIF} font-size="22" fill="#4a2f12">WANTED</text>` +
        `<rect x="20" y="42" width="86" height="76" fill="#d9bd83" stroke="#6b4a22" stroke-width="1.5"/>` +
        `<path d="M40 118Q42 96 63 94Q84 96 86 118Z M63 92A14 14 0 1 0 63 64A14 14 0 1 0 63 92Z" fill="#8a6a3a"/>` +
        `<text x="63" y="96" ${SERIF} font-size="12" fill="#ecd7a6">?</text>` +
        `<text x="63" y="134" ${SERIF} font-size="9" letter-spacing="1" fill="#4a2f12">DEAD OR ALIVE</text>` +
        `<text x="63" y="152" ${SERIF} font-size="10" fill="#4a2f12">฿ ???,???,???-</text>`,
    ),
  },
  {
    id: "treasure-map",
    name: "Treasure Map",
    image: svg(
      `${parchment}${frame("#6b4a22")}` +
        `<g stroke="#a88552" stroke-width="0.5" opacity="0.6"><path d="M6 50H120M6 94H120M6 138H120M42 6V170M84 6V170"/></g>` +
        `<path d="M20 40Q34 24 52 34Q66 30 64 48Q72 62 54 66Q40 76 30 62Q14 56 20 40Z" fill="#cfae6c" stroke="#6b4a22" stroke-width="1.2"/>` +
        `<path d="M70 104Q86 90 102 102Q114 116 104 132Q94 148 78 140Q62 128 70 104Z" fill="#cfae6c" stroke="#6b4a22" stroke-width="1.2"/>` +
        `<path d="M44 52Q60 80 50 98Q44 116 74 112Q84 112 88 120" fill="none" stroke="#8b2a1a" stroke-width="1.8" stroke-dasharray="3 3"/>` +
        `<g stroke="#b3202a" stroke-width="3" stroke-linecap="round"><line x1="83" y1="115" x2="93" y2="125"/><line x1="93" y1="115" x2="83" y2="125"/></g>` +
        `<g transform="translate(30 140)"><path d="${star(13, 6)}" fill="#6b4a22"/></g>`,
    ),
  },
  {
    id: "helm",
    name: "Ship's Helm",
    image: svg(
      `<defs><linearGradient id="s" y2="1"><stop offset="0" stop-color="#2a7bb8"/><stop offset="1" stop-color="#0b2747"/></linearGradient>` +
        `<pattern id="w" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 8Q6 2 12 8T24 8" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/></pattern></defs>` +
        `<rect width="126" height="176" fill="url(#s)"/><rect width="126" height="176" fill="url(#w)"/>${frame("#e0b84a")}` +
        `<g transform="translate(63 88)" stroke="#e0b84a" stroke-width="3" fill="none">${spokes()}` +
        `<circle r="28" stroke-width="5" stroke="#8a5a2b"/><circle r="28" stroke-width="1.5"/><circle r="7" fill="#8a5a2b"/></g>`,
    ),
  },
];

const key = (seat: MatSeat) => `strawhat.cardback.${seat}`;

export const presetChoice = (id: string): BackChoice => `preset:${id}`;

export function loadBack(seat: MatSeat): BackChoice {
  try {
    return localStorage.getItem(key(seat)) ?? presetChoice(CLASSIC);
  } catch {
    return presetChoice(CLASSIC);
  }
}

/** Returns false when the browser refused to store it (private mode or out of space). */
export function saveBack(seat: MatSeat, choice: BackChoice): boolean {
  try {
    if (choice === presetChoice(CLASSIC)) localStorage.removeItem(key(seat));
    else localStorage.setItem(key(seat), choice);
    return true;
  } catch {
    return false;
  }
}

/** The picture to show for a choice, or null for the classic back. Unknown presets fall back to classic. */
export function backImage(choice: BackChoice): string | null {
  if (choice.startsWith("preset:")) {
    const id = choice.slice("preset:".length);
    return BACK_PRESETS.find((p) => p.id === id)?.image ?? null;
  }
  return choice.startsWith("data:image/") ? choice : null;
}

/** Card backs are 63 × 88 mm, like the real cards. */
const CARD_RATIO = 63 / 88;

/** Reads an uploaded picture, crops it to card shape from the middle and shrinks it to a JPEG. */
export async function readBackImage(file: File, width = 360): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file (JPG, PNG, or WebP).");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image couldn't be opened. Try a JPG or PNG."));
      img.src = url;
    });
    const { naturalWidth: w, naturalHeight: h } = image;
    const cropW = Math.min(w, h * CARD_RATIO);
    const cropH = cropW / CARD_RATIO;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(width, Math.round(cropW));
    canvas.height = Math.round(canvas.width / CARD_RATIO);
    canvas
      .getContext("2d")
      ?.drawImage(
        image,
        (w - cropW) / 2,
        (h - cropH) / 2,
        cropW,
        cropH,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
