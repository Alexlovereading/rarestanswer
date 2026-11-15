/**
 * Player-facing copy for one answer page.
 *
 * Facts come from that prompt's JSON (names, aliases, tiers, rarity,
 * popularity, source) and from the pageview window in
 * scripts/data/prompt-defs.ts (VIEW_START..VIEW_END, read at build).
 * Popularity is the sum of those 12 complete months, not a monthly average.
 *
 * The view label is fixed: "Wikipedia views, last 12 months"
 * (or "Wiktionary views, last 12 months" when the source says Wiktionary).
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
  if (kind === 'wiktionary') return 'Wiktionary views, last 12 months';
  if (kind === 'wikipedia') return 'Wikipedia views, last 12 months';
  return 'stored popularity';
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

export function rarityPlain(answer: Answer, answers: readonly Answer[]): string {
  if (answers.length === 1) return 'the only answer in this set';
  let max = -Infinity;
  let min = Infinity;
  let maxCount = 0;
  let minCount = 0;
  for (const item of answers) {
    if (item.rarity > max) {
      max = item.rarity;
      maxCount = 1;
    } else if (item.rarity === max) maxCount += 1;
    if (item.rarity < min) {
      min = item.rarity;
      minCount = 1;
    } else if (item.rarity === min) minCount += 1;
  }
  if (max === min) return 'tied with every other answer in this set';
  if (answer.rarity === max) {
    return maxCount > 1 ? 'tied for rarest in this set' : 'the rarest in this set';
  }
  if (answer.rarity === min) {
    return minCount > 1 ? 'tied for most common in this set' : 'the most common in this set';
  }
  return `rarer than about ${percent(answer.rarity)}% of this set`;
}

/** Short cell text for the ranking table. */
export function rarityShort(answer: Answer, answers: readonly Answer[]): string {
  const phrase = rarityPlain(answer, answers);
  if (phrase === 'the only answer in this set') return 'Only answer';
  if (phrase === 'tied with every other answer in this set') return 'Tied with the set';
  if (phrase === 'tied for rarest in this set') return 'Tied for rarest';
  if (phrase === 'the rarest in this set') return 'Rarest';
  if (phrase === 'tied for most common in this set') return 'Tied for most common';
  if (phrase === 'the most common in this set') return 'Most common';
  return `Rarer than ${percent(answer.rarity)}%`;
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

function bandClause(band: Band, role: 'least' | 'most'): string {
  const points = tierPoints(band.tier);
  const extra = band.total > band.names.length ? `, ${band.total} in this tier` : '';
  const names = joinNames(band.names);
  if (role === 'least') {
    return band.total === 1
      ? `The least-viewed answer is ${names} (${points})`
      : `The least-viewed answers include ${names} (${points}${extra})`;
  }
  return band.total === 1
    ? `The most-viewed answer is ${names} (${points})`
    : `The most-viewed answers include ${names} (${points}${extra})`;
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
  const rare = answers[0];
  if (!rare) return '';
  const cluster = answers.filter((answer) => answer.rarity === rare.rarity);
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
      `${asked} accepts ${count} answers, ranked from least viewed to most viewed.`,
      `${count} answers count for ${asked}. The list runs from the least viewed name to the most viewed.`,
      `The accepted set for ${asked} is ${count} names long, ranked by ${measureLabel(source)}.`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  } else if (count >= 40) {
    const frames = [
      `${asked} has ${count} accepted answers. The table ranks them from least viewed to most viewed.`,
      `${count} names count for ${asked}. Fewer ${measureLabel(source)} means a higher tier.`,
      `Every accepted answer to ${asked} is in the table below (${count} in total).`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  } else {
    const frames = [
      `${asked} has ${count} accepted answers, a closed list ranked from least viewed to most viewed.`,
      `There are ${count} accepted answers to ${asked}. The table is the full list.`,
      `${count} answers are accepted for ${asked}. Learn the rare end of this closed list if you want a high score.`,
    ];
    opener = frames[frame(slug, 'lead', frames.length)] ?? frames[0]!;
  }

  if (count === 1) {
    return `${opener} ${rare.name} is ${tierPoints(rare.tier)}, with ${viewsClause(rare.popularity, source)}.`;
  }
  if (cluster.length > 3) {
    const sample = joinNames(cluster.slice(0, 3).map((answer) => answer.name));
    return `${opener} ${cluster.length} answers tie for rarest (${tierPoints(rare.tier)}), including ${sample}. Each shows ${viewsClause(rare.popularity, source)}.`;
  }
  if (cluster.length > 1) {
    return `${opener} ${joinNames(cluster.map((answer) => answer.name))} tie for rarest (${tierPoints(rare.tier)}), with ${viewsClause(rare.popularity, source)} each.`;
  }
  return `${opener} ${rare.name} is the rarest: ${tierPoints(rare.tier)}, ${rarityPlain(rare, answers)}, with ${viewsClause(rare.popularity, source)}.`;
}

function scopeParagraph(question: string, answers: readonly Answer[]): string {
  const count = answers.length;
  const asked = quoteQuestion(question);
  if (count < 15) {
    const list = joinNames(answers.map((answer) => answer.name));
    return `${asked} accepts only ${count} ${count === 1 ? 'answer' : 'answers'}, and the table is the whole list. From rarest to most common: ${list}.`;
  }
  if (count >= 120) {
    return `${asked} accepts ${count} answers. The table is the whole set, rarest first. A guess counts when it matches a listed name or an alias stored on that name.`;
  }
  if (count >= 40) {
    return `There are ${count} accepted answers to ${asked}. Every one of them is in the table. A name that is not listed, and is not a stored alias, does not count.`;
  }
  return `${asked} has ${count} accepted answers, a closed list. The table is that list, rarest first. Only those names and their stored aliases count.`;
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
  if (answers.length < 2) return '';
  const hard = hardBand(answers);
  const easy = easyBand(answers);
  const viewed = measureLabel(source);
  const rare = answers[0];
  const common = answers[answers.length - 1];
  if (!rare || !common) return '';
  if (hard.tier === easy.tier) {
    return `All ${answers.length} answers are ${tierPoints(hard.tier)}. ${rare.name} is the least viewed of them, and ${common.name} is the most viewed.`;
  }
  const least = `${bandClause(hard, 'least')}.`;
  const most = `${bandClause(easy, 'most')}.`;
  if (shape === 'long' || shape === 'open') {
    return `${most} They have the most ${viewed}, so this ranking treats them as the familiar picks. ${least} They have the fewest, so they are the hard scores.`;
  }
  return `${least} ${most} The most-viewed names are the familiar ones on this ranking, and the least-viewed names are the hard scores.`;
}

function tipParagraph(answers: readonly Answer[], shape: Shape): string {
  const rare = answers[0];
  if (!rare) return '';
  if (answers.length === 1) {
    return `${rare.name} is the only accepted answer, at ${tierPoints(rare.tier)}.`;
  }
  const hard = hardBand(answers);
  const easy = easyBand(answers);
  const hardNames = joinNames(hard.names);
  const easyNames = joinNames(easy.names);
  const easyPoints = tierPoints(easy.tier);
  const hardLabel =
    hard.total > hard.names.length
      ? `${tierPoints(hard.tier)}, ${hard.total} in this tier`
      : tierPoints(hard.tier);
  const easyVerb = easy.names.length === 1 ? 'is' : 'are';
  if (shape === 'small') {
    return `To score high in this small set, name ${hardNames} (${hardLabel}). ${easyNames} ${easyVerb} ${easyPoints}.`;
  }
  if (shape === 'open') {
    return `On a list of ${answers.length}, the high scores are the least-viewed tier: ${hardNames} (${hardLabel}). ${easyNames} ${easyVerb} the most-viewed end (${easyPoints}).`;
  }
  if (shape === 'long') {
    return `Aim for ${hardNames} (${hardLabel}). ${easyNames} ${easyVerb} ${easyPoints}, the familiar end of this list.`;
  }
  const high =
    hard.names.length === 1
      ? `The high score on this closed list is ${hardNames} (${hardLabel}).`
      : `The high scores on this closed list are ${hardNames} (${hardLabel}).`;
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
  answers: readonly Answer[],
  uses: readonly AliasUse[],
  misses: readonly Miss[],
  shape: Shape,
): PlayerFaq[] {
  const asked = quoteQuestion(question);
  const count = answers.length;
  const hard = hardBand(answers);
  const easy = easyBand(answers);
  const tip = tipParagraph(answers, shape);
  const spelling = aliasFaq(answers, uses, misses);
  if (shape === 'small') {
    const rare = answers[0];
    const common = answers[answers.length - 1];
    const howMany =
      !rare || !common || count === 1
        ? `${count}. It is a small closed set${rare ? `: ${rare.name}` : ''}.`
        : `${count}. It is a small closed set, from ${rare.name} (rarest) to ${common.name} (most common).`;
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
        question: 'Which names are the familiar ones?',
        answer: `${bandClause(easy, 'most')}. This ranking treats those most-viewed names as the familiar picks.`,
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
        question: 'Which names are the hard scores?',
        answer: `${bandClause(hard, 'least')}.`,
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
      question: 'Which names are the familiar ones?',
      answer: `${bandClause(easy, 'most')}.`,
    },
    {
      question: 'How do you score high on this prompt?',
      answer: tip,
    },
  ];
}

