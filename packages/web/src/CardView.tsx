import type { CardDefinition } from "@strawhat/engine";
import { KEYWORD_NAMES } from "./describe.js";

export type Glow = "playable" | "target" | "selected" | "attacker" | "defender" | null;

interface Props {
  def?: CardDefinition | undefined;
  faceDown?: boolean;
  rested?: boolean;
  don?: number;
  power?: number | undefined;
  glow?: Glow;
  dim?: boolean;
  size?: "small" | "normal" | "large";
  onClick?: (() => void) | undefined;
  onHover?: (() => void) | undefined;
  label?: string;
}

/** One card, drawn from its data. Real card art will replace the drawn face later. */
export function CardView({
  def,
  faceDown,
  rested,
  don = 0,
  power,
  glow = null,
  dim,
  size = "normal",
  onClick,
  onHover,
  label,
}: Props) {
  const classes = [
    "card",
    size,
    rested ? "rested" : "",
    glow ? `glow-${glow}` : "",
    dim ? "dim" : "",
    onClick ? "clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (faceDown || !def) {
    return (
      <div className={`${classes} back`} onClick={onClick} aria-label={label ?? "Face-down card"}>
        <div className="back-mark">
          <span>SH</span>
        </div>
      </div>
    );
  }

  const colors = def.colors;
  const background =
    colors.length > 1
      ? `linear-gradient(135deg, var(--c-${colors[0]}) 0 50%, var(--c-${colors[1]}) 50% 100%)`
      : `var(--c-${colors[0] ?? "black"})`;
  const shownPower = power ?? def.power;
  const boosted = power !== undefined && def.power !== undefined && power !== def.power;

  return (
    <div
      className={`${classes} face ${def.category}`}
      onClick={onClick}
      onMouseEnter={onHover}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={label ?? def.name}
    >
      <div className="card-band" style={{ background }} />
      {def.cost !== undefined && (
        <div className="card-cost" title="Cost">
          {def.cost}
        </div>
      )}
      {shownPower !== undefined && (
        <div className={`card-power ${boosted ? (power! > def.power! ? "up" : "down") : ""}`}>
          {shownPower}
        </div>
      )}
      {def.counter ? <div className="card-counter">+{def.counter / 1000}k</div> : null}
      <div className="card-body">
        <div className="card-name">{def.name}</div>
        <div className="card-category">{def.category}</div>
        {def.keywords?.length ? (
          <div className="card-keywords">
            {def.keywords.map((k) => (
              <span key={k}>{KEYWORD_NAMES[k]}</span>
            ))}
          </div>
        ) : null}
        {def.effects?.length ? <div className="card-effect-dot" title="Has effects" /> : null}
      </div>
      {don > 0 && <div className="card-don">+{don} DON!!</div>}
    </div>
  );
}
