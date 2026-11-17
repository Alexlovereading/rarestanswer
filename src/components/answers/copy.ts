/**
 * SEO copy for /rarest-answers/ and /answers/<slug>/.
 *
 * `prompts.ts` validates JSON, then calls `derivePromptSeo`.
 * Category labels come from `shared.categories` in the locale file.
 * An optional `seoNoun` overrides the title noun.
 * Without it, the noun is the object of the question:
 * "Name a species of great ape" → "Species of Great Ape".
 *
 * Answer-page titles lead with "Rare <plural noun>" and the rarest ranked
 * name. `noData` answers are never that name. The document title stays within
 * 60 characters; `answerTitleSuffix` drops " — Rarest Answer" when the suffix
 * would push the answer out of that window.
 * The opening says "The rarest <noun> on this list is …" once.
 * `answerSeoSentence` may add one more sentence for a slug.
 */

import { answerSeoSentence } from '~/config/answer-seo';
import { defaultLocale } from '~/i18n/routing';
import { getUi } from '~/i18n/ui';
import { TIERS, type Answer, type CategoryKey, type Prompt } from '~/lib/game/types';
import { pageTitle } from '~/lib/seo';
import {
  buildPlayerCopy,
  dataUpdatedLine,
  isNoData,
  measureHeading,
  measureKind,
  measureLabel,
  noDataExplanation,
  rankedAnswers,
  rarityBasis,
} from './player-copy';

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
  /** Hub card title. The answer page H1 is `h1`. */
  heading: string;
  /** Visible H1. Same opening as `documentTitle`, and it may run a little longer. */
  h1: string;
  /** `<title>` core, at most 60 characters. Brand suffix is decided separately. */
  documentTitle: string;
  crumb: string;
  description: string;
  /** One- or two-sentence lead under the title. */
  intro: string;
  /** Useful playing notes: scope, aliases, near-misses, easy/hard, scoring tip. */
  guide: string[];
  viewsNote: string;
  /** Column heading. Wikipedia pages use "English Wikipedia pageviews, last 12 months". */
  viewsHeading: string;
  sourceNote: string;
  tableCaption: string;
  /** "Data updated October 2026." Null when `source` names no month. */
  dataUpdated: string | null;
  /** One line above the table when any answer has no Wikipedia article. */
  noDataNote: string;
  answers: SeoAnswer[];
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

export {
  dataUpdatedLine,
  isNoData,
  measureKind,
  measureLabel,
  noDataExplanation,
  rankedAnswers,
  rarityBasis,
  rarityPlain,
  rarityShort,
  sourceMonthLabel,
} from './player-copy';

export type SeoAnswer = Answer & { noData?: true };

/** mailto subject is exactly `Answer report: <slug>`. */
export function reportAnswerHref(slug: string): string {
  return `mailto:contact@rarestanswer.xyz?subject=${encodeURIComponent(`Answer report: ${slug}`)}`;
}

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

/**
 * Pluralize the head noun and keep the "of/in/…" tail.
 * "Species of Great Ape" stays "Species of Great Ape" (species is invariant).
 * This does not invert to "Great Ape species".
 */
function pluralHeadTitle(phrase: string): string {
  const prep = phrase.match(/^(.*?)(\s+(?:of|in|from|on|for|with|by)\s+.+)$/i);
  if (prep?.[1] && prep[2]) return `${pluralizeChunk(prep[1])}${prep[2]}`;
  return pluralizeChunk(phrase);
}

function pluralizeChunk(phrase: string): string {
  const parts = phrase.split(/ or /i);
  if (parts.length > 1) return parts.map((part) => pluralPhrase(part.trim())).join(' or ');
  return pluralPhrase(phrase);
}

/** "Rare Species of Great Ape" — the phrasing searchers actually type. */
function rarePluralTitle(nounTitle: string): string {
  return `Rare ${pluralHeadTitle(nounTitle)}`;
}

const TITLE_MAX = 60;
const BRAND_SUFFIX = ' — Rarest Answer';
const DESC_MIN = 140;
const DESC_MAX = 160;

function clipTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_MAX) return clean;
  const cut = clean.slice(0, TITLE_MAX + 1);
  const space = cut.lastIndexOf(' ');
  const base = (space >= 28 ? cut.slice(0, space) : clean.slice(0, TITLE_MAX)).trimEnd();
  return base.replace(/[\s:&,(–-]+$/u, '').trimEnd();
}