function viewsNote(source: string, answers: readonly Answer[]): string {
  const kind = measureKind(source);
  if (kind === 'stored') {
    return `These numbers are the stored popularity figures on this prompt. Source: ${source}.`;
  }
  const heading = measureHeading(source);
  const window = viewBounds().label;
  let text = `${heading} (${window}). Each number is the sum of those 12 months. Source: ${source}.`;
  if (/counts as 1/i.test(source)) {
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
    ? ' Linked names open the English Wikipedia article stored on that answer.'
    : '';
  if (kind === 'stored') {
    return `Recorded source: ${source}. The table shows the stored popularity figures on this prompt.${links}`;
  }
  const heading = measureHeading(source);
  const window = viewBounds().label;
  let text = `Recorded source: ${source}. The view column is ${heading} (${window}), added across those months. Inside this prompt, more of those views means a more common rank.`;
  if (/wikidata/i.test(source)) {
    text += ' The source names Wikidata as where the answer list was compiled.';
  }
  if (/counts as 1/i.test(source)) {
    text += ' A 1 in that column is the source’s own placeholder for a name with no article.';
  }
  return `${text}${links}`;
}

function tableCaption(question: string, source: string, count: number): string {
  const word = count === 1 ? 'answer' : 'answers';
  return `${count} accepted ${word} to ${quoteQuestion(question)}, rarest first. The last column is ${measureHeading(source)}.`;
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
    scope: scopeParagraph(input.question, answers),
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
    faq: buildFaq(input.question, answers, uses, misses, shape),
    viewsNote: viewsNote(input.source, answers),
    viewsHeading: measureHeading(input.source),
    sourceNote: sourceNote(input.source, answers),
    tableCaption: tableCaption(input.question, input.source, answers.length),
  };
}
