/**
 * Rarest Answer engine: matching, scoring, daily seed, storage, and the
 * keyword strings the play pages render.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, test, vi } from 'vitest';
import fixture from './fixtures/great-ape-species.json';
import fixtureIndex from './fixtures/prompts-index.json';
import { CATEGORY_KEYS, isCategoryKey } from '~/lib/game/categories';
import { CATEGORY_PAGES, measureCopy } from '~/lib/game/category-copy';
import {
  HOME,
  HOME_FAQ,
  HOW_TO_STEPS,
  PLAY,
  RULES_AT_A_GLANCE,
  UNLIMITED,
  revealTierLabel,
} from '~/lib/game/copy';
import {
  HISTORY_DAYS,
  ROUND_SIZE,
  addDays,
  dailyRoundNumber,
  daysBetween,
  formatCountdown,
  localDateKey,
  msUntilNextLocalMidnight,
  selectCategory,
  selectDaily,
  selectUnlimited,
  withPinnedPrompt,
} from '~/lib/game/daily';
import { readClientPrompt } from '~/lib/game/load-prompts';
import { catalogTotals, promptTierDistribution } from '~/lib/game/round-summary';
import { createTried, matchGuess, rememberGuess, type Matchable } from '~/lib/game/match';
import { levenshtein, normalize } from '~/lib/game/normalize';
import {
  commonAnswers,
  couldHaveNamedLine,
  countRarer,
  isPromptIndexEntry,
  isSlug,
  pickWarmupSlug,
  placementLine,
  promptDataPath,
  PROMPT_INDEX_PATH,
  rarestAnswers,
  reportAnswerHref,
  revealLists,
  toClientPrompt,
} from '~/lib/game/prompts';
import {
  applyScore,
  effectiveTier,
  freshScore,
  maxRoundScore,
  PENALTY_MS,
  pointsForTier,
  scorePrompt,
  TIMER_MS,
} from '~/lib/game/score';
import { buildShareText, sharePageUrl, tierSquare } from '~/lib/game/share';
import {
  TRACK,
  TRACK_NAME_MAX,
  TRACK_SLUG_PATTERN,
  isTrackSlug,
  playStartedProps,
  roundCompletedProps,
  trackEvent,
  warmupProps,
} from '~/lib/game/track';
import { drawShareCard } from '~/lib/game/share-card';
import {
  DAILY_STORAGE_KEY,
  STATS_STORAGE_KEY,
  defaultStats,
  parseDaily,
  parseSettings,
  parseStats,
  readDaily,
  readStats,
  recordDaily,
  recordFreeRound,
  SCORE_HISTORY_LIMIT,
  scoreDistribution,
  tierDistribution,
  writeDailyIfScored,
  writeStats,
  writeStatsIfScored,
  type DailySave,
  type KeyValueStore,
} from '~/lib/game/stats';
import { TIERS, type CategoryKey, type PromptIndexEntry } from '~/lib/game/types';
import {
  celebrationParticles,
  clockVisual,
  currentCombo,
  novaReaction,
  scoreAtProgress,
} from '~/lib/game/visuals';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = toClientPrompt(fixture);
if (!client) throw new Error('fixture prompt did not parse');

/** The frozen one-prompt catalog. Engine cases must not read src/data/prompts. */
function frozenIndex(): PromptIndexEntry[] {
  const index = fixtureIndex.filter(isPromptIndexEntry);
  if (index.length !== fixtureIndex.length) {
    throw new Error('tests/fixtures/prompts-index.json has an entry the engine would drop');
  }
  return index;
}

interface RankedAnswer {
  name: string;
  rarity: number;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
}

function isPromptFile(value: unknown): value is {
  id: string;
  slug: string;
  category: string;
  question: string;
  answers: unknown[];
} {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('id' in value) ||
    !('slug' in value) ||
    !('category' in value) ||
    !('question' in value) ||
    !('answers' in value)
  ) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.slug === 'string' &&
    typeof value.category === 'string' &&
    typeof value.question === 'string' &&
    value.question.trim().length > 0 &&
    Array.isArray(value.answers)
  );
}

function isRankedAnswer(value: unknown): value is RankedAnswer {
  if (typeof value !== 'object' || value === null) return false;
  if (!('name' in value) || !('rarity' in value) || !('tier' in value)) return false;
  return (
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.rarity === 'number' &&
    Number.isFinite(value.rarity) &&
    isTierNumber(value.tier)
  );
}

function isTierNumber(value: unknown): value is RankedAnswer['tier'] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

/** Higher rarity first. Ties break on tier, then display name, same as the client sort. */
function isRarestFirst(prev: RankedAnswer, next: RankedAnswer): boolean {
  if (prev.rarity !== next.rarity) return prev.rarity > next.rarity;
  if (prev.tier !== next.tier) return prev.tier > next.tier;
  return prev.name.localeCompare(next.name, 'en') <= 0;
}

function catalog(perCategory: number): PromptIndexEntry[] {
  const out: PromptIndexEntry[] = [];
  for (const category of CATEGORY_KEYS) {
    for (let i = 0; i < perCategory; i++) {
      const slug = `${category}-${String(i).padStart(2, '0')}`;
      out.push({
        id: slug,
        slug,
        category,
        question: `Name a ${category} item ${i}`,
        answerCount: 12,
      });
    }
  }
  return out;
}

