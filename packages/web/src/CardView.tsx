import type { CardDefinition, Keyword } from "@strawhat/engine";
import type { KeyboardEvent } from "react";
import { KEYWORD_HELP, KEYWORD_NAMES } from "./describe.js";

export type Glow =
  | "playable"
  | "target"
  | "selected"
  | "attacker"
  | "defender"
  /** The New Player coach's suggested card. */
  | "suggested"
  | null;

interface Props {
  def?: CardDefinition | undefined;
  /** Official card art. Cards without art are drawn from their data. */
  image?: string | undefined;
  faceDown?: boolean;
  /** Picture on the back of a face-down card; the classic back when missing. */
  back?: string | null | undefined;
  rested?: boolean;
  don?: number;
  power?: number | undefined;
  /** Keywords the card has right now; any it doesn't print, such as a gained [Double Attack], get a tag. */
  keywords?: Keyword[] | undefined;
  glow?: Glow;
  dim?: boolean;
  size?: "small" | "normal" | "large";
  /** Show the card name under the art, for cards on the field and in hand. */
  showName?: boolean;
  onClick?: (() => void) | undefined;
  onHover?: (() => void) | undefined;
  label?: string;
}

export function CardView({
  def,
  image,
  faceDown,
  back,
  rested,
  don = 0,
  power,
  keywords,
  glow = null,
  dim,
  size = "normal",
  showName = true,
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
      <div
        className={`${classes} back ${back ? "custom" : ""}`}
        style={back ? { backgroundImage: `url("${back}")` } : undefined}
        onClick={onClick}
        aria-label={label ?? "Face-down card"}
      >
        {!back && (
          <div className="back-mark" aria-hidden="true">
            <span className="back-ring" />
            <span className="back-text">STRAWHAT</span>
          </div>
        )}
      </div>
    );
  }

  const gained = (keywords ?? []).filter((k) => GAINED_TAGS.has(k) && !def.keywords?.includes(k));
  const shownPower = power ?? def.power;
  const changed = power !== undefined && def.power !== undefined && power !== def.power;
  const interactive = onClick
    ? {
        role: "button",
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div
      className={`${classes} face ${def.category} ${image ? "art" : "drawn"}`}
      onClick={onClick}
      onMouseEnter={onHover}
      aria-label={label ?? def.name}
      {...interactive}
    >
      {image ? (
        <img src={image} alt={def.name} draggable={false} loading="lazy" />
      ) : (
        <DrawnFace def={def} />
      )}
      {changed && (
        <div className={`card-power-chip ${power! > def.power! ? "up" : "down"}`}>{shownPower}</div>
      )}
      {don > 0 && <div className="card-don">+{don} DON!!</div>}
      {gained.length > 0 && (
        <div className="card-gained">
          {gained.map((k) => (
            <span key={k} title={KEYWORD_HELP[k]}>
              {KEYWORD_NAMES[k]}
            </span>
          ))}
        </div>
      )}
      {showName && image && size !== "large" && <div className="card-name-strip">{def.name}</div>}
    </div>
  );
}

/** Gained keywords worth a tag on the card: the ones that change how much Life a hit takes. */
const GAINED_TAGS = new Set<Keyword>(["doubleAttack", "banish"]);

/** Used only when a card has no art yet. */
function DrawnFace({ def }: { def: CardDefinition }) {
  const colors = def.colors;
  const background =
    colors.length > 1
      ? `linear-gradient(135deg, var(--c-${colors[0]}) 0 50%, var(--c-${colors[1]}) 50% 100%)`
      : `var(--c-${colors[0] ?? "black"})`;
  return (
    <>
      <div className="card-band" style={{ background }} />
      {def.cost !== undefined && <div className="card-cost">{def.cost}</div>}
      {def.power !== undefined && <div className="card-power">{def.power}</div>}
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
      </div>
    </>
  );
}

/** A DON!! card. Drawn, since DON!! art isn't part of the card data. */
export function DonCard({ rested, back }: { rested?: boolean; back?: boolean }) {
  return (
    <div className={`don-card ${rested ? "rested" : ""} ${back ? "back" : ""}`} aria-hidden="true">
      <span>DON!!</span>
    </div>
  );
}
