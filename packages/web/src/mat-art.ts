import { isUpload, presetOf, type MatPresetId } from "./playmat.js";
import { drawScene } from "./Scenery.js";

/**
 * The ready-made playmats: original One Piece-themed scenes drawn in code, so they need no image
 * files and belong to the project (no Bandai or fan art). Each one is drawn once, the first time
 * it's needed, and kept as a JPEG picture for the rest of the visit.
 */
const WIDTH = 1600;
const HEIGHT = 900;
const cache = new Map<MatPresetId, string>();

/** The picture to show for a seat's saved choice, or null for the default mat. */
export function matImage(choice: string | null): string | null {
  const preset = presetOf(choice);
  if (preset) return presetImage(preset);
  return isUpload(choice) ? choice : null;
}

export function presetImage(id: MatPresetId): string | null {
  const done = cache.get(id);
  if (done) return done;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  SCENES[id](ctx, WIDTH, HEIGHT, random(id));
  const image = canvas.toDataURL("image/jpeg", 0.86);
  cache.set(id, image);
  return image;
}

type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, w: number, h: number, rnd: () => number) => void;

const SCENES: Record<MatPresetId, Draw> = {
  sunset: (ctx, w, h) => drawScene(ctx, w, h, 0),
  "treasure-map": treasureMap,
  "lawn-deck": lawnDeck,
  wanted: wantedWall,
  "straw-hat": strawHat,
  wano: wanoNight,
  "sky-island": skyIsland,
  "fish-man-island": fishManIsland,
};

/** The same "random" picture every time: a small seeded generator per scene. */
function random(seed: string) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function vignette(ctx: Ctx, w: number, h: number, strength = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function blob(ctx: Ctx, x: number, y: number, r: number, rnd: () => number, points = 14) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.7 + rnd() * 0.45);
    const px = x + Math.cos(a) * rr * 1.4;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// An old sea chart of the world: the Red Line running top to bottom, the Grand Line across it
