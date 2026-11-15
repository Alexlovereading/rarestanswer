/**
 * Versioned local stats, the in-progress daily round, and the timer
 * setting. Every reader accepts a tiny storage interface and returns a
 * safe default when the payload is missing, corrupt, or the wrong version.
 * Writers swallow quota and privacy-mode exceptions.
 */

import { addDays } from './daily';
import type { RoundTier } from './score';
import { scorePrompt } from './score';

export const STATS_STORAGE_KEY = 'rarestanswer.stats.v1';
export const DAILY_STORAGE_KEY = 'rarestanswer.daily.v1';
export const SETTINGS_STORAGE_KEY = 'rarestanswer.settings.v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type TierHits = [number, number, number, number, number, number];

export interface StatsV1 {
  version: 1;
  streak: number;
  bestStreak: number;
  lastDailyDate: string | null;
  dailyPlayed: number;
  roundsPlayed: number;
  totalPoints: number;
  bestDailyScore: number;
  tierHits: TierHits;
  /** Finished daily scores, oldest first. Capped at SCORE_HISTORY_LIMIT. */
  dailyScores: number[];
}

export interface PromptResult {
  slug: string;
  tier: RoundTier;
  points: number;
  answer: string | null;
  outcome: 'hit' | 'time' | 'pass';
  spotlight: boolean;
}

export interface DailySave {
  version: 1;
  date: string;
  slugs: string[];
  cursor: number;
  score: number;
  spotlightUsed: boolean;
  noTimer: boolean;
  results: PromptResult[];
  completed: boolean;
  recorded: boolean;
}

export interface SettingsV1 {
  version: 1;
  noTimer: boolean;
  /** False until the player closes How to play or starts a round. */
  seenRules: boolean;
}

/** How many daily scores the distribution chart keeps. */
export const SCORE_HISTORY_LIMIT = 60;

export interface DistRow {
  key: string;
  count: number;
  /** 0 when every row is empty, otherwise count / peak. */
  share: number;
}

/** Inclusive ranges. The last bucket has no upper bound. */
export const SCORE_BUCKETS: readonly { key: string; min: number; max: number }[] = [
  { key: '0', min: 0, max: 0 },
  { key: '1-49', min: 1, max: 49 },
  { key: '50-149', min: 50, max: 149 },
  { key: '150-299', min: 150, max: 299 },
  { key: '300-499', min: 300, max: 499 },
  { key: '500+', min: 500, max: Number.POSITIVE_INFINITY },
];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function defaultStats(): StatsV1 {
  return {
    version: 1,
    streak: 0,
    bestStreak: 0,
    lastDailyDate: null,
    dailyPlayed: 0,
    roundsPlayed: 0,
    totalPoints: 0,
    bestDailyScore: 0,
    tierHits: [0, 0, 0, 0, 0, 0],
    dailyScores: [],
  };
}

export function defaultSettings(): SettingsV1 {
  return { version: 1, noTimer: false, seenRules: false };
}

/** Peak-relative bar lengths for a chart. An all-zero series stays flat. */
export function withShares(rows: readonly { key: string; count: number }[]): DistRow[] {
  const peak = rows.reduce((max, row) => (row.count > max ? row.count : max), 0);
  return rows.map((row) => ({
    key: row.key,
    count: row.count,
    share: peak > 0 ? row.count / peak : 0,
  }));
}

/** Six bars, keys "1"…"6", from a tierHits tuple. */
export function tierDistribution(hits: readonly number[]): DistRow[] {
  const rows = [0, 1, 2, 3, 4, 5].map((index) => ({
    key: String(index + 1),
    count: hits[index] ?? 0,
  }));
  return withShares(rows);
}

/** Daily scores grouped into SCORE_BUCKETS. */
export function scoreDistribution(scores: readonly number[]): DistRow[] {
  const rows = SCORE_BUCKETS.map((bucket) => ({
    key: bucket.key,
    count: scores.reduce(
      (total, score) => (score >= bucket.min && score <= bucket.max ? total + 1 : total),
      0,
    ),
  }));
  return withShares(rows);
}