function memoryStore(
  initial?: Record<string, string>,
): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('normalize', () => {
  test('folds case, accents, punctuation, and a leading article', () => {
    expect(normalize('  The   Human!! ')).toBe('human');
    expect(normalize('Café')).toBe('cafe');
    expect(normalize('İstanbul')).toBe('istanbul');
    expect(normalize("Grauer's gorilla")).toBe('grauers gorilla');
    expect(normalize('x-ray')).toBe('x ray');
    expect(normalize('a')).toBe('a');
    expect(normalize('')).toBe('');
  });

  test('caps edit distance at 2 and accepts one change', () => {
    expect(levenshtein('bonobo', 'bonobo')).toBe(0);
    expect(levenshtein('bonobo', 'bonoba')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(2);
    expect(levenshtein('a', 'abc')).toBe(2);
  });
});

describe('match', () => {
  test('accepts case, articles, aliases, and a single long typo', () => {
    const tried = createTried();
    expect(matchGuess(client.answers, 'HUMAN', tried).status).toBe('hit');
    expect(matchGuess(client.answers, 'the human', tried).status).toBe('hit');
    expect(matchGuess(client.answers, 'homo sapiens', tried).status).toBe('hit');
    expect(matchGuess(client.answers, 'humán', tried).status).toBe('hit');
    expect(matchGuess(client.answers, "Grauer's gorilla", tried)).toMatchObject({
      status: 'hit',
      answer: { name: 'Eastern gorilla' },
    });
    expect(matchGuess(client.answers, 'grauers gorilla', tried)).toMatchObject({
      status: 'hit',
      answer: { name: 'Eastern gorilla' },
    });
    expect(matchGuess(client.answers, 'bonoba', tried)).toMatchObject({
      status: 'hit',
      answer: { name: 'Bonobo' },
    });
    expect(matchGuess(client.answers, 'chimpanze', tried)).toMatchObject({
      status: 'hit',
      answer: { name: 'Chimpanzee' },
    });
    expect(matchGuess(client.answers, 'Tapanuli orangutan', tried)).toMatchObject({
      status: 'hit',
      answer: { tier: 6 },
    });
  });

  test('rejects short typos, distance 2, empties, and unknown names', () => {
    const tried = createTried();
    expect(matchGuess(client.answers, 'bonob', tried).status).toBe('miss');
    expect(matchGuess(client.answers, 'chimpanxx', tried).status).toBe('miss');
    expect(matchGuess(client.answers, '   ', tried).status).toBe('empty');
    expect(matchGuess(client.answers, 'platypus', tried).status).toBe('miss');
  });

  test('a typo that is one edit from two answers is a miss', () => {
    const answers: Matchable[] = [
      { name: 'alphaaa', aliases: [], tier: 1, rarity: 0 },
      { name: 'alphaab', aliases: [], tier: 6, rarity: 1 },
    ];
    expect(matchGuess(answers, 'alphaac', createTried()).status).toBe('miss');
    expect(matchGuess(answers, 'alphaaa', createTried())).toMatchObject({
      status: 'hit',
      answer: { name: 'alphaaa' },
    });
  });

  test('rejects a second spelling of an answer already matched', () => {
    const tried = createTried();
    const first = matchGuess(client.answers, 'chimp', tried);
    expect(first.status).toBe('hit');
    rememberGuess(tried, 'chimp', first);
    const second = matchGuess(client.answers, 'chimpanzees', tried);
    expect(second.status).toBe('duplicate');
    rememberGuess(tried, 'platypus', { status: 'miss' });
    expect(matchGuess(client.answers, 'platypus', tried).status).toBe('duplicate');
  });
});

describe('score', () => {
  test('uses the tier table and doubles only a scored Spotlight', () => {
    expect(TIERS.map((row) => pointsForTier(row.tier))).toEqual([5, 10, 20, 40, 70, 100]);
    expect(TIMER_MS).toBe(25_000);
    expect(PENALTY_MS).toBe(1_000);
    let state = freshScore();
    let step = applyScore(state, 0, true);
    expect(step.points).toBe(0);
    expect(step.state.spotlightUsed).toBe(false);
    step = applyScore(step.state, 6, true);
    expect(step.points).toBe(200);
    expect(step.state.spotlightUsed).toBe(true);
    state = step.state;
    step = applyScore(state, 6, true);
    expect(step.points).toBe(scorePrompt(6, false));
    expect(step.state.total).toBe(300);
  });
});

describe('daily seed', () => {
  test('local dates ignore UTC and countdown math is stable', () => {
    expect(localDateKey(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02');
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dailyRoundNumber('2026-01-01')).toBe(1);
    expect(formatCountdown(3_661_000)).toBe('01:01:01');
    const noon = new Date(2026, 5, 15, 12, 0, 0);
    expect(msUntilNextLocalMidnight(noon)).toBe(12 * 60 * 60 * 1000);
    expect(HISTORY_DAYS).toBe(30);
    expect(ROUND_SIZE).toBe(7);
  });

  test('a full catalog is 7 categories, deterministic, and unique across 30 days', () => {
    for (const perCategory of [HISTORY_DAYS, 40]) {
      const index = catalog(perCategory);
      const rounds: string[][] = [];
      for (let day = 0; day < HISTORY_DAYS + 15; day++) {
        const date = new Date(2026, 2, 1 + day);
        const round = selectDaily(index, date);
        expect(round).toHaveLength(ROUND_SIZE);
        const slugs = round.map((entry) => entry.slug);
        const categories = round.map((entry) => entry.category);
        expect(new Set(slugs).size).toBe(ROUND_SIZE);
        expect(new Set(categories).size).toBe(ROUND_SIZE);
        rounds.push(slugs);
        expect(selectDaily(index, date)).toEqual(round);
      }
      for (let start = 0; start <= rounds.length - HISTORY_DAYS; start++) {
        const window = rounds.slice(start, start + HISTORY_DAYS).flat();
        expect(new Set(window).size).toBe(window.length);
      }
    }
  });

  test('the skipped category rotates, and the epoch day is stable', () => {
    const index = catalog(40);
    const first = selectDaily(index, new Date(2026, 0, 1));
    expect(first.map((entry) => entry.category)).not.toContain('geography');
    expect(first[0]?.slug).toBe('animals-00');
    const skipped: CategoryKey[] = [];
    for (let day = 0; day < CATEGORY_KEYS.length; day++) {
      const round = selectDaily(index, new Date(2026, 0, 1 + day));
      const have = new Set(round.map((entry) => entry.category));
      const miss = CATEGORY_KEYS.filter((category) => !have.has(category));
      expect(miss).toHaveLength(1);
      const missed = miss[0];
      if (missed) skipped.push(missed);
    }
    expect(new Set(skipped).size).toBe(CATEGORY_KEYS.length);
    expect(selectDaily(index, new Date(2026, 0, 1)).map((entry) => entry.slug)).toEqual(
      selectDaily(index, new Date(2026, 1, 10)).map((entry) => entry.slug),
    );
  });

  test('a one-prompt catalog deals that prompt instead of repeating it', () => {
    const index = frozenIndex();
    expect(index).toHaveLength(1);
    const round = selectDaily(index, new Date(2026, 10, 14));
    expect(round.map((entry) => entry.slug)).toEqual(['great-ape-species']);
    expect(round).toHaveLength(1);
    expect(selectDaily(index, new Date(2026, 10, 15)).map((entry) => entry.slug)).toEqual([
      'great-ape-species',
    ]);
    expect(selectDaily([], new Date(2026, 10, 14))).toEqual([]);
  });

  test('unlimited and category rounds stay inside the pool', () => {
    const index = catalog(40);
    const first = selectUnlimited(index, 1);
    expect(selectUnlimited(index, 1)).toEqual(first);
    expect(selectUnlimited(index, 2).map((entry) => entry.slug)).not.toEqual(
      first.map((entry) => entry.slug),
    );
    expect(new Set(first.map((entry) => entry.slug)).size).toBe(ROUND_SIZE);
    expect(new Set(first.map((entry) => entry.category)).size).toBe(ROUND_SIZE);
    const geo = selectCategory(index, 'geography', 3);
    expect(geo).toHaveLength(ROUND_SIZE);
    expect(geo.every((entry) => entry.category === 'geography')).toBe(true);
    expect(selectCategory(index, 'geography', 3)).toEqual(geo);
    expect(selectCategory(index, 'food', 1).every((entry) => entry.category === 'food')).toBe(true);
    expect(isCategoryKey('sports')).toBe(true);
    expect(isCategoryKey('nope')).toBe(false);
  });

  test('a requested prompt is played first and an unknown slug is ignored', () => {
    const index = catalog(4);
    const round = selectUnlimited(index, 4);
    const pinned = withPinnedPrompt(round, 'food-02', index);
    expect(pinned[0]?.slug).toBe('food-02');
    expect(pinned).toHaveLength(ROUND_SIZE);
    expect(new Set(pinned.map((entry) => entry.slug)).size).toBe(ROUND_SIZE);
    expect(withPinnedPrompt(round, 'missing', index).map((entry) => entry.slug)).toEqual(
      round.map((entry) => entry.slug),
    );
    expect(withPinnedPrompt(round, null, index)).toEqual(round.slice(0, ROUND_SIZE));
  });
});

describe('stats storage', () => {
  test('streak continues across a local day and ignores a second write', () => {
    let stats = defaultStats();
    stats = recordDaily(stats, { dateKey: '2026-11-14', score: 100, tiers: [6, 0, 1] });
    expect(stats.streak).toBe(1);
    expect(stats.bestStreak).toBe(1);
    expect(stats.tierHits[5]).toBe(1);
    expect(stats.tierHits[0]).toBe(1);
    expect(stats.dailyScores).toEqual([100]);
    expect(recordDaily(stats, { dateKey: '2026-11-14', score: 5, tiers: [2] })).toBe(stats);
    stats = recordDaily(stats, { dateKey: '2026-11-15', score: 10, tiers: [2] });
    expect(stats.streak).toBe(2);
    stats = recordDaily(stats, { dateKey: '2026-11-17', score: 10, tiers: [2] });
    expect(stats.streak).toBe(1);
    const free = recordFreeRound(stats, { score: 40, tiers: [4] });
    expect(free.streak).toBe(1);
    expect(free.totalPoints).toBe(stats.totalPoints + 40);
    expect(free.dailyScores).toEqual(stats.dailyScores);
  });

  test('daily scores stay capped and old saves without the field still parse', () => {
    let stats = defaultStats();
    for (let day = 0; day < SCORE_HISTORY_LIMIT + 3; day++) {
      const date = `2026-01-${String((day % 28) + 1).padStart(2, '0')}`;
      stats = recordDaily(
        { ...stats, lastDailyDate: day === 0 ? null : '1999-01-01' },
        { dateKey: date, score: day, tiers: [1] },
      );
    }
    expect(stats.dailyScores).toHaveLength(SCORE_HISTORY_LIMIT);
    expect(stats.dailyScores[0]).toBe(3);
    expect(stats.dailyScores.at(-1)).toBe(SCORE_HISTORY_LIMIT + 2);
    const legacy = {
      version: 1,
      streak: 4,
      bestStreak: 4,
      lastDailyDate: '2026-11-14',
      dailyPlayed: 4,
      roundsPlayed: 4,
      totalPoints: 40,
      bestDailyScore: 20,
      tierHits: [1, 0, 0, 0, 0, 0],
    };
    expect(parseStats(legacy)?.dailyScores).toEqual([]);
    expect(parseStats(legacy)?.streak).toBe(4);
    expect(parseStats({ ...legacy, dailyScores: [5, 10] })?.dailyScores).toEqual([5, 10]);
    expect(parseStats({ ...legacy, dailyScores: 'nope' })).toBeNull();
    expect(parseStats({ ...legacy, dailyScores: [-1] })).toBeNull();
    const long = Array.from({ length: SCORE_HISTORY_LIMIT + 5 }, (_, index) => index);
    expect(parseStats({ ...legacy, dailyScores: long })?.dailyScores).toEqual(long.slice(5));
  });

  test('guess and score charts use the peak bar as full width', () => {
    expect(tierDistribution([0, 0, 0, 2, 0, 4]).map((row) => row.share)).toEqual([
      0, 0, 0, 0.5, 0, 1,
    ]);
    expect(tierDistribution([0, 0, 0, 0, 0, 0]).every((row) => row.share === 0)).toBe(true);
    expect(
      scoreDistribution([0, 49, 50, 149, 150, 499, 500, 800]).map((row) => [row.key, row.count]),
    ).toEqual([
      ['0', 1],
      ['1-49', 1],
      ['50-149', 2],
      ['150-299', 1],
      ['300-499', 1],
      ['500+', 2],
    ]);
    expect(scoreDistribution([]).every((row) => row.share === 0)).toBe(true);
    expect(scoreDistribution([10, 10, 5]).find((row) => row.key === '1-49')?.share).toBe(1);
  });

  test('corrupt payloads and throwing stores fall back safely', () => {
    expect(parseStats(null)).toBeNull();
    expect(parseStats({ version: 2 })).toBeNull();
    expect(parseStats({ version: 1, streak: -1 })).toBeNull();
    expect(parseSettings({ version: 1, noTimer: 'yes' })).toBeNull();
    expect(parseSettings({ version: 1, noTimer: true })).toEqual({
      version: 1,
      noTimer: true,
      seenRules: false,
    });
    expect(parseSettings({ version: 1, noTimer: false, seenRules: true })?.seenRules).toBe(true);
    expect(parseSettings({ version: 1, noTimer: false, seenRules: 'yes' })).toBeNull();
    const broken = memoryStore();
    broken.getItem = () => {
      throw new Error('denied');
    };
    expect(readStats(broken)).toEqual(defaultStats());
    expect(readStats(memoryStore({ [STATS_STORAGE_KEY]: '{' }))).toEqual(defaultStats());
    expect(readStats(memoryStore({ [STATS_STORAGE_KEY]: '{"version":2}' }))).toEqual(
      defaultStats(),
    );
    const quota: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => writeStats(quota, defaultStats())).not.toThrow();
    const roundTrip = memoryStore();
    const saved = recordDaily(defaultStats(), { dateKey: '2026-11-14', score: 5, tiers: [1] });
    writeStats(roundTrip, saved);
    expect(readStats(roundTrip)).toEqual(saved);
  });

  test('daily saves must match today and their own score', () => {
    const save: DailySave = {
      version: 1,
      date: '2026-11-14',
      slugs: ['great-ape-species'],
      cursor: 1,
      score: 100,
      spotlightUsed: false,
      noTimer: false,
      results: [
        {
          slug: 'great-ape-species',
          tier: 6,
          points: 100,
          answer: 'Tapanuli orangutan',
          outcome: 'hit',
          spotlight: false,
        },
      ],
      completed: true,
      recorded: false,
    };
    expect(parseDaily(save, '2026-11-14')).toEqual(save);
    expect(parseDaily(save, '2026-11-15')).toBeNull();
    expect(parseDaily({ ...save, score: 1 }, '2026-11-14')).toBeNull();
    expect(
      parseDaily({ ...save, results: [{ ...save.results[0], points: 999 }] }, '2026-11-14'),
    ).toBeNull();
    const store = memoryStore({
      [DAILY_STORAGE_KEY]: JSON.stringify(save),
    });
    expect(readDaily(store, '2026-11-14')?.score).toBe(100);
    expect(readDaily(store, '2026-11-13')).toBeNull();
    expect(readDaily(memoryStore({ [DAILY_STORAGE_KEY]: 'nope' }), '2026-11-14')).toBeNull();
  });
});

describe('share text and client payload', () => {
  test('the grid is spoiler-free and uses our squares', () => {
    expect(tierSquare(0)).toBe('⬛');
    expect(tierSquare(1)).toBe('⬜');
    expect(tierSquare(6)).toBe('🟧');
    const text = buildShareText({
      mode: 'daily',
      roundNumber: 318,
      tiers: [6, 1, 0],
      score: 105,
      spotlightUsed: true,
      noTimer: true,
      url: 'https://rarestanswer.xyz/',
    });
    expect(text).toContain('Rarest Answer #318');
    expect(text).toContain('🟧⬜⬛');
    expect(text).toContain('105 points');
    expect(text).toContain('Spotlight used');
    expect(text).toContain('No timer');
    expect(text).not.toContain('Tapanuli');
    expect(sharePageUrl('https://rarestanswer.xyz/', 'daily')).toBe('https://rarestanswer.xyz/');
    expect(sharePageUrl('https://rarestanswer.xyz', 'unlimited')).toBe(
      'https://rarestanswer.xyz/unlimited/',
    );
    expect(sharePageUrl('https://rarestanswer.xyz', 'category', 'animals')).toBe(
      'https://rarestanswer.xyz/trivia/animals/',
    );
  });

  test('client JSON drops popularity, wiki, and source, and sorts rarest-first', () => {
    expect(fixture.source).toBe('fixture');
    expect(client.answers[0]?.name).toBe('Tapanuli orangutan');
    expect(client.answers.at(-1)?.name).toBe('Human');
    const encoded = JSON.stringify(client);
    expect(encoded).not.toContain('popularity');
    expect(encoded).not.toContain('wiki');
    expect(encoded).not.toContain('source');
    const shuffled = toClientPrompt({
      ...fixture,
      answers: [...fixture.answers].reverse(),
    });
    expect(shuffled?.answers[0]?.name).toBe('Tapanuli orangutan');
    expect(rarestAnswers(client.answers, 2).map((answer) => answer.name)).toEqual([
      'Tapanuli orangutan',
      'Eastern gorilla',
    ]);
    expect(commonAnswers(client.answers, 2).map((answer) => answer.name)).toEqual([
      'Human',
      'Chimpanzee',
    ]);
    expect(couldHaveNamedLine(8)).toBe('You could have named any of 8 answers.');
    expect(revealLists(client.answers).complete).toBe(true);
    expect(revealLists(client.answers).common).toEqual([]);
    expect(revealLists(client.answers, 3).complete).toBe(false);
    expect(revealLists(client.answers, 3).rarest).toHaveLength(3);
    expect(revealLists(client.answers, 3).common).toHaveLength(3);
    expect(placementLine(1, 8)).toBe('Rarest of 8.');
    expect(placementLine(2, 8)).toBe('Rank 2 of 8. 1 answer is rarer than yours.');
    expect(placementLine(4, 8)).toBe('Rank 4 of 8. 3 answers are rarer than yours.');
    expect(placementLine(1, 1)).toBe('Only one accepted answer.');
    expect(countRarer(client.answers, 0)).toBe(7);
    expect(
      toClientPrompt({ slug: 'ok', category: 'animals', question: 'Q', answers: [] }),
    ).toBeNull();
    expect(
      toClientPrompt({
        slug: '../secret',
        category: 'animals',
        question: 'Q',
        answers: fixture.answers,
      }),
    ).toBeNull();
  });

  test('prompt files are read from the index, not a hardcoded slug list', () => {
    expect(PROMPT_INDEX_PATH).toBe('/game-data/index.json');
    expect(promptDataPath('great-ape-species')).toBe('/game-data/great-ape-species.json');
    const index = frozenIndex();
    expect(index.map((entry) => entry.slug)).toEqual(['great-ape-species']);
    expect(index[0]?.question).toBe(fixture.question);
    expect(index[0]?.answerCount).toBe(fixture.answers.length);
    const loaded = toClientPrompt(fixture);
    expect(loaded?.question).toBe('Name a species of great ape');
    expect(JSON.stringify(loaded)).not.toContain('popularity');
    expect(readClientPrompt('../etc/passwd')).toBeNull();
    expect(readClientPrompt('NOT a prompt')).toBeNull();
    const endpoint = readFileSync(join(root, 'src/pages/game-data/[slug].json.ts'), 'utf8');
    expect(endpoint).toContain('readPromptIndex');
    expect(endpoint).not.toContain('great-ape-species');
  });
});

describe('play pages', () => {
  test('the homepage title, H1, and description carry the target phrases', () => {
    const blob = `${HOME.title}\n${HOME.h1}\n${HOME.description}`.toLowerCase();
    for (const phrase of [
      'rarest answer game',
      'guess the rarest answer',
      'rare answer game',
      'rarest answer wins',
      'finding rare answers',
      'daily games',
      'trivia',
    ]) {
      expect(blob).toContain(phrase);
    }
    const unlimited = `${UNLIMITED.title}\n${UNLIMITED.h1}\n${UNLIMITED.description}`.toLowerCase();
    expect(unlimited).toContain('rarest answer game unlimited');
    expect(unlimited).toContain('krillion unlimited');
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    expect(index).toContain('HOME.title');
    expect(index).toContain('HOME.h1');
    expect(index).toContain('HOME.description');
    expect(index).toContain('GameFaq');
    expect(index).toContain('videoGameJsonLd');
    const unlimitedPage = readFileSync(join(root, 'src/pages/unlimited.astro'), 'utf8');
    expect(unlimitedPage).toContain('UNLIMITED.title');
    expect(unlimitedPage).toContain('UNLIMITED.h1');
  });

  test('each category page has its own trivia phrase', () => {
    expect(Object.keys(CATEGORY_PAGES)).toEqual([...CATEGORY_KEYS]);
    for (const page of Object.values(CATEGORY_PAGES)) {
      const blob = `${page.title}\n${page.h1}\n${page.description}`.toLowerCase();
      expect(blob).toContain(page.keyword);
      expect(page.intro.length).toBeGreaterThan(80);
    }
    const trivia = readFileSync(join(root, 'src/pages/trivia/[category].astro'), 'utf8');
    expect(trivia).toContain('page.title');
    expect(trivia).toContain('page.h1');
    expect(HOW_TO_STEPS.join(' ')).toContain(String(ROUND_SIZE));
    expect(HOME_FAQ.some((item) => item.answer.includes('25'))).toBe(true);
  });

  test('view totals are the last 12 months, and the how-to matches the engine', () => {
    const wiki = measureCopy(['Wikidata + Wikipedia pageviews (2026-10)'], 'none');
    expect(wiki).toContain('Wikipedia views, last 12 months');
    expect(wiki.toLowerCase()).not.toContain('monthly');
    const wikt = measureCopy(['Wikidata lexemes + Wiktionary pageviews (2026-10)'], 'none');
    expect(wikt).toContain('Wiktionary views, last 12 months');
    expect(wikt.toLowerCase()).not.toContain('monthly');
    const placeholder = measureCopy(['fixture'], 'none');
    expect(placeholder).toContain('placeholder popularity');
    expect(placeholder.toLowerCase()).not.toContain('monthly');

    const how = HOW_TO_STEPS.join(' ');
    expect(how).toContain('the prompt accepts');
    expect(how).not.toContain('any real answer');
    expect(how).not.toContain('category is still empty');
    expect(how).toContain('a, an, or the');
    expect(how).toContain('at least six characters');
    expect(how).toContain('only one answer is that close');
    expect(how).toContain('costs no time');
    expect(how).toContain('locks once the round starts');
    expect(RULES_AT_A_GLANCE.join(' ')).toContain('while the timer is on');

    const rarity = HOME_FAQ.find((item) => item.question.toLowerCase().includes('how is rarity'));
    expect(rarity?.answer).toContain('Wikipedia views, last 12 months');
    expect(rarity?.answer).toContain('Wiktionary views, last 12 months');
    expect(rarity?.answer.toLowerCase()).not.toContain('monthly');
    expect(CATEGORY_PAGES.geography.intro).toContain("prompt's list");
    expect(CATEGORY_PAGES.geography.intro).not.toContain('Every real answer counts');
    expect(CATEGORY_PAGES.food.intro).not.toContain('other players');
  });

  test('the play surface does not mount an ad slot', () => {
    const dir = join(root, 'src/components/game');
    for (const file of readdirSync(dir)) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/AdSense|Adsterra|StickyBanner/);
    }
  });
});