/**
 * Lead with the search phrasing and the rarest ranked answer.
 * Fall back to "Rarest <noun>: <answer> (<N> Ranked)" when the long form
 * does not fit. `noData` names are not passed in as `rareName`.
 */
function buildDocumentTitle(
  nounTitle: string,
  rareName: string | null,
  rankedCount: number,
  total: number,
): string {
  const rareLabel = rarePluralTitle(nounTitle);
  if (!rareName || rankedCount <= 0) {
    const none = `${rareLabel}: None Ranked`;
    if (none.length <= TITLE_MAX) return none;
    const shorter = `Rarest ${nounTitle}: None Ranked`;
    return shorter.length <= TITLE_MAX ? shorter : clipTitle(shorter);
  }
  const rankedLabel = rankedCount === total ? `All ${rankedCount} Ranked` : `${rankedCount} Ranked`;
  const preferred = `${rareLabel}: ${rareName} & ${rankedLabel}`;
  if (preferred.length <= TITLE_MAX) return preferred;
  const fallback = `Rarest ${nounTitle}: ${rareName} (${rankedCount} Ranked)`;
  if (fallback.length <= TITLE_MAX) return fallback;
  const rareAndName = `${rareLabel}: ${rareName}`;
  if (rareAndName.length <= TITLE_MAX) return rareAndName;
  return clipTitle(preferred);
}

/** H1 matches the title and may spell out "and" when that still reads as a heading. */
function buildSnippetH1(
  nounTitle: string,
  rareName: string | null,
  rankedCount: number,
  total: number,
  documentTitle: string,
): string {
  const rareLabel = rarePluralTitle(nounTitle);
  if (!rareName || rankedCount <= 0) {
    const longer = `${rareLabel}: No Ranked Answer`;
    return longer.length <= 90 ? longer : documentTitle;
  }
  const rankedLabel =
    rankedCount === total ? `and All ${rankedCount} Ranked` : `and ${rankedCount} Ranked`;
  const preferred = `${rareLabel}: ${rareName} ${rankedLabel}`;
  if (preferred.length <= 90) return preferred;
  const withName = `${rareLabel}: ${rareName}`;
  if (withName.length <= 100) return withName;
  return documentTitle;
}

/**
 * Mirrors BaseLayout: undefined keeps " — Rarest Answer" when it still fits
 * in 60 characters. '' means the suffix is dropped.
 */
export function answerTitleSuffix(core: string): '' | undefined {
  if (core.includes('Rarest Answer')) return '';
  if (core.length + BRAND_SUFFIX.length <= TITLE_MAX) return undefined;
  return '';
}

