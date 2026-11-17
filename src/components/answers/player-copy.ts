/**
 * Player-facing copy for one answer page.
 *
 * Facts come from that prompt's JSON (names, aliases, tiers, rarity,
 * popularity, source) and from the pageview window in
 * scripts/data/prompt-defs.ts (VIEW_START..VIEW_END, read at build).
 * Popularity is the sum of those 12 complete months, not a monthly average.
 *
 * The view label is fixed: "English Wikipedia pageviews, last 12 months"
 * (or "English Wiktionary pageviews, last 12 months" when the source says Wiktionary).
 * Rarity is that pageview total, not how often players answer.
 * Answers with `noData: true` are accepted but unranked: they sort after
 * answers that have pageviews and are never called the rarest.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTried, matchGuess } from '~/lib/game/match';
import { normalize } from '~/lib/game/normalize';
import { TIERS, type Answer } from '~/lib/game/types';

export interface PlayerFaq {
  question: string;
  answer: string;
}

export interface PlayerCopy {
  lead: string;
  guide: string[];
  faq: PlayerFaq[];
  viewsNote: string;
  viewsHeading: string;
  sourceNote: string;
  tableCaption: string;
}

export type MeasureKind = 'wikipedia' | 'wiktionary' | 'stored';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Direction and filler tokens that make a weak "does not count" line. */
const GENERIC = new Set([
  'north',
  'south',
  'east',
  'west',
  'upper',
  'lower',
  'great',
  'inner',
  'outer',
  'new',
  'old',
  'saint',
  'little',
  'high',
  'near',
  'ever',
  'long',
  'time',
  'back',
  'than',
  'down',
  'away',
  'very',
  'much',
  'more',
  'some',
  'many',
  'such',
  'just',
  'only',
  'from',
  'with',
  'that',
  'this',
  'have',
  'been',
  'were',
  'your',
  'into',
  'over',
  'when',
  'here',
  'there',
  'again',
]);

type Shape = 'small' | 'closed' | 'long' | 'open';

interface Band {
  tier: Answer['tier'];
  names: string[];
  total: number;
}

interface AliasUse {
  alias: string;
  name: string;
  other: string | null;
}

interface Miss {
  label: string;
  owners: string[];
}

interface ViewBounds {
  start: string;
  end: string;
  label: string;
}

let boundsCache: ViewBounds | null = null;

function viewBounds(): ViewBounds {
  if (boundsCache) return boundsCache;
  const text = readPromptDefs();
  const start = text.match(/export const VIEW_START = '(\d{8})'/)?.[1];
  const end = text.match(/export const VIEW_END = '(\d{8})'/)?.[1];
  if (!start || !end) {
    throw new Error('answers: VIEW_START and VIEW_END were not found in scripts/data/prompt-defs.ts');
  }
  boundsCache = {
    start,
    end,
    label: `${formatMonth(start)}–${formatMonth(end)}`,
  };
  return boundsCache;
}

function readPromptDefs(): string {
  const fromCwd = join(process.cwd(), 'scripts/data/prompt-defs.ts');
  const fromHere = fileURLToPath(new URL('../../../scripts/data/prompt-defs.ts', import.meta.url));
  for (const path of [fromCwd, fromHere]) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      // try the next path
    }
  }
  throw new Error('answers: could not read scripts/data/prompt-defs.ts');
}

function formatMonth(ymd: string): string {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const name = MONTHS[month - 1];
  if (!name || !Number.isInteger(year) || year < 2000) {
    throw new Error(`answers: bad pageview month ${ymd}`);
  }
  return `${name} ${year}`;
}

/** Wiktionary is checked first: those source lines also contain "pageviews". */
export function measureKind(source: string): MeasureKind {
  if (/wiktionary/i.test(source)) return 'wiktionary';
  if (/wikipedia|page\s*views?/i.test(source)) return 'wikipedia';
  return 'stored';
}

/** Exact label used on every Wikipedia or Wiktionary figure this page owns. */
export function measureLabel(source: string): string {
  const kind = measureKind(source);
  if (kind === 'wiktionary') return 'English Wiktionary pageviews, last 12 months';
  if (kind === 'wikipedia') return 'English Wikipedia pageviews, last 12 months';
  return 'stored popularity';
}

/** True only when the prompt file sets `noData`. Absence means the answer is ranked. */
export function isNoData(answer: object): boolean {
  return 'noData' in answer && (answer as { noData?: boolean }).noData === true;
}