describe('live prompt catalog', () => {
  test('every prompt file matches the index, slug rule, rarest-first order, and tiers 1..6', () => {
    const dir = join(root, 'src/data/prompts');
    const indexRaw: unknown = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    expect(Array.isArray(indexRaw)).toBe(true);
    if (!Array.isArray(indexRaw)) return;

    const bySlug = new Map<string, PromptIndexEntry>();
    for (const entry of indexRaw) {
      expect([isPromptIndexEntry(entry), entry]).toEqual([true, entry]);
      if (!isPromptIndexEntry(entry)) continue;
      expect(isSlug(entry.slug)).toBe(true);
      expect(bySlug.has(entry.slug)).toBe(false);
      bySlug.set(entry.slug, entry);
    }

    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.json') && name !== 'index.json')
      .sort();
    expect(files).toEqual([...bySlug.keys()].map((slug) => `${slug}.json`).sort());
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const slug = file.slice(0, -'.json'.length);
      const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      expect([isPromptFile(raw), slug]).toEqual([true, slug]);
      if (!isPromptFile(raw)) continue;
      const entry = bySlug.get(slug);
      expect(entry?.id).toBe(raw.id);
      expect(raw.slug).toBe(entry?.slug);
      expect(raw.category).toBe(entry?.category);
      expect(raw.question).toBe(entry?.question);
      expect(raw.answers).toHaveLength(entry?.answerCount ?? -1);
      expect(raw.answers.length).toBeGreaterThan(0);
      const ranked: RankedAnswer[] = [];
      for (const row of raw.answers) {
        expect([isRankedAnswer(row), slug]).toEqual([true, slug]);
        if (isRankedAnswer(row)) ranked.push(row);
      }
      for (let i = 1; i < ranked.length; i++) {
        const prev = ranked[i - 1];
        const next = ranked[i];
        if (!prev || !next) continue;
        expect({
          slug,
          prev: prev.name,
          next: next.name,
          ordered: isRarestFirst(prev, next),
        }).toMatchObject({ ordered: true });
      }
    }
  });
});

