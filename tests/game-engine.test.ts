/**
 * Rarest Answer engine: matching, scoring, daily seed, storage, and the
 * keyword strings the play pages render.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import fixture from '~/data/prompts/great-ape-species.json';
import { CATEGORY_KEYS, isCategoryKey } from '~/lib/game/categories';
import { CATEGORY_PAGES } from '~/lib/game/category-copy';
import { HOME, HOME_FAQ, HOW_TO_STEPS, UNLIMITED } from '~/lib/game/copy';
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
import { readClientPrompt, readPromptIndex } from '~/lib/game/load-prompts';
import { createTried, matchGuess, rememberGuess, type Matchable } from '~/lib/game/match';
import { levenshtein, normalize } from '~/lib/game/normalize';
import {
  commonAnswers,
  couldHaveNamedLine,
  countRarer,
  placementLine,
  promptDataPath,
  PROMPT_INDEX_PATH,
  rarestAnswers,
  revealLists,
  toClientPrompt,
} from '~/lib/game/prompts';
import {
  applyScore,
  freshScore,
  PENALTY_MS,
  pointsForTier,
  scorePrompt,
  TIMER_MS,
} from '~/lib/game/score';
import { buildShareText, sharePageUrl, tierSquare } from '~/lib/game/share';
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
  writeStats,
  type DailySave,
  type KeyValueStore,
} from '~/lib/game/stats';
import { TIERS, type CategoryKey, type PromptIndexEntry } from '~/lib/game/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = toClientPrompt(fixture);
if (!client) throw new Error('fixture prompt did not parse');

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

  test('the fixture deals its one prompt instead of repeating it', () => {
    const index = readPromptIndex();
    const round = selectDaily(index, new Date(2026, 10, 14));
    expect(round.map((entry) => entry.slug)).toEqual(['great-ape-species']);
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
    expect(parseStats({ ...legacy, dailyScores: long })?.dailyScores).toEqual(
      long.slice(5),
    );
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
      url: 'https://rarestanswer.com/',
    });
    expect(text).toContain('Rarest Answer #318');
    expect(text).toContain('🟧⬜⬛');
    expect(text).toContain('105 points');
    expect(text).toContain('Spotlight used');
    expect(text).toContain('No timer');
    expect(text).not.toContain('Tapanuli');
    expect(sharePageUrl('https://rarestanswer.com/', 'daily')).toBe('https://rarestanswer.com/');
    expect(sharePageUrl('https://rarestanswer.com', 'unlimited')).toBe(
      'https://rarestanswer.com/unlimited/',
    );
    expect(sharePageUrl('https://rarestanswer.com', 'category', 'animals')).toBe(
      'https://rarestanswer.com/trivia/animals/',
    );
  });

  test('client JSON drops popularity, wiki, and source, and sorts rarest-first', () => {
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
    const index = readPromptIndex();
    expect(index.some((entry) => entry.slug === 'great-ape-species')).toBe(true);
    const loaded = readClientPrompt('great-ape-species');
    expect(loaded?.question).toBe('Name a species of great ape');
    expect(JSON.stringify(loaded)).not.toContain('popularity');
    expect(readClientPrompt('../etc/passwd')).toBeNull();
    expect(readClientPrompt('not-a-real-prompt')).toBeNull();
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
    expect(index).toContain('faqPageJsonLd');
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

  test('the play surface does not mount an ad slot', () => {
    const dir = join(root, 'src/components/game');
    for (const file of readdirSync(dir)) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/AdSense|Adsterra|StickyBanner/);
    }
  });
});