export function rankedAnswers<T extends object>(answers: readonly T[]): T[] {
  return answers.filter((answer) => !isNoData(answer));
}

/** Month named in the prompt source, such as "(2026-10)" → "October 2026". */
export function sourceMonthLabel(source: string): string | null {
  const match = source.match(/\((20\d{2})-(0[1-9]|1[0-2])(?:-\d{2})?\)/);
  if (!match?.[1] || !match[2]) return null;
  const name = MONTHS[Number(match[2]) - 1];
  if (!name) return null;
  return `${name} ${match[1]}`;
}

/** Visible stamp. Null when the source string has no month — nothing is invented. */
export function dataUpdatedLine(source: string): string | null {
  const month = sourceMonthLabel(source);
  if (!month) return null;
  return `Data updated ${month}.`;
}

/** Plain definition. Wiktionary and stored figures are not relabeled as Wikipedia. */
export function rarityBasis(source: string): string {
  const kind = measureKind(source);
  if (kind === 'wiktionary') {
    return 'Rarity comes from English Wiktionary pageviews over the last 12 months, not from player answers.';
  }
  if (kind === 'wikipedia') {
    return 'Rarity comes from English Wikipedia pageviews over the last 12 months, not from player answers.';
  }
  return 'These figures are stored popularity on this prompt, not a count of player answers.';
}

/** One line above the ranking table. Empty when every answer is ranked. */
export function noDataExplanation(answers: readonly object[]): string {
  const unranked = answers.filter((answer) => isNoData(answer)).length;
  const ranked = answers.length - unranked;
  if (unranked === 0) return '';
  if (ranked === 0) {
    return unranked === 1
      ? 'This answer has no English Wikipedia article. It is Uncommon (unranked), and it is not the rarest.'
      : 'None of these answers has an English Wikipedia article. They are Uncommon (unranked), and none of them is the rarest.';
  }
  if (unranked === 1) {
    return 'One answer has no English Wikipedia article. It is listed after the ranked answers as Uncommon (unranked), and it is not the rarest.';
  }
  return 'Answers with no English Wikipedia article are listed after the ranked answers as Uncommon (unranked). They are not the rarest.';
}

function pageviewSignal(source: string): 'pageviews' | 'stored popularity' {
  return measureKind(source) === 'stored' ? 'stored popularity' : 'pageviews';
}

export function measureHeading(source: string): string {
  const label = measureLabel(source);
  if (label === 'stored popularity') return 'Stored popularity';
  return label;
}

function tierRow(tier: Answer['tier']): { name: string; points: number } {
  const row = TIERS.find((item) => item.tier === tier);
  return row ?? { name: `Tier ${tier}`, points: 0 };
}

function tierPoints(tier: Answer['tier']): string {
  const row = tierRow(tier);
  return `${row.name}, ${row.points} points`;
}

export function rarityPlain(answer: Answer, answers: readonly Answer[], source = ''): string {
  if (isNoData(answer)) return 'unranked, because it has no English Wikipedia article';
  const pool = rankedAnswers(answers);
  if (pool.length === 0) return 'unranked, because it has no English Wikipedia article';
  if (pool.length === 1) return 'the only ranked answer in this set';
  let max = -Infinity;
  let min = Infinity;
  let maxCount = 0;
  let minCount = 0;
  for (const item of pool) {
    if (item.rarity > max) {
      max = item.rarity;
      maxCount = 1;
    } else if (item.rarity === max) maxCount += 1;
    if (item.rarity < min) {
      min = item.rarity;
      minCount = 1;
    } else if (item.rarity === min) minCount += 1;
  }
  if (max === min) return 'tied with every other ranked answer in this set';
  if (answer.rarity === max) {
    return maxCount > 1 ? 'tied for rarest in this set' : 'the rarest in this set';
  }
  if (answer.rarity === min) {
    return minCount > 1 ? 'tied for most common in this set' : 'the most common in this set';
  }
  const signal = pageviewSignal(source);
  return `fewer ${signal} than about ${percent(answer.rarity)}% of the ranked answers`;
}