describe('game presentation calculations', () => {
  test('share export decodes raster treasures eagerly and removes its temporary stage', async () => {
    const stub = <T extends object>(value: Partial<T>): T => value as T;
    const image = stub<HTMLImageElement>({ loading: 'lazy', decode: vi.fn().mockResolvedValue(undefined) });
    const stage = stub<HTMLElement>({
      style: stub<CSSStyleDeclaration>({}),
      setAttribute: vi.fn(),
      append: vi.fn(),
      querySelector: vi.fn().mockReturnValue(image),
      remove: vi.fn(),
    });
    const template = stub<HTMLTemplateElement>({
      content: stub<DocumentFragment>({ cloneNode: vi.fn().mockReturnValue({}) }),
    });
    const host = stub<HTMLElement>({ querySelector: vi.fn().mockReturnValue(template), append: vi.fn() });
    const gradient = { addColorStop: vi.fn() };
    const ctx = stub<CanvasRenderingContext2D>({
      clearRect: vi.fn(), fillRect: vi.fn(), createRadialGradient: vi.fn().mockReturnValue(gradient),
      createLinearGradient: vi.fn().mockReturnValue(gradient), beginPath: vi.fn(), roundRect: vi.fn(),
      stroke: vi.fn(), fillText: vi.fn(), measureText: vi.fn().mockReturnValue({ width: 60 }),
      drawImage: vi.fn(), setLineDash: vi.fn(), arc: vi.fn(),
    });
    const canvas = stub<HTMLCanvasElement>({ width: 1200, height: 630, getContext: vi.fn().mockReturnValue(ctx) });
    vi.stubGlobal('document', {
      documentElement: {}, fonts: { ready: Promise.resolve() }, createElement: () => stage,
    });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '0 0% 50%' }));
    try {
      await drawShareCard(canvas, host, {
        title: 'Round', score: 100, tiers: [6, 0, 6], spotlight: false, noTimer: false,
        url: 'https://example.test/',
      });
      expect(image.loading).toBe('eager');
      expect(image.decode).toHaveBeenCalledOnce();
      expect(ctx.drawImage).toHaveBeenCalledTimes(3);
      expect(ctx.drawImage).toHaveBeenNthCalledWith(1, image, 960, 88, 156, 156);
      expect(stage.remove).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('Nova celebrates Rare and above and reacts to unscored prompts', () => {
    expect(novaReaction(0)).toBe('surprised');
    expect([1, 2, 3].map((tier) => novaReaction(tier as 1 | 2 | 3))).toEqual([
      'thinking', 'thinking', 'thinking',
    ]);
    expect([4, 5, 6].map((tier) => novaReaction(tier as 4 | 5 | 6))).toEqual([
      'celebrating', 'celebrating', 'celebrating',
    ]);
  });

  test('clock colors follow real remaining time and the ring stays bounded', () => {
    expect(clockVisual(25_000, 25_000)).toEqual({ phase: 'steady', offset: 0 });
    expect(clockVisual(10_000, 25_000)).toEqual({ phase: 'warning', offset: 60 });
    expect(clockVisual(5_000, 25_000)).toEqual({ phase: 'urgent', offset: 80 });
    expect(clockVisual(-1, 25_000)).toEqual({ phase: 'urgent', offset: 100 });
    expect(clockVisual(30_000, 25_000).offset).toBe(0);
    expect(clockVisual(null, 25_000)).toEqual({ phase: 'off', offset: 100 });
    expect(clockVisual(Number.NaN, 0).offset).toBe(100);
  });

  test('combo counts consecutive scored prompts and resets after an unscored prompt', () => {
    expect(currentCombo([])).toBe(0);
    expect(currentCombo([{ tier: 6 }, { tier: 1 }, { tier: 4 }])).toBe(3);
    expect(currentCombo([{ tier: 6 }, { tier: 0 }])).toBe(0);
    expect(currentCombo([{ tier: 6 }, { tier: 0 }, { tier: 2 }])).toBe(1);
  });

  test('score roll lands exactly on the true score, including replay resets', () => {
    expect(scoreAtProgress(5, 205, 0)).toBe(5);
    expect(scoreAtProgress(5, 205, 1)).toBe(205);
    expect(scoreAtProgress(5, 205, 0.5)).toBeGreaterThan(5);
    expect(scoreAtProgress(205, 0, 1)).toBe(0);
    expect(scoreAtProgress(5, 205, -1)).toBe(5);
    expect(scoreAtProgress(5, 205, 2)).toBe(205);
    expect(scoreAtProgress(5, 205, Number.NaN)).toBe(205);
  });

  test('bursts are tier-scaled, deterministic and bounded; a pass has no celebration', () => {
    expect(celebrationParticles(0)).toEqual([]);
    const common = celebrationParticles(1);
    const legendary = celebrationParticles(6);
    expect(legendary.length).toBeGreaterThan(common.length);
    expect(legendary.length).toBeLessThanOrEqual(50);
    expect(legendary).toEqual(celebrationParticles(6));
    expect(legendary.every((particle) => particle.ribbon)).toBe(true);
    expect(
      legendary.every((particle) => Math.abs(particle.x) < 200 && Math.abs(particle.y) < 225),
    ).toBe(true);
  });
});

