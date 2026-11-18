/**
 * SEO copy for /rarest-answers/ and /answers/<slug>/.
 *
 * `prompts.ts` validates JSON, then calls `derivePromptSeo`.
 * Category labels come from `shared.categories` in the locale file.
 * An optional `seoNoun` overrides the title noun.
 * Without it, the noun is the object of the question:
 * "Name a species of great ape" → "Species of Great Ape".
 *
 * The document title leads with "Rarest <Singular Noun>?" and the ranked count
 * ("All <N> Ranked for Rare Answers", then shorter fallbacks). It stays within
 * 60 characters and keeps the question's capitalised proper nouns. It does not
 * paste an answer name. When some answers are `noData`, N is the ranked count,
 * and the title, H1, or description also states the accepted count.
 * `answerTitleNoun` may replace the noun for one slug.
 * The H1 is the prompt with "rare" inserted: "Name a rare country in Africa:
 * all <N>, rarest to most common", or "all <ranked> ranked, <accepted> accepted"
 * when those counts differ.
 * The opening names the rarest answer once, then up to two backup picks.
 * `answerSeoSentence` may add one scope note. The ranking credit mentions
 * Krillion once. `answerTitleSuffix` drops " — Rarest Answer" when the
 * suffix would push the core past 60 characters.
 */

import {
  answerDescriptionNote,
  answerQuerySynonym,
  answerSeoSentence,
  answerTitleNoun,
  answerTitleTail,
  answerTitleTokenSynonyms,
} from '~/config/answer-seo';
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
  /** `<title>` core, at most 60 characters. Query noun, not an answer name. */
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