// with the Calm Belts on either side, and a dotted course to an X.
function treasureMap(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const paper = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.65);
  paper.addColorStop(0, "#efd9a6");
  paper.addColorStop(0.7, "#d8b77a");
  paper.addColorStop(1, "#9c7440");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(110, 70, 30, ${rnd() * 0.08})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  }

  const mid = h / 2;
  // Calm Belts.
  ctx.fillStyle = "rgba(90, 120, 110, 0.16)";
  ctx.fillRect(0, mid - h * 0.2, w, h * 0.07);
  ctx.fillRect(0, mid + h * 0.13, w, h * 0.07);
  // Grand Line.
  ctx.fillStyle = "rgba(60, 110, 140, 0.18)";
  ctx.fillRect(0, mid - h * 0.13, w, h * 0.26);
  ctx.strokeStyle = "rgba(90, 50, 20, 0.45)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  for (const y of [mid - h * 0.13, mid + h * 0.13]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Red Line.
  const rx = w * 0.28;
  ctx.fillStyle = "rgba(150, 60, 40, 0.55)";
  ctx.beginPath();
  ctx.moveTo(rx - 22, 0);
  for (let y = 0; y <= h; y += 30) ctx.lineTo(rx - 22 + Math.sin(y / 60) * 8, y);
  ctx.lineTo(rx + 22, h);
  for (let y = h; y >= 0; y -= 30) ctx.lineTo(rx + 22 + Math.sin(y / 50) * 8, y);
  ctx.closePath();
  ctx.fill();

  // Islands along the way.
  const islands: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const x = w * (0.08 + rnd() * 0.86);
    const y =
      i < 9
        ? mid + (rnd() - 0.5) * h * 0.2
        : rnd() < 0.5
          ? h * rnd() * 0.25
          : h * (0.75 + rnd() * 0.22);
    if (Math.abs(x - rx) < 60) continue;
    islands.push([x, y, 14 + rnd() * 34]);
  }
  for (const [x, y, r] of islands) {
    ctx.fillStyle = "rgba(160, 120, 60, 0.55)";
    blob(ctx, x, y, r, rnd);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 45, 15, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // The course, from the Red Line to the X.
  const route = islands.filter(([, y]) => Math.abs(y - mid) < h * 0.13).sort((a, b) => a[0] - b[0]);
  const end = { x: w * 0.9, y: mid - h * 0.04 };
  ctx.strokeStyle = "rgba(170, 30, 25, 0.8)";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(rx + 30, mid);
  for (const [x, y, r] of route) if (x > rx && x < end.x - 40) ctx.lineTo(x, y - r - 10);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(end.x - 22, end.y - 22);
  ctx.lineTo(end.x + 22, end.y + 22);
  ctx.moveTo(end.x + 22, end.y - 22);
  ctx.lineTo(end.x - 22, end.y + 22);
  ctx.stroke();
  ctx.lineCap = "butt";

  compassRose(ctx, w * 0.12, h * 0.8, h * 0.13);
  ctx.fillStyle = "rgba(80, 45, 15, 0.75)";
  ctx.font = `italic 600 ${h * 0.05}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("Grand Line", w * 0.62, mid + h * 0.105);
  ctx.save();
  ctx.translate(rx, h * 0.18);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `italic 600 ${h * 0.035}px Georgia, serif`;
  ctx.fillStyle = "rgba(255, 235, 200, 0.8)";
  ctx.fillText("Red Line", 0, 10);
  ctx.restore();
  vignette(ctx, w, h, 0.45);
}

function compassRose(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(80, 45, 15, 0.7)";
  ctx.lineWidth = 2;
  for (const rr of [r, r * 0.8]) {
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0;
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = long ? "rgba(150, 40, 30, 0.75)" : "rgba(80, 45, 15, 0.6)";
    ctx.beginPath();
    ctx.moveTo(0, -(long ? r * 1.1 : r * 0.7));
    ctx.lineTo(r * 0.12, 0);
    ctx.lineTo(-r * 0.12, 0);
    ctx.fill();
  }
  ctx.restore();
}

// The lawn deck of a pirate ship: soft grass between wooden rails, with a tangerine tree.
function lawnDeck(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const grass = ctx.createLinearGradient(0, 0, 0, h);
  grass.addColorStop(0, "#3f8a3a");
  grass.addColorStop(0.5, "#4f9e43");
  grass.addColorStop(1, "#356f2f");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, w, h);
  // Mowing stripes.
  for (let x = 0; x < w; x += 160) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(x, 0, 80, h);
  }
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 6 + rnd() * 10;
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(30, 80, 25, 0.5)" : "rgba(140, 200, 100, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 5, y - len);
    ctx.stroke();
  }
  // Wooden rails along the top and bottom.
  for (const y of [0, h - 60]) {
    const wood = ctx.createLinearGradient(0, y, 0, y + 60);
    wood.addColorStop(0, "#8a5a2f");
    wood.addColorStop(0.5, "#a8733f");
    wood.addColorStop(1, "#6b4222");
    ctx.fillStyle = wood;
    ctx.fillRect(0, y, w, 60);
    ctx.strokeStyle = "rgba(50, 25, 10, 0.5)";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 60);
      ctx.stroke();
      ctx.fillStyle = "rgba(40, 20, 8, 0.6)";
      ctx.beginPath();
      ctx.arc(x + 70, y + 30, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Tangerine trees in two corners, seen from above.
  for (const [x, y, s] of [
    [w * 0.06, h * 0.22, 1],
    [w * 0.94, h * 0.78, 0.85],
  ] as const) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x + 14, y + 16, 120 * s, 105 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 90 * s;
      ctx.fillStyle = rnd() < 0.5 ? "#1f5a22" : "#2c7a2c";
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 26 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 20 + rnd() * 80 * s;
      const fx = x + Math.cos(a) * d;
      const fy = y + Math.sin(a) * d;
      ctx.fillStyle = "#f08a1c";
      ctx.beginPath();
      ctx.arc(fx, fy, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 220, 150, 0.7)";
      ctx.beginPath();
      ctx.arc(fx - 3, fy - 3, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  vignette(ctx, w, h, 0.4);
}

// A wall of wanted posters pinned to weathered planks.
function wantedWall(ctx: Ctx, w: number, h: number, rnd: () => number) {
  planks(ctx, w, h, rnd, "#5a3a22", "#3e2716");
  const bounties = [
    "3,000,000,000",
    "1,111,000,000",
    "1,032,000,000",
    "500,000,000",
    "1,100,000,000",
    "383,000,000",
    "1,394,000,000",
    "394,000,000",
  ];
  const pw = w * 0.15;
  const ph = pw * 1.42;
  const cols = 5;
  for (let i = 0; i < 9; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = w * 0.04 + col * (w * 0.19) + (row ? w * 0.095 : 0) + (rnd() - 0.5) * 30;
    const y = h * 0.06 + row * (h * 0.47) + (rnd() - 0.5) * 30;
    poster(ctx, x, y, pw, ph, (rnd() - 0.5) * 0.12, bounties[i % bounties.length] ?? "", i);
  }
  vignette(ctx, w, h, 0.6);
}

function planks(ctx: Ctx, w: number, h: number, rnd: () => number, light: string, dark: string) {
  const ph = 90;
  for (let y = 0; y < h; y += ph) {
    ctx.fillStyle = rnd() < 0.5 ? light : dark;
    ctx.fillRect(0, y, w, ph);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(20, 10, 4, ${0.1 + rnd() * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gy = y + rnd() * ph;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(w * 0.3, gy + (rnd() - 0.5) * 10, w * 0.7, gy + (rnd() - 0.5) * 10, w, gy);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, y + ph - 3, w, 3);
  }
}

function poster(
  ctx: Ctx,
  x: number,
  y: number,
  pw: number,
  ph: number,
  tilt: number,
  bounty: string,
  n: number,
) {
  ctx.save();
  ctx.translate(x + pw / 2, y + ph / 2);
  ctx.rotate(tilt);
  ctx.translate(-pw / 2, -ph / 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(8, 10, pw, ph);
  const paper = ctx.createLinearGradient(0, 0, pw, ph);
  paper.addColorStop(0, "#f0dcae");
  paper.addColorStop(1, "#d3b47a");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, pw, ph);
  ctx.fillStyle = "#3a2414";
  ctx.textAlign = "center";
  ctx.font = `900 ${pw * 0.2}px Georgia, serif`;
  ctx.fillText("WANTED", pw / 2, pw * 0.24);
  // The picture: a pirate's silhouette in a straw hat, a bandana, or a tricorn.
  const px = pw * 0.12;
  const py = pw * 0.32;
  const pww = pw * 0.76;
  const phh = pw * 0.62;
  ctx.fillStyle = "#c9a56b";
  ctx.fillRect(px, py, pww, phh);
  ctx.strokeStyle = "#3a2414";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pww, phh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pww, phh);
  ctx.clip();
  const cx = pw / 2;
  const cy = py + phh * 0.62;
  ctx.fillStyle = "#4a2e18";
  ctx.beginPath();
  ctx.ellipse(cx, py + phh * 1.05, pww * 0.42, phh * 0.4, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, phh * 0.22, 0, Math.PI * 2);
  ctx.fill();
  const hat = n % 3;
  ctx.fillStyle = hat === 0 ? "#e2b84a" : "#2a1a0e";
  if (hat === 0 || hat === 2) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - phh * 0.14, phh * 0.42, phh * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy - phh * 0.18, phh * 0.22, phh * 0.17, 0, Math.PI, 0);
    ctx.fill();
    if (hat === 0) {
      ctx.fillStyle = "#b52a1e";
      ctx.fillRect(cx - phh * 0.22, cy - phh * 0.21, phh * 0.44, phh * 0.05);
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy - phh * 0.06, phh * 0.24, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#3a2414";
  ctx.font = `700 ${pw * 0.085}px Georgia, serif`;
  ctx.fillText("DEAD OR ALIVE", pw / 2, py + phh + pw * 0.12);
  ctx.font = `700 ${pw * 0.085}px Georgia, serif`;
  ctx.fillText(`B ${bounty} -`, pw / 2, py + phh + pw * 0.27);
  ctx.font = `700 ${pw * 0.05}px Georgia, serif`;
  ctx.fillText("MARINE", pw / 2, ph - pw * 0.06);
  // A pin at the top.
  ctx.fillStyle = "#a02218";
  ctx.beginPath();
  ctx.arc(pw / 2, 10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A straw hat resting on an old wooden table.
function strawHat(ctx: Ctx, w: number, h: number, rnd: () => number) {
  planks(ctx, w, h, rnd, "#7a4f2c", "#6a4325");
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = h * 0.36;
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(cx + 24, cy + 30, r * 1.05, r * 0.98, 0, 0, Math.PI * 2);
  ctx.fill();
  // Brim, seen from above, with the woven rings.
  const straw = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  straw.addColorStop(0, "#f4d27a");
  straw.addColorStop(1, "#c9962f");
  ctx.fillStyle = straw;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  for (let rr = r * 0.98; rr > r * 0.5; rr -= 7) {
    ctx.strokeStyle = `rgba(120, 80, 20, ${0.18 + rnd() * 0.12})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Frayed edge.
  ctx.strokeStyle = "rgba(200, 150, 60, 0.9)";
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2 + rnd() * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98);
    ctx.lineTo(
      cx + Math.cos(a) * r * (1.02 + rnd() * 0.04),
      cy + Math.sin(a) * r * (1.02 + rnd() * 0.04),
    );
    ctx.stroke();
  }
  // Red band and crown.
  ctx.fillStyle = "#b8231a";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  const crown = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, 5, cx, cy, r * 0.44);
  crown.addColorStop(0, "#f7dc8c");
  crown.addColorStop(1, "#d6a23c");
  ctx.fillStyle = crown;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
  for (let rr = r * 0.42; rr > 6; rr -= 7) {
    ctx.strokeStyle = "rgba(130, 85, 20, 0.2)";
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  vignette(ctx, w, h, 0.55);
}

