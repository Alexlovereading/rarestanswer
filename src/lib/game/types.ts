/**
 * Rarest Answer data contract. Prompt files live in src/data/prompts/.
 * W1-GAME owns the rest of src/lib/game/; this file stays the shared types.
 */

export type CategoryKey =
  | 'geography'
  | 'animals'
  | 'food'
  | 'sports'
  | 'screen'
  | 'music'
  | 'science'
  | 'history';

export interface Answer {
  /** Display name. */
  name: string;
  /** Accepted alternate spellings. Normalized matching is done in the engine. */
  aliases: string[];
  /** Raw signal, e.g. Wikipedia monthly pageviews. */
  popularity: number;
  /** 0..1, 1 = rarest (percentile within the prompt). */
  rarity: number;
  /** 6 = rarest. */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  /** en.wikipedia title. */
  wiki?: string;
}

export interface Prompt {
  id: string;
  slug: string;
  category: CategoryKey;
  /** e.g. "Name a species of great ape" */
  question: string;
  /** Sorted rarest-first. */
  answers: Answer[];
  /** e.g. "Wikidata + Wikipedia pageviews (2026-10)" */
  source: string;
}

export interface PromptIndexEntry {
  id: string;
  slug: string;
  category: CategoryKey;
  question: string;
  answerCount: number;
}

/** Own tier ladder. Tier 6 is the rarest. */
export const TIERS: readonly { tier: Answer['tier']; name: string; points: number }[] = [
  { tier: 1, name: 'Common', points: 5 },
  { tier: 2, name: 'Familiar', points: 10 },
  { tier: 3, name: 'Uncommon', points: 20 },
  { tier: 4, name: 'Rare', points: 40 },
  { tier: 5, name: 'Epic', points: 70 },
  { tier: 6, name: 'Legendary', points: 100 },
];
