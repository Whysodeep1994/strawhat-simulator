import { setOf, type CardCategory, type Color } from "@strawhat/engine";
import type { ReactNode } from "react";
import { officialText, setLabel, type Card } from "./card-data.js";

export const CATEGORY_NAMES: Record<CardCategory, string> = {
  leader: "Leader",
  character: "Character",
  event: "Event",
  stage: "Stage",
};

export const COLOR_NAMES: Record<Color, string> = {
  red: "Red",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  black: "Black",
  yellow: "Yellow",
};

const RARITY_NAMES: Record<string, string> = {
  L: "Leader",
  C: "Common",
  UC: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  SP: "Special",
  P: "Promo",
  TR: "Treasure Rare",
};

/**
 * Everything printed on a card, large and easy to read: the art and a table of its details and
 * official text. Used by the deck builder's preview and its card reader.
 */
export function CardPrint({
  card,
  image,
  legality,
  children,
}: {
  card: Card;
  image: string | undefined;
  /** e.g. "Up to 4 in Standard" or "Banned in Standard". */
  legality?: string | undefined;
  /** Buttons or notes under the details. */
  children?: ReactNode;
}) {
  const text = officialText(card);
  const rows: [string, ReactNode][] = [
    ["Card number", <span className="card-id">{card.id}</span>],
    ["Card type", CATEGORY_NAMES[card.category]],
    ["Colour", card.colors.map((c) => COLOR_NAMES[c]).join(" / ")],
  ];
  if (card.cost !== undefined) rows.push(["Cost", card.cost]);
  if (card.life !== undefined) rows.push(["Life", card.life]);
  if (card.power !== undefined) rows.push(["Power", card.power]);
  if (card.category === "character")
    rows.push(["Counter", card.counter ? `+${card.counter}` : "None"]);
  if (card.attribute) rows.push(["Attribute", card.attribute]);
  if (card.types?.length) rows.push(["Types", card.types.join(" / ")]);
  if (card.rarity) rows.push(["Rarity", RARITY_NAMES[card.rarity] ?? card.rarity]);
  if (card.blockIcon !== undefined) rows.push(["Block", card.blockIcon]);
  rows.push(["Set", setLabel(setOf(card.id))]);
  if (legality) rows.push(["Standard", legality]);

  return (
    <div className="card-print">
      {image ? (
        <img
          className="print-art"
          src={image}
          alt={`${card.name} (${card.id})`}
          draggable={false}
        />
      ) : null}
      <div className="print-text">
        <h3>{card.name}</h3>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {text.length ? (
          <div className="print-effect">
            {text.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="note">No effect text.</p>
        )}
        {children}
      </div>
    </div>
  );
}