// The Land of Wano by night: a full moon, a great mountain, and cherry blossoms on the wind.
function wanoNight(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#120c2a");
  sky.addColorStop(0.6, "#3b1d4a");
  sky.addColorStop(1, "#6b2a46");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const moon = { x: w * 0.72, y: h * 0.3, r: h * 0.2 };
  const glow = ctx.createRadialGradient(moon.x, moon.y, moon.r, moon.x, moon.y, moon.r * 3);
  glow.addColorStop(0, "rgba(255, 230, 190, 0.35)");
  glow.addColorStop(1, "rgba(255, 230, 190, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fbecc8";
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
  ctx.fill();
  // Mountain with a snowy top.
  ctx.fillStyle = "#24163a";
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.8);
  ctx.lineTo(w * 0.33, h * 0.25);
  ctx.lineTo(w * 0.4, h * 0.25);
  ctx.lineTo(w * 0.72, h * 0.8);
  ctx.fill();
  ctx.fillStyle = "#e9dff0";
  ctx.beginPath();
  ctx.moveTo(w * 0.33, h * 0.25);
  ctx.lineTo(w * 0.4, h * 0.25);
  ctx.lineTo(w * 0.44, h * 0.34);
  ctx.lineTo(w * 0.41, h * 0.32);
  ctx.lineTo(w * 0.38, h * 0.36);
  ctx.lineTo(w * 0.35, h * 0.31);
  ctx.lineTo(w * 0.31, h * 0.34);
  ctx.closePath();
  ctx.fill();
  // Waves in the old woodblock style.
  ctx.fillStyle = "#1c2a5a";
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.strokeStyle = "rgba(220, 230, 255, 0.55)";
  ctx.lineWidth = 3;
  for (let row = 0; row < 4; row++) {
    const y = h * (0.82 + row * 0.05);
    for (let x = -60 + (row % 2) * 40; x < w + 60; x += 80) {
      ctx.beginPath();
      ctx.arc(x, y, 30, Math.PI, Math.PI * 1.9);
      ctx.stroke();
    }
  }
  // A cherry tree branch from the top left.
  ctx.strokeStyle = "#1a0d14";
  ctx.lineCap = "round";
  const branch = (x: number, y: number, a: number, len: number, width: number, depth: number) => {
    if (depth === 0 || len < 20) return;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    blossoms.push([x2, y2]);
    branch(x2, y2, a + 0.4 + rnd() * 0.3, len * 0.72, width * 0.65, depth - 1);
    branch(x2, y2, a - 0.3 - rnd() * 0.3, len * 0.7, width * 0.65, depth - 1);
  };
  const blossoms: [number, number][] = [];
  branch(-20, h * 0.05, 0.35, 220, 26, 6);
  ctx.lineCap = "butt";
  for (const [x, y] of blossoms) {
    for (let i = 0; i < 6; i++)
      petal(ctx, x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 50, 7 + rnd() * 6, rnd());
  }
  for (let i = 0; i < 90; i++) petal(ctx, rnd() * w, rnd() * h * 0.85, 4 + rnd() * 4, rnd());
  vignette(ctx, w, h, 0.45);
}

