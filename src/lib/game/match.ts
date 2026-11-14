/**
 * Match one guess against a prompt's answers.
 * Exact name or alias wins. A single typo (distance ≤ 1) counts only when
 * both strings are at least 6 characters. An ambiguous typo is a miss.
 * A guess already submitted, or a second way of writing an answer already
 * matched, is a duplicate and must not be penalized again.
 */

import type { Answer } from './types';
import { levenshtein, normalize } from './normalize';

export interface Matchable {
  name: string;
  aliases: readonly string[];
  tier: Answer['tier'];
  rarity?: number;
}

export interface Tried {
  queries: Set<string>;
  answers: Set<string>;
}

export type GuessResult =
  | { status: 'empty' }
  | { status: 'duplicate'; answer: Matchable | null }
  | { status: 'miss' }
  | { status: 'hit'; answer: Matchable };

export function createTried(): Tried {
  return { queries: new Set(), answers: new Set() };
}

const FUZZY_MIN = 6;

export function matchGuess(answers: readonly Matchable[], raw: string, tried: Tried): GuessResult {
  const norm = normalize(raw);
  if (!norm) return { status: 'empty' };
  if (tried.queries.has(norm)) return { status: 'duplicate', answer: null };

  const exact = exactHits(answers, norm);
  if (exact.length > 0) {
    const answer = pickBest(exact);
    if (tried.answers.has(answer.name)) return { status: 'duplicate', answer };
    return { status: 'hit', answer };
  }

  if ([...norm].length >= FUZZY_MIN) {
    const fuzzy = fuzzyHits(answers, norm);
    if (fuzzy.length === 1) {
      const answer = fuzzy[0];
      if (!answer) return { status: 'miss' };
      if (tried.answers.has(answer.name)) return { status: 'duplicate', answer };
      return { status: 'hit', answer };
    }
  }

  return { status: 'miss' };
}

/** Record a submitted guess so the next call can reject it. */
export function rememberGuess(tried: Tried, raw: string, result: GuessResult): void {
  if (result.status === 'empty') return;
  const norm = normalize(raw);
  if (norm) tried.queries.add(norm);
  if ((result.status === 'hit' || result.status === 'duplicate') && result.answer) {
    tried.answers.add(result.answer.name);
  }
}

function exactHits(answers: readonly Matchable[], norm: string): Matchable[] {
  const hits: Matchable[] = [];
  for (const answer of answers) {
    if (
      normalize(answer.name) === norm ||
      answer.aliases.some((alias) => normalize(alias) === norm)
    ) {
      hits.push(answer);
    }
  }
  return hits;
}

function fuzzyHits(answers: readonly Matchable[], norm: string): Matchable[] {
  const hits: Matchable[] = [];
  for (const answer of answers) {
    const keys = [answer.name, ...answer.aliases];
    const close = keys.some((key) => {
      const folded = normalize(key);
      return [...folded].length >= FUZZY_MIN && levenshtein(norm, folded) <= 1;
    });
    if (close) hits.push(answer);
  }
  return hits;
}

/** Highest tier, then highest rarity, then the earlier row. */
function pickBest(hits: Matchable[]): Matchable {
  return hits.reduce((best, hit) => {
    if (hit.tier !== best.tier) return hit.tier > best.tier ? hit : best;
    const hr = hit.rarity ?? 0;
    const br = best.rarity ?? 0;
    if (hr !== br) return hr > br ? hit : best;
    return best;
  });
}
