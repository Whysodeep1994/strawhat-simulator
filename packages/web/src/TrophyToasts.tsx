import { useEffect } from "react";
import { TIER_POINTS, trophyById, type Tier } from "./trophies.js";

const SHOW_MS = 4200;

/** A trophy's medal: a coin in its tier's colour with a star. Original artwork, drawn in SVG. */
export function Medal({ tier, locked = false }: { tier: Tier; locked?: boolean }) {
  return (
    <svg
      className={`medal ${tier} ${locked ? "locked" : ""}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18" className="medal-rim" />
      <circle cx="20" cy="20" r="13.5" className="medal-face" />
      <path
        d="M20 10.5l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L20 25l-5.7 3 1.2-6.4-4.7-4.4 6.4-.8z"
        className="medal-star"
      />
    </svg>
  );
}

/** Pops up each newly earned trophy in turn, like a console's achievement notice. */
export function TrophyToasts({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const trophy = ids[0] ? trophyById(ids[0]) : undefined;

  useEffect(() => {
    if (!ids[0]) return;
    const timer = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(timer);
  }, [ids[0], ids.length]);

  if (!trophy) return null;
  return (
    <div className="trophy-toast" role="status" key={trophy.id} onClick={onDone}>
      <Medal tier={trophy.tier} />
      <div>
        <span className="toast-kicker">Trophy earned · {TIER_POINTS[trophy.tier]} points</span>
        <strong>{trophy.name}</strong>
        <span>{trophy.text}</span>
      </div>
    </div>
  );
}
