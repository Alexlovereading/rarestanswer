/**
 * HomePage ↔ en.json contract — HomePage renders straight from the locale
 * JSON `home` namespace. Before the typed-surface fix every access went
 * through `as any`, so an en.json key rename silently blanked homepage
 * blocks with zero gate failures (check-i18n only compares locale↔en, not
 * component↔en). This test regex-scans the component frontmatter+template
 * for `home.<key>[.<sub>]` accesses — including `const <alias> =
 * home.<key>` section aliases — and deep-looks every dotted path up in
 * en.json. The /faq pages' accesses through getHomeFaq() are pinned the
 * same way against `home.faq`. A key rename now fails CI here AND at
 * typecheck (getUi returns `typeof en`) instead of at a user's screen.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import en from '~/locales/en.json';
import { getHomeFaq } from '~/i18n/ui';
import { answerPath } from '~/components/answers/prompts';
import {
  rarestKeywordAnchor,
  topTrendingPrompts,
  trendingPrompts,
  TRENDING_PROMPT_SLUGS,
} from '~/config/trending-prompts';
import { loadCatalog, promptNoun, promptsFor } from '~/lib/game/category-copy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const homePage = readFileSync(join(root, 'src/components/home/HomePage.astro'), 'utf8');
const faqPages = [
  'src/pages/faq.astro',
  'src/pages/[locale]/faq.astro',
].map((rel) => ({ rel, src: readFileSync(join(root, rel), 'utf8') }));

const homeJson = en.home as unknown as Record<string, unknown>;

/** Walk a dotted path ("start.cards") through the en.json home object. */
function lookup(path: string): unknown {
  let cur: unknown = homeJson;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in (cur as Record<string, unknown>))) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Every `home.<key>[.<sub>]` literal access in the component source. */
function directHomePaths(src: string): string[] {
  const paths: string[] = [];
  for (const m of src.matchAll(/home\.([A-Za-z_]\w*)(?:\??\.([A-Za-z_]\w*))?/g)) {
    paths.push(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  }
  return paths;
}

/** Aliases declared as `const <alias>[: Type] = home.<key>` (section namespaces). */
function homeAliases(src: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const m of src.matchAll(/const ([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*home\.([A-Za-z_]\w+)/g)) {
    aliases.set(m[1], m[2]);
  }
  return aliases;
}

/** All access paths: direct `home.x[.y]` literals + `<alias>.<sub>` through declared aliases. */
function collectedHomePaths(): Set<string> {
  const paths = new Set(directHomePaths(homePage));
  for (const [alias, key] of homeAliases(homePage)) {
    for (const m of homePage.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_]\\w*)`, 'g'))) {
      paths.add(`${key}.${m[1]}`);
    }
  }
  return paths;
}

describe('HomePage ↔ en.json access contract', () => {
  test('the scanner actually sees the component (sanity against silent regex rot)', () => {
    const paths = collectedHomePaths();
    expect(paths.size).toBeGreaterThanOrEqual(10);
    expect(paths).toContain('meta.title');
    expect(paths).toContain('hero.title');
    expect(paths).toContain('start.cards');
  });

  test('every home.<key>[.<sub>] access (incl. aliases) exists in en.json', () => {
    const offenders: string[] = [];
    for (const path of collectedHomePaths()) {
      if (lookup(path) === undefined) offenders.push(path);
    }
    expect(
      offenders,
      `HomePage accesses keys missing from en.json "home":\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('/faq pages ↔ en.json home.faq contract', () => {
  test('home.faq exists with the shape both /faq routes render', () => {
    expect(homeJson.faq).toBeDefined();
    expect(lookup('faq.title')).toBeTypeOf('string');
    expect(lookup('faq.description')).toBeTypeOf('string');
    expect(Array.isArray(lookup('faq.items'))).toBe(true);
  });

  test('every faq.<key> access on both /faq routes exists under en.json home.faq', () => {
    const offenders: string[] = [];
    for (const { rel, src } of faqPages) {
      // Strip comments first — doc blocks mention "src/pages/faq.astro", a
      // filename, not a property access on the faq namespace.
      const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of codeOnly.matchAll(/\bfaq\.([A-Za-z_]\w*)/g)) {
        if (lookup(`faq.${m[1]}`) === undefined) offenders.push(`${rel}: faq.${m[1]}`);
      }
    }
    expect(offenders, `missing keys:\n${offenders.join('\n')}`).toEqual([]);
  });

  test('getHomeFaq() serves the en.json namespace (and deep-merges partial locales)', () => {
    expect(getHomeFaq('en')).toEqual(en.home.faq);
    // ja.json carries its own faq; if a key were dropped there, getUi()'s
    // deep-merge must transparently fall back to en (never undefined).
    const jaFaq = getHomeFaq('ja');
    expect(jaFaq.title).toBeTypeOf('string');
    expect(jaFaq.title.length).toBeGreaterThan(0);
    expect(Array.isArray(jaFaq.items)).toBe(true);
  });
});

describe('src/ type-escape hatch ban', () => {
  /**
   * Every UI JSON surface is typed end-to-end (getUi returns `typeof en`;
   * dynamic-key loops use `keyof typeof` narrowing), so the double-hop cast
   * that used to paper over key drift has no legitimate remaining use. This
   * is the same "ban the pattern, not the symptom" move as the is:inline
   * ES2018 syntax gate: reintroducing `as unknown as` fails here instead of
   * re-hiding a key rename until a user's screen goes blank.
   */
  test('no double-hop casts anywhere in src/ (zero tolerance, comments stripped)', () => {
    const offenders: string[] = [];
    let scanned = 0;
    const scan = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          scan(p);
          continue;
        }
        if (!/\.(astro|ts)$/.test(e.name)) continue;
        scanned += 1;
        // Same comment-stripping as the /faq scan above: a doc block may
        // legitimately discuss the pattern without committing it.
        const codeOnly = readFileSync(p, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        if (codeOnly.includes('as unknown as')) offenders.push(p.replace(root, ''));
      }
    };
    scan(join(root, 'src'));
    // Guard against silent regex/file-walk rot: src/ has ~60 .astro/.ts
    // files; if the walk stops seeing them the ban reads as vacuously green.
    expect(scanned).toBeGreaterThan(40);
    expect(
      offenders,
      `double-hop casts reintroduced in:\n${offenders.join('\n')}\n` +
        `Use the structured JSON types (getUi → typeof en / SharedUi) or ` +
        `'keyof typeof' narrowing instead.`,
    ).toEqual([]);
  });
});