/** The `<title>` string after BaseLayout's suffix rule. */
export function renderedAnswerTitle(core: string): string {
  if (answerTitleSuffix(core) === undefined && !core.includes('Rarest Answer')) {
    return `${core}${BRAND_SUFFIX}`;
  }
  return core;
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

function compareAnswers(a: SeoAnswer, b: SeoAnswer): number {
  const aMissing = isNoData(a);
  const bMissing = isNoData(b);
  if (aMissing !== bMissing) return aMissing ? 1 : -1;
  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
  if (a.popularity !== b.popularity) return a.popularity - b.popularity;
  return a.name.localeCompare(b.name, 'en');
}

function buildHeading(nounTitle: string, total: number, ranked: number): string {
  if (ranked <= 0) return `${nounTitle} — No Ranked Rarest Answer`;
  if (ranked !== total) {
    const answers = ranked === 1 ? 'Answer' : 'Answers';
    return `Rarest ${nounTitle} — ${ranked} ${answers} Ranked by Pageviews`;
  }
  const answers = total === 1 ? 'Answer' : 'Answers';
  return `Rarest ${nounTitle} — All ${total} ${answers} Ranked by Rarity`;
}

function measureShort(source: string): string {
  const kind = measureKind(source);
  if (kind === 'wiktionary') return 'Wiktionary views';
  if (kind === 'stored') return 'stored popularity';
  return 'Wikipedia views';
}

function quotedAsked(question: string, max?: number): string {
  let asked = stripEndPunctuation(question).replace(/"/g, "'");
  if (max != null && asked.length > max) {
    const cut = asked.slice(0, Math.max(0, max - 1));
    const space = cut.lastIndexOf(' ');
    const base = (space > 20 ? cut.slice(0, space) : cut).trimEnd();
    asked = `${base}…`;
  }
  return `"${asked}"`;
}

function alsoNames(ranked: readonly SeoAnswer[]): SeoAnswer[] {
  return ranked.slice(1, 3);
}

function alsoSentence(names: readonly SeoAnswer[]): string {
  if (names.length === 0) return '';
  const label = names.every((answer) => answer.tier >= 4) ? 'Also rare' : 'Next rarest';
  return ` ${label}: ${names.map((answer) => answer.name).join(', ')}.`;
}

function descriptionPads(source: string): string[] {
  const kind = measureKind(source);
  const window =
    kind === 'stored'
      ? ' Stored popularity on this prompt.'
      : kind === 'wiktionary'
        ? ' Wiktionary pageviews, last 12 months.'
        : ' Wikipedia pageviews, last 12 months.';
  return [' Ranked rarest first.', ' Full list on this page.', window];
}

function clipDescription(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESC_MAX) return clean;
  const cut = clean.slice(0, DESC_MAX - 1);
  const space = cut.lastIndexOf(' ');
  const base = (space >= 110 ? cut.slice(0, space) : cut).trimEnd().replace(/[,:;]$/g, '');
  const clipped = `${base}…`;
  return clipped.length <= DESC_MAX ? clipped : clipped.slice(0, DESC_MAX);
}

/** Keep a complete sentence inside 140–160 characters when the candidates allow it. */
function clampDescription(candidates: string[], pads: string[]): string {
  const clean = [
    ...new Set(candidates.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean)),
  ];
  const inRange = clean.find((item) => item.length >= DESC_MIN && item.length <= DESC_MAX);
  if (inRange) return inRange;
  const under = clean.filter((item) => item.length < DESC_MIN).sort((a, b) => b.length - a.length);
  if (under.length > 0) {
    let text = under[0] ?? '';
    for (const pad of pads) {
      if (text.length >= DESC_MIN) break;
      const next = `${text}${pad}`;
      if (next.length <= DESC_MAX) text = next;
    }
    if (text.length >= DESC_MIN && text.length <= DESC_MAX) return text;
    if (text.length < DESC_MIN) {
      const filler = ' The ranking is published on this page.';
      if (text.length + filler.length <= DESC_MAX) text += filler;
    }
    if (text.length >= DESC_MIN && text.length <= DESC_MAX) return text;
  }
  const over = clean.filter((item) => item.length > DESC_MAX).sort((a, b) => a.length - b.length);
  return clipDescription(over[0] ?? clean[0] ?? '');
}

function buildSnippetDescription(
  rare: SeoAnswer | undefined,
  ranked: readonly SeoAnswer[],
  total: number,
  question: string,
  source: string,
): string {
  const measure = measureShort(source);
  const asked = quotedAsked(question);
  const shortAsked = quotedAsked(question, 42);
  const pads = descriptionPads(source);
  if (!rare) {
    return clampDescription(
      [
        `No ranked rarest answer for ${asked}. All ${total} accepted answers lack an English Wikipedia article, so none is ranked. They stay on the list as unranked names.`,
        `No ranked rarest answer. All ${total} accepted answers lack an English Wikipedia article, so none is called the rarest. They stay unranked on this list.`,
      ],
      pads,
    );
  }
  const lead = `Rarest answer: ${rare.name} (${tierName(rare.tier)}).`;
  const alsoFull = alsoSentence(alsoNames(ranked));
  const alsoOne = alsoSentence(alsoNames(ranked).slice(0, 1));
  const bridges = [
    ` All ${total} accepted answers to ${asked}, ranked by ${measure}.`,
    ` All ${total} answers to ${asked}, ranked by ${measure}.`,
    ` ${total} answers to ${asked}, ranked by ${measure}.`,
    ` All ${total} accepted answers to ${shortAsked}, ranked by ${measure}.`,
    ` For ${asked}, ranked by ${measure}.`,
    ` ${asked}, ranked by ${measure}.`,
    ` All ${total} accepted answers, ranked by ${measure}.`,
    ` Ranked by ${measure}.`,
  ];
  const candidates: string[] = [];
  for (const extra of [alsoFull, alsoOne, '']) {
    for (const bridge of bridges) candidates.push(`${lead}${extra}${bridge}`);
  }
  return clampDescription(candidates, pads);
}

