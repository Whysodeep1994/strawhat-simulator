import type { CardCatalog } from "./cards.js";

/** Deck construction rules 5-1-2 to 5-1-2-3. Returns a list of problems; empty means legal. */
export function validateDeck(catalog: CardCatalog, leaderId: string, deck: string[]): string[] {
  const errors: string[] = [];
  const leader = catalog[leaderId];
  if (!leader) return [`Unknown leader "${leaderId}"`];
  if (leader.category !== "leader") errors.push(`"${leaderId}" is not a Leader card`);
  if (deck.length !== 50) errors.push(`Deck has ${deck.length} cards; it must have exactly 50`);

  const copies = new Map<string, number>();
  for (const id of deck) {
    const card = catalog[id];
    if (!card) {
      errors.push(`Unknown card "${id}"`);
      continue;
    }
    copies.set(id, (copies.get(id) ?? 0) + 1);
    if (card.category === "leader") errors.push(`"${id}" is a Leader and can't be in the deck`);
    if (!card.colors.every((c) => leader.colors.includes(c))) {
      errors.push(`"${id}" has a color that isn't on the Leader`);
    }
  }
  for (const [id, count] of copies) {
    if (count > 4) errors.push(`${count} copies of "${id}"; the limit is 4`);
  }
  return [...new Set(errors)];
}
