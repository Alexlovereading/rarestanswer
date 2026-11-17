/**
 * Truthful sitemap lastmod for URLs the MDX walk does not date.
 *
 * Import this only from astro.config.ts. It uses node:fs and git, and it
 * must not import `~/…`: the config file loads before that alias exists.
 *
 * Rules (never the build clock):
 * - /answers/<slug> = last commit of src/data/prompts/<file>.json
 * - hubs (/rarest-answers, /trivia/<category>, /tags, /tags/<tag>, /recent)
 *   = newest child already dated. An empty hub keeps the page file's commit.
 * - other concrete page files = last commit of that source file
 *
 * Article dates stay in the MDX walk (`lastModified`, then `date`). This
 * module does not replace a date the walk already stored for an article or
 * a category list.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Same eight keys as src/lib/game/categories.ts. Not imported: that module sits next to files other work owns, and a syntax error there must not take the sitemap down. */
const TRIVIA_CATEGORIES = [
  'geography',
  'animals',
  'food',
  'sports',
  'screen',
  'music',
  'science',
  'history',
] as const;

/** Non-default-locale legal routes from src/pages/[locale]/[legal].astro. */
const LOCALE_LEGAL_SLUGS = [
  'about',
  'privacy-policy',
  'terms-of-service',
  'copyright',
  'contact',
] as const;

export interface ArticleLastmodRef {
  locale: string;
  /** `Date.toISOString()` value. Lexicographic order matches time order. */
  iso: string;
  tags: readonly string[];
}

interface PageSource {
  /** Sitemap path without a trailing slash. `/` stays `/`. */
  path: string;
  /** Repo-relative posix path, matching `git log --name-only`. */
  file: string;
}

/**
 * Tag URL slug. Copied from slugifyTag in src/lib/url.ts — that module
 * imports `~/…`, which is not available while astro.config.ts is loading.
 * Keep the two bodies identical.
 */
export function slugifyTagForPath(tag: string): string {
  const folded = tag
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (/[^a-z0-9-]/.test(folded)) return tag.trim();
  return folded;
}

/** Frontmatter `tags`, inline `[a, b]` or a YAML list. Empty when absent. */
export function parseFrontmatterTags(frontmatter: string): string[] {
  const inline = frontmatter.match(/^tags:[ \t]*\[([^\]]*)\][ \t]*(?:#.*)?$/m);
  if (inline) return splitTagList(inline[1]);
  const block = frontmatter.match(/^tags:[ \t]*\r?\n((?:[ \t]+-[ \t]+.*(?:\r?\n|$))*)/m);
  if (!block) return [];
  const tags: string[] = [];
  for (const line of block[1].split(/\r?\n/)) {
    const item = line.match(/^[ \t]+-[ \t]+(.*)$/);
    if (!item) continue;
    const value = unquote(item[1].replace(/\s+#.*$/, '').trim());
    if (value) tags.push(value);
  }
  return tags;
}

/**
 * Newest-first `git log --pretty=format:COMMIT %cI --name-only`.
 * The first time a path appears is its latest commit. Dates are UTC ISO.
 */
export function parseCommitNameLog(log: string): Map<string, string> {
  const dates = new Map<string, string>();
  let current: string | null = null;
  for (const raw of log.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('COMMIT ')) {
      const parsed = new Date(line.slice('COMMIT '.length).trim());
      current = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      continue;
    }
    const file = unquoteGitPath(line);
    if (!current || dates.has(file)) continue;
    dates.set(file, current);
  }
  return dates;
}

function unquoteGitPath(line: string): string {
  const trimmed = line.trim();
  const bare =
    trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
  return bare.replace(/\\/g, '/');
}

function splitTagList(inner: string): string[] {
  const tags: string[] = [];
  for (const part of inner.split(',')) {
    const value = unquote(part.trim());
    if (value) tags.push(value);
  }
  return tags;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function localizedPath(locale: string, defaultLocale: string, tail: string): string {
  if (locale === defaultLocale) return tail ? `/${tail}` : '/';
  return tail ? `/${locale}/${tail}` : `/${locale}`;
}

function setIfEmpty(map: Map<string, string>, pagePath: string, iso: string | undefined): void {
  if (!iso || map.has(pagePath)) return;
  map.set(pagePath, iso);
}

function readGitCommitDates(repoRoot: string, pathspecs: readonly string[]): Map<string, string> {
  if (!fs.existsSync(path.join(repoRoot, '.git'))) return new Map();
  try {
    const log = execFileSync(
      'git',
      [
        '-c',
        'core.quotePath=false',
        '--no-pager',
        'log',
        '--pretty=format:COMMIT %cI',
        '--name-only',
        '--',
        ...pathspecs,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return parseCommitNameLog(log);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `sitemap lastmod: git log failed (${message}); answer and static page dates were left unset`,
    );
    return new Map();
  }
}

function discoverConcretePages(
  repoRoot: string,
  locales: readonly string[],
  defaultLocale: string,
): PageSource[] {
  const pagesDir = path.join(repoRoot, 'src/pages');
  if (!fs.existsSync(pagesDir)) return [];
  const found: PageSource[] = [];
  const walk = (dir: string, segments: string[], localeScoped: boolean) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '[locale]' && entry.isDirectory()) {
        walk(path.join(dir, entry.name), segments, true);
        continue;
      }
      if (entry.name.includes('[')) continue;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...segments, entry.name], localeScoped);
        continue;
      }
      // Astro drops 404/500 before the sitemap filter. They are not URLs we submit.
      if (!entry.name.endsWith('.astro') || entry.name === '404.astro') continue;
      const abs = path.join(dir, entry.name);
      const file = path.relative(repoRoot, abs).split(path.sep).join('/');
      const urlSegments =
        entry.name === 'index.astro' ? segments : [...segments, entry.name.slice(0, -'.astro'.length)];
      const tail = urlSegments.join('/');
      if (!localeScoped) {
        found.push({ path: tail ? `/${tail}` : '/', file });
        continue;
      }
      for (const locale of locales) {
        if (locale === defaultLocale) continue;
        found.push({ path: localizedPath(locale, defaultLocale, tail), file });
      }
    }
  };
  walk(pagesDir, [], false);

  const legalFile = 'src/pages/[locale]/[legal].astro';
  if (fs.existsSync(path.join(repoRoot, legalFile))) {
    for (const locale of locales) {
      if (locale === defaultLocale) continue;
      for (const slug of LOCALE_LEGAL_SLUGS) {
        found.push({ path: `/${locale}/${slug}`, file: legalFile });
      }
    }
  }
  return found;
}

