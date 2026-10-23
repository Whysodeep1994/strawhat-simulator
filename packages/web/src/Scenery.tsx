import { useEffect, useRef } from "react";

/**
 * The home screen backdrop: an original painted scene of a pirate ship sailing the open sea
 * at sunset. Drawn in code, so it needs no image files and belongs to the project.
 */
export function Scenery() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let raf = 0;
    let last = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(el.clientWidth * ratio);
      el.height = Math.round(el.clientHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(ctx, el.clientWidth, el.clientHeight, frame);
    };
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (time - last < 33) return; // about 30 frames a second is plenty for waves
      last = time;
      frame++;
      draw(ctx, el.clientWidth, el.clientHeight, frame);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!still) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvas} className="scenery" aria-hidden="true" />;
}

// Fixed "random" layout so the scene looks the same every time.
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: ((i * 7919) % 1000) / 1000,
  y: ((i * 104729) % 1000) / 1000,
  r: 0.4 + ((i * 31) % 10) / 10,
}));
const CLOUDS = [
  { x: 0.08, y: 0.2, w: 0.3, speed: 0.00004 },
  { x: 0.55, y: 0.13, w: 0.36, speed: 0.00003 },
  { x: 0.82, y: 0.3, w: 0.22, speed: 0.00005 },
  { x: 0.3, y: 0.36, w: 0.2, speed: 0.00006 },
];

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const horizon = h * 0.6;

  // Sky: night blue at the top, sunset at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#141a3d");
  sky.addColorStop(0.45, "#5b2a6e");
  sky.addColorStop(0.75, "#e0663f");
  sky.addColorStop(1, "#ffcf7a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  for (const s of STARS) {
    if (s.y > 0.4) continue;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t / 40 + s.x * 20));
    ctx.fillStyle = "#fff6e0";
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * horizon, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Sun, half set.
  const sunX = w * 0.68;
  const sunR = Math.min(w, h) * 0.11;
  const glow = ctx.createRadialGradient(sunX, horizon, sunR * 0.5, sunX, horizon, sunR * 4);
  glow.addColorStop(0, "rgba(255, 220, 140, 0.75)");
  glow.addColorStop(1, "rgba(255, 140, 80, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = "#ffe3a3";
  ctx.beginPath();
  ctx.arc(sunX, horizon, sunR, Math.PI, 0);
  ctx.fill();

  // Clouds drifting across the sunset.
  for (const c of CLOUDS) {
    const x = (((c.x + t * c.speed * 33) % 1.4) - 0.2) * w;
    cloud(ctx, x, c.y * horizon, c.w * w);
  }

  // Far islands.
  ctx.fillStyle = "#3a1f45";
  island(ctx, w * 0.12, horizon, w * 0.22, h * 0.07);
  island(ctx, w * 0.9, horizon, w * 0.16, h * 0.05);
  ctx.fillStyle = "#2b1838";
  island(ctx, w * 0.28, horizon, w * 0.1, h * 0.035);

  // Sea.
  const sea = ctx.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, "#f39a5b");
  sea.addColorStop(0.15, "#8c3f63");
  sea.addColorStop(0.5, "#23315f");
  sea.addColorStop(1, "#0b1530");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Sunlight on the water.
  for (let i = 0; i < 26; i++) {
    const y = horizon + 4 + i * i * 0.55 * (h / 900);
    if (y > h) break;
    const spread = sunR * (0.6 + i * 0.12);
    const wobble = Math.sin(t / 12 + i) * spread * 0.25;
    ctx.globalAlpha = Math.max(0, 0.75 - i * 0.03);
    ctx.fillStyle = "#ffd894";
    ctx.fillRect(
      sunX - spread / 2 + wobble,
      y,
      spread * (0.4 + 0.6 * Math.abs(Math.sin(i + t / 20))),
      2,
    );
  }
  ctx.globalAlpha = 1;

  // Rolling wave lines.
  for (let row = 0; row < 9; row++) {
    const y = horizon + (h - horizon) * (0.12 + row * 0.11);
    ctx.strokeStyle = `rgba(255, 210, 170, ${0.06 + row * 0.012})`;
    ctx.lineWidth = 1 + row * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const yy = y + Math.sin(x / (40 + row * 12) + t / (14 - row * 0.6) + row) * (2 + row * 0.8);
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // The ship, bobbing on the waves.
  const shipX = w * 0.3 + Math.sin(t / 150) * w * 0.01;
  const shipY = horizon + (h - horizon) * 0.32 + Math.sin(t / 18) * 3;
  ship(ctx, shipX, shipY, Math.min(w, h) * 0.28, Math.sin(t / 22) * 0.025);

  // Seagulls.
  ctx.strokeStyle = "rgba(30, 16, 40, 0.8)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const gx = (((i * 0.23 + t * 0.0007) % 1.2) - 0.1) * w;
    const gy = horizon * (0.25 + i * 0.09) + Math.sin(t / 10 + i) * 4;
    const flap = 4 + Math.sin(t / 4 + i * 2) * 3;
    const span = 9 + i * 2;
    ctx.beginPath();
    ctx.moveTo(gx - span, gy - flap);
    ctx.quadraticCurveTo(gx - span / 2, gy - flap - 3, gx, gy);
    ctx.quadraticCurveTo(gx + span / 2, gy - flap - 3, gx + span, gy - flap);
    ctx.stroke();
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  const g = ctx.createLinearGradient(0, y - width * 0.1, 0, y + width * 0.08);
  g.addColorStop(0, "rgba(255, 196, 160, 0.55)");
  g.addColorStop(1, "rgba(160, 70, 110, 0.35)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.5, width * 0.07, 0, 0, Math.PI * 2);
  ctx.ellipse(x - width * 0.18, y - width * 0.05, width * 0.18, width * 0.08, 0, 0, Math.PI * 2);
  ctx.ellipse(x + width * 0.1, y - width * 0.07, width * 0.22, width * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

function island(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  width: number,
  height: number,
) {
  ctx.beginPath();
  ctx.moveTo(x - width / 2, base);
  ctx.bezierCurveTo(
    x - width / 4,
    base - height * 1.1,
    x + width / 6,
    base - height * 1.3,
    x + width / 2,
    base,
  );
  ctx.fill();
}

function ship(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const s = size / 100;
  ctx.fillStyle = "#1a0f22";
  ctx.strokeStyle = "#1a0f22";

  // Hull.
  ctx.beginPath();
  ctx.moveTo(-48 * s, -10 * s);
  ctx.quadraticCurveTo(-40 * s, 14 * s, -10 * s, 16 * s);
  ctx.lineTo(30 * s, 16 * s);
  ctx.quadraticCurveTo(50 * s, 10 * s, 58 * s, -14 * s);
  ctx.lineTo(44 * s, -8 * s);
  ctx.lineTo(-48 * s, -10 * s);
  ctx.fill();
  // Figurehead.
  ctx.beginPath();
  ctx.arc(60 * s, -18 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Masts.
  ctx.lineWidth = 2.2 * s;
  for (const [mx, top] of [
    [-18, -78],
    [14, -96],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(mx * s, -8 * s);
    ctx.lineTo(mx * s, top * s);
    ctx.stroke();
  }

  // Sails, lit by the sunset from behind.
  ctx.fillStyle = "rgba(255, 233, 196, 0.92)";
  sail(ctx, -18 * s, -70 * s, 30 * s, 26 * s);
  sail(ctx, -18 * s, -40 * s, 34 * s, 26 * s);
  sail(ctx, 14 * s, -88 * s, 34 * s, 30 * s);
  sail(ctx, 14 * s, -54 * s, 40 * s, 36 * s);

  // Flag.
  ctx.fillStyle = "#1a0f22";
  ctx.beginPath();
  ctx.moveTo(14 * s, -96 * s);
  ctx.lineTo(32 * s, -92 * s);
  ctx.lineTo(14 * s, -86 * s);
  ctx.fill();
  ctx.restore();
}

function sail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  width: number,
  height: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, top);
  ctx.quadraticCurveTo(cx, top - height * 0.12, cx + width / 2, top);
  ctx.quadraticCurveTo(cx + width * 0.62, top + height / 2, cx + width / 2, top + height);
  ctx.quadraticCurveTo(cx, top + height * 1.1, cx - width / 2, top + height);
  ctx.quadraticCurveTo(cx - width * 0.38, top + height / 2, cx - width / 2, top);
  ctx.fill();
}
