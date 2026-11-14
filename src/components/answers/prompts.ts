/**
 * Load src/data/prompts/*.json at build time (index.json is the catalog, not a prompt).
 * New files from W1-DATA are picked up on the next build without a code change.
 * Optional `seoNoun` is read here; it is not on the shared Prompt type.
 */

import { siteUrl } from '~/config/site';
import { defaultLocale } from '~/i18n/routing';
import type { Answer, CategoryKey, Prompt } from '~/lib/game/types';
import { absoluteUrl, homeUrl, localizePath } from '~/lib/url';
import {
  CATEGORY_ORDER,
  comparePromptSeo,
  derivePromptSeo,
  type PromptInput,
  type PromptSeo,
} from './copy';

export {
  HUB_TITLE,
  categoryLabel,
  categoriesIn,
  comparePromptSeo,
  formatMeasure,
  formatRarity,
  formatViews,
  hubDescription,
  hubIntro,
  tierName,
  wikipediaUrl,
  type FaqItem,
  type PromptSeo,
} from './copy';

export const HUB_PATH = localizePath('/rarest-answers', defaultLocale);

const promptModules = import.meta.glob('/src/data/prompts/*.json', { eager: true });

let cache: PromptSeo[] | null = null;

export function getPrompts(): PromptSeo[] {
  if (!cache) cache = loadPrompts();
  return cache;
}

export function getPrompt(slug: string): PromptSeo | undefined {
  return getPrompts().find((prompt) => prompt.slug === slug);
}

export function relatedPrompts(prompt: PromptSeo): PromptSeo[] {
  return getPrompts().filter(
    (other) => other.category === prompt.category && other.slug !== prompt.slug,
  );
}

export function answerPath(slug: string): string {
  return localizePath(`/answers/${slug}`, defaultLocale);
}

export function answerAbsolute(slug: string): string {
  return absoluteUrl(`/answers/${slug}`, defaultLocale);
}

export function playPath(slug: string): string {
  return `${localizePath('/unlimited', defaultLocale)}?prompt=${encodeURIComponent(slug)}`;
}

export function triviaPath(category: CategoryKey): string {
  return localizePath(`/trivia/${category}`, defaultLocale);
}

export function hubCategoryPath(category: CategoryKey): string {
  return `${HUB_PATH}?category=${encodeURIComponent(category)}`;
}

export function answerCrumbJsonLd(opts: {
  homeLabel: string;
  hubLabel: string;
  crumb: string;
  path: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: opts.homeLabel,
        item: `${siteUrl}${homeUrl(defaultLocale)}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: opts.hubLabel,
        item: `${siteUrl}${HUB_PATH}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: opts.crumb,
        item: `${siteUrl}${opts.path}`,
      },
    ],
  };
}

function loadPrompts(): PromptSeo[] {
  const slugs = new Map<string, string>();
  const prompts: PromptSeo[] = [];

  for (const [path, mod] of Object.entries(promptModules)) {
    const file = baseName(path);
    if (file === 'index.json') continue;
    const prompt = derivePromptSeo(validatePrompt(moduleJson(mod), file));
    const previous = slugs.get(prompt.slug);
    if (previous) {
      throw new Error(`prompts: slug ${prompt.slug} is in both ${previous} and ${file}`);
    }
    slugs.set(prompt.slug, file);
    if (file !== `${prompt.slug}.json`) {
      console.warn(`[answers] ${file} declares slug ${prompt.slug}`);
    }
    prompts.push(prompt);
  }

  if (prompts.length === 0) {
    console.warn('[answers] no prompt JSON files in src/data/prompts (index.json does not count)');
  }
  warnIndexDrift(slugs);
  prompts.sort(comparePromptSeo);
  return prompts;
}

function warnIndexDrift(loaded: Map<string, string>): void {
  const entry = Object.entries(promptModules).find(([path]) => baseName(path) === 'index.json');
  if (!entry) return;
  const data = moduleJson(entry[1]);
  if (!Array.isArray(data)) {
    console.warn('[answers] src/data/prompts/index.json is not an array; ignored');
    return;
  }
  const indexSlugs: string[] = [];
  for (const row of data) {
    if (isRecord(row) && typeof row.slug === 'string' && row.slug) indexSlugs.push(row.slug);
  }
  const missingFiles = indexSlugs.filter((slug) => !loaded.has(slug));
  const indexSet = new Set(indexSlugs);
  const missingIndex = [...loaded.keys()].filter((slug) => !indexSet.has(slug));
  if (missingFiles.length > 0) {
    console.warn(
      `[answers] index.json slug(s) without a prompt file: ${missingFiles.slice(0, 12).join(', ')}`,
    );
  }
  if (indexSlugs.length > 0 && missingIndex.length > 0) {
    console.warn(
      `[answers] prompt file(s) missing from index.json: ${missingIndex.slice(0, 12).join(', ')}`,
    );
  }
}

