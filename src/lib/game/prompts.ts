/**
 * The JSON the browser is allowed to see. Popularity, wiki titles, and the
 * source note stay on the server. Answers are returned rarest-first even
 * if a prompt file arrives unsorted.
 */

import type { Answer, CategoryKey, Prompt, PromptIndexEntry } from './types';
import { isCategoryKey } from './categories';

export const PROMPT_INDEX_PATH = '/game-data/index.json';

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

export function promptDataPath(slug: string): string {
  return `/game-data/${encodeURIComponent(slug)}.json`;
}

export interface ClientAnswer {
  name: string;
  aliases: string[];
  tier: Answer['tier'];
  rarity: number;
}

export interface ClientPrompt {
  id: string;
  slug: string;
  category: CategoryKey;
  question: string;
  answers: ClientAnswer[];
}

export function isPromptIndexEntry(value: unknown): value is PromptIndexEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.slug === 'string' &&
    isSlug(value.slug) &&
    typeof value.category === 'string' &&
    isCategoryKey(value.category) &&
    typeof value.question === 'string' &&
    value.question.trim().length > 0 &&
    typeof value.answerCount === 'number' &&
    Number.isFinite(value.answerCount) &&
    value.answerCount >= 0
  );
}

/**
 * Strip a prompt file down to the play payload. Returns null when the
 * file cannot be played (no usable answers, unknown category, bad slug).
 */
export function toClientPrompt(value: unknown): ClientPrompt | null {
  if (!isRecord(value)) return null;
  const slug = typeof value.slug === 'string' ? value.slug : '';
  const category = value.category;
  const question = typeof value.question === 'string' ? value.question.trim() : '';
  if (!isSlug(slug) || typeof category !== 'string' || !isCategoryKey(category) || !question) {
    return null;
  }
  if (!Array.isArray(value.answers)) return null;
  const answers: ClientAnswer[] = [];
  for (const row of value.answers) {
    const answer = toClientAnswer(row);
    if (answer) answers.push(answer);
  }
  if (answers.length === 0) return null;
  answers.sort((a, b) => b.rarity - a.rarity || b.tier - a.tier || a.name.localeCompare(b.name, 'en'));
  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : slug;
  return { id, slug, category, question, answers };
}

export function rarestAnswers<T>(answers: readonly T[], limit = 10): T[] {
  return answers.slice(0, limit);
}

/** Most-common first. The input is rarest-first. */
export function commonAnswers<T>(answers: readonly T[], limit = 10): T[] {
  const tail = answers.length <= limit ? answers : answers.slice(answers.length - limit);
  return tail.slice().reverse();
}

export function couldHaveNamedLine(count: number): string {
  if (count === 1) return 'You could have named 1 answer.';
  return `You could have named any of ${count} answers.`;
}

export function countRarer(answers: readonly { rarity: number }[], rarity: number): number {
  return answers.reduce((total, answer) => (answer.rarity > rarity ? total + 1 : total), 0);
}

export function rarerThanLine(count: number): string {
  if (count <= 0) return 'Nothing in this prompt is rarer.';
  if (count === 1) return '1 answer is rarer than yours.';
  return `${count} answers are rarer than yours.`;
}

/**
 * One list when the prompt is short enough to show in full. Longer prompts
 * keep the rarest slice and the most-common slice, which can overlap.
 */
export function revealLists<T>(
  answers: readonly T[],
  limit = 10,
): { complete: boolean; rarest: T[]; common: T[] } {
  if (answers.length <= limit) {
    return { complete: true, rarest: answers.slice(), common: [] };
  }
  return {
    complete: false,
    rarest: rarestAnswers(answers, limit),
    common: commonAnswers(answers, limit),
  };
}

/** 1-based rank from a rarest-first list. Ties share the rank above them. */
export function answerRank(rarerCount: number): number {
  return rarerCount + 1;
}

export function placementLine(rank: number, total: number): string {
  if (total <= 1) return 'Only one accepted answer.';
  if (rank <= 1) return `Rarest of ${total}.`;
  const rarer = rank - 1;
  if (rarer === 1) return `Rank ${rank} of ${total}. 1 answer is rarer than yours.`;
  return `Rank ${rank} of ${total}. ${rarer} answers are rarer than yours.`;
}

function toClientAnswer(value: unknown): ClientAnswer | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > 200) return null;
  if (!isTier(value.tier)) return null;
  if (typeof value.rarity !== 'number' || !Number.isFinite(value.rarity)) return null;
  const aliases: string[] = [];
  if (Array.isArray(value.aliases)) {
    for (const alias of value.aliases) {
      if (typeof alias === 'string' && alias.trim()) aliases.push(alias.trim());
    }
  }
  return { name, aliases, tier: value.tier, rarity: value.rarity };
}

function isTier(value: unknown): value is Answer['tier'] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Compile-time check that a full Prompt is accepted by the stripper. */
export function clientPromptFrom(prompt: Prompt): ClientPrompt | null {
  return toClientPrompt(prompt);
}
