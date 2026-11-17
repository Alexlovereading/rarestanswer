/**
 * SEO copy for /rarest-answers/ and /answers/<slug>/.
 *
 * `prompts.ts` validates JSON, then calls `derivePromptSeo`.
 * Category labels come from `shared.categories` in the locale file.
 * An optional `seoNoun` overrides the title noun.
 * Without it, the noun is the object of the question:
 * "Name a species of great ape" → "Species of Great Ape".
 *
 * The document title is "Rare <plural noun>: All <N> Ranked, Rarest to Most Common"
 * (fallback "Rare <plural noun>: All <N> Ranked by Rarity"). It does not name
 * an answer. When some answers are `noData`, N is the ranked count, and the
 * title, H1, or description also states the accepted count. `answerTitleNoun`
 * may replace the plural noun for one slug.
 * The H1 is "<Plural noun>: all <N>, ranked from rarest to most common",
 * or "all <ranked> ranked, <accepted> accepted" when those counts differ.
 * The opening names the rarest answer once. `answerSeoSentence` may add
 * one scope note. `answerTitleSuffix` drops " — Rarest Answer" when the
 * suffix would push the core past 60 characters.
 */

import { answerSeoSentence, answerTitleNoun } from '~/config/answer-seo';
import { curatedRelatedSlugs } from '~/config/related-prompts';
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
  /** Visible H1, sentence case. The rarest name stays in `intro`, not here. */
  h1: string;
  /** `<title>` core, at most 60 characters. No answer name. */
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

/** Keep a comma or parenthesis outside the word that is cased. */
function withEdge(word: string, render: (core: string) => string): string {
  const match = word.match(/^([^A-Za-z0-9'’]*)(.*?)([^A-Za-z0-9'’]*)$/);
  const lead = match?.[1] ?? '';
  const core = match?.[2] ?? '';
  const tail = match?.[3] ?? '';
  if (!core) return word;
  return `${lead}${render(core)}${tail}`;
}