function gameDisclaimer(source: string): string {
  const kind = measureKind(source);
  if (kind === 'wiktionary') {
    return 'If you met this prompt in Krillion or another rare-answer game, rarity here is English Wiktionary pageviews over the last 12 months.';
  }
  if (kind === 'stored') {
    return 'If you met this prompt in Krillion or another rare-answer game, rarity here is the stored popularity on this list.';
  }
  return 'If you met this prompt in Krillion or another rare-answer game, rarity here is English Wikipedia pageviews over the last 12 months.';
}

/** "The rarest <noun> on this list is <name>." Empty when nothing is ranked. */
function rarestNounLine(nounPhrase: string, ranked: readonly SeoAnswer[]): string {
  const rare = ranked[0];
  if (!rare) return '';
  const cluster = ranked.filter((answer) => answer.rarity === rare.rarity);
  if (cluster.length > 1) {
    const shown = cluster.slice(0, 3).map((answer) => answer.name);
    const more = cluster.length > 3 ? `, and ${cluster.length - 3} more` : '';
    return `The rarest ${nounPhrase} on this list are ${joinNames(shown)}${more}.`;
  }
  return `The rarest ${nounPhrase} on this list is ${rare.name}.`;
}

function buildSnippetIntro(
  slug: string,
  nounPhrase: string,
  source: string,
  ranked: readonly SeoAnswer[],
): string {
  const looking = `Looking for a rare ${nounPhrase} to name?`;
  const ask = `name a rare ${nounPhrase}`;
  const extra = answerSeoSentence(slug);
  const disclaimer = extra ? `${extra} ${gameDisclaimer(source)}` : gameDisclaimer(source);
  const rare = ranked[0];
  if (!rare) {
    return `${looking} None of the accepted answers has an English Wikipedia article, so none is ranked as the rarest ${nounPhrase}. ${disclaimer}`;
  }
  const tier = tierName(rare.tier);
  const cluster = ranked.filter((answer) => answer.rarity === rare.rarity);
  const least = measureKind(source) === 'stored' ? 'lowest stored-popularity' : 'least-viewed';
  const nounLine = rarestNounLine(nounPhrase, ranked);
  if (cluster.length > 1) {
    const shown = cluster.slice(0, 3).map((answer) => answer.name);
    const more = cluster.length > 3 ? `, and ${cluster.length - 3} more` : '';
    return `${looking} ${nounLine} The rarest accepted answers are ${joinNames(shown)}${more} (${tier}). To ${ask}, start with those ${least} ranked answers. ${disclaimer}`;
  }
  const answerSentence = `The rarest accepted answer is ${rare.name} (${tier}).`;
  const follow =
    ranked.length === 1
      ? `To ${ask}, that is the only ranked answer.`
      : `To ${ask}, start with that ${least} ranked answer.`;
  return `${looking} ${nounLine} ${answerSentence} ${follow} ${disclaimer}`;
}