function validatePrompt(value: unknown, file: string): PromptInput {
  const obj = asRecord(value, file);
  const slug = assertSlug(reqString(obj, 'slug', file), file);
  const id = optString(obj, 'id', file) ?? slug;
  const categoryRaw = reqString(obj, 'category', file);
  if (!isCategory(categoryRaw)) {
    throw new Error(
      `prompts/${file}: category ${JSON.stringify(categoryRaw)} is not one of ${CATEGORY_ORDER.join(', ')}`,
    );
  }
  const question = reqString(obj, 'question', file);
  const source = reqString(obj, 'source', file);
  let seoNoun = optString(obj, 'seoNoun', file);
  if (seoNoun && seoNoun.length > 80) {
    console.warn(`[answers] ${file}: seoNoun is ${seoNoun.length} chars; ignoring`);
    seoNoun = undefined;
  }
  if (!Array.isArray(obj.answers) || obj.answers.length === 0) {
    throw new Error(`prompts/${file}: answers must be a non-empty array`);
  }
  const answers = obj.answers.map((answer, index) => parseAnswer(answer, file, index));
  const prompt: Prompt & { seoNoun?: string } = {
    id,
    slug,
    category: categoryRaw,
    question,
    source,
    answers,
  };
  if (seoNoun) prompt.seoNoun = seoNoun;
  return prompt;
}

function parseAnswer(value: unknown, file: string, index: number): Answer {
  const label = `${file} answers[${index}]`;
  const obj = asRecord(value, label);
  const name = reqString(obj, 'name', label);
  const popularity = obj.popularity;
  if (typeof popularity !== 'number' || !Number.isFinite(popularity) || popularity < 0) {
    throw new Error(`prompts/${label}: popularity must be a finite number >= 0`);
  }
  const rarity = obj.rarity;
  if (typeof rarity !== 'number' || !Number.isFinite(rarity) || rarity < -1e-6 || rarity > 1 + 1e-6) {
    throw new Error(`prompts/${label}: rarity must be a number from 0 to 1`);
  }
  if (!isTier(obj.tier)) {
    throw new Error(`prompts/${label}: tier must be an integer 1 through 6`);
  }
  const tier = obj.tier;
  let aliases: string[] = [];
  if (obj.aliases == null) {
    aliases = [];
  } else if (!Array.isArray(obj.aliases)) {
    throw new Error(`prompts/${label}: aliases must be an array of strings`);
  } else {
    aliases = obj.aliases.map((alias, aliasIndex) => {
      if (typeof alias !== 'string') {
        throw new Error(`prompts/${label}: aliases[${aliasIndex}] must be a string`);
      }
      return alias.trim();
    }).filter((alias) => alias !== '');
  }
  let wiki: string | undefined;
  if (obj.wiki == null || obj.wiki === '') {
    wiki = undefined;
  } else if (typeof obj.wiki !== 'string') {
    throw new Error(`prompts/${label}: wiki must be a string`);
  } else {
    const trimmed = obj.wiki.trim();
    wiki = trimmed === '' ? undefined : trimmed;
  }
  const answer: Answer = { name, aliases, popularity, rarity, tier };
  if (wiki) answer.wiki = wiki;
  return answer;
}

function isTier(value: unknown): value is Answer['tier'] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function assertSlug(slug: string, file: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(slug)) {
    throw new Error(
      `prompts/${file}: slug ${JSON.stringify(slug)} must be one URL segment (letters, numbers, hyphens, underscores)`,
    );
  }
  return slug;
}

function isCategory(value: string): value is CategoryKey {
  return (CATEGORY_ORDER as readonly string[]).includes(value);
}

function reqString(obj: Record<string, unknown>, key: string, label: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`prompts/${label}: ${key} must be a non-empty string`);
  }
  return value.trim();
}

function optString(obj: Record<string, unknown>, key: string, label: string): string | undefined {
  if (!(key in obj)) return undefined;
  const value = obj[key];
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error(`prompts/${label}: ${key} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`prompts/${label}: expected an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function baseName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function moduleJson(mod: unknown): unknown {
  if (isRecord(mod) && 'default' in mod) return mod.default;
  return mod;
}