/**
 * Record a finished daily. Calling it again for the same local date
 * returns the same stats object and does not move the streak.
 * Playing yesterday continues the streak. Any larger gap starts at 1.
 */
export function recordDaily(
  stats: StatsV1,
  round: { dateKey: string; score: number; tiers: readonly number[] },
): StatsV1 {
  if (stats.lastDailyDate === round.dateKey) return stats;
  const continued = stats.lastDailyDate === addDays(round.dateKey, -1);
  const streak = continued ? stats.streak + 1 : 1;
  return {
    ...stats,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastDailyDate: round.dateKey,
    dailyPlayed: stats.dailyPlayed + 1,
    roundsPlayed: stats.roundsPlayed + 1,
    totalPoints: stats.totalPoints + round.score,
    bestDailyScore: Math.max(stats.bestDailyScore, round.score),
    tierHits: addTiers(stats.tierHits, round.tiers),
    dailyScores: appendScore(stats.dailyScores, round.score),
  };
}

/** Unlimited and category rounds count points, not the daily streak. */
export function recordFreeRound(
  stats: StatsV1,
  round: { score: number; tiers: readonly number[] },
): StatsV1 {
  return {
    ...stats,
    roundsPlayed: stats.roundsPlayed + 1,
    totalPoints: stats.totalPoints + round.score,
    tierHits: addTiers(stats.tierHits, round.tiers),
  };
}

export function readStats(store: KeyValueStore): StatsV1 {
  return readJson(store, STATS_STORAGE_KEY, parseStats, defaultStats);
}

export function writeStats(store: KeyValueStore, stats: StatsV1): void {
  writeJson(store, STATS_STORAGE_KEY, stats);
}

export function readSettings(store: KeyValueStore): SettingsV1 {
  return readJson(store, SETTINGS_STORAGE_KEY, parseSettings, defaultSettings);
}

export function writeSettings(store: KeyValueStore, settings: SettingsV1): void {
  writeJson(store, SETTINGS_STORAGE_KEY, settings);
}

/** A save from another local date, or a save that fails validation, is dropped. */
export function readDaily(store: KeyValueStore, todayKey: string): DailySave | null {
  let raw: string | null;
  try {
    raw = store.getItem(DAILY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const save = parseDaily(JSON.parse(raw), todayKey);
    return save;
  } catch {
    return null;
  }
}

export function writeDaily(store: KeyValueStore, save: DailySave): void {
  writeJson(store, DAILY_STORAGE_KEY, save);
}

export function parseStats(value: unknown): StatsV1 | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const streak = intField(value.streak);
  const bestStreak = intField(value.bestStreak);
  const dailyPlayed = intField(value.dailyPlayed);
  const roundsPlayed = intField(value.roundsPlayed);
  const totalPoints = intField(value.totalPoints);
  const bestDailyScore = intField(value.bestDailyScore);
  const tierHits = tierHitsField(value.tierHits);
  const dailyScores = scoreHistoryField(value.dailyScores);
  const lastDailyDate = value.lastDailyDate;
  if (
    streak === null ||
    bestStreak === null ||
    dailyPlayed === null ||
    roundsPlayed === null ||
    totalPoints === null ||
    bestDailyScore === null ||
    !tierHits ||
    dailyScores === null
  ) {
    return null;
  }
  if (
    lastDailyDate !== null &&
    (typeof lastDailyDate !== 'string' || !DATE_KEY.test(lastDailyDate))
  ) {
    return null;
  }
  return {
    version: 1,
    streak,
    bestStreak,
    lastDailyDate: lastDailyDate === null ? null : lastDailyDate,
    dailyPlayed,
    roundsPlayed,
    totalPoints,
    bestDailyScore,
    tierHits,
    dailyScores,
  };
}

export function parseSettings(value: unknown): SettingsV1 | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.noTimer !== 'boolean') return null;
  const seenRules = value.seenRules === undefined ? false : value.seenRules;
  if (typeof seenRules !== 'boolean') return null;
  return { version: 1, noTimer: value.noTimer, seenRules };
}