export function derivePromptSeo(input: PromptInput): PromptSeo {
  const answers = [...input.answers].sort(compareAnswers);
  if (answers.length === 0) throw new Error(`Prompt ${input.slug} has no answers`);
  const ranked = rankedAnswers(answers);
  const rare = ranked[0];
  const { nounTitle, nounPhrase } = deriveNoun(input.question, input.seoNoun);
  const documentTitle = buildDocumentTitle(
    nounTitle,
    rare?.name ?? null,
    ranked.length,
    answers.length,
  );
  const h1 = buildSnippetH1(nounTitle, rare?.name ?? null, ranked.length, answers.length, documentTitle);
  const heading = buildHeading(nounTitle, answers.length, ranked.length);
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
    h1,
    documentTitle,
    crumb: rarePluralTitle(nounTitle),
    description: buildSnippetDescription(rare, ranked, answers.length, input.question, input.source),
    intro: buildSnippetIntro(input.slug, nounPhrase, input.source, ranked),
    guide: player.guide,
    viewsNote: player.viewsNote,
    viewsHeading: player.viewsHeading,
    sourceNote: player.sourceNote,
    tableCaption: player.tableCaption,
    dataUpdated: dataUpdatedLine(input.source),
    noDataNote: noDataExplanation(answers),
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
  const room = DESC_MAX - suffix.length;
  if (room < 8) return marker.slice(0, DESC_MAX);
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

  const titleGroupsRendered = new Map<string, PromptSeo[]>();
  for (const prompt of prompts) {
    const key = renderedAnswerTitle(prompt.documentTitle);
    const group = titleGroupsRendered.get(key);
    if (group) group.push(prompt);
    else titleGroupsRendered.set(key, [prompt]);
  }
  for (const group of titleGroupsRendered.values()) {
    if (group.length < 2) continue;
    for (const prompt of group) {
      const withSlug = disambiguateDocumentTitle(prompt.documentTitle, prompt.slug, '(');
      const slugTaken = prompts.some(
        (other) =>
          other !== prompt &&
          renderedAnswerTitle(other.documentTitle) === renderedAnswerTitle(withSlug),
      );
      prompt.documentTitle = slugTaken
        ? disambiguateDocumentTitle(prompt.documentTitle, prompt.slug, '[')
        : withSlug;
    }
  }
}

function disambiguateDocumentTitle(core: string, slug: string, bracket: '(' | '['): string {
  const marker = bracket === '(' ? ` (${slug})` : ` [${slug}]`;
  if (core.length + marker.length <= TITLE_MAX) return `${core}${marker}`;
  const room = TITLE_MAX - marker.length;
  if (room < 8) return marker.trim().slice(0, TITLE_MAX);
  const cut = core
    .slice(0, room)
    .trimEnd()
    .replace(/[\s:&,(–-]+$/u, '');
  return `${cut}${marker}`;
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
  if (wiki && !wikt && !stored) return 'English Wikipedia pageviews, last 12 months';
  if (wikt && !wiki && !stored) return 'English Wiktionary pageviews, last 12 months';
  if (wiki && wikt && !stored) {
    return 'English Wikipedia pageviews, last 12 months, or English Wiktionary pageviews, last 12 months, in that set';
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
  const notPlayers = ' Not a count of player answers.';
  const full = `Rarest answers for ${prompts.length} ${promptWord} and ${answers.toLocaleString('en-US')} accepted ${answerWord}. Each card’s rarest name has the fewest ${measure}.${notPlayers}`;
  if (full.length <= 165) return full;
  const short = `Rarest answers for ${prompts.length} ${promptWord}. Each card’s rarest name has the fewest ${measure}.${notPlayers}`;
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
  const basis = catalogBasis(prompts);
  const updated = sharedUpdated(prompts);
  const updatedSentence = updated ? ` ${updated}` : '';
  return `${basis} Each card shows that prompt’s rarest ranked answer: the name with the fewest ${measure}. Answers with no English Wikipedia article are not called the rarest. This index has ${prompts.length} ${promptWord} in ${where}, and ${answers.toLocaleString('en-US')} accepted ${answerWord}. Open a prompt for the full list, the aliases that count, and which names score high.${updatedSentence}`;
}

function catalogBasis(prompts: readonly { source: string }[]): string {
  const kinds = new Set(prompts.map((prompt) => measureKind(prompt.source)));
  const wiki = kinds.has('wikipedia');
  const wikt = kinds.has('wiktionary');
  const stored = kinds.has('stored');
  if (wiki && !wikt && !stored) return rarityBasis('Wikipedia pageviews');
  if (wikt && !wiki && !stored) return rarityBasis('Wiktionary pageviews');
  if (stored && !wiki && !wikt) return rarityBasis('stored popularity');
  return 'When a prompt names Wikipedia, rarity comes from English Wikipedia pageviews over the last 12 months, not from player answers. A Wiktionary source uses English Wiktionary pageviews over the last 12 months. Any other source is stored popularity, not player answers.';
}

function sharedUpdated(prompts: readonly { source: string }[]): string | null {
  if (prompts.length === 0) return null;
  const lines = prompts.map((prompt) => dataUpdatedLine(prompt.source));
  const first = lines[0];
  if (!first || lines.some((line) => line !== first)) return null;
  return first;
}