describe('round maximum', () => {
  test('uses the highest published tier and spends Spotlight exactly once', () => {
    expect(maxRoundScore(7)).toBe(800);
    const highest = TIERS.reduce((best, row) => (row.points > best.points ? row : best));
    for (const count of [1, 3, 7]) {
      expect(maxRoundScore(count)).toBe(
        (count - 1) * scorePrompt(highest.tier, false) + scorePrompt(highest.tier, true),
      );
    }
  });

  test('empty or invalid deals cannot award a Spotlight bonus', () => {
    for (const count of [0, -1, NaN, Infinity]) expect(maxRoundScore(count)).toBe(0);
  });
});

describe('published data totals', () => {
  test('sums every index answer count and counts only represented categories', () => {
    const index: PromptIndexEntry[] = [
      { id: 'a', slug: 'first', question: 'First?', category: 'animals', answerCount: 8 },
      { id: 'b', slug: 'second', question: 'Second?', category: 'animals', answerCount: 51 },
      { id: 'c', slug: 'third', question: 'Third?', category: 'science', answerCount: 13 },
    ];
    expect(catalogTotals(index)).toEqual({ prompts: 3, answers: 72, categories: 2 });
    expect(catalogTotals(index.slice(0, 1))).toEqual({ prompts: 1, answers: 8, categories: 1 });
    expect(index[1]?.answerCount).toBe(51);
  });

  test('an empty catalog stays empty', () => {
    expect(catalogTotals([])).toEqual({ prompts: 0, answers: 0, categories: 0 });
  });
});