/** Capitalised tokens from the question, lowercase, stop words left out. */
export function capitalisedQuestionTokens(question: string): string[] {
  return [...properTokens(question)];
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

function wordCore(word: string): string {
  const match = word.match(/[A-Za-z0-9'’]+/);
  return (match?.[0] ?? '').replace(/['’]s$/i, '').toLowerCase();
}

function isProperWord(word: string, proper: Set<string>): boolean {
  const core = wordCore(word);
  return core.length > 0 && proper.has(core);
}

/**
 * Singular nouns to try, fullest first.
 * Leading filler ("club that has won the") drops before a proper name does.
 * Shorter cuts are fallbacks for when the proper names themselves do not fit.
 */
function looseNouns(singular: string, proper: Set<string>): string[] {
  const full = trimEdgeWords(singular);
  const nouns: string[] = [];
  const add = (noun: string) => {
    const clean = trimEdgeWords(noun);
    if (!clean || nouns.includes(clean)) return;
    nouns.push(clean);
  };
  add(full);
  const words = full.split(' ').filter(Boolean);
  let start = 0;
  while (start < words.length - 1 && !isProperWord(words[start]!, proper)) {
    start += 1;
    add(words.slice(start).join(' '));
  }
  let end = words.length;
  while (end > 1 && !isProperWord(words[end - 1]!, proper)) {
    end -= 1;
    add(words.slice(0, end).join(' '));
  }
  if (start > 0 || end < words.length) add(words.slice(start, end).join(' '));
  const onlyProper = words.filter((word) => isProperWord(word, proper));
  if (onlyProper.length > 0) add(onlyProper.join(' '));
  addCommaCuts(full, add);
  addWordPrefixes(full, add);
  addSuffixes(full, add);
  const orAt = full.search(/\s+or\s+/i);
  if (orAt > 0) {
    add(full.slice(0, orAt));
    add(full.slice(orAt).replace(/^\s*or\s+/i, ''));
  }
  return nouns;
}

function titleKeepsTokens(
  title: string,
  tokens: Set<string>,
  synonyms: Readonly<Record<string, string>>,
): boolean {
  const lower = title.toLowerCase();
  for (const token of tokens) {
    if (lower.includes(token)) continue;
    const synonym = synonyms[token];
    if (synonym && lower.includes(synonym.toLowerCase())) continue;
    return false;
  }
  return true;
}

/** Count clauses, best first. N is the ranked count. Nothing ranked stays honest. */
function titleTails(slug: string, ranked: number, total: number, hasBackup: boolean): string[] {
  if (ranked <= 0) return ['None Ranked'];
  const tails: string[] = [];
  const add = (tail: string) => {
    if (tail && !tails.includes(tail)) tails.push(tail);
  };
  const custom = answerTitleTail(slug);
  if (ranked < total) {
    if (custom) add(`All ${ranked} ${custom}, ${total} Accepted`);
    add(`All ${ranked} Ranked, ${total} Accepted`);
    add(`All ${ranked} Ranked (${total} Accepted)`);
    // The H1 and description still give the accepted count.
    add(`All ${ranked} Ranked`);
    add(`${ranked} Ranked`);
    return tails;
  }
  if (custom) add(`All ${ranked} ${custom}`);
  add(`All ${ranked} Ranked for Rare Answers`);
  if (hasBackup) add(`All ${ranked} Ranked + Backup Picks`);
  add(`All ${ranked} Ranked`);
  // Short tails let the full noun fit before any noun is cut.
  add(`${ranked} Ranked`);
  return tails;
}

/**
 * "Rarest <Singular>? All <N> Ranked …".
 * The answer name stays off the title. N is the ranked count.
 * A shorter noun is used only when the longer one does not fit.
 * Proper-noun tokens stay, unless a configured synonym in the title covers them.
 */
function buildDocumentTitle(
  singular: string,
  question: string,
  slug: string,
  total: number,
  rankedCount: number,
  hasBackup: boolean,
  fixedNoun = false,
): string {
  const noun = singular.replace(/\s+/g, ' ').trim() || 'Answer';
  const tails = titleTails(slug, rankedCount, total, hasBackup);
  // A hand-written noun is used as is. Cutting it could leave a fragment.
  if (fixedNoun) {
    for (const tail of tails) {
      const title = `Rarest ${noun}? ${tail}`;
      if (title.length <= TITLE_MAX) return title;
    }
    return clipTitle(`Rarest ${noun}? ${tails[tails.length - 1] ?? 'Ranked'}`);
  }
  const tokens = properTokens(question);
  const synonyms = answerTitleTokenSynonyms(slug);
  const nouns = looseNouns(noun, tokens);
  for (const option of nouns) {
    for (const tail of tails) {
      const title = `Rarest ${option}? ${tail}`.replace(/\s+/g, ' ').trim();
      if (title.length > TITLE_MAX) continue;
      if (!titleKeepsTokens(title, tokens, synonyms)) continue;
      return title;
    }
  }
  const tail = tails[tails.length - 1] ?? 'Ranked';
  for (const option of nouns) {
    const title = `Rarest ${option}? ${tail}`.replace(/\s+/g, ' ').trim();
    if (title.length <= TITLE_MAX) return title;
  }
  return clipTitle(`Rarest ${nouns[nouns.length - 1] ?? noun}? ${tail}`);
}

/** "Name a country in Africa" → "Name a rare country in Africa". */
function rarePromptWording(question: string): string {
  const q = stripEndPunctuation(question).replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  const withArticle = q.replace(/^name\s+(?:a|an|the|some|any)\s+/i, 'Name a rare ');
  if (withArticle !== q) return withArticle;
  const bare = q.replace(/^name\s+/i, 'Name a rare ');
  if (bare !== q) return bare;
  if (!q) return 'Name a rare answer';
  return `Name a rare ${q.charAt(0).toLowerCase()}${q.slice(1)}`;
}

/** Prompt wording with "rare", then an honest count. */
function buildPageH1(question: string, total: number, rankedCount: number): string {
  const lead = rarePromptWording(question);
  if (rankedCount <= 0) return `${lead}: all ${total}, none ranked`;
  if (rankedCount < total) return `${lead}: all ${rankedCount} ranked, ${total} accepted`;
  return `${lead}: all ${total}, rarest to most common`;
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

function rarestCluster(ranked: readonly SeoAnswer[]): SeoAnswer[] {
  const rare = ranked[0];
  if (!rare) return [];
  return ranked.filter((answer) => answer.rarity === rare.rarity);
}

function backupAnswers(ranked: readonly SeoAnswer[]): SeoAnswer[] {
  return ranked.slice(rarestCluster(ranked).length, rarestCluster(ranked).length + 2);
}

function queryNouns(nounPhrase: string): string[] {
  const words = nounPhrase.split(' ').filter(Boolean);
  const nouns: string[] = [];
  const add = (value: string) => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean || nouns.includes(clean)) return;
    nouns.push(clean);
  };
  add(words.join(' '));
  for (let end = words.length - 1; end >= 1; end -= 1) add(words.slice(0, end).join(' '));
  return nouns;
}

/** Search wording that the plain question does not already contain. */
function searchQueries(full: string, slug: string): string[] {
  const synonym = answerQuerySynonym(slug);
  if (!synonym || full.toLowerCase().includes(synonym.toLowerCase())) return [];
  const queries: string[] = [];
  if (/^movies?$/i.test(synonym)) {
    const word = synonym.toLowerCase() === 'movies' ? 'movies' : 'movie';
    const replaced = full.replace(/\bfilms?\b/i, word);
    if (replaced !== full) queries.push(replaced);
  }
  if (slug === 'grammy-record-of-the-year') {
    queries.push('Name a rare Grammy winner for Record of the Year?');
  }
  const bare = synonym.replace(/^rare\s+/i, '');
  queries.push(`Name a rare ${bare}?`);
  return queries;
}

function queryForms(question: string, nounPhrase: string, slug: string): string[] {
  const full = `${rarePromptWording(question)}?`;
  const forms: string[] = [];
  const add = (value: string) => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean || forms.includes(clean)) return;
    forms.push(clean);
  };
  for (const query of searchQueries(full, slug)) add(query);
  add(full);
  for (const noun of queryNouns(nounPhrase)) add(`Name a rare ${noun}?`);
  return forms;
}

function rarestLeads(ranked: readonly SeoAnswer[]): string[] {
  const cluster = rarestCluster(ranked);
  const first = cluster[0];
  if (!first) return [];
  if (cluster.length === 1) return [`${first.name} is the rarest pick.`];
  if (cluster.length === 2) {
    return [`${cluster[0]!.name} and ${cluster[1]!.name} tie as the rarest picks.`];
  }
  const pair = `${cluster[0]!.name} and ${cluster[1]!.name}`;
  return [
    `${pair} tie with ${cluster.length - 2} more as the rarest picks.`,
    `${first.name} is one rarest pick, tied with ${cluster.length - 1} more.`,
  ];
}

const DESCRIPTION_CLOSERS = [
  '',
  'Tiers are listed.',
  'Each name has a tier.',
  'The full list is on this page.',
  'Tiers sit beside each ranked name.',
];

function rankedBodies(rankedCount: number, total: number, backups: number): string[] {
  const backup = backups >= 2 ? 'backup picks' : backups === 1 ? 'the backup pick' : '';
  const bodies: string[] = [];
  const add = (body: string) => {
    const clean = body.replace(/\s+/g, ' ').trim();
    if (clean && !bodies.includes(clean)) bodies.push(clean);
  };
  if (rankedCount < total) {
    if (backup) {
      add(`All ${rankedCount} ranked of ${total} accepted, with ${backup} and the spellings that count.`);
      add(`All ${rankedCount} ranked, ${total} accepted, with ${backup} and spellings.`);
      add(`${rankedCount} ranked, ${total} accepted, with ${backup}.`);
    }
    add(`All ${rankedCount} ranked of ${total} accepted, with the spellings that count.`);
    add(`${rankedCount} ranked and ${total} accepted.`);
    return bodies;
  }
  if (backup) {
    add(`All ${total} ranked, with ${backup} and the spellings that count.`);
    add(`All ${total} ranked, with ${backup} and spellings.`);
    add(`All ${total} ranked, with ${backup}.`);
    add(`${backup.charAt(0).toUpperCase()}${backup.slice(1)} and spellings are listed.`);
  }
  add(`All ${total} ranked, with the spellings that count.`);
  add(`All ${total} ranked on this page.`);
  return bodies;
}

function unrankedBodies(total: number): string[] {
  return [
    `None is ranked. None of the ${total} accepted answers has an English Wikipedia article.`,
    `None is ranked. All ${total} accepted answers lack an English Wikipedia article.`,
    `None is ranked. Spellings are listed, and no name is called the rarest.`,
    'None is ranked.',
  ];
}

function joinCopy(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Starts with the "Name a rare …?" query, then the rarest pick and the list. */
function clickDescriptionCandidates(
  question: string,
  nounPhrase: string,
  total: number,
  ranked: readonly SeoAnswer[],
  slug: string,
  note: string | undefined,
): string[] {
  const queries = queryForms(question, nounPhrase, slug);
  const bodies = ranked.length === 0 ? unrankedBodies(total) : rankedBodies(ranked.length, total, backupAnswers(ranked).length);
  const leads = ranked.length === 0 ? [''] : rarestLeads(ranked);
  const out: string[] = [];
  for (const query of queries) {
    for (const lead of leads) {
      for (const body of bodies) {
        for (const closer of DESCRIPTION_CLOSERS) {
          out.push(joinCopy([query, lead, body, closer, note]));
        }
      }
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
      const filler = ' Spellings are listed on this page.';
      if (text.length + filler.length <= DESC_MAX) text += filler;
    }
    if (text.length >= DESC_MIN && text.length <= DESC_MAX) return text;
  }
  const over = clean.filter((item) => item.length > DESC_MAX).sort((a, b) => a.length - b.length);
  return clipDescription(over[0] ?? clean[0] ?? '');
}

function descriptionScore(text: string): number {
  let score = 0;
  if (text.includes('spellings')) score += 8;
  if (/All \d+ ranked/.test(text)) score += 6;
  const questionEnd = text.indexOf('?');
  if (questionEnd > 0) score += questionEnd * 1.2;
  score -= Math.abs(text.length - 150) * 0.25;
  return score;
}

function pickDescription(
  candidates: string[],
  pads: string[],
  required: string | undefined,
  synonym: string | undefined,
  wantBackup: boolean,
): string {
  const pool = [...new Set(candidates.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const inRange = pool.filter((item) => item.length >= DESC_MIN && item.length <= DESC_MAX);
  let choices = required ? inRange.filter((item) => item.includes(required)) : inRange.slice();
  if (choices.length === 0) choices = inRange;
  if (synonym) {
    const withSynonym = choices.filter((item) => item.toLowerCase().includes(synonym.toLowerCase()));
    if (withSynonym.length > 0) choices = withSynonym;
  }
  if (wantBackup) {
    const withBackup = choices.filter((item) => item.toLowerCase().includes('backup pick'));
    if (withBackup.length > 0) choices = withBackup;
  }
  if (choices.length > 0) {
    const ranked = choices
      .map((text) => ({ text, index: pool.indexOf(text) }))
      .sort((a, b) => descriptionScore(b.text) - descriptionScore(a.text) || a.index - b.index);
    return ranked[0]?.text ?? '';
  }
  const noted = required ? pool.filter((item) => item.includes(required)) : pool;
  return clampDescription(noted.length > 0 ? noted : pool, pads);
}

function buildClickDescription(
  question: string,
  nounPhrase: string,
  total: number,
  ranked: readonly SeoAnswer[],
  slug: string,
): string {
  const note = answerDescriptionNote(slug);
  const synonym = answerQuerySynonym(slug);
  const pads =
    ranked.length === 0
      ? [' See the table.', ' Spellings are listed on this page.', ' No name is called the rarest.']
      : [' Tiers are listed.', ' Each name has a tier.', ' The full list is on this page.'];
  return pickDescription(
    clickDescriptionCandidates(question, nounPhrase, total, ranked, slug, note),
    pads,
    note,
    synonym,
    backupAnswers(ranked).length > 0,
  );
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

/** The next one or two ranked names. Empty when there is no name after the rarest cluster. */
function backupSentence(ranked: readonly SeoAnswer[]): string {
  const next = backupAnswers(ranked);
  const first = next[0];
  if (!first) return '';
  if (next.length === 1) return `The backup pick is ${first.name} (${tierName(first.tier)}).`;
  const second = next[1];
  if (!second) return `The backup pick is ${first.name} (${tierName(first.tier)}).`;
  return `Backup picks are ${first.name} (${tierName(first.tier)}) and ${second.name} (${tierName(second.tier)}).`;
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
  const parts = rare
    ? [rarestSentence(nounPhrase, ranked), backupSentence(ranked)]
    : ['None of the accepted answers has an English Wikipedia article, so none is ranked.'];
  return [...parts, extra, credit].filter((part) => part && part.trim()).join(' ');
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
  const titleOverride = answerTitleNoun(input.slug);
  const documentTitle = buildDocumentTitle(
    titleOverride ?? nounTitle,
    input.question,
    input.slug,
    answers.length,
    ranked.length,
    backupAnswers(ranked).length > 0,
    titleOverride !== undefined,
  );
  const h1 = buildPageH1(input.question, answers.length, ranked.length);
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
    crumb: nounTitle,
    description: buildClickDescription(input.question, nounPhrase, answers.length, ranked, input.slug),
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
  const tail = core.match(/\? [^?]+$/)?.[0] ?? core.match(/: [^:]+$/)?.[0] ?? '';
  const head = tail ? core.slice(0, -tail.length) : core;
  const rare = head.startsWith('Rarest ') ? 'Rarest ' : head.startsWith('Rare ') ? 'Rare ' : '';
  const noun = head.slice(rare.length);
  const words = noun.split(' ').filter(Boolean);
  for (let keep = words.length; keep >= 1; keep -= 1) {
    const cut = trimEdgeWords(words.slice(0, keep).join(' '));
    if (!cut) continue;
    const next = `${rare}${cut}${tail}${marker}`;
    if (next.length <= TITLE_MAX) return next;
  }
  const room = TITLE_MAX - marker.length;
  if (room < 8) return marker.trim().slice(0, TITLE_MAX);
  const cut = core
    .slice(0, room)
    .trimEnd()
    .replace(/[\s:?&,(–-]+$/u, '');
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
