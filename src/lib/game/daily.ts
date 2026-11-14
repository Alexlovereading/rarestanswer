/**
 * Daily, unlimited, and category round selection.
 *
 * The daily round is a pure function of the local calendar date. With a
 * full catalog (every played category has at least 30 prompts, and the day
 * draws at most one prompt from each), a slug cannot repeat inside any
 * window of 30 consecutive local days: the pick is `dayNumber % poolLength`,
 * and a window of 30 days spans a difference of at most 29.
 *
 * A shorter catalog still returns a deterministic round and never repeats
 * a slug inside that round. It cannot promise a 30-day gap, because there
 * are not enough prompts.
 */

import type { PromptIndexEntry } from './types';
import { CATEGORY_KEYS, isCategoryKey, type CategoryKey } from './categories';

export const DAILY_EPOCH = '2026-01-01';
export const ROUND_SIZE = 7;
export const HISTORY_DAYS = 30;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const match = DATE_KEY.exec(key);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function daysBetween(fromKey: string, toKey: string): number {
  const from = utcDay(fromKey);
  const to = utcDay(toKey);
  if (from === null || to === null) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function addDays(dateKey: string, delta: number): string {
  const day = utcDay(dateKey);
  if (day === null) return dateKey;
  const next = new Date(day + delta * 86_400_000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatLocalDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Milliseconds from `now` until the next local midnight. Always ≥ 0. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Round number for a local date. 2026-01-01 is round 1. */
export function dailyRoundNumber(dateKey: string): number {
  return daysBetween(DAILY_EPOCH, dateKey) + 1;
}

export function selectDaily(index: readonly PromptIndexEntry[], date: Date): PromptIndexEntry[] {
  const unique = dedupe(index);
  if (unique.length === 0) return [];
  const dayNum = daysBetween(DAILY_EPOCH, localDateKey(date));
  const groups = groupByCategory(unique);
  const active = activeCategories(groups);
  const target = Math.min(ROUND_SIZE, unique.length);
  return drawPlan(groups, dailyPlan(active, dayNum, target), dayNum);
}

/**
 * Put one prompt first when a page asked for it (`/unlimited/?prompt=`).
 * An unknown slug leaves the round unchanged. The result never exceeds
 * ROUND_SIZE and never repeats the pinned slug.
 */
export function withPinnedPrompt(
  round: readonly PromptIndexEntry[],
  slug: string | null | undefined,
  index: readonly PromptIndexEntry[],
): PromptIndexEntry[] {
  if (!slug) return round.slice(0, ROUND_SIZE);
  const pinned = index.find((entry) => entry.slug === slug);
  if (!pinned) return round.slice(0, ROUND_SIZE);
  const rest = round.filter((entry) => entry.slug !== pinned.slug);
  return [pinned, ...rest].slice(0, ROUND_SIZE);
}

export function selectUnlimited(
  index: readonly PromptIndexEntry[],
  seed: number,
): PromptIndexEntry[] {
  const unique = dedupe(index);
  if (unique.length === 0) return [];
  const rng = mulberry32(seed >>> 0);
  const groups = groupByCategory(unique);
  const active = shuffle(activeCategories(groups), rng);
  const target = Math.min(ROUND_SIZE, unique.length);
  const plan = fillPlan(active, target);
  return drawShuffled(groups, unique, plan, rng);
}

export function selectCategory(
  index: readonly PromptIndexEntry[],
  category: CategoryKey,
  seed: number,
): PromptIndexEntry[] {
  const pool = dedupe(index)
    .filter((entry) => entry.category === category)
    .sort(bySlug);
  if (pool.length === 0) return [];
  const rng = mulberry32((seed ^ fnv1a(category)) >>> 0);
  const target = Math.min(ROUND_SIZE, pool.length);
  const copy = pool.slice();
  for (let i = 0; i < target; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    const swap = copy[j];
    copy[j] = copy[i] as PromptIndexEntry;
    copy[i] = swap as PromptIndexEntry;
  }
  return copy.slice(0, target);
}

function dedupe(index: readonly PromptIndexEntry[]): PromptIndexEntry[] {
  const seen = new Set<string>();
  const out: PromptIndexEntry[] = [];
  for (const entry of index) {
    if (!entry || typeof entry.slug !== 'string' || seen.has(entry.slug)) continue;
    if (!isCategoryKey(entry.category)) continue;
    if (typeof entry.answerCount === 'number' && entry.answerCount < 1) continue;
    seen.add(entry.slug);
    out.push(entry);
  }
  return out;
}

function groupByCategory(index: readonly PromptIndexEntry[]): Map<CategoryKey, PromptIndexEntry[]> {
  const map = new Map<CategoryKey, PromptIndexEntry[]>();
  for (const category of CATEGORY_KEYS) map.set(category, []);
  for (const entry of index) map.get(entry.category)?.push(entry);
  for (const list of map.values()) list.sort(bySlug);
  return map;
}

function activeCategories(groups: Map<CategoryKey, PromptIndexEntry[]>): CategoryKey[] {
  return CATEGORY_KEYS.filter((category) => (groups.get(category)?.length ?? 0) > 0);
}

/**
 * Which categories play today, in category-list order.
 * When at least `target` categories have prompts, the day skips the rest
 * on a rotating index so the skipped category moves every day.
 */
function dailyPlan(active: CategoryKey[], dayNum: number, target: number): CategoryKey[] {
  if (active.length === 0 || target <= 0) return [];
  if (active.length >= target) {
    const skip = active.length - target;
    const skipped = new Set<number>();
    for (let s = 0; s < skip; s++) skipped.add(positiveMod(dayNum + s, active.length));
    return active.filter((_, index) => !skipped.has(index));
  }
  return fillPlan(active, target);
}

function fillPlan(active: CategoryKey[], target: number): CategoryKey[] {
  const plan: CategoryKey[] = [];
  if (active.length === 0) return plan;
  for (let i = 0; i < target; i++) {
    const category = active[i % active.length];
    if (category) plan.push(category);
  }
  return plan;
}

/**
 * One prompt per plan slot. The cursor is the day number plus how many
 * times this category was already used in the same round, so two slots
 * from one category do not collide. It is NOT the slot index: a slot
 * index changes when a neighboring category is skipped and would repeat
 * a slug on back-to-back days.
 */
function drawPlan(
  groups: Map<CategoryKey, PromptIndexEntry[]>,
  plan: CategoryKey[],
  dayNum: number,
): PromptIndexEntry[] {
  const used = new Set<string>();
  const seenInPlan = new Map<CategoryKey, number>();
  const picked: PromptIndexEntry[] = [];
  for (const category of plan) {
    const nth = seenInPlan.get(category) ?? 0;
    seenInPlan.set(category, nth + 1);
    const pool = groups.get(category) ?? [];
    const choice = takeUnused(pool, dayNum + nth, used);
    if (!choice) continue;
    used.add(choice.slug);
    picked.push(choice);
  }
  return picked;
}

function drawShuffled(
  groups: Map<CategoryKey, PromptIndexEntry[]>,
  all: readonly PromptIndexEntry[],
  plan: CategoryKey[],
  rng: () => number,
): PromptIndexEntry[] {
  const used = new Set<string>();
  const picked: PromptIndexEntry[] = [];
  for (const category of plan) {
    const preferred = (groups.get(category) ?? []).filter((entry) => !used.has(entry.slug));
    const source = preferred.length > 0 ? preferred : all.filter((entry) => !used.has(entry.slug));
    if (source.length === 0) break;
    const choice = source[Math.floor(rng() * source.length)];
    if (!choice) break;
    used.add(choice.slug);
    picked.push(choice);
  }
  return picked;
}

function takeUnused(
  pool: readonly PromptIndexEntry[],
  cursor: number,
  used: Set<string>,
): PromptIndexEntry | null {
  if (pool.length === 0) return null;
  const start = positiveMod(cursor, pool.length);
  for (let step = 0; step < pool.length; step++) {
    const candidate = pool[positiveMod(start + step, pool.length)];
    if (candidate && !used.has(candidate.slug)) return candidate;
  }
  return null;
}

function bySlug(a: PromptIndexEntry, b: PromptIndexEntry): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

function positiveMod(n: number, m: number): number {
  if (m <= 0) return 0;
  return ((n % m) + m) % m;
}

function utcDay(key: string): number | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, m - 1, d);
}

function fnv1a(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = swap as T;
  }
  return copy;
}