describe('answers by tier across the dealt prompts', () => {
  test('aggregates exact answer counts, including absent tiers, with proportional bars', () => {
    const prompt = toClientPrompt(fixture);
    if (!prompt) throw new Error('Invalid fixture');
    const first = prompt.answers[0];
    if (!first) throw new Error('Missing fixture answer');
    const tier = (n: (typeof TIERS)[number]['tier']) => ({ ...first, tier: n });
    const prompts = [
      { answers: [tier(1), tier(1), tier(4)] },
      { answers: [tier(1), tier(3), tier(6), tier(6)] },
    ];
    const rows = promptTierDistribution(prompts);
    expect(rows.map((row) => row.key)).toEqual(TIERS.map((row) => String(row.tier)));
    expect(rows.map((row) => row.count)).toEqual([3, 0, 1, 1, 0, 2]);
    expect(rows.map((row) => row.share)).toEqual([1, 0, 1 / 3, 1 / 3, 0, 2 / 3]);
    expect(rows.reduce((total, row) => total + row.count, 0)).toBe(7);
    expect(prompts.map((entry) => entry.answers.length)).toEqual([3, 4]);
  });

  test('counts the frozen prompt answers without treating aliases as answers', () => {
    const prompt = toClientPrompt(fixture);
    if (!prompt) throw new Error('Invalid fixture');
    const rows = promptTierDistribution([prompt]);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(prompt.answers.length);
    for (const row of rows) {
      expect(row.count).toBe(
        prompt.answers.filter((answer) => String(answer.tier) === row.key).length,
      );
    }
  });

  test('empty rounds produce no answers or invented distribution', () => {
    const rows = promptTierDistribution([]);
    expect(rows).toHaveLength(TIERS.length);
    expect(rows.every((row) => row.count === 0 && row.share === 0)).toBe(true);
  });
});