function petal(ctx: Ctx, x: number, y: number, r: number, turn: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn * Math.PI * 2);
  ctx.fillStyle = turn < 0.5 ? "rgba(255, 183, 206, 0.9)" : "rgba(255, 214, 228, 0.85)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// An island in the sky: a sea of white clouds under bright blue, with a golden bell shining.
function skyIsland(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#2f74c9");
  sky.addColorStop(0.55, "#8cc8f0");
  sky.addColorStop(1, "#e8f6ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Tall cloud towers in the distance.
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w;
    const top = h * (0.15 + rnd() * 0.25);
    puffColumn(ctx, x, top, h * 0.7, 60 + rnd() * 60, rnd, "rgba(255, 255, 255, 0.55)");
  }
  // The golden bell on its cloud island.
  const bx = w * 0.78;
  const by = h * 0.32;
  const shine = ctx.createRadialGradient(bx, by, 10, bx, by, 200);
  shine.addColorStop(0, "rgba(255, 236, 150, 0.9)");
  shine.addColorStop(1, "rgba(255, 236, 150, 0)");
  ctx.fillStyle = shine;
  ctx.fillRect(bx - 200, by - 200, 400, 400);
  ctx.fillStyle = "#e0b02c";
  ctx.beginPath();
  ctx.moveTo(bx - 34, by + 40);
  ctx.quadraticCurveTo(bx - 30, by - 40, bx, by - 44);
  ctx.quadraticCurveTo(bx + 30, by - 40, bx + 34, by + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f6d561";
  ctx.fillRect(bx - 40, by + 36, 80, 9);
  // The sea of clouds.
  for (let row = 0; row < 5; row++) {
    const y = h * (0.55 + row * 0.1);
    for (let x = -80; x < w + 80; x += 90 + rnd() * 50) {
      ctx.fillStyle = `rgba(236, 244, 255, ${0.55 + row * 0.06})`;
      ctx.beginPath();
      ctx.arc(x, y + rnd() * 20, 60 + rnd() * 40 + row * 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(170, 200, 230, 0.18)";
    ctx.fillRect(0, y + 40, w, 8);
  }
  vignette(ctx, w, h, 0.35);
}

function puffColumn(
  ctx: Ctx,
  x: number,
  top: number,
  bottom: number,
  r: number,
  rnd: () => number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let y = bottom; y > top; y -= r * 0.6) {
    ctx.beginPath();
    ctx.arc(x + (rnd() - 0.5) * r, y, r * (0.7 + rnd() * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Deep under the sea: sunlight falling from far above, coral, and rising bubbles.
function fishManIsland(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const sea = ctx.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, "#1a8fb0");
  sea.addColorStop(0.5, "#0f5a86");
  sea.addColorStop(1, "#071f44");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
  // Light rays from the surface.
  for (let i = 0; i < 9; i++) {
    const x = w * (0.1 + i * 0.1 + (rnd() - 0.5) * 0.05);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(220, 250, 255, 0.22)");
    g.addColorStop(1, "rgba(220, 250, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40 + rnd() * 40, 0);
    ctx.lineTo(x + 180 + rnd() * 80, h);
    ctx.lineTo(x + 60, h);
    ctx.fill();
  }
  // A great bubble dome around a far-off island.
  const dx = w * 0.5;
  const dy = h * 0.42;
  const dr = h * 0.24;
  ctx.fillStyle = "rgba(160, 230, 255, 0.12)";
  ctx.beginPath();
  ctx.arc(dx, dy, dr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(220, 250, 255, 0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 220, 240, 0.35)";
  for (let i = 0; i < 6; i++) {
    const x = dx + (i - 2.5) * dr * 0.25;
    const top = dy + dr * (0.1 - (i % 3) * 0.12);
    ctx.fillRect(x - 10, top, 20, dy + dr * 0.75 - top);
    ctx.beginPath();
    ctx.arc(x, top, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  // Coral along the sea floor.
  ctx.fillStyle = "#0a1a33";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * 0.9 + Math.sin(x / 90) * 18);
  ctx.lineTo(w, h);
  ctx.fill();
  const corals = ["#e25d7a", "#f28a3c", "#b05ad6", "#e8c34a"];
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    coral(ctx, x, h * 0.92, 40 + rnd() * 70, corals[i % corals.length] ?? "#e25d7a", rnd);
  }
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w;
    const y = rnd() * h * 0.9;
    const r = 2 + rnd() * 9;
    ctx.strokeStyle = "rgba(230, 250, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  vignette(ctx, w, h, 0.5);
}

function coral(ctx: Ctx, x: number, y: number, len: number, color: string, rnd: () => number) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  const grow = (x1: number, y1: number, a: number, l: number, width: number) => {
    if (l < 8) return;
    const x2 = x1 + Math.cos(a) * l;
    const y2 = y1 + Math.sin(a) * l;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    grow(x2, y2, a - 0.4 - rnd() * 0.2, l * 0.65, width * 0.7);
    grow(x2, y2, a + 0.4 + rnd() * 0.2, l * 0.65, width * 0.7);
  };
  grow(x, y, -Math.PI / 2 + (rnd() - 0.5) * 0.4, len * 0.5, 9);
  ctx.lineCap = "butt";
}
