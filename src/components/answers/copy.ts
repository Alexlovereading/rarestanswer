/**
 * SEO copy for /rarest-answers/ and /answers/<slug>/.
 *
 * `prompts.ts` validates JSON, then calls `derivePromptSeo`.
 * Category labels come from `shared.categories` in the locale file.
 * An optional `seoNoun` overrides the title noun ("Rarest <noun>").
 * Without it, the noun is the object of the question:
 * "Name a species of great ape" → "Species of Great Ape".
 */

import { defaultLocale } from '~/i18n/routing';
import { getUi } from '~/i18n/ui';
import { TIERS, type Answer, type CategoryKey, type Prompt } from '~/lib/game/types';
import { pageTitle } from '~/lib/seo';
import { buildPlayerCopy, measureHeading, measureKind, measureLabel } from './player-copy';

export const HUB_TITLE = "Rarest Answers — Every Prompt's Rarest Answer";

export const CATEGORY_ORDER: readonly CategoryKey[] = [
  'geography',
  'animals',
  'food',
  'sports',
  'screen',
  'music',
  'science',
  'history',
];

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  geography: 'Geography',
  animals: 'Animals',
  food: 'Food',
  sports: 'Sports',
  screen: 'Movies & TV',
  music: 'Music',
  science: 'Science',
  history: 'History',
};

export function categoryLabel(category: CategoryKey): string {
  const fromUi = getUi(defaultLocale).shared.categories[category];
  return fromUi || CATEGORY_LABEL[category];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PromptSeo {
  id: string;
  slug: string;
  category: CategoryKey;
  question: string;
  source: string;
  nounTitle: string;
  nounPhrase: string;
  heading: string;
  crumb: string;
  description: string;
  /** One- or two-sentence lead under the title. */
  intro: string;
  /** Useful playing notes: scope, aliases, near-misses, easy/hard, scoring tip. */
  guide: string[];
  viewsNote: string;
  /** Column heading. Wikipedia pages use "Wikipedia views, last 12 months". */
  viewsHeading: string;
  sourceNote: string;
  tableCaption: string;
  answers: Answer[];
  faq: FaqItem[];
}

export type PromptInput = Prompt & { seoNoun?: string };

const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'to',
  'from',
  'with',
  'by',
  'at',
  'vs',
]);

const PROPER_STOP = new Set([
  'name',
  'what',
  'whats',
  'who',
  'which',
  'how',
  'a',
  'an',
  'the',
  'some',
  'any',
  'is',
  'are',
  'guess',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'to',
  'from',
]);

const INVARIANT_PLURAL = new Set([
  'species',
  'series',
  'sheep',
  'fish',
  'deer',
  'moose',
  'aircraft',
  'offspring',
]);

const tierByNumber = new Map(TIERS.map((row) => [row.tier, row]));

export function tierName(tier: Answer['tier']): string {
  return tierByNumber.get(tier)?.name ?? `Tier ${tier}`;
}