describe('noData answers and warm-up', () => {
  test('a noData answer is accepted and scores as Uncommon, never as the rarest', () => {
    const ranked = Array.from({ length: 11 }, (_, index) => ({
      name: `Body ${index}`,
      aliases: [],
      popularity: 1000 - index,
      rarity: (10 - index) / 20,
      tier: 1 as const,
      wiki: `Body_${index}`,
    }));
    const prompt = toClientPrompt({
      id: 'planets',
      slug: 'planets-and-dwarf-planets',
      category: 'science',
      question: 'Name a planet or dwarf planet',
      source: 'test',
      answers: [
        {
          name: 'Haumea',
          aliases: ['haumea'],
          popularity: 0,
          rarity: 1,
          tier: 6,
          noData: true,
        },
        ...ranked,
      ],
    });
    expect(prompt).not.toBeNull();
    if (!prompt) return;
    const ghost = prompt.answers.find((answer) => answer.name === 'Haumea');
    expect(ghost?.noData).toBe(true);
    expect(ghost?.tier).toBe(3);
    expect(JSON.stringify(prompt)).not.toContain('popularity');
    expect(JSON.stringify(prompt)).not.toContain('"wiki"');
    const tried = createTried();
    const hit = matchGuess(prompt.answers, 'haumea', tried);
    expect(hit.status).toBe('hit');
    if (hit.status !== 'hit') return;
    expect(effectiveTier(hit.answer)).toBe(3);
    expect(pointsForTier(3)).toBe(20);
    expect(scorePrompt(effectiveTier(hit.answer), false)).toBe(20);
    expect(applyScore(freshScore(), effectiveTier(hit.answer), true).points).toBe(40);
    expect(revealTierLabel(hit.answer)).toBe(PLAY.noDataReveal);
    expect(revealTierLabel(hit.answer).toLowerCase()).not.toContain('legendary');
    expect(revealTierLabel(hit.answer).toLowerCase()).not.toContain('rarest');
    const lists = revealLists(prompt.answers);
    expect(lists.rarest.map((answer) => answer.name)).not.toContain('Haumea');
    expect(lists.common.map((answer) => answer.name)).not.toContain('Haumea');
    expect(lists.rarest).toHaveLength(10);
    expect(rarestAnswers(prompt.answers).every((answer) => answer.noData !== true)).toBe(true);
    expect(countRarer([{ rarity: 1, noData: true }, { rarity: 0.2 }], 0.2)).toBe(0);

    const bare = toClientPrompt({
      slug: 'bare-prompt',
      category: 'science',
      question: 'Name one',
      answers: [{ name: 'Ceres', aliases: ['ceres'], noData: true }],
    });
    expect(bare?.answers[0]).toMatchObject({ name: 'Ceres', tier: 3, rarity: 0.5, noData: true });
    const kept = toClientPrompt({
      slug: 'kept-prompt',
      category: 'science',
      question: 'Name one',
      answers: [{ name: 'Earth', aliases: [], popularity: 9, rarity: 1, tier: 6, wiki: 'Earth' }],
    });
    expect(kept?.answers[0]?.noData).toBeUndefined();
    expect(kept?.answers[0]?.tier).toBe(6);
    expect(scorePrompt(effectiveTier(kept?.answers[0] ?? { tier: 6 }), false)).toBe(100);
  });

  test('warm-up does not touch stats or the daily save', () => {
    const stats = defaultStats();
    stats.streak = 4;
    stats.dailyPlayed = 2;
    const save: DailySave = {
      version: 1,
      date: '2026-11-15',
      slugs: ['great-ape-species'],
      cursor: 1,
      score: 5,
      spotlightUsed: false,
      noTimer: false,
      results: [
        {
          slug: 'great-ape-species',
          tier: 1,
          points: 5,
          answer: 'Human',
          outcome: 'hit',
          spotlight: false,
        },
      ],
      completed: true,
      recorded: true,
    };
    const store = memoryStore({
      [STATS_STORAGE_KEY]: JSON.stringify(stats),
      [DAILY_STORAGE_KEY]: JSON.stringify(save),
    });
    const beforeStats = store.getItem(STATS_STORAGE_KEY);
    const beforeDaily = store.getItem(DAILY_STORAGE_KEY);
    writeStatsIfScored(store, { ...stats, streak: 99 }, true);
    writeDailyIfScored(
      store,
      { ...save, score: 100, results: save.results.map((row) => ({ ...row, points: 100 })) },
      true,
    );
    expect(store.getItem(STATS_STORAGE_KEY)).toBe(beforeStats);
    expect(store.getItem(DAILY_STORAGE_KEY)).toBe(beforeDaily);
    expect(readStats(store)).toMatchObject({ streak: 4, dailyPlayed: 2 });
    expect(readDaily(store, '2026-11-15')?.score).toBe(5);

    expect(
      pickWarmupSlug([
        { slug: 'countries-in-europe' },
        { slug: 'us-states' },
        { slug: 'planets-and-dwarf-planets' },
      ]),
    ).toBe('planets-and-dwarf-planets');
    expect(pickWarmupSlug([{ slug: 'us-states' }, { slug: 'countries-in-europe' }])).toBe(
      'us-states',
    );
    expect(pickWarmupSlug([{ slug: 'countries-in-europe' }])).toBe('countries-in-europe');
    expect(pickWarmupSlug([{ slug: 'great-ape-species' }])).toBeNull();

    const browser = readFileSync(join(root, 'src/lib/game/browser.ts'), 'utf8');
    expect(browser).toContain('writeStatsIfScored(store, stats, true)');
    expect(browser).toContain('writeDailyIfScored(store, readDaily(store, session.dateKey), true)');
    expect(browser).toContain('if (!practice)');
  });

  test('the reveal explains rarity, reports a wrong answer, and puts Next above the list', () => {
    const href = reportAnswerHref('us-states', 'Name a US state', 'Ohio');
    const url = new URL(href);
    expect(href.startsWith('mailto:contact@rarestanswer.xyz?')).toBe(true);
    expect(url.searchParams.get('subject')).toBe('Answer report: us-states');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Name a US state');
    expect(body).toContain('Typed answer: Ohio');

    expect(PLAY.rarityLine).toBe(
      "Rarity = how rarely an answer's Wikipedia article is viewed — not what other players typed.",
    );
    expect(PLAY.noDataReveal).toBe('No Wikipedia article — scored as Uncommon');
    expect(PLAY.warmupNote).toBe('Practice — not scored, does not affect streak');
    const app = readFileSync(join(root, 'src/components/game/GameApp.astro'), 'utf8');
    expect(app.split('{PLAY.rarityLine}').length - 1).toBe(2);
    expect(app).toContain('{PLAY.warmupNote}');
    expect(app).toContain('data-game-warmup');
    expect(app).toContain('data-game-report');
    expect(app).toContain('{PLAY.reportAnswer}');
    const reveal = app.slice(
      app.indexOf('data-game-view="reveal"'),
      app.indexOf('data-game-view="end"'),
    );
    expect(reveal.indexOf('data-game-next')).toBeGreaterThan(-1);
    expect(reveal.indexOf('data-game-next')).toBeLessThan(reveal.indexOf('data-game-rarest'));

    const files = [
      join(root, 'src/lib/game/copy.ts'),
      join(root, 'src/lib/game/category-copy.ts'),
      ...readdirSync(join(root, 'src/components/game')).map((name) =>
        join(root, 'src/components/game', name),
      ),
    ];
    const blob = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(blob).not.toContain('few other players');
    expect(blob).not.toContain('nobody else');
    expect(blob).not.toContain('% of players');
    expect(blob).not.toContain('Other players will type');
  });
});

