/** Catalog and round counts come from published data, never player estimates. */
import type { ClientPrompt } from './prompts';
import { withShares, type DistRow } from './stats';
import { TIERS, type PromptIndexEntry } from './types';

export function catalogTotals(index: readonly PromptIndexEntry[]): {
  prompts: number;
  answers: number;
  categories: number;
} {
  return {
    prompts: index.length,
    answers: index.reduce((sum, entry) => sum + entry.answerCount, 0),
    categories: new Set(index.map((entry) => entry.category)).size,
  };
}

/** Count answer entries in each tier across exactly the supplied prompts. */
export function promptTierDistribution(
  prompts: readonly Pick<ClientPrompt, 'answers'>[],
): DistRow[] {
  const counts = new Map<number, number>();
  for (const prompt of prompts) {
    for (const answer of prompt.answers) {
      counts.set(answer.tier, (counts.get(answer.tier) ?? 0) + 1);
    }
  }
  return withShares(
    TIERS.map((row) => ({ key: String(row.tier), count: counts.get(row.tier) ?? 0 })),
  );
}