describe('trending prompt links', () => {
  test('keeps GSC order and drops slugs that are not in the catalog', () => {
    expect(
      trendingPrompts([
        { slug: 'not-a-prompt' },
        { slug: 'ghibli-films' },
        { slug: 'countries-in-africa' },
        { slug: 'great-ape-species' },
      ]).map((prompt) => prompt.slug),
    ).toEqual(['great-ape-species', 'countries-in-africa', 'ghibli-films']);
  });

  test('the published catalog still contains the GSC list, in that order', () => {
    const known = loadCatalog();
    expect(trendingPrompts(known).map((prompt) => prompt.slug)).toEqual([...TRENDING_PROMPT_SLUGS]);
  });

  test('anchor text is "Rarest" plus the singular noun', () => {
    expect(rarestKeywordAnchor('country in Africa')).toBe('Rarest country in Africa');
    expect(rarestKeywordAnchor('  ')).toBe('Rarest answer');
    const catalog = loadCatalog();
    const question = (slug: string) => catalog.find((prompt) => prompt.slug === slug)?.question ?? '';
    expect(rarestKeywordAnchor(promptNoun(question('countries-in-africa')))).toBe(
      'Rarest country in Africa',
    );
    expect(rarestKeywordAnchor(promptNoun(question('great-ape-species'))).toLowerCase()).toContain(
      'species of great ape',
    );
    expect(rarestKeywordAnchor(promptNoun(question('mcu-characters'))).toLowerCase()).not.toMatch(
      /\bcharacters\b/,
    );
    expect(answerPath('countries-in-africa')).toBe('/answers/countries-in-africa/');
  });

  test('category tops follow the trending list, then the existing order', () => {
    const catalog = loadCatalog();
    const screen = promptsFor(catalog, 'screen');
    expect(topTrendingPrompts(screen, 3).map((prompt) => prompt.slug)).toEqual([
      'ghibli-films',
      'disney-animated-films',
      'mcu-characters',
    ]);
    const history = promptsFor(catalog, 'history');
    const historyTop = topTrendingPrompts(history, 3);
    expect(historyTop.map((prompt) => prompt.slug).slice(0, 2)).toEqual([
      'canadian-prime-ministers',
      'english-monarchs',
    ]);
    expect(historyTop).toHaveLength(3);
    const food = promptsFor(catalog, 'food');
    const trending = new Set<string>(TRENDING_PROMPT_SLUGS);
    expect(food.some((prompt) => trending.has(prompt.slug))).toBe(false);
    expect(topTrendingPrompts(food, 3).map((prompt) => prompt.slug)).toEqual(
      food.slice(0, 3).map((prompt) => prompt.slug),
    );
  });

  test('card anchors stay outside the rest of the card, and unlimited meta names the guess', () => {
    const files = [
      'src/components/home/AnswerLobby.astro',
      'src/components/home/CategoryPrompts.astro',
      'src/components/home/SpotlightStrip.astro',
      'src/components/home/PopularPrompts.astro',
      'src/components/answers/AnswerHub.astro',
      'src/components/answers/PromptArticle.astro',
    ];
    for (const rel of files) {
      const src = readFileSync(join(root, rel), 'utf8');
      expect(src, rel).toContain('keyword-anchor');
      expect(src, rel).toContain('inset: 0');
    }
    const lobby = readFileSync(join(root, 'src/components/home/AnswerLobby.astro'), 'utf8');
    const lobbyCard = lobby.slice(lobby.indexOf('group.prompts.map'));
    const lobbyClose = lobbyCard.indexOf('</a>');
    expect(lobbyCard.indexOf('rare.name')).toBeGreaterThan(lobbyClose);
    const category = readFileSync(join(root, 'src/components/home/CategoryPrompts.astro'), 'utf8');
    const categoryList = category.slice(category.indexOf('prompts.map'));
    expect(categoryList.indexOf('answerCountLabel')).toBeGreaterThan(categoryList.indexOf('</a>'));
    const unlimited = readFileSync(join(root, 'src/pages/unlimited.astro'), 'utf8');
    const description = unlimited.match(/const pageDescription =\n\s+'([^']+)'/)?.[1] ?? '';
    expect(description.toLowerCase()).toContain('guess the rarest answer');
    expect(description.length).toBeGreaterThanOrEqual(140);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(readFileSync(join(root, 'src/components/home/LobbyHero.astro'), 'utf8')).toContain(
      'PopularPrompts',
    );
    expect(readFileSync(join(root, 'src/pages/trivia/[category].astro'), 'utf8')).toContain(
      'topTrendingPrompts',
    );
    expect(en.shared.visuals.popularPromptsTitle).toBe('Popular prompts');
    expect(en.shared.visuals.topPromptsIn).toContain('{category}');
  });
});