describe('plausible custom events', () => {
  interface FakeEl {
    href: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    closest(selector: string): FakeEl | null;
  }

  function anchor(href: string, extra: Record<string, string> = {}): FakeEl {
    const attrs: Record<string, string> = { href, ...extra };
    const el: FakeEl = {
      href,
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      setAttribute(name, value) {
        attrs[name] = value;
      },
      closest(selector) {
        if (selector === '[data-track]' && attrs['data-track']) return el;
        return null;
      },
    };
    return el;
  }

  function listenerSource(): string {
    const layout = readFileSync(join(root, 'src/components/layout/BaseLayout.astro'), 'utf8');
    const start = layout.indexOf('{plausibleSrc &&');
    const end = layout.indexOf('VibeCafé', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = layout.slice(start, end);
    const bodies = [...block.matchAll(/<script[^>]*is:inline[^>]*>([\s\S]*?)<\/script>/g)].map(
      (match) => match[1],
    );
    const found = bodies.filter((body) => body.includes("closest('[data-track]')"));
    expect(found).toHaveLength(1);
    expect(layout.slice(0, start)).not.toContain("closest('[data-track]')");
    expect(layout.slice(end)).not.toContain("closest('[data-track]')");
    const listener = found[0];
    expect(listener).toContain(TRACK.playPrompt);
    expect(listener).toContain(TRACK.reportAnswer);
    expect(listener).toContain(TRACK_SLUG_PATTERN);
    expect(listener).toContain(`name.length > ${TRACK_NAME_MAX}`);
    expect(listener).not.toContain(TRACK.playStarted);
    expect(listener).not.toContain(TRACK.roundCompleted);
    expect(listener).not.toContain(TRACK.warmup);
    expect(listener).not.toContain('?.');
    expect(listener).not.toContain('??');
    return listener;
  }

  function boot(links: FakeEl[], plausible?: ((...args: unknown[]) => void) | null) {
    const clicks: Array<(event: { target: unknown }) => void> = [];
    const rootAttrs: Record<string, string> = {};
    const document = {
      documentElement: {
        getAttribute(name: string) {
          return rootAttrs[name] ?? null;
        },
        setAttribute(name: string, value: string) {
          rootAttrs[name] = value;
        },
      },
      querySelectorAll(selector: string) {
        return selector === 'a[href]' ? links : [];
      },
      addEventListener(_type: string, fn: (event: { target: unknown }) => void) {
        clicks.push(fn);
      },
    };
    const sandbox = {
      window: {
        plausible,
        location: { origin: 'https://rarestanswer.xyz' },
      },
      document,
      URL,
    };
    const run = () => runInNewContext(listenerSource(), sandbox);
    run();
    return {
      clicks,
      rerun: run,
      click(target: unknown) {
        expect(clicks).toHaveLength(1);
        clicks[0]({ target });
      },
    };
  }

  test('slug rule matches the prompt slug rule', () => {
    for (const value of [
      'great-ape-species',
      'us-states',
      'planets-and-dwarf-planets',
      'a',
      'us_states',
      'Not',
      'a/b',
      '',
      'Ohio',
    ]) {
      expect(isTrackSlug(value)).toBe(isSlug(value));
    }
  });

  test('play, warm-up, and completion props stay on mode and a public slug', () => {
    expect(playStartedProps('unlimited', 'great-ape-species', 'great-ape-species')).toEqual({
      mode: 'unlimited',
      prompt: 'great-ape-species',
    });
    expect(playStartedProps('unlimited', 'us-states', 'great-ape-species')).toEqual({
      mode: 'unlimited',
    });
    expect(playStartedProps('daily', 'us-states', null)).toEqual({ mode: 'daily' });
    expect(playStartedProps('nope', 'us-states', 'us-states')).toEqual({ prompt: 'us-states' });
    expect(warmupProps('planets-and-dwarf-planets')).toEqual({
      prompt: 'planets-and-dwarf-planets',
    });
    expect(warmupProps('Ohio')).toEqual({});
    expect(roundCompletedProps('category')).toEqual({ mode: 'category' });
    expect(roundCompletedProps('nope')).toEqual({});

    const send = vi.fn();
    trackEvent(
      TRACK.playStarted,
      { mode: 'daily', prompt: 'us-states', typed: 'Ohio', score: '10' },
      send,
    );
    expect(send).toHaveBeenCalledWith(TRACK.playStarted, {
      props: { mode: 'daily', prompt: 'us-states' },
    });
    send.mockClear();
    trackEvent(TRACK.playStarted, { mode: 'daily', prompt: 'Ohio' }, send);
    expect(send).toHaveBeenCalledWith(TRACK.playStarted, { props: { mode: 'daily' } });
    send.mockClear();
    trackEvent(TRACK.roundCompleted, { mode: 'nope', prompt: 'Ohio' }, send);
    expect(send).toHaveBeenCalledWith(TRACK.roundCompleted);
    send.mockClear();
    trackEvent('', { mode: 'daily' }, send);
    trackEvent('x'.repeat(TRACK_NAME_MAX + 1), { mode: 'daily' }, send);
    expect(send).not.toHaveBeenCalled();
    expect(() => trackEvent(TRACK.playStarted, { mode: 'daily' })).not.toThrow();
    expect(() =>
      trackEvent(TRACK.playStarted, { mode: 'daily' }, () => {
        throw new Error('blocked');
      }),
    ).not.toThrow();
  });

  test('the game sends three outcome events and only the report link is a click target', () => {
    const browser = readFileSync(join(root, 'src/lib/game/browser.ts'), 'utf8');
    expect(browser.match(/trackEvent\(/g)).toHaveLength(3);
    expect(browser).toContain(
      'trackEvent(TRACK.playStarted, playStartedProps(session.mode, slug, requestedPrompt()))',
    );
    expect(browser).toContain('trackEvent(TRACK.warmup, warmupProps(practiceSlug))');
    expect(browser).toContain('trackEvent(TRACK.roundCompleted, roundCompletedProps(session.mode))');

    const app = readFileSync(join(root, 'src/components/game/GameApp.astro'), 'utf8');
    const play = app.slice(app.indexOf('data-game-play'), app.indexOf('data-game-warmup'));
    const warmup = app.slice(app.indexOf('data-game-warmup'), app.indexOf('data-game-help-open'));
    expect(play).not.toContain('data-track');
    expect(warmup).not.toContain('data-track');
    expect(app.match(/data-track=/g)).toHaveLength(1);
    expect(app).toContain('data-track={TRACK.reportAnswer}');
  });

  test('delegated [data-track] clicks tag answer-page links and omit typed guesses', () => {
    const play = anchor('/unlimited/?prompt=great-ape-species');
    const again = anchor('/unlimited/?prompt=us-states');
    const unlimited = anchor('/unlimited/');
    const contact = anchor('mailto:contact@rarestanswer.xyz');
    const badPrompt = anchor('/unlimited/?prompt=Ohio');
    const report = anchor(
      'mailto:contact@rarestanswer.xyz?subject=Answer%20report%3A%20countries-in-europe',
    );
    const kept = anchor('/unlimited/?prompt=planets-and-dwarf-planets', { 'data-track': 'Keep me' });
    const gameReport = anchor('mailto:contact@rarestanswer.xyz?subject=Answer%20report', {
      'data-track': TRACK.reportAnswer,
    });
    gameReport.href = reportAnswerHref('us-states', 'Name a US state', 'Ohio');
    const tooLong = anchor('/about/', { 'data-track': 'x'.repeat(TRACK_NAME_MAX + 1) });

    const plausible = vi.fn();
    const session = boot(
      [play, again, unlimited, contact, badPrompt, report, kept, gameReport, tooLong],
      plausible,
    );

    expect(play.getAttribute('data-track')).toBe(TRACK.playPrompt);
    expect(play.getAttribute('data-track-prompt')).toBe('great-ape-species');
    expect(again.getAttribute('data-track')).toBe(TRACK.playPrompt);
    expect(again.getAttribute('data-track-prompt')).toBe('us-states');
    expect(unlimited.getAttribute('data-track')).toBeNull();
    expect(contact.getAttribute('data-track')).toBeNull();
    expect(badPrompt.getAttribute('data-track')).toBeNull();
    expect(report.getAttribute('data-track')).toBe(TRACK.reportAnswer);
    expect(report.getAttribute('data-track-prompt')).toBe('countries-in-europe');
    expect(kept.getAttribute('data-track')).toBe('Keep me');
    expect(kept.getAttribute('data-track-prompt')).toBeNull();
    expect(gameReport.getAttribute('data-track')).toBe(TRACK.reportAnswer);
    expect(gameReport.getAttribute('data-track-prompt')).toBeNull();

    session.click(play);
    session.click({ closest: (selector: string) => again.closest(selector) });
    session.click(report);
    session.click(gameReport);
    session.click(unlimited);
    session.click({});
    session.click(tooLong);
    session.rerun();

    expect(session.clicks).toHaveLength(1);
    expect(plausible.mock.calls).toEqual([
      [TRACK.playPrompt, { props: { prompt: 'great-ape-species' } }],
      [TRACK.playPrompt, { props: { prompt: 'us-states' } }],
      [TRACK.reportAnswer, { props: { prompt: 'countries-in-europe' } }],
      [TRACK.reportAnswer, { props: { prompt: 'us-states' } }],
    ]);
    expect(JSON.stringify(plausible.mock.calls)).not.toContain('Ohio');
    expect(JSON.stringify(plausible.mock.calls)).not.toContain('Typed answer');

    const bare = anchor('mailto:contact@rarestanswer.xyz?subject=Answer%20report');
    const quiet = vi.fn();
    boot([bare], quiet);
    quiet.mockClear();
    const started = boot([bare], quiet);
    started.click(bare);
    expect(quiet).toHaveBeenCalledTimes(1);
    expect(quiet).toHaveBeenCalledWith(TRACK.reportAnswer);

    expect(() => boot([play], null).click(play)).not.toThrow();
  });
});