/** Short cell text for the ranking table. */
export function rarityShort(answer: Answer, answers: readonly Answer[], source = ''): string {
  if (isNoData(answer)) return 'Unranked';
  const phrase = rarityPlain(answer, answers, source);
  if (phrase === 'the only ranked answer in this set') return 'Only ranked answer';
  if (phrase === 'unranked, because it has no English Wikipedia article') return 'Unranked';
  if (phrase === 'tied with every other ranked answer in this set') return 'Tied with ranked answers';
  if (phrase === 'tied for rarest in this set') return 'Tied for rarest';
  if (phrase === 'the rarest in this set') return 'Rarest';
  if (phrase === 'tied for most common in this set') return 'Tied for most common';
  if (phrase === 'the most common in this set') return 'Most common';
  const pct = percent(answer.rarity);
  if (pageviewSignal(source) === 'stored popularity') return `Lower stored popularity than ${pct}%`;
  return `Fewer pageviews than ${pct}%`;
}

function percent(rarity: number): number {
  let pct = Math.round(rarity * 100);
  if (pct >= 100) pct = 99;
  if (pct <= 0) pct = 1;
  return pct;
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

function viewsClause(n: number, source: string): string {
  const label = measureLabel(source);
  const formatted = formatCount(n);
  if (label === 'stored popularity') return `stored popularity ${formatted}`;
  if (Math.round(n) === 1) return `1 under ${label}`;
  return `${formatted} ${label}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function quoteQuestion(question: string): string {
  return `“${question.replace(/[?!.]+$/g, '').trim()}”`;
}

function shapeOf(count: number): Shape {
  if (count < 15) return 'small';
  if (count < 40) return 'closed';
  if (count < 120) return 'long';
  return 'open';
}

function frame(slug: string, salt: string, count: number): number {
  let hash = 2166136261;
  const text = `${salt}:${slug}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function sentenceCase(word: string): string {
  if (!word) return word;
  const first = word.charAt(0);
  if (first === first.toUpperCase()) return word;
  return first.toUpperCase() + word.slice(1);
}

function counts(answers: readonly Answer[], guess: string): boolean {
  const result = matchGuess(answers, guess, createTried());
  return result.status === 'hit';
}

function hardBand(answers: readonly Answer[]): Band {
  const tier = answers[0]?.tier ?? 1;
  const group = answers.filter((answer) => answer.tier === tier);
  return { tier, names: group.slice(0, 3).map((answer) => answer.name), total: group.length };
}

function easyBand(answers: readonly Answer[]): Band {
  const tier = answers[answers.length - 1]?.tier ?? 1;
  const group = answers.filter((answer) => answer.tier === tier);
  return { tier, names: group.slice(-3).map((answer) => answer.name), total: group.length };
}

function bandClause(
  band: Band,
  role: 'least' | 'most',
  signal: 'pageviews' | 'stored popularity' = 'pageviews',
): string {
  const points = tierPoints(band.tier);
  const extra = band.total > band.names.length ? `, ${band.total} in this tier` : '';
  const names = joinNames(band.names);
  const phrase =
    role === 'least'
      ? signal === 'stored popularity'
        ? 'lowest stored popularity'
        : 'fewest pageviews'
      : signal === 'stored popularity'
        ? 'highest stored popularity'
        : 'most pageviews';
  return band.total === 1
    ? `The answer with the ${phrase} is ${names} (${points})`
    : `The answers with the ${phrase} include ${names} (${points}${extra})`;
}

function containsName(aliasKey: string, otherKey: string): boolean {
  const aliasTokens = aliasKey.split(' ').filter(Boolean);
  const otherTokens = otherKey.split(' ').filter(Boolean);
  if (otherTokens.length === 0 || otherTokens.length > aliasTokens.length) return false;
  for (let i = 0; i <= aliasTokens.length - otherTokens.length; i++) {
    if (otherTokens.every((token, index) => aliasTokens[i + index] === token)) return true;
  }
  return false;
}

function otherNameInside(alias: string, owner: string, answers: readonly Answer[]): string | null {
  const key = normalize(alias);
  let found: string | null = null;
  let foundLength = 0;
  for (const answer of answers) {
    if (answer.name === owner) continue;
    const other = normalize(answer.name);
    if (other.length < 4 || other === key || !containsName(key, other)) continue;
    if (other.length > foundLength) {
      found = answer.name;
      foundLength = other.length;
    }
  }
  return found;
}

function stripsToName(name: string, alias: string): boolean {
  const stripped = alias.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return normalize(stripped) === normalize(name);
}

function bestAlias(answer: Answer, answers: readonly Answer[]): string | null {
  const nameKey = normalize(answer.name);
  const nameTokens = new Set(nameKey.split(' ').filter(Boolean));
  let best: { alias: string; score: number } | null = null;
  for (const alias of answer.aliases) {
    const key = normalize(alias);
    if (!key || key === nameKey) continue;
    const tokens = key.split(' ').filter(Boolean);
    const shared = tokens.filter((token) => nameTokens.has(token)).length;
    let score = 10 - shared * 3;
    if (key.startsWith(nameKey) || key.includes(nameKey)) score -= 3;
    if (stripsToName(answer.name, alias) && key !== nameKey) score -= 6;
    if (/^\d/.test(alias) || /\d{3,}/.test(alias)) score -= 2;
    if (alias.length <= 16) score += 1;
    if (otherNameInside(alias, answer.name, answers)) score += 5;
    if (!best || score > best.score || (score === best.score && alias.length < best.alias.length)) {
      best = { alias, score };
    }
  }
  if (!best || best.score < 6) return null;
  return best.alias;
}

function pickAliases(answers: readonly Answer[]): AliasUse[] {
  const picked: AliasUse[] = [];
  const seen = new Set<string>();
  const take = (group: readonly Answer[], limit: number) => {
    let count = 0;
    for (const answer of group) {
      const alias = bestAlias(answer, answers);
      if (!alias) continue;
      const key = normalize(alias);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push({
        alias,
        name: answer.name,
        other: otherNameInside(alias, answer.name, answers),
      });
      count += 1;
      if (count >= limit) break;
    }
  };
  const mid = Math.ceil(answers.length / 2);
  take(answers.slice(0, mid), 2);
  take([...answers.slice(mid)].reverse(), 2);
  return picked;
}

function nearMisses(answers: readonly Answer[]): Miss[] {
  const buckets = new Map<string, Miss>();
  for (const answer of answers) {
    const seen = new Set<string>();
    for (const raw of answer.name.split(/[^\p{L}\p{N}]+/u)) {
      const key = normalize(raw);
      if (key.length < 4 || GENERIC.has(key) || /^\d+$/.test(key) || seen.has(key)) continue;
      if (key.length < 5) {
        const last = normalize(answer.name).split(' ').filter(Boolean).at(-1);
        if (last !== key) continue;
      }
      seen.add(key);
      const bucket = buckets.get(key);
      if (bucket) {
        if (!bucket.owners.includes(answer.name)) bucket.owners.push(answer.name);
      } else {
        buckets.set(key, { label: raw, owners: [answer.name] });
      }
    }
  }
  const misses: Miss[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.owners.length < 2 || bucket.owners.length > 8) continue;
    if (counts(answers, key) || counts(answers, bucket.label)) continue;
    misses.push(bucket);
  }
  misses.sort(
    (a, b) => a.owners.length - b.owners.length || a.label.localeCompare(b.label, 'en'),
  );
  return misses.slice(0, 2);
}

function ownerList(owners: string[]): string {
  if (owners.length <= 4) return joinNames(owners);
  return `${owners.slice(0, 3).join(', ')}, and ${owners.length - 3} more`;
}

function leadParagraph(slug: string, question: string, source: string, answers: readonly Answer[]): string {
  const count = answers.length;
  const asked = quoteQuestion(question);
  if (count === 0) return '';
  const word = count === 1 ? 'answer' : 'answers';
  let opener: string;
  if (count < 15) {
    const frames = [
      `${asked} is a small closed set: ${count} accepted ${word}.`,
      `This is a small closed set. ${asked} accepts ${count} ${word}, and the table lists ${count === 1 ? 'it' : 'every one'}.`,
      `Only ${count} ${count === 1 ? 'answer is' : 'answers are'} accepted for ${asked}. The set is closed.`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  } else if (count >= 120) {
    const frames = [
      `${asked} accepts ${count} answers. Ranked rows run from fewest pageviews to most pageviews.`,
      `${count} answers count for ${asked}. Ranked rows run from the fewest pageviews to the most pageviews.`,
      `The accepted set for ${asked} is ${count} names long, ranked by ${measureLabel(source)}.`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  } else if (count >= 40) {
    const frames = [
      `${asked} has ${count} accepted answers. Ranked rows run from fewest pageviews to most pageviews.`,
      `${count} names count for ${asked}. Fewer ${measureLabel(source)} means a higher tier.`,
      `Every accepted answer to ${asked} is in the table below (${count} in total).`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  } else {
    const frames = [
      `${asked} has ${count} accepted answers, a closed list. Ranked rows run from fewest pageviews to most pageviews.`,
      `There are ${count} accepted answers to ${asked}. The table is the full list.`,
      `${count} answers are accepted for ${asked}. Learn the rare end of this closed list if you want a high score.`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  }

  const ranked = rankedAnswers(answers);
  const rare = ranked[0];
  if (!rare) {
    return `${asked} accepts ${count} ${word}. None of them has an English Wikipedia article, so none is ranked and none is the rarest. Each is scored as Uncommon (unranked).`;
  }
  const cluster = ranked.filter((answer) => answer.rarity === rare.rarity);
  const omitted = answers.length - ranked.length;
  const omittedNote =
    omitted === 0
      ? ''
      : ` ${omitted} ${omitted === 1 ? 'answer has' : 'answers have'} no English Wikipedia article and ${omitted === 1 ? 'is' : 'are'} not part of this ranking.`;
  if (ranked.length === 1) {
    return `${opener} ${rare.name} is the rarest ranked answer: ${tierPoints(rare.tier)}, with ${viewsClause(rare.popularity, source)}.${omittedNote}`;
  }
  if (cluster.length > 3) {
    const sample = joinNames(cluster.slice(0, 3).map((answer) => answer.name));
    return `${opener} ${cluster.length} ranked answers tie for rarest (${tierPoints(rare.tier)}), including ${sample}. Each shows ${viewsClause(rare.popularity, source)}.${omittedNote}`;
  }
  if (cluster.length > 1) {
    return `${opener} ${joinNames(cluster.map((answer) => answer.name))} tie for rarest (${tierPoints(rare.tier)}), with ${viewsClause(rare.popularity, source)} each.${omittedNote}`;
  }
  return `${opener} ${rare.name} is the rarest: ${tierPoints(rare.tier)}, ${rarityPlain(rare, ranked, source)}, with ${viewsClause(rare.popularity, source)}.${omittedNote}`;
}

function unrankedClause(answers: readonly Answer[]): string {
  const unranked = answers.filter((answer) => isNoData(answer));
  if (unranked.length === 0) return '';
  const ranked = answers.length - unranked.length;
  if (ranked === 0) {
    return unranked.length === 1
      ? ' It has no English Wikipedia article, so it is Uncommon (unranked) and it is not the rarest.'
      : ' None of them has an English Wikipedia article, so they are Uncommon (unranked) and none of them is the rarest.';
  }
  if (unranked.length <= 8) {
    return ` Also accepted, with no English Wikipedia article: ${joinNames(unranked.map((answer) => answer.name))}. They are Uncommon (unranked) and are not the rarest.`;
  }
  return ` ${unranked.length} other accepted answers have no English Wikipedia article. They are Uncommon (unranked) and are not the rarest.`;
}

function scopeParagraph(question: string, answers: readonly Answer[], source: string): string {
  const ranked = rankedAnswers(answers);
  const count = answers.length;
  const asked = quoteQuestion(question);
  const extra = unrankedClause(answers);
  if (ranked.length === 0) {
    return `${asked} accepts ${count} ${count === 1 ? 'answer' : 'answers'}.${extra}`;
  }
  if (count < 15) {
    const word = count === 1 ? 'answer' : 'answers';
    const order =
      ranked.length <= 1
        ? ''
        : measureKind(source) === 'stored'
          ? ' Ranked answers run from lowest stored popularity to highest.'
          : ' Ranked answers run from fewest pageviews to most.';
    return `${asked} accepts ${count} ${word}.${order}${extra}`;
  }
  if (count >= 120) {
    return `${asked} accepts ${count} answers. Ranked rows are ordered by pageviews, fewest first.${extra} A guess counts when it matches a listed name or an alias stored on that name.`;
  }
  if (count >= 40) {
    return `There are ${count} accepted answers to ${asked}. Every one of them is in the table.${extra} A name that is not listed, and is not a stored alias, does not count.`;
  }
  return `${asked} has ${count} accepted answers, a closed list. Ranked rows are ordered by pageviews, fewest first.${extra} Only those names and their stored aliases count.`;
}

function distinctAlias(answers: readonly Answer[]): { alias: string; name: string } | null {
  for (const answer of answers) {
    for (const alias of answer.aliases) {
      const key = normalize(alias);
      if (!key || key === normalize(answer.name)) continue;
      return { alias, name: answer.name };
    }
  }
  return null;
}

function aliasParagraph(answers: readonly Answer[], uses: readonly AliasUse[]): string {
  if (uses.length === 0) {
    const extra = distinctAlias(answers);
    if (!extra) {
      return 'No extra aliases are stored on these answers. A guess has to match the name in the table.';
    }
    if (stripsToName(extra.name, extra.alias)) {
      return `A qualifier in parentheses also counts, such as ${extra.alias} for ${extra.name}.`;
    }
    return `${extra.alias} also counts as ${extra.name}.`;
  }
  const bits = uses.map((use) => `${use.alias} for ${use.name}`);
  let text = `These aliases count: ${joinNames(bits)}.`;
  for (const use of uses) {
    if (!use.other) continue;
    text += ` ${sentenceCase(use.alias)} scores as ${use.name}. ${use.other} is a separate answer.`;
  }
  return text;
}

function missParagraph(misses: readonly Miss[]): string {
  return misses
    .map((miss) => {
      const word = sentenceCase(miss.label);
      return `${word} is not an accepted answer on its own. The names that include it are ${ownerList(miss.owners)}.`;
    })
    .join(' ');
}

function standingsParagraph(answers: readonly Answer[], source: string, shape: Shape): string {
  const ranked = rankedAnswers(answers);
  if (ranked.length < 2) return '';
  const signal = pageviewSignal(source);
  const hard = hardBand(ranked);
  const easy = easyBand(ranked);
  const viewed = measureLabel(source);
  const rare = ranked[0];
  const common = ranked[ranked.length - 1];
  if (!rare || !common) return '';
  if (hard.tier === easy.tier) {
    const few = signal === 'stored popularity' ? 'lowest stored popularity' : 'fewest pageviews';
    const many = signal === 'stored popularity' ? 'highest stored popularity' : 'most pageviews';
    return `All ${ranked.length} ranked answers are ${tierPoints(hard.tier)}. ${rare.name} has the ${few} among them, and ${common.name} has the ${many}.`;
  }
  const least = `${bandClause(hard, 'least', signal)}.`;
  const most = `${bandClause(easy, 'most', signal)}.`;
  if (shape === 'long' || shape === 'open') {
    return `${most} They have the most ${viewed}. ${least} They have the fewest, so they are the high scores on this ranking.`;
  }
  const commonEnd = signal === 'stored popularity' ? 'higher stored popularity' : 'more pageviews';
  const highEnd = signal === 'stored popularity' ? 'lower stored popularity' : 'fewer pageviews';
  return `${least} ${most} Names with ${commonEnd} are the common end of this ranking. Names with ${highEnd} are the high scores.`;
}

function tipParagraph(answers: readonly Answer[], shape: Shape): string {
  const ranked = rankedAnswers(answers);
  const rare = ranked[0];
  if (!rare) {
    return 'No answer on this prompt is ranked by pageviews. Accepted answers with no English Wikipedia article score as Uncommon (unranked), and none of them is the rarest.';
  }
  if (ranked.length === 1) {
    return `${rare.name} is the only ranked answer, at ${tierPoints(rare.tier)}. It is the rarest on this prompt.`;
  }
  const hard = hardBand(ranked);
  const easy = easyBand(ranked);
  const hardNames = joinNames(hard.names);
  const easyNames = joinNames(easy.names);
  const easyPoints = tierPoints(easy.tier);
  const hardLabel =
    hard.total > hard.names.length
      ? `${tierPoints(hard.tier)}, ${hard.total} in this tier`
      : tierPoints(hard.tier);
  const easyVerb = easy.names.length === 1 ? 'is' : 'are';
  if (shape === 'small') {
    return `To score high among the ranked answers, name ${hardNames} (${hardLabel}). ${easyNames} ${easyVerb} ${easyPoints}.`;
  }
  if (shape === 'open') {
    return `On this list, the high scores among ranked answers are the names with the fewest pageviews: ${hardNames} (${hardLabel}). ${easyNames} ${easyVerb} the most-pageviews end (${easyPoints}).`;
  }
  if (shape === 'long') {
    return `Aim for ${hardNames} (${hardLabel}). ${easyNames} ${easyVerb} ${easyPoints}, the most-pageviews end of the ranked list.`;
  }
  const high =
    hard.names.length === 1
      ? `The high score among ranked answers is ${hardNames} (${hardLabel}).`
      : `The high scores among ranked answers are ${hardNames} (${hardLabel}).`;
  return `${high} ${easyNames} ${easyVerb} ${easyPoints}.`;
}

function aliasFaq(answers: readonly Answer[], uses: readonly AliasUse[], misses: readonly Miss[]): string {
  const base = aliasParagraph(answers, uses);
  const miss = misses[0];
  if (!miss) return base;
  const word = sentenceCase(miss.label);
  return `${base} ${word} is not an accepted answer on its own.`;
}

function buildFaq(
  question: string,
  source: string,
  answers: readonly Answer[],
  uses: readonly AliasUse[],
  misses: readonly Miss[],
  shape: Shape,
): PlayerFaq[] {
  const asked = quoteQuestion(question);
  const count = answers.length;
  const ranked = rankedAnswers(answers);
  const signal = pageviewSignal(source);
  const tip = tipParagraph(answers, shape);
  const spelling = aliasFaq(answers, uses, misses);
  const mostQuestion =
    signal === 'stored popularity'
      ? 'Which names have the highest stored popularity?'
      : 'Which names have the most pageviews?';
  if (ranked.length === 0) {
    return [
      {
        question: `How many answers does ${asked} accept?`,
        answer: `${count}. None has an English Wikipedia article, so none is ranked and none is the rarest. Each scores as Uncommon (unranked).`,
      },
      {
        question: 'Which answer is the rarest?',
        answer: 'None. No answer on this prompt has an English Wikipedia article, so none is ranked as rarest.',
      },
      {
        question: 'Which other spellings count?',
        answer: spelling,
      },
    ];
  }
  const hard = hardBand(ranked);
  const easy = easyBand(ranked);
  if (shape === 'small') {
    const rare = ranked[0];
    const common = ranked[ranked.length - 1];
    const howMany =
      !rare || !common || ranked.length === 1
        ? `${count}. It is a small closed set${rare ? `, and ${rare.name} is the rarest ranked answer` : ''}.`
        : `${count}. It is a small closed set, from ${rare.name} (rarest) to ${common.name} (${signal === 'stored popularity' ? 'highest stored popularity' : 'most pageviews'}).`;
    return [
      {
        question: `How many answers does ${asked} accept?`,
        answer: howMany,
      },
      {
        question: 'Which answer scores highest?',
        answer: tip,
      },
      {
        question: 'Which other spellings count?',
        answer: spelling,
      },
    ];
  }
  if (shape === 'open') {
    return [
      {
        question: `Do all ${count} answers count?`,
        answer: `Yes. The table is the accepted set for ${asked}. A name that is not listed, and is not a stored alias, does not count.`,
      },
      {
        question: mostQuestion,
        answer: `${bandClause(easy, 'most', signal)}.`,
      },
      {
        question: 'How do you score high on this prompt?',
        answer: tip,
      },
    ];
  }
  if (shape === 'long') {
    return [
      {
        question: 'What counts as a correct answer?',
        answer: `The ${count} names in the table, plus any alias stored on a row. A name that is neither does not count.`,
      },
      {
        question: 'Which names are the high scores?',
        answer: `${bandClause(hard, 'least', signal)}.`,
      },
      {
        question: 'Which spellings besides the main name count?',
        answer: spelling,
      },
    ];
  }
  return [
    {
      question: `What does ${asked} accept?`,
      answer: `${count} names, listed in the table, plus the aliases stored on those rows.`,
    },
    {
      question: mostQuestion,
      answer: `${bandClause(easy, 'most', signal)}.`,
    },
    {
      question: 'How do you score high on this prompt?',
      answer: tip,
    },
  ];
}

function viewsNote(source: string, answers: readonly Answer[]): string {
  const kind = measureKind(source);
  const unranked = answers.filter((answer) => isNoData(answer)).length;
  if (kind === 'stored') {
    const base = `These numbers are the stored popularity figures on this prompt, not a count of player answers. Source: ${source}.`;
    if (unranked === 0) return base;
    return `${base} ${noDataExplanation(answers)} The pageview cell says “No article”.`;
  }
  const heading = measureHeading(source);
  const window = viewBounds().label;
  let text = `${heading} (${window}). Each number is the sum of those 12 months, not a count of player answers. Source: ${source}.`;
  if (unranked > 0) {
    text +=
      unranked === 1
        ? ' One answer has no English Wikipedia article. Its pageview cell says “No article”. It is Uncommon (unranked) and is not the rarest.'
        : ` ${unranked} answers have no English Wikipedia article. Their pageview cells say “No article”. They are Uncommon (unranked) and are not the rarest.`;
  } else if (/counts as 1/i.test(source)) {
    const ones = answers.filter((answer) => answer.popularity === 1).length;
    text +=
      ones > 0
        ? ` The source counts a name with no article as 1, and ${ones} ${ones === 1 ? 'answer has' : 'answers have'} that value.`
        : ' The source counts a name with no article as 1.';
  }
  return text;
}

function sourceNote(source: string, answers: readonly Answer[]): string {
  const kind = measureKind(source);
  const hasWiki = answers.some((answer) => Boolean(answer.wiki));
  const links = hasWiki
    ? ' The Wikipedia article column links an answer only when an English Wikipedia title is stored on it.'
    : ' No English Wikipedia title is stored on these answers, so the Wikipedia article column has no links.';
  const unranked = answers.filter((answer) => isNoData(answer)).length;
  if (kind === 'stored') {
    return `Recorded source: ${source}. The table shows the stored popularity figures on this prompt, not a count of player answers.${links}`;
  }
  const heading = measureHeading(source);
  const window = viewBounds().label;
  let text = `Recorded source: ${source}. The pageview column is ${heading} (${window}), added across those months. Inside this prompt, more of those pageviews means a more common rank. This is not a count of player answers.`;
  if (/wikidata/i.test(source)) {
    text += ' The source names Wikidata as where the answer list was compiled.';
  }
  if (unranked > 0) {
    text += ' A row that says “No article” has no English Wikipedia article. It is Uncommon (unranked) and is not the rarest.';
  } else if (/counts as 1/i.test(source)) {
    text += ' A 1 in that column is the source’s own placeholder for a name with no article.';
  }
  return `${text}${links}`;
}

function tableCaption(question: string, source: string, answers: readonly Answer[]): string {
  const total = answers.length;
  const unranked = answers.filter((answer) => isNoData(answer)).length;
  const ranked = total - unranked;
  const heading = measureHeading(source);
  const asked = quoteQuestion(question);
  const order = measureKind(source) === 'stored' ? 'lowest stored popularity first' : 'fewest pageviews first';
  if (unranked === 0) {
    const word = total === 1 ? 'answer' : 'answers';
    return `${total} accepted ${word} to ${asked}, ${order}. The pageview column is ${heading}.`;
  }
  const rankedWord = ranked === 1 ? 'answer' : 'answers';
  return `${ranked} ranked ${rankedWord} to ${asked}, ${order}, then ${unranked} with no English Wikipedia article (Uncommon, unranked). The pageview column is ${heading}.`;
}

export function buildPlayerCopy(input: {
  slug: string;
  question: string;
  source: string;
  answers: readonly Answer[];
}): PlayerCopy {
  const answers = input.answers;
  const shape = shapeOf(answers.length);
  const uses = pickAliases(answers);
  const misses = nearMisses(answers);
  const parts = {
    scope: scopeParagraph(input.question, answers, input.source),
    alias: aliasParagraph(answers, uses),
    miss: missParagraph(misses),
    standings: standingsParagraph(answers, input.source, shape),
    tip: tipParagraph(answers, shape),
  };
  const order: Array<keyof typeof parts> =
    shape === 'small'
      ? ['scope', 'alias', 'miss', 'standings', 'tip']
      : shape === 'closed'
        ? ['tip', 'standings', 'scope', 'alias', 'miss']
        : shape === 'long'
          ? ['standings', 'tip', 'alias', 'miss', 'scope']
          : ['tip', 'standings', 'scope', 'alias', 'miss'];
  const shift = frame(input.slug, 'order', order.length);
  const rotated = [...order.slice(shift), ...order.slice(0, shift)];
  return {
    lead: leadParagraph(input.slug, input.question, input.source, answers),
    guide: rotated.map((key) => parts[key]).filter((paragraph) => paragraph.trim().length > 0),
    faq: buildFaq(input.question, input.source, answers, uses, misses, shape),
    viewsNote: viewsNote(input.source, answers),
    viewsHeading: measureHeading(input.source),
    sourceNote: sourceNote(input.source, answers),
    tableCaption: tableCaption(input.question, input.source, answers),
  };
}