export function parseDaily(value: unknown, todayKey: string): DailySave | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (value.date !== todayKey || typeof value.date !== 'string') return null;
  if (!Array.isArray(value.slugs) || value.slugs.length < 1 || value.slugs.length > 7) return null;
  const slugs: string[] = [];
  for (const slug of value.slugs) {
    if (typeof slug !== 'string' || !SLUG.test(slug)) return null;
    slugs.push(slug);
  }
  if (new Set(slugs).size !== slugs.length) return null;
  if (!Array.isArray(value.results)) return null;
  const results: PromptResult[] = [];
  for (const row of value.results) {
    const parsed = parseResult(row);
    if (!parsed || !slugs.includes(parsed.slug)) return null;
    results.push(parsed);
  }
  const cursor = intField(value.cursor);
  const score = intField(value.score);
  if (cursor === null || score === null) return null;
  if (cursor !== results.length || cursor > slugs.length) return null;
  if (typeof value.spotlightUsed !== 'boolean' || typeof value.noTimer !== 'boolean') return null;
  if (typeof value.completed !== 'boolean' || typeof value.recorded !== 'boolean') return null;
  const sum = results.reduce((total, row) => total + row.points, 0);
  if (sum !== score) return null;
  const completed = cursor === slugs.length;
  if (value.completed !== completed) return null;
  if (!completed && value.recorded) return null;
  return {
    version: 1,
    date: todayKey,
    slugs,
    cursor,
    score,
    spotlightUsed: value.spotlightUsed,
    noTimer: value.noTimer,
    results,
    completed,
    recorded: value.recorded,
  };
}

function parseResult(value: unknown): PromptResult | null {
  if (!isRecord(value)) return null;
  if (typeof value.slug !== 'string' || !SLUG.test(value.slug)) return null;
  if (value.outcome !== 'hit' && value.outcome !== 'time' && value.outcome !== 'pass') return null;
  if (typeof value.spotlight !== 'boolean') return null;
  if (!isRoundTier(value.tier)) return null;
  const points = intField(value.points);
  if (points === null) return null;
  let answer: string | null = null;
  if (value.outcome === 'hit') {
    if (value.tier === 0 || typeof value.answer !== 'string' || value.answer.length === 0)
      return null;
    if (points !== scorePrompt(value.tier, value.spotlight)) return null;
    answer = value.answer;
  } else if (value.tier !== 0 || points !== 0 || value.answer !== null || value.spotlight) {
    return null;
  }
  return {
    slug: value.slug,
    tier: value.tier,
    points,
    answer,
    outcome: value.outcome,
    spotlight: value.outcome === 'hit' ? value.spotlight : false,
  };
}

function appendScore(current: readonly number[], score: number): number[] {
  const next =
    current.length >= SCORE_HISTORY_LIMIT
      ? current.slice(current.length - SCORE_HISTORY_LIMIT + 1)
      : current.slice();
  next.push(score);
  return next;
}

function scoreHistoryField(value: unknown): number[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const start = Math.max(0, value.length - SCORE_HISTORY_LIMIT);
  const scores: number[] = [];
  for (let index = start; index < value.length; index++) {
    const score = intField(value[index]);
    if (score === null) return null;
    scores.push(score);
  }
  return scores;
}

function addTiers(current: TierHits, tiers: readonly number[]): TierHits {
  const next = current.slice() as TierHits;
  for (const tier of tiers) {
    if (tier >= 1 && tier <= 6) next[tier - 1] = (next[tier - 1] ?? 0) + 1;
  }
  return next;
}

function readJson<T>(
  store: KeyValueStore,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: () => T,
): T {
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback();
    return parse(JSON.parse(raw)) ?? fallback();
  } catch {
    return fallback();
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode and full disks still let the round finish on screen.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function intField(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000_000) {
    return null;
  }
  return value;
}

function tierHitsField(value: unknown): TierHits | null {
  if (!Array.isArray(value) || value.length !== 6) return null;
  const hits: number[] = [];
  for (const entry of value) {
    const n = intField(entry);
    if (n === null) return null;
    hits.push(n);
  }
  return hits as TierHits;
}

function isRoundTier(value: unknown): value is RoundTier {
  return (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  );
}
