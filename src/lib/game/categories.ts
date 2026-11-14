/**
 * The eight prompt categories. Page-length marketing copy lives in
 * category-copy.ts so the game bundle can import the labels alone.
 */

import type { CategoryKey } from './types';

export type { CategoryKey };

export const CATEGORY_KEYS: readonly CategoryKey[] = [
  'geography',
  'animals',
  'food',
  'sports',
  'screen',
  'music',
  'science',
  'history',
];

const KEY_SET = new Set<string>(CATEGORY_KEYS);

export function isCategoryKey(value: string): value is CategoryKey {
  return KEY_SET.has(value);
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  geography: 'Geography',
  animals: 'Animals',
  food: 'Food',
  sports: 'Sports',
  screen: 'Movies & TV',
  music: 'Music',
  science: 'Science',
  history: 'History',
};