function titleCaseWord(word: string, index: number, proper: Set<string>): string {
  return withEdge(word, (core) => {
    const lower = core.toLowerCase();
    if (proper.has(lower)) return renderProper(core);
    if (index > 0 && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function sentenceWord(word: string, proper: Set<string>): string {
  return withEdge(word, (core) => {
    const lower = core.toLowerCase();
    if (proper.has(lower)) return renderProper(core);
    return lower;
  });
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

const TITLE_MAX = 60;
const BRAND_SUFFIX = ' — Rarest Answer';
const DESC_MIN = 140;
const DESC_MAX = 160;

const DANGLING_TITLE_WORD = new Set([
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

function clipTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_MAX) return clean;
  const cut = clean.slice(0, TITLE_MAX + 1);
  const space = cut.lastIndexOf(' ');
  let base = (space >= 28 ? cut.slice(0, space) : clean.slice(0, TITLE_MAX)).trimEnd();
  base = base.replace(/[\s:&,(–-]+$/u, '').trimEnd();
  const words = base.split(' ').filter(Boolean);
  while (words.length > 3 && DANGLING_TITLE_WORD.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }
  return words.join(' ');
}

/**
 * Title candidates, best first. N is the ranked count.
 * When some accepted answers are unranked, the longer forms also say how many are accepted.
 */
function titleCandidates(noun: string, ranked: number, total: number): string[] {
  const label = `Rare ${noun}`.replace(/\s+/g, ' ').trim();
  const rankedLabel = `${label}: All ${ranked} Ranked`;
  if (ranked < total) {
    return [
      `${label}: All ${ranked} Ranked, ${total} Accepted`,
      `${label}: All ${ranked} Ranked (${total} Accepted)`,
      rankedLabel,
    ];
  }
  return [
    `${rankedLabel}, Rarest to Most Common`,
    `${label}: All ${ranked} Ranked by Rarity`,
    rankedLabel,
  ];
}

function trimEdgeWords(noun: string): string {
  const words = noun.replace(/[\s,:;–-]+$/u, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  while (words.length > 1 && DANGLING_TITLE_WORD.has(words[0]!.toLowerCase())) words.shift();
  while (words.length > 1 && DANGLING_TITLE_WORD.has(words[words.length - 1]!.toLowerCase())) words.pop();
  return words.join(' ');
}

function addCommaCuts(noun: string, add: (noun: string) => void): void {
  let rest = noun;
  while (rest.includes(',')) {
    rest = rest.slice(0, rest.lastIndexOf(','));
    add(rest);
  }
}

function addWordPrefixes(noun: string, add: (noun: string) => void): void {
  const words = trimEdgeWords(noun).split(' ').filter(Boolean);
  for (let keep = words.length - 1; keep >= 1; keep -= 1) add(words.slice(0, keep).join(' '));
}

function addSuffixes(noun: string, add: (noun: string) => void): void {
  const words = trimEdgeWords(noun).split(' ').filter(Boolean);
  for (let start = 1; start < words.length; start += 1) add(words.slice(start).join(' '));
}

/**
 * Nouns to try, best first. The full noun wins when it fits.
 * An "or" list keeps the part before "or".
 * A long "X of Y" noun keeps its ending ("Best Actress") before a shared opening.
 */
function titleNouns(pluralTitle: string): string[] {
  const full = trimEdgeWords(pluralTitle);
  const nouns: string[] = [];
  const add = (noun: string) => {
    const clean = trimEdgeWords(noun);
    if (!clean || nouns.includes(clean)) return;
    if (clean !== full && /\sor\s/i.test(clean)) return;
    nouns.push(clean);
  };
  add(full);
  const orAt = pluralTitle.search(/\s+or\s+/i);
  if (orAt > 0) {
    const primary = pluralTitle.slice(0, orAt);
    add(primary);
    addCommaCuts(primary, add);
    addWordPrefixes(primary, add);
  } else {
    addCommaCuts(full, add);
    addSuffixes(full, add);
    addWordPrefixes(full, add);
  }
  return nouns;
}

/**
 * "Rare <plural>: All <N> Ranked, Rarest to Most Common".
 * The rarest name stays off the title. N is the ranked count.
 * When nothing is ranked, the title says so instead of claiming a ranking.
 */
function buildDocumentTitle(pluralTitle: string, total: number, rankedCount: number): string {
  const noun = pluralTitle.replace(/\s+/g, ' ').trim();
  if (rankedCount <= 0) {
    const none = `Rare ${trimEdgeWords(noun) || noun}: None Ranked`;
    return none.length <= TITLE_MAX ? none : clipTitle(none);
  }
  for (const option of titleNouns(noun)) {
    for (const candidate of titleCandidates(option, rankedCount, total)) {
      if (candidate.length <= TITLE_MAX) return candidate;
    }
  }
  const fallback = titleCandidates(trimEdgeWords(noun) || noun, rankedCount, total).at(-1) ?? noun;
  return clipTitle(fallback);
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "<Plural noun>: all <N>, ranked from rarest to most common" in sentence case. */
function buildPageH1(pluralSentence: string, total: number, rankedCount: number): string {
  const noun = capitalizeFirst(pluralSentence.trim() || 'answers');
  if (rankedCount <= 0) return `${noun}: all ${total}, none ranked`;
  if (rankedCount < total) return `${noun}: all ${rankedCount} ranked, ${total} accepted`;
  return `${noun}: all ${total}, ranked from rarest to most common`;
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
    return `Rarest ${nounTitle} — ${ranked} Ranked, ${total} Accepted`;
  }
  const answers = total === 1 ? 'Answer' : 'Answers';
  return `Rarest ${nounTitle} — All ${total} ${answers} Ranked by Rarity`;
}

interface DescFlags {
  accepted: boolean;
  scores: boolean;
  tail: 'full' | 'short' | 'none';
}

function questionVariants(question: string): string[] {
  const asked = stripEndPunctuation(question).replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  const variants = [asked];
  const words = asked.split(' ').filter(Boolean);
  for (let keep = words.length - 1; keep >= 3; keep -= 1) {
    variants.push(`${words.slice(0, keep).join(' ')}…`);
  }
  return variants.length > 0 ? variants : ['this prompt'];
}

function krillionWhere(tail: DescFlags['tail']): string {
  if (tail === 'full') return ' in Krillion or another rare-answer game';
  if (tail === 'short') return ' in Krillion';
  return '';
}

function stuckLine(asked: string, flags: DescFlags, see: string): string {
  return `Stuck on "${asked}"${krillionWhere(flags.tail)}? ${see}`;
}

/** Reason to open the page. Answer names stay in the intro, not here. */
function clickDescriptionCandidates(question: string, total: number, rankedCount: number): string[] {
  const asked = questionVariants(question);
  const tails: DescFlags['tail'][] = ['full', 'short', 'none'];
  const out: string[] = [];
  if (rankedCount <= 0) {
    const sees = [
      `See all ${total} accepted answers. None is ranked, because none has an English Wikipedia article.`,
      `All ${total} accepted answers are unranked. None has an English Wikipedia article.`,
      `None of the ${total} accepted answers is ranked.`,
    ];
    for (const questionText of asked) {
      for (const tail of tails) {
        for (const see of sees) {
          out.push(stuckLine(questionText, { accepted: true, scores: false, tail }, see));
        }
      }
    }
    return out;
  }
  if (rankedCount < total) {
    const unranked = total - rankedCount;
    const sees = [
      `See all ${rankedCount} ranked of ${total} accepted answers, with scores and spellings that count.`,
      `See the ${rankedCount} ranked answers. ${total} accepted, ${unranked} not ranked.`,
      `All ${rankedCount} ranked answers are on this page. ${total} names are accepted.`,
    ];
    for (const questionText of asked) {
      for (const tail of tails) {
        for (const see of sees) {
          out.push(stuckLine(questionText, { accepted: true, scores: true, tail }, see));
        }
      }
    }
    return out;
  }
  const flags: DescFlags[] = [];
  for (const tail of tails) {
    flags.push({ accepted: true, scores: true, tail });
    flags.push({ accepted: false, scores: true, tail });
    flags.push({ accepted: true, scores: false, tail });
    flags.push({ accepted: false, scores: false, tail });
  }
  for (const questionText of asked) {
    for (const flag of flags) {
      const accepted = flag.accepted ? 'accepted ' : '';
      const scores = flag.scores ? ', with scores and spellings that count' : '';
      const see = `See all ${total} ${accepted}answers ranked by rarity${scores}.`;
      out.push(stuckLine(questionText, flag, see));
    }
  }
  return out;
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

function buildClickDescription(question: string, total: number, rankedCount: number): string {
  return clampDescription(clickDescriptionCandidates(question, total, rankedCount), [
    ' Scores and spellings are in the table.',
    ' The full list is on this page.',
  ]);
}

/** Whose ranking this is. One Krillion mention. Does not claim the scores match. */
function rankingCredit(source: string, rankedCount: number): string {
  const differ = "Krillion's acceptance and scores may differ.";
  if (rankedCount <= 0) return differ;
  const kind = measureKind(source);
  if (kind === 'wiktionary') {
    return `These rankings are Rarest Answer's Wiktionary-pageview rankings. ${differ}`;
  }
  if (kind === 'stored') {
    return `These rankings are Rarest Answer's stored-popularity rankings. ${differ}`;
  }
  return `These rankings are Rarest Answer's Wikipedia-pageview rankings. ${differ}`;
}

/** One sentence. Empty when nothing is ranked. */
function rarestSentence(nounPhrase: string, ranked: readonly SeoAnswer[]): string {
  const rare = ranked[0];
  if (!rare) return '';
  const tier = tierName(rare.tier);
  const cluster = ranked.filter((answer) => answer.rarity === rare.rarity);
  if (cluster.length > 1) {
    const shown = cluster.slice(0, 3).map((answer) => answer.name);
    const more = cluster.length > 3 ? `, and ${cluster.length - 3} more` : '';
    return `The rarest ${nounPhrase} on this list are ${joinNames(shown)}${more} (${tier}).`;
  }
  return `The rarest ${nounPhrase} on this list is ${rare.name} (${tier}).`;
}

function buildSnippetIntro(
  slug: string,
  nounPhrase: string,
  source: string,
  ranked: readonly SeoAnswer[],
): string {
  const extra = answerSeoSentence(slug);
  const credit = rankingCredit(source, ranked.length);
  const rare = ranked[0];
  const lead = rare
    ? rarestSentence(nounPhrase, ranked)
    : 'None of the accepted answers has an English Wikipedia article, so none is ranked.';
  return [lead, extra, credit].filter((part) => part && part.trim()).join(' ');
}

const COMPARISON_HEAD = 3;
const COMPARISON_ALL_BELOW = 15;

export interface ComparisonRow {
  answer: SeoAnswer;
  /** 1-based rank among ranked answers. A sample can skip from 3 to the last rank. */
  rank: number;
}

/**
 * Ranked rows to show above the long guide.
 * The full ranked list when it is short. Otherwise the rarest few and the most common.
 * `noData` rows are left out.
 */
export function comparisonRows(answers: readonly SeoAnswer[]): ComparisonRow[] {
  const ranked = answers.filter((answer) => !isNoData(answer));
  if (ranked.length < 2) return [];
  if (ranked.length < COMPARISON_ALL_BELOW) {
    return ranked.map((answer, index) => ({ answer, rank: index + 1 }));
  }
  const head = ranked.slice(0, COMPARISON_HEAD).map((answer, index) => ({ answer, rank: index + 1 }));
  const last = ranked[ranked.length - 1];
  if (!last) return head;
  return [...head, { answer: last, rank: ranked.length }];
}

/** One line under the comparison heading. Empty when the list needs no caveat. */
export function comparisonNote(answers: readonly SeoAnswer[]): string {
  const rankedCount = answers.filter((answer) => !isNoData(answer)).length;
  const unranked = answers.length - rankedCount;
  if (rankedCount < 2) return '';
  if (rankedCount >= COMPARISON_ALL_BELOW) {
    return `${rankedCount} answers are ranked. This comparison shows the rarest ${COMPARISON_HEAD} and the most common end of the ranking.`;
  }
  if (unranked > 0) {
    return 'These are the ranked answers. The table also lists accepted answers that are not ranked.';
  }
  return '';
}

export function derivePromptSeo(input: PromptInput): PromptSeo {
  const answers = [...input.answers].sort(compareAnswers);
  if (answers.length === 0) throw new Error(`Prompt ${input.slug} has no answers`);
  const ranked = rankedAnswers(answers);
  const { nounTitle, nounPhrase } = deriveNoun(input.question, input.seoNoun);
  const pluralTitle = answerTitleNoun(input.slug) ?? pluralHeadTitle(nounTitle);
  const pluralSentence = pluralHeadTitle(nounPhrase);
  const documentTitle = buildDocumentTitle(pluralTitle, answers.length, ranked.length);
  const h1 = buildPageH1(pluralSentence, answers.length, ranked.length);
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
    crumb: pluralTitle,
    description: buildClickDescription(input.question, answers.length, ranked.length),
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

const RELATED_MAX = 6;

const RELATED_STOP = new Set([
  'species',
  'songs',
  'song',
  'films',
  'film',
  'characters',
  'character',
  'winners',
  'winner',
  'dishes',
  'dish',
  'sites',
  'site',
  'members',
  'member',
  'countries',
  'country',
  'states',
  'state',
  'genres',
  'genre',
  'instruments',
  'instrument',
]);

function relatedTokens(slug: string): string[] {
  return slug.split('-').filter((token) => token.length >= 4 && !RELATED_STOP.has(token));
}

/**
 * Curated topic links first. A prompt with no topic group keeps same-category
 * prompts that share a distinctive slug token. Catalog neighbors are not used.
 */
export function selectRelated(prompt: PromptSeo, all: readonly PromptSeo[]): PromptSeo[] {
  const bySlug = new Map(all.map((item) => [item.slug, item]));
  const curated = curatedRelatedSlugs(prompt.slug)
    .map((slug) => bySlug.get(slug))
    .filter((item): item is PromptSeo => item != null && item.slug !== prompt.slug);
  if (curated.length > 0) return curated.slice(0, RELATED_MAX);
  const tokens = new Set(relatedTokens(prompt.slug));
  if (tokens.size === 0) return [];
  return all
    .filter((item) => item.slug !== prompt.slug && item.category === prompt.category)
    .map((item) => ({
      item,
      share: relatedTokens(item.slug).filter((token) => tokens.has(token)).length,
    }))
    .filter((row) => row.share > 0)
    .sort(
      (a, b) =>
        b.share - a.share ||
        a.item.question.localeCompare(b.item.question) ||
        a.item.slug.localeCompare(b.item.slug),
    )
    .slice(0, RELATED_MAX)
    .map((row) => row.item);
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
  const tail = core.match(/: [^:]+$/)?.[0] ?? '';
  const head = tail ? core.slice(0, -tail.length) : core;
  const rare = head.startsWith('Rare ') ? 'Rare ' : '';
  const noun = head.slice(rare.length);
  const words = noun.split(' ').filter(Boolean);
  for (let keep = words.length; keep >= 1; keep -= 1) {
    const cut = trimEdgeWords(words.slice(words.length - keep).join(' '));
    if (!cut) continue;
    const next = `${rare}${cut}${tail}${marker}`;
    if (next.length <= TITLE_MAX) return next;
  }
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
