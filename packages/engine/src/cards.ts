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
  | "unblockable";

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
  effects?: EffectDefinition[];
}

export type CardCatalog = Record<string, CardDefinition>;

export function hasKeyword(card: CardDefinition, keyword: Keyword): boolean {
  return card.keywords?.includes(keyword) ?? false;
}
