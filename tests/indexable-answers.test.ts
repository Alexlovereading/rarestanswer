import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  INDEXABLE_ANSWER_SLUGS,
  INDEXABLE_ANSWER_SLUG_SET,
  isIndexableAnswerPath,
  isIndexableAnswerSlug,
} from '~/config/indexable-answers';
import { TRENDING_PROMPT_SLUGS } from '~/config/trending-prompts';
import catalog from '~/data/prompts/index.json';

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('featured answer index policy', () => {
  test('contains 30 unique slugs, each appearing exactly once in the full catalog', () => {
    expect(INDEXABLE_ANSWER_SLUGS).toHaveLength(30);
    expect(INDEXABLE_ANSWER_SLUG_SET.size).toBe(30);
    expect(catalog).toHaveLength(276);
    for (const slug of INDEXABLE_ANSWER_SLUGS) {
      expect(catalog.filter((entry) => entry.slug === slug), slug).toHaveLength(1);
      expect(isIndexableAnswerSlug(slug)).toBe(true);
    }
    expect(catalog.filter((entry) => !isIndexableAnswerSlug(entry.slug))).toHaveLength(246);
  });

  test('includes all trending prompts', () => {
    for (const slug of TRENDING_PROMPT_SLUGS) {
      expect(isIndexableAnswerSlug(slug), slug).toBe(true);
    }
  });

  test('features at least two prompts in every category', () => {
    for (const category of [
      'geography', 'animals', 'food', 'sports', 'screen', 'music', 'science', 'history',
    ]) {
      const featured = catalog.filter(
        (entry) => entry.category === category && isIndexableAnswerSlug(entry.slug),
      );
      expect(featured.length, category).toBeGreaterThanOrEqual(2);
    }
  });

  test('matches only featured single-slug answer paths, with an optional trailing slash', () => {
    for (const slug of INDEXABLE_ANSWER_SLUGS) {
      expect(isIndexableAnswerPath(`/answers/${slug}`)).toBe(true);
      expect(isIndexableAnswerPath(`/answers/${slug}/`)).toBe(true);
    }
    for (const path of [
      '/answers/actinides', '/answers/actinides/', '/answers/not-a-prompt/',
      '/answers/', '/answers', '/rarest-answers/', '/great-ape-species/',
      '/ja/answers/great-ape-species/', '/answers/great-ape-species/extra/',
      '/answers/great-ape-species//', '/answers/great-ape-species/?prompt=actinides',
      '/answers/great-ape-species/#answers', 'https://example.com/answers/great-ape-species/',
      '/answers/great-ape-species/\n',
    ]) {
      expect(isIndexableAnswerPath(path), path).toBe(false);
    }
    expect(isIndexableAnswerSlug('actinides')).toBe(false);
  });

  test('sitemap and answer meta share the whitelist without pruning routes', () => {
    const config = source('astro.config.ts');
    expect(config).toContain("from './src/config/indexable-answers'");
    const filter = config.slice(config.indexOf('filter: (url)'), config.indexOf('serialize(item)'));
    expect(filter).toContain("if (pagePath.startsWith('/answers/') && !isIndexableAnswerPath(pagePath)) return false;");
    expect(filter).not.toMatch(/pagePath\s*===\s*['"]\/rarest-answers/);
    const page = source('src/pages/answers/[slug].astro');
    expect(page).toContain("from '~/config/indexable-answers'");
    expect(page).toContain('noindexFollow={!isIndexableAnswerSlug(prompt.slug)}');
    expect(page).toContain('return getPrompts().map(');
  });

  test('noindex keeps nofollow precedence and defaults stay indexable', () => {
    const base = source('src/components/layout/BaseLayout.astro');
    const locale = source('src/components/layout/LocaleLayout.astro');
    for (const layout of [base, locale]) expect(layout).toContain('noindexFollow?: boolean;');
    expect(base).toContain('noindexFollow = false');
    expect(base).toMatch(/noindex\s*\?\s*\(\s*<meta name="robots" content="noindex, nofollow"\s*\/>\s*\)\s*:\s*noindexFollow\s*\?\s*\(\s*<meta name="robots" content="noindex, follow"\s*\/>/);
    expect(base).toContain('content="max-image-preview:large"');
    expect(locale).toContain('<BaseLayout locale={locale} fullBleed={fullBleed} {...rest}>');
  });

  test('llms.txt advertises featured guides while describing the full game catalog', () => {
    const endpoint = source('src/pages/llms.txt.ts');
    expect(endpoint).toContain('prompts.filter((entry) => isIndexableAnswerSlug(entry.slug))');
    expect(endpoint).toContain('for (const prompt of featuredPrompts)');
    expect(endpoint).toContain('all ${prompts.length} prompts');
    expect(endpoint).toContain('${featuredPrompts.length} featured indexable answer guides');
  });
});

describe('lobby template deduplication', () => {
  test.each(['src/pages/unlimited.astro', 'src/pages/trivia/[category].astro'])(
    '%s keeps its unique content and omits homepage strips',
    (path) => {
      const page = source(path);
      for (const component of ['HowToStrip', 'TierLadder', 'CategoryDeck', 'SpotlightStrip']) {
        expect(page, component).not.toContain(component);
      }
      for (const component of ['LobbyHero', 'GameApp', 'LobbyContent', 'GameFaq', 'RelatedLinks', 'NovaCta']) {
        expect(page).toContain(`<${component}`);
      }
      expect(page).toContain('class="reading-grid"');
      expect(page).toContain('id="tips"');
      expect(page).not.toContain('href="#ways"');
      if (path.includes('unlimited')) {
        expect(page).not.toContain('BrowseAnswers');
        expect(page).toContain('id="what"');
        expect(page).toContain('id="krillion-unlimited-game"');
      } else {
        expect(page).toContain('<PopularPrompts');
        expect(page).toContain('<CategoryPrompts');
        expect(page).toContain('id="neighbor"');
      }
    },
  );

  test('robots excludes unlimited prompt parameter copies', () => {
    expect(source('src/pages/robots.txt.ts')).toContain('Disallow: /unlimited/?prompt=');
  });
});