interface PromptIdentity {
  file: string;
  slug: string;
  category: string;
}

function readPromptIdentities(repoRoot: string): PromptIdentity[] {
  const dir = path.join(repoRoot, 'src/data/prompts');
  if (!fs.existsSync(dir)) return [];
  const prompts: PromptIdentity[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'index.json') continue;
    const file = `src/data/prompts/${entry.name}`;
    const text = fs.readFileSync(path.join(dir, entry.name), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`sitemap lastmod: ${file} is not valid JSON (${message})`);
    }
    const record = parsed && typeof parsed === 'object' ? (parsed as { slug?: unknown; category?: unknown }) : {};
    const fromFile = entry.name.slice(0, -'.json'.length);
    const slug = typeof record.slug === 'string' && record.slug.trim() ? record.slug.trim() : fromFile;
    const category = typeof record.category === 'string' ? record.category.trim() : '';
    if (!slug || slug.includes('/') || slug.includes('\\')) continue;
    prompts.push({ file, slug, category });
  }
  return prompts;
}

function later(current: string | undefined, next: string): string {
  if (!current || current < next) return next;
  return current;
}

/**
 * Fill answer, hub, and static lastmod entries. Article paths and category
 * list paths already in `map` are left as they are.
 */
export function applyTruthfulLastmods(options: {
  map: Map<string, string>;
  repoRoot: string;
  locales: readonly string[];
  defaultLocale: string;
  articles: readonly ArticleLastmodRef[];
}): void {
  const { map, repoRoot, locales, defaultLocale, articles } = options;
  const dates = readGitCommitDates(repoRoot, ['src/data/prompts', 'src/pages']);

  for (const page of discoverConcretePages(repoRoot, locales, defaultLocale)) {
    setIfEmpty(map, page.path, dates.get(page.file));
  }

  const byCategory = new Map<string, string>();
  let answersMax: string | undefined;
  for (const prompt of readPromptIdentities(repoRoot)) {
    const iso = dates.get(prompt.file);
    if (!iso) continue;
    const answerPath = `/answers/${prompt.slug}`;
    // A repeated slug keeps the newer commit. Blind set would let readdir order win.
    map.set(answerPath, later(map.get(answerPath), iso));
    answersMax = later(answersMax, iso);
    if (prompt.category) byCategory.set(prompt.category, later(byCategory.get(prompt.category), iso));
  }
  if (answersMax) map.set('/rarest-answers', answersMax);

  const triviaSource = dates.get('src/pages/trivia/[category].astro');
  const triviaCategories = new Set<string>(TRIVIA_CATEGORIES);
  for (const category of byCategory.keys()) triviaCategories.add(category);
  for (const category of triviaCategories) {
    const iso = byCategory.get(category) ?? triviaSource;
    if (iso) map.set(`/trivia/${category}`, iso);
  }

  const recentByLocale = new Map<string, string>();
  const tagsByLocale = new Map<string, Map<string, string>>();
  for (const article of articles) {
    recentByLocale.set(article.locale, later(recentByLocale.get(article.locale), article.iso));
    let tags = tagsByLocale.get(article.locale);
    if (!tags) {
      tags = new Map();
      tagsByLocale.set(article.locale, tags);
    }
    for (const tag of article.tags) {
      const slug = slugifyTagForPath(tag);
      if (!slug) continue;
      tags.set(slug, later(tags.get(slug), article.iso));
    }
  }
  for (const [locale, iso] of recentByLocale) {
    map.set(localizedPath(locale, defaultLocale, 'recent'), iso);
  }
  for (const [locale, tags] of tagsByLocale) {
    let indexMax: string | undefined;
    for (const [slug, iso] of tags) {
      map.set(localizedPath(locale, defaultLocale, `tags/${slug}`), iso);
      indexMax = later(indexMax, iso);
    }
    if (indexMax) map.set(localizedPath(locale, defaultLocale, 'tags'), indexMax);
  }
}