export function formatViews(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export function formatRarity(n: number): string {
  if (!Number.isFinite(n)) return '0.000';
  return n.toFixed(3);
}

export function wikipediaUrl(title: string): string {
  const slug = encodeURIComponent(title.trim().replace(/ /g, '_'));
  return `https://en.wikipedia.org/wiki/${slug}`;
}

export { measureKind, measureLabel, rarityPlain, rarityShort } from './player-copy';

/** Table heading for the popularity column. */
export function viewsColumnLabel(source: string): string {
  return measureHeading(source);
}

/** Card label next to a popularity figure. */
export function formatMeasure(n: number, source: string): string {
  const formatted = formatViews(n);
  const label = measureLabel(source);
  if (label === 'stored popularity') return `Stored popularity ${formatted}`;
  if (Math.round(n) === 1) return `1 under ${label}`;
  return `${formatted} ${label}`;
}

function normalizePhrase(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripEndPunctuation(text: string): string {
  return text.replace(/[?!.]+$/g, '').trim();
}

function properTokens(text: string): Set<string> {
  const found = new Set<string>();
  for (const raw of text.split(/[^A-Za-z0-9'’-]+/)) {
    if (!raw) continue;
    const word = raw.replace(/['’]s$/i, '');
    if (!word) continue;
    const lower = word.toLowerCase();
    if (PROPER_STOP.has(lower)) continue;
    const first = word[0];
    if (!first || first.toLowerCase() === first.toUpperCase()) continue;
    if (first !== first.toUpperCase()) continue;
    found.add(lower);
  }
  return found;
}

function renderProper(word: string): string {
  if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
  if (word !== word.toLowerCase() && word.slice(1) !== word.slice(1).toLowerCase()) return word;
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCaseWord(word: string, index: number, proper: Set<string>): string {
  const lower = word.toLowerCase();
  if (proper.has(lower)) return renderProper(word);
  if (index > 0 && SMALL_WORDS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function sentenceWord(word: string, proper: Set<string>): string {
  const lower = word.toLowerCase();
  if (proper.has(lower)) return renderProper(word);
  return lower;
}

function mapPhrase(phrase: string, proper: Set<string>, mode: 'title' | 'sentence'): string {
  const words = normalizePhrase(phrase).split(' ').filter(Boolean);
  return words
    .map((word, index) =>
      mode === 'title' ? titleCaseWord(word, index, proper) : sentenceWord(word, proper),
    )
    .join(' ');
}

function extractNoun(question: string): string | null {
  const q = stripEndPunctuation(question);
  const patterns = [
    /^name\s+(?:a|an|the|some|any)\s+(.+)$/i,
    /^name\s+(.+)$/i,
    /^what(?:'s|’s| is| are)\s+(?:a|an|the|some|any)?\s*(.+)$/i,
    /^which\s+(?:are|is)?\s*(?:a|an|the|some|any)?\s*(.+)$/i,
    /^guess\s+(?:a|an|the|some|any)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const noun = q.match(pattern)?.[1]?.trim();
    if (noun) return noun;
  }
  return null;
}

function deriveNoun(question: string, seoNoun: string | undefined): { nounTitle: string; nounPhrase: string } {
  const extracted = extractNoun(question);
  const proper = properTokens(`${question} ${seoNoun ?? ''}`);
  const sentenceSource =
    extracted ?? seoNoun ?? stripEndPunctuation(question);
  const titleSource = seoNoun ?? sentenceSource;
  const nounPhrase = mapPhrase(sentenceSource, proper, 'sentence');
  const nounTitle = mapPhrase(titleSource, proper, 'title');
  return {
    nounPhrase: nounPhrase || 'answer',
    nounTitle: nounTitle || 'Answer',
  };
}

function pluralizeWord(word: string): string {
  const lower = word.toLowerCase();
  if (INVARIANT_PLURAL.has(lower)) return word;
  if (/(?:ss|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/s$/i.test(word)) return word;
  return `${word}s`;
}

function pluralPhrase(phrase: string): string {
  if (/^species\b/i.test(phrase)) return phrase;
  const words = phrase.split(' ');
  const last = words[words.length - 1];
  if (!last) return phrase;
  words[words.length - 1] = pluralizeWord(last);
  return words.join(' ');
}

/** Pluralize the head noun, not the object of "in"/"of" ("country in Africa" → "countries in Africa"). */
function pluralHead(phrase: string): string {
  const species = speciesLabel(phrase);
  if (species) return species;
  const orParts = phrase.split(/ or /i);
  if (orParts.length > 1) return orParts.map((part) => pluralHead(part.trim())).join(' or ');
  const prep = phrase.match(/^(.*?)(\s+(?:of|in|from|on|for|with|by)\s+.+)$/i);
  if (prep?.[1] && prep[2]) return `${pluralPhrase(prep[1])}${prep[2]}`;
  return pluralPhrase(phrase);
}

/** "species of great ape" → "great ape species" (species is invariant). */
function speciesLabel(phrase: string): string | null {
  const match = phrase.match(/^species of (.+)$/i);
  if (!match?.[1]) return null;
  return `${match[1]} species`;
}

function capMeta(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 165) return clean;
  const cut = clean.slice(0, 162);
  const space = cut.lastIndexOf(' ');
  const base = space > 120 ? cut.slice(0, space) : cut;
  return `${base.trimEnd()}…`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function compareAnswers(a: Answer, b: Answer): number {
  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
  if (a.popularity !== b.popularity) return a.popularity - b.popularity;
  return a.name.localeCompare(b.name, 'en');
}

function buildHeading(nounTitle: string, count: number): string {
  const answers = count === 1 ? 'Answer' : 'Answers';
  return `Rarest ${nounTitle} — All ${count} ${answers} Ranked by Rarity`;
}

function buildDescription(
  rare: Answer,
  nounPhrase: string,
  count: number,
  question: string,
  source: string,
  seoNoun?: string,
): string {
  const group = count === 1 ? nounPhrase : pluralHead(nounPhrase);
  const heading = measureHeading(source);
  const rankedBy =
    heading === 'Stored popularity' ? 'Ranked by stored popularity.' : `Ranked by ${heading}.`;
  let text = `${count} ${group}. ${rare.name} is the rarest (${tierName(rare.tier)}). ${rankedBy}`;
  const asked = stripEndPunctuation(question);
  const withQuestion = ` “${asked}”.`;
  if (
    asked &&
    !text.toLowerCase().includes(asked.toLowerCase()) &&
    text.length + withQuestion.length <= 165
  ) {
    text += withQuestion;
  }
  const noun = seoNoun?.trim();
  if (noun && !text.toLowerCase().includes(noun.toLowerCase())) {
    const withNoun = `${noun}. ${text}`;
    if (withNoun.length <= 165) text = withNoun;
  }
  if (text.length > 165) {
    const core = `${count} ${group}. ${rare.name} is the rarest (${tierName(rare.tier)}). ${rankedBy}`;
    return capMeta(core.length <= 165 ? core : `${count} ${group}. ${rare.name} is the rarest (${tierName(rare.tier)}).`);
  }
  if (text.length >= 40) return text;
  return capMeta(`${text} Ranked from rarest to most common.`);
}

export function derivePromptSeo(input: PromptInput): PromptSeo {
  const answers = [...input.answers].sort(compareAnswers);
  const rare = answers[0];
  if (!rare) throw new Error(`Prompt ${input.slug} has no answers`);
  const { nounTitle, nounPhrase } = deriveNoun(input.question, input.seoNoun);
  const heading = buildHeading(nounTitle, answers.length);
  const player = buildPlayerCopy({
    slug: input.slug,
    question: input.question,
    source: input.source,
    answers,
  });
  return {
    id: input.id,
    slug: input.slug,
    category: input.category,
    question: input.question,
    source: input.source,
    nounTitle,
    nounPhrase,
    heading,
    crumb: `Rarest ${nounTitle}`,
    description: buildDescription(
      rare,
      nounPhrase,
      answers.length,
      input.question,
      input.source,
      input.seoNoun,
    ),
    intro: player.lead,
    guide: player.guide,
    viewsNote: player.viewsNote,
    viewsHeading: player.viewsHeading,
    sourceNote: player.sourceNote,
    tableCaption: player.tableCaption,
    answers,
    faq: player.faq,
  };
}

const RELATED_MIN = 4;
const RELATED_MAX = 6;

/**
 * Next prompts in catalog order, wrapping past the end. `sorted` may include
 * `slug`. Returns at most `count` other prompts.
 */
function takeNext(sorted: readonly PromptSeo[], slug: string, count: number): PromptSeo[] {
  if (count <= 0 || sorted.length === 0) return [];
  const index = sorted.findIndex((item) => item.slug === slug);
  if (index === -1) return sorted.filter((item) => item.slug !== slug).slice(0, count);
  const after = sorted.slice(index + 1);
  const before = sorted.slice(0, index);
  const ring = [...after, ...before].filter((item) => item.slug !== slug);
  return ring.slice(0, count);
}

/**
 * 4–6 related prompts when the catalog can fill that many: same category
 * first (the next ones in list order), then the next prompts in the full
 * catalog. Fewer than 4 only when fewer than 4 other prompts exist.
 */
export function selectRelated(prompt: PromptSeo, all: readonly PromptSeo[]): PromptSeo[] {
  const same = all.filter((item) => item.category === prompt.category);
  const picked = takeNext(same, prompt.slug, RELATED_MAX);
  if (picked.length >= RELATED_MIN) return picked;
  const seen = new Set(picked.map((item) => item.slug));
  const extras = takeNext(all, prompt.slug, all.length).filter((item) => !seen.has(item.slug));
  return [...picked, ...extras.slice(0, RELATED_MIN - picked.length)];
}

function descriptionWithMarker(description: string, marker: string): string {
  const suffix = ` ${marker}`;
  const room = 165 - suffix.length;
  if (room < 8) return marker.slice(0, 165);
  const clean = description.replace(/\s+/g, ' ').trim();
  if (clean.length <= room) return `${clean}${suffix}`;
  const cut = clean.slice(0, Math.max(0, room - 1));
  const space = cut.lastIndexOf(' ');
  const base = (space > 40 ? cut.slice(0, space) : cut).trimEnd();
  return `${base}…${suffix}`;
}

/**
 * Document titles and meta descriptions must stay unique once hundreds of
 * prompts share a noun. Mutates `heading` and `description` in place.
 */
export function ensureUniquePromptMeta(prompts: PromptSeo[]): void {
  const titleGroups = new Map<string, PromptSeo[]>();
  for (const prompt of prompts) {
    const key = pageTitle(prompt.heading);
    const group = titleGroups.get(key);
    if (group) group.push(prompt);
    else titleGroups.set(key, [prompt]);
  }
  for (const group of titleGroups.values()) {
    if (group.length < 2) continue;
    for (const prompt of group) {
      const base = prompt.heading;
      const withSlug = `${base} (${prompt.slug})`;
      const slugTaken = prompts.some(
        (other) => other !== prompt && pageTitle(other.heading) === pageTitle(withSlug),
      );
      prompt.heading = slugTaken ? `${base} [${prompt.slug}]` : withSlug;
    }
  }

  const descriptionGroups = new Map<string, PromptSeo[]>();
  for (const prompt of prompts) {
    const group = descriptionGroups.get(prompt.description);
    if (group) group.push(prompt);
    else descriptionGroups.set(prompt.description, [prompt]);
  }
  for (const group of descriptionGroups.values()) {
    if (group.length < 2) continue;
    for (const prompt of group) {
      const marked = descriptionWithMarker(prompt.description, `(${prompt.slug})`);
      const taken = prompts.some((other) => other !== prompt && other.description === marked);
      prompt.description = taken
        ? descriptionWithMarker(prompt.description, `[${prompt.slug}]`)
        : marked;
    }
  }
}

export function categoriesIn(prompts: readonly { category: CategoryKey }[]): CategoryKey[] {
  const present = new Set(prompts.map((prompt) => prompt.category));
  return CATEGORY_ORDER.filter((category) => present.has(category));
}

export function comparePromptSeo(a: PromptSeo, b: PromptSeo): number {
  const byCat = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (byCat !== 0) return byCat;
  return a.question.localeCompare(b.question) || a.slug.localeCompare(b.slug);
}

function hubMeasure(prompts: readonly { source: string }[]): string {
  const kinds = new Set(prompts.map((prompt) => measureKind(prompt.source)));
  const wiki = kinds.has('wikipedia');
  const wikt = kinds.has('wiktionary');
  const stored = kinds.has('stored');
  if (wiki && !wikt && !stored) return 'Wikipedia views, last 12 months';
  if (wikt && !wiki && !stored) return 'Wiktionary views, last 12 months';
  if (wiki && wikt && !stored) {
    return 'Wikipedia views, last 12 months, or Wiktionary views, last 12 months, in that set';
  }
  return 'stored figure in that set';
}

export function hubDescription(prompts: readonly { source?: string; answers: readonly unknown[] }[]): string {
  if (prompts.length === 0) {
    return 'Rarest answers for every prompt, with the rarest correct answer and the full ranking on its own page.';
  }
  const answers = prompts.reduce((sum, prompt) => sum + prompt.answers.length, 0);
  const promptWord = prompts.length === 1 ? 'prompt' : 'prompts';
  const answerWord = answers === 1 ? 'answer' : 'answers';
  const sourced = prompts.filter((prompt): prompt is { source: string; answers: readonly unknown[] } =>
    typeof prompt.source === 'string',
  );
  const measure = sourced.length === prompts.length ? hubMeasure(sourced) : 'stored figure in that set';
  const full = `Rarest answers for ${prompts.length} ${promptWord} and ${answers.toLocaleString('en-US')} ranked ${answerWord}. Each card’s rarest name has the fewest ${measure}.`;
  if (full.length <= 165) return full;
  const short = `Rarest answers for ${prompts.length} ${promptWord}. Each card’s rarest name has the fewest ${measure}.`;
  return capMeta(short);
}

export function hubIntro(prompts: readonly PromptSeo[]): string {
  if (prompts.length === 0) {
    return 'No prompts are published yet. Each prompt will show its rarest correct answer and a link to the full ranking.';
  }
  const answers = prompts.reduce((sum, prompt) => sum + prompt.answers.length, 0);
  const cats = categoriesIn(prompts).map((category) => categoryLabel(category));
  const where = cats.length === 1 ? `the ${cats[0]} category` : joinNames(cats);
  const promptWord = prompts.length === 1 ? 'prompt' : 'prompts';
  const answerWord = answers === 1 ? 'answer' : 'answers';
  const measure = hubMeasure(prompts);
  return `Each card shows that prompt’s rarest accepted answer: the name with the fewest ${measure}. This index has ${prompts.length} ${promptWord} in ${where}, and ${answers.toLocaleString('en-US')} ranked ${answerWord}. Open a prompt for the full list, the aliases that count, and which names score high.`;
}
