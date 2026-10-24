import type { EffectDefinition } from "./effects.js";

/** Card data the engine needs. Real cards use their official card number as `id` (e.g. "OP13-001"). */

export type CardCategory = "leader" | "character" | "event" | "stage";

export type Color = "red" | "green" | "blue" | "purple" | "black" | "yellow";

/** Keyword effects the engine handles directly (rules 10-1). */
export type Keyword =
  | "rush"
  | "rushCharacter"
  | "doubleAttack"
  | "banish"
  | "blocker"
  | "unblockable"
  /** "Can also attack your opponent's active Characters." */
  | "canAttackActive";

export interface CardDefinition {
  id: string;
  name: string;
  category: CardCategory;
  colors: Color[];
  /** Character, Event, and Stage cards (rule 2-7-5). */
  cost?: number;
  /** Leader and Character cards (rule 2-6-2). */
  power?: number;
  /** Character cards only (rule 2-10-2). */
  counter?: number;
  /** Leader cards only (rule 2-9-3). */
  life?: number;
  keywords?: Keyword[];
  types?: string[];
  /** Printed attribute, e.g. "Slash" or "Strike/Ranged". */
  attribute?: string | null;
  effects?: EffectDefinition[];
  /** "Also treat this card's name as [X] according to the rules." */
  aliases?: string[];
  /** The block icon printed on the card (1, 2, … or "X"); formats use it to rotate older cards out. */
  blockIcon?: number | string;
}

export type CardCatalog = Record<string, CardDefinition>;

export function hasKeyword(card: CardDefinition, keyword: Keyword): boolean {
  return card.keywords?.includes(keyword) ?? false;
}
