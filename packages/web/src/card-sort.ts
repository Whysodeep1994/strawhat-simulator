import type { CardCategory } from "@strawhat/engine";
import type { Card } from "./card-data.js";

/** The deck builder's sort orders. */
export type SortKey = "number" | "cost" | "power" | "category" | "attribute";

export const SORT_NAMES: Record<SortKey, string> = {
  number: "Card number",
  cost: "Cost",
  power: "Power",
  category: "Card type",
  attribute: "Attribute",
};

const CATEGORY_ORDER: CardCategory[] = ["leader", "character", "event", "stage"];

/**
 * Sorts cards for the library. Cards with no value for the key (an Event has no power) go last
 * either way, and ties fall back to cost, then card number, so the order never jumps around.
 */
export function sortCards(cards: Card[], key: SortKey, descending = false): Card[] {
  const value = (card: Card): number | string | undefined => {
    switch (key) {
      case "number":
        return undefined;
      case "cost":
        return card.cost;
      case "power":
        return card.power;
      case "category":
        return CATEGORY_ORDER.indexOf(card.category);
      case "attribute":
        return card.attribute ?? undefined;
    }
  };
  const byNumber = (a: Card, b: Card) => a.id.localeCompare(b.id, "en", { numeric: true });
  const direction = descending ? -1 : 1;
  return [...cards].sort((a, b) => {
    if (key === "number") return direction * byNumber(a, b);
    const va = value(a);
    const vb = value(b);
    if (va === undefined || vb === undefined) {
      if (va !== vb) return va === undefined ? 1 : -1;
    } else if (va !== vb) {
      return (
        direction *
        (typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb)))
      );
    }
    return (a.cost ?? 99) - (b.cost ?? 99) || byNumber(a, b);
  });
}
