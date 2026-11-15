/**
 * build-prompts.ts — compile src/data/prompts from Wikidata + pageviews.
 *
 * Sources (cached under .cache/build-prompts/, which is local tooling state):
 *   - Wikidata SPARQL: https://query.wikidata.org/sparql
 *   - Wikidata lexemes for English interjections
 *   - Wikimedia pageviews, monthly, summed over the last 12 complete months
 *
 * Politeness: User-Agent identifies the bot, concurrency stays at or below 4,
 * and 429/5xx responses back off. Re-runs reuse the cache.
 *
 * Usage:
 *   pnpm build-prompts            # write src/data/prompts
 *   pnpm build-prompts --counts   # SPARQL sizes only, no pageviews, no writes
 *   pnpm build-prompts --only=a,b # limit to these slugs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Answer, Prompt, PromptIndexEntry } from '../src/lib/game/types';
import {
  CATEGORY_ORDER,
  MAX_ANSWERS,
  PROMPT_DEFS,
  RESULT_CAP,
  SOURCE_MONTH,
  VIEW_END,
  VIEW_START,
  type PromptDef,
  acceptLemma,
  aliasAllowed,
  assertPromptDefs,
  generatedVariants,
  normalizeKey,
  pageviewProject,
  rarityOf,
  round3,
  sourceLine,
  tierFor,
  answerMinimum,
} from './data/prompt-defs';

const UA = 'RarestAnswerBot/1.0 (contact@rarestanswer.com)';
const SPARQL_URL = 'https://query.wikidata.org/sparql';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache', 'build-prompts');
const OUT_DIR = join(ROOT, 'src', 'data', 'prompts');

const SPARQL_CONCURRENCY = 2;
const SPARQL_GAP_MS = 250;
const PAGEVIEW_CONCURRENCY = 10;
const PAGEVIEW_GAP_MS = 40;
const SPARQL_TIMEOUT_MS = 50_000;
const PAGEVIEW_TIMEOUT_MS = 30_000;
const ATTEMPTS = 5;

interface Binding {
  type: string;
  value: string;
}

interface SparqlResults {
  results?: { bindings?: Record<string, Binding>[] };
  message?: string;
}

interface RawItem {
  id: string;
  label: string;
  wiki: string;
  alts: string[];
  binomials: string[];
  symbols: string[];
  shorts: string[];
}

interface Draft {
  name: string;
  aliases: string[];
  popularity: number;
  wiki?: string;
}

interface CountRow {
  slug: string;
  category: string;
  count: number;
  status: 'ok' | 'low' | 'sat' | 'err';
  detail: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cachePath(kind: string, key: string): string {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 16);
  const safe = key.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  return join(CACHE_DIR, kind, `${safe}__${hash}.json`);
}

function readCache(file: string): unknown | undefined {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function writeCache(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, file);
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  gapMs: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const run = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      if (gapMs > 0) await sleep(gapMs);
      results[index] = await worker(items[index], index);
    }
  };
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

async function fetchRetry(url: string, init: RequestInit, timeoutMs: number, attempts = ATTEMPTS): Promise<Response> {
  let delay = 1000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(wait + Math.floor(Math.random() * 400));
        delay = Math.min(delay * 2, 30_000);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      const name = error instanceof Error ? error.name : '';
      if (attempt === attempts) break;
      void name;
      await sleep(delay + Math.floor(Math.random() * 400));
      delay = Math.min(delay * 2, 30_000);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(message);
}

function splitPacked(value: string | undefined): string[] {
  if (!value) return [];
  return value.split('|||').map((part) => part.trim()).filter(Boolean);
}

function wikiFilters(): string {
  return [
    'FILTER(!STRSTARTS(?enwiki, "List of "))',
    'FILTER(!STRSTARTS(?enwiki, "Lists of "))',
    'FILTER(!STRSTARTS(?enwiki, "Timeline of "))',
    'FILTER(!STRSTARTS(?enwiki, "Index of "))',
    'FILTER(!STRSTARTS(?enwiki, "Glossary of "))',
    'FILTER(!STRSTARTS(?enwiki, "Template:"))',
    'FILTER(!STRSTARTS(?enwiki, "Category:"))',
    'FILTER(!STRSTARTS(?enwiki, "Wikipedia:"))',
    'FILTER(!STRSTARTS(?enwiki, "Portal:"))',
    'FILTER(!STRSTARTS(?enwiki, "File:"))',
    'FILTER(!CONTAINS(LCASE(?enwiki), "(disambiguation)"))',
  ].join('\n');
}

/**
 * Small VALUES-style sets where Blazegraph's optimizer runs the outer OPTIONALs
 * before the subquery and times out (verified 2026-11-14). Keep written order.
 */
const FIXED_ORDER = new Set(['great-ape-species', 'commonwealth-members', 'planets-and-dwarf-planets', 'human-chromosomes']);

function sparqlFor(def: PromptDef, mode: 'count' | 'full'): string {
  if (!def.where) throw new Error(`${def.slug} has no SPARQL pattern`);
  const inner = `
SELECT DISTINCT ?item ?label ?enwiki WHERE {
  ${def.where}
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q4167410 }
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> ;
           schema:name ?enwiki .
  ${wikiFilters()}
  OPTIONAL { ?item rdfs:label ?enlabel. FILTER(LANG(?enlabel) = "en") }
  BIND(COALESCE(?enlabel, ?enwiki) AS ?label)
  FILTER(!REGEX(?label, "^Q[0-9]+$"))
}
LIMIT ${RESULT_CAP}`;
  if (mode === 'count') return inner;
  return `
SELECT ?item ?label ?enwiki
  (GROUP_CONCAT(DISTINCT ?alt; SEPARATOR="|||") AS ?alts)
  (GROUP_CONCAT(DISTINCT ?binomial; SEPARATOR="|||") AS ?binomials)
  (GROUP_CONCAT(DISTINCT ?symbol; SEPARATOR="|||") AS ?symbols)
  (GROUP_CONCAT(DISTINCT ?short; SEPARATOR="|||") AS ?shorts)
WHERE {
  ${FIXED_ORDER.has(def.slug) ? 'hint:Query hint:optimizer "None" .' : ''}
  { ${inner} }
  OPTIONAL { ?item skos:altLabel ?alt. FILTER(LANG(?alt) = "en") }
  OPTIONAL { ?item wdt:P225 ?binomial }
  OPTIONAL { ?item wdt:P246 ?symbol }
  OPTIONAL { ?item wdt:P1813 ?short. FILTER(LANG(?short) = "en") }
}
GROUP BY ?item ?label ?enwiki`;
}

function lexemeSparql(categoryId: string): string {
  return `
SELECT DISTINCT ?lemma WHERE {
  ?lexeme wikibase:lexicalCategory wd:${categoryId} ;
          dct:language wd:Q1860 ;
          wikibase:lemma ?lemma .
  FILTER(LANG(?lemma) = "en")
}`;
}

async function sparql(query: string, cacheKey: string): Promise<SparqlResults> {
  const queryHash = createHash('sha1').update(query).digest('hex').slice(0, 12);
  const file = cachePath('sparql', `${cacheKey}:${queryHash}`);
  const cached = readCache(file);
  if (cached && typeof cached === 'object') return cached as SparqlResults;

  const response = await fetchRetry(
    SPARQL_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': UA,
        'Api-User-Agent': UA,
      },
      body: new URLSearchParams({ query }),
    },
    SPARQL_TIMEOUT_MS,
    2,
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SPARQL HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  const parsed = JSON.parse(text) as SparqlResults;
  if (!parsed.results?.bindings) {
    throw new Error(`SPARQL body missing results: ${text.slice(0, 240)}`);
  }
  writeCache(file, parsed);
  return parsed;
}

function bindingsOf(payload: SparqlResults): Record<string, Binding>[] {
  return payload.results?.bindings ?? [];
}

function rawItemsFrom(payload: SparqlResults): RawItem[] {
  const byId = new Map<string, RawItem>();
  for (const row of bindingsOf(payload)) {
    const id = row.item?.value.split('/').pop() ?? '';
    const label = row.label?.value?.trim() ?? '';
    const wiki = row.enwiki?.value?.trim() ?? '';
    if (!id || !label || !wiki) continue;
    const incoming: RawItem = {
      id,
      label,
      wiki,
      alts: splitPacked(row.alts?.value),
      binomials: splitPacked(row.binomials?.value),
      symbols: splitPacked(row.symbols?.value),
      shorts: splitPacked(row.shorts?.value),
    };
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, incoming);
      continue;
    }
    existing.alts.push(...incoming.alts);
    existing.binomials.push(...incoming.binomials);
    existing.symbols.push(...incoming.symbols);
    existing.shorts.push(...incoming.shorts);
    if (incoming.label.length < existing.label.length) existing.label = incoming.label;
    if (incoming.wiki.length < existing.wiki.length) existing.wiki = incoming.wiki;
  }
  return [...byId.values()];
}

function baseName(label: string, wiki: string): { name: string; qualifier: string | null } {
  const wikiMatch = wiki.match(/^(.*)\s+\(([^)]+)\)\s*$/);
  const wikiBase = (wikiMatch ? wikiMatch[1] : wiki).trim();
  // Wikipedia titles are the public name. Wikidata labels are aliases, so a
  // vandalized label cannot replace "Lady Jane Grey" or "Lettuce".
  return { name: wikiBase || label.trim(), qualifier: wikiMatch ? wikiMatch[2].trim() : null };
}

function pushAlias(bucket: string[], seen: Set<string>, raw: string, kind: 'alt' | 'short' | 'symbol' | 'generated', keepShort: boolean): void {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!aliasAllowed(cleaned, kind, keepShort)) return;
  const key = normalizeKey(cleaned);
  if (!key || seen.has(key)) return;
  seen.add(key);
  bucket.push(cleaned);
}

function draftsFromItems(items: RawItem[], keepShort: boolean): Draft[] {
  const prelim = items.map((item) => {
    const split = baseName(item.label, item.wiki);
    return { item, ...split };
  });
  const nameUse = new Map<string, number>();
  for (const row of prelim) {
    const key = normalizeKey(row.name);
    nameUse.set(key, (nameUse.get(key) ?? 0) + 1);
  }
  return prelim.flatMap((row) => {
    let name = row.name;
    const key = normalizeKey(name);
    if (!key || key.length > 80) return [];
    if (!/[A-Za-z]/.test(name)) return [];
    if ((nameUse.get(key) ?? 0) > 1) {
      const qualifier = row.qualifier ?? row.item.wiki;
      name = qualifier ? `${row.name} (${qualifier})` : row.item.wiki;
    }
    if (!name || name.length > 90) return [];
    const aliases: string[] = [];
    const seen = new Set<string>([normalizeKey(name)]);
    const add = (raw: string, kind: 'alt' | 'short' | 'symbol' | 'generated'): void => {
      pushAlias(aliases, seen, raw, kind, keepShort);
    };
    add(row.item.wiki, 'generated');
    add(row.item.label, 'alt');
    add(row.name, 'generated');
    for (const variant of generatedVariants(name)) add(variant, 'generated');
    for (const variant of generatedVariants(row.item.wiki)) add(variant, 'generated');
    for (const binomial of row.item.binomials) add(binomial, 'alt');
    for (const symbol of row.item.symbols) add(symbol, 'symbol');
    for (const short of row.item.shorts) add(short, 'short');
    for (const alt of row.item.alts) add(alt, 'alt');
    return [{ name, aliases, popularity: 0, wiki: row.item.wiki }];
  });
}

function draftsFromLemmas(lemmas: string[]): Draft[] {
  const out: Draft[] = [];
  const seenName = new Set<string>();
  for (const lemma of lemmas) {
    if (!acceptLemma(lemma)) continue;
    const name = lemma.replace(/\s+/g, ' ').trim();
    const key = normalizeKey(name);
    if (!key || seenName.has(key)) continue;
    seenName.add(key);
    const aliases: string[] = [];
    const seen = new Set<string>([key]);
    for (const variant of generatedVariants(name)) {
      pushAlias(aliases, seen, variant, 'generated', false);
    }
    out.push({ name, aliases, popularity: 0 });
  }
  return out;
}

function mergeDrafts(drafts: Draft[]): Draft[] {
  const byName = new Map<string, Draft>();
  for (const draft of drafts) {
    const key = normalizeKey(draft.name);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...draft, aliases: [...draft.aliases] });
      continue;
    }
    if (draft.popularity > existing.popularity) {
      existing.wiki = draft.wiki ?? existing.wiki;
      existing.popularity = draft.popularity;
    }
    for (const alias of draft.aliases) {
      if (!existing.aliases.some((current) => normalizeKey(current) === normalizeKey(alias))) {
        existing.aliases.push(alias);
      }
    }
  }
  return [...byName.values()];
}

function capDrafts(drafts: Draft[]): Draft[] {
  if (drafts.length <= MAX_ANSWERS) return drafts;
  const sorted = [...drafts].sort((a, b) => a.popularity - b.popularity || a.name.localeCompare(b.name, 'en'));
  const picked = [...sorted.slice(0, MAX_ANSWERS / 2), ...sorted.slice(-MAX_ANSWERS / 2)];
  const seen = new Set<string>();
  const kept: Draft[] = [];
  for (const draft of picked) {
    const key = normalizeKey(draft.name);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(draft);
  }
  return kept;
}

function stripCollisions(answers: Answer[]): void {
  const nameOwners = new Map<string, number>();
  answers.forEach((answer, index) => {
    nameOwners.set(normalizeKey(answer.name), index);
  });
  const aliasOwners = new Map<string, Set<number>>();
  answers.forEach((answer, index) => {
    for (const alias of answer.aliases) {
      const key = normalizeKey(alias);
      if (!key) continue;
      const owners = aliasOwners.get(key) ?? new Set<number>();
      owners.add(index);
      aliasOwners.set(key, owners);
    }
  });
  for (const answer of answers) {
    const own = normalizeKey(answer.name);
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const alias of answer.aliases) {
      const key = normalizeKey(alias);
      if (!key || key === own || seen.has(key)) continue;
      const owners = aliasOwners.get(key);
      if (owners && owners.size > 1) continue;
      if (nameOwners.has(key)) continue;
      seen.add(key);
      kept.push(alias);
    }
    kept.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), 'en') || a.localeCompare(b, 'en'));
    answer.aliases = kept;
  }
}

function scoreDrafts(drafts: Draft[]): Answer[] {
  const popularities = drafts.map((draft) => draft.popularity);
  const scored = drafts.map((draft) => {
    const raw = rarityOf(draft.popularity, popularities);
    const answer: Answer = {
      name: draft.name,
      aliases: draft.aliases,
      popularity: draft.popularity,
      rarity: round3(raw),
      tier: tierFor(raw),
    };
    if (draft.wiki) answer.wiki = draft.wiki;
    return { answer, raw };
  });
  scored.sort((a, b) => b.raw - a.raw || a.answer.popularity - b.answer.popularity || a.answer.name.localeCompare(b.answer.name, 'en'));
  const answers = scored.map((row) => row.answer);
  stripCollisions(answers);
  return answers;
}

function pageviewUrl(project: string, title: string): string {
  const article = encodeURIComponent(title.replace(/ /g, '_'));
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${article}/monthly/${VIEW_START}/${VIEW_END}`;
}

async function pageviewsFor(project: string, title: string): Promise<number> {
  const file = cachePath('pageviews', `${project}::${title}`);
  const cached = readCache(file);
  if (cached && typeof cached === 'object' && cached !== null && 'views' in cached) {
    const views = (cached as { views: unknown }).views;
    if (typeof views === 'number') return views;
  }
  const response = await fetchRetry(
    pageviewUrl(project, title),
    { headers: { Accept: 'application/json', 'User-Agent': UA, 'Api-User-Agent': UA } },
    PAGEVIEW_TIMEOUT_MS,
  );
  if (response.status === 404) {
    writeCache(file, { views: 0, status: 404 });
    return 0;
  }
  if (!response.ok) {
    throw new Error(`pageviews HTTP ${response.status} for ${title}`);
  }
  const payload = (await response.json()) as { items?: { views?: number }[] };
  const views = (payload.items ?? []).reduce((sum, item) => sum + (item.views ?? 0), 0);
  writeCache(file, { views, status: 200 });
  return views;
}

async function countDef(def: PromptDef): Promise<CountRow> {
  try {
    if (def.lexemeCategory) {
      const payload = await sparql(lexemeSparql(def.lexemeCategory), `lex:${def.slug}`);
      const lemmas = bindingsOf(payload).map((row) => row.lemma?.value ?? '').filter(acceptLemma);
      const unique = new Set(lemmas.map((lemma) => normalizeKey(lemma)));
      const count = unique.size;
      const status: CountRow['status'] = count >= answerMinimum(def) ? 'ok' : 'low';
      console.error(`${status.toUpperCase()} ${count} ${def.slug}`);
      return {
        slug: def.slug,
        category: def.category,
        count,
        status,
        detail: [...unique].slice(0, 6).join(', '),
      };
    }
    const payload = await sparql(sparqlFor(def, 'count'), `count:${def.slug}`);
    const rows = bindingsOf(payload);
    const labels = [...new Set(rows.map((row) => row.label?.value ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
    const count = new Set(rows.map((row) => row.item?.value ?? '').filter(Boolean)).size;
    let status: CountRow['status'] = 'ok';
    if (rows.length >= RESULT_CAP) status = 'sat';
    else if (count < answerMinimum(def)) status = 'low';
    const detail = labels.slice(0, 8).join(', ');
    console.error(`${status.toUpperCase()} ${count} ${def.slug}`);
    return { slug: def.slug, category: def.category, count, status, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERR 0 ${def.slug} ${message.slice(0, 160)}`);
    return { slug: def.slug, category: def.category, count: 0, status: 'err', detail: message.slice(0, 180) };
  }
}

interface FetchedPrompt {
  def: PromptDef;
  drafts: Draft[];
  error?: string;
}

function applyExtraAliases(drafts: Draft[], extras: PromptDef['extraAliases']): void {
  if (!extras) return;
  for (const draft of drafts) {
    const more = extras[draft.name] ?? (draft.wiki ? extras[draft.wiki] : undefined);
    if (!more) continue;
    const seen = new Set<string>([normalizeKey(draft.name), ...draft.aliases.map((alias) => normalizeKey(alias))]);
    for (const alias of more) {
      if (!aliasAllowed(alias, 'alt', false)) continue;
      const key = normalizeKey(alias);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      draft.aliases.push(alias);
    }
  }
}

function selectedDefs(): PromptDef[] {
  const onlyFlag = process.argv.find((arg) => arg.startsWith('--only='));
  if (!onlyFlag) return [...PROMPT_DEFS];
  const wanted = new Set(onlyFlag.slice('--only='.length).split(',').filter(Boolean));
  return PROMPT_DEFS.filter((def) => wanted.has(def.slug));
}

function assertRarityContract(): void {
  const pops = [1, 2, 3, 4, 5, 6, 7, 8];
  if (rarityOf(1, pops) !== 1) throw new Error('rarest popularity must score 1');
  if (rarityOf(8, pops) !== 0) throw new Error('most popular must score 0');
  if (Math.abs(rarityOf(2, pops) - 6 / 7) > 1e-9) throw new Error('percentile mismatch');
  if (tierFor(1) !== 6 || tierFor(0) !== 1) throw new Error('tier endpoints');
  if (tierFor(0.199) !== 1 || tierFor(0.2) !== 2) throw new Error('tier 0.2 boundary');
  if (tierFor(0.399) !== 2 || tierFor(0.4) !== 3) throw new Error('tier 0.4 boundary');
  if (tierFor(0.599) !== 3 || tierFor(0.6) !== 4) throw new Error('tier 0.6 boundary');
  if (tierFor(0.799) !== 4 || tierFor(0.8) !== 5) throw new Error('tier 0.8 boundary');
  if (tierFor(0.929) !== 5 || tierFor(0.93) !== 6) throw new Error('tier 0.93 boundary');
  if (round3(6 / 7) !== 0.857 || round3(3 / 7) !== 0.429) throw new Error('round3');
}

function writeOutputs(prompts: ReadonlyArray<Prompt & { seoNoun?: string }>): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const slugs = new Set(prompts.map((prompt) => prompt.slug));
  for (const prompt of prompts) {
    const file = join(OUT_DIR, `${prompt.slug}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(prompt, null, 2)}\n`);
    renameSync(tmp, file);
  }
  for (const name of readdirSync(OUT_DIR)) {
    if (!name.endsWith('.json') || name === 'index.json') continue;
    if (!slugs.has(name.slice(0, -'.json'.length))) rmSync(join(OUT_DIR, name));
  }
  const index: PromptIndexEntry[] = prompts
    .map((prompt) => ({
      id: prompt.id,
      slug: prompt.slug,
      category: prompt.category,
      question: prompt.question,
      answerCount: prompt.answers.length,
    }))
    .sort((a, b) => {
      const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      return byCategory || a.slug.localeCompare(b.slug, 'en');
    });
  const indexFile = join(OUT_DIR, 'index.json');
  const tmp = `${indexFile}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(index, null, 2)}\n`);
  renameSync(tmp, indexFile);
}

function categoryCounts(prompts: Prompt[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const category of CATEGORY_ORDER) counts.set(category, 0);
  for (const prompt of prompts) counts.set(prompt.category, (counts.get(prompt.category) ?? 0) + 1);
  return counts;
}

async function main(): Promise<void> {
  assertPromptDefs();
  assertRarityContract();
  const defs = selectedDefs();
  if (defs.length === 0) throw new Error('no prompt defs selected');
  const countsOnly = process.argv.includes('--counts');
  console.error(`prompts ${defs.length}  window ${VIEW_START}-${VIEW_END}  source month ${SOURCE_MONTH}`);

  if (countsOnly) {
    const rows = await mapPool(defs, SPARQL_CONCURRENCY, SPARQL_GAP_MS, (def) => countDef(def));
    const byCategory = new Map<string, { ok: number; low: number; sat: number; err: number }>();
    for (const category of CATEGORY_ORDER) byCategory.set(category, { ok: 0, low: 0, sat: 0, err: 0 });
    for (const row of rows) {
      const bucket = byCategory.get(row.category) ?? { ok: 0, low: 0, sat: 0, err: 0 };
      bucket[row.status] += 1;
      byCategory.set(row.category, bucket);
      console.log(`${row.status.toUpperCase()}\t${row.count}\t${row.category}\t${row.slug}\t${row.detail}`);
    }
    for (const category of CATEGORY_ORDER) {
      const bucket = byCategory.get(category);
      console.error(`${category}: ok ${bucket?.ok ?? 0} low ${bucket?.low ?? 0} sat ${bucket?.sat ?? 0} err ${bucket?.err ?? 0}`);
    }
    return;
  }

  console.error('fetching answer sets');
  const fetched: FetchedPrompt[] = await mapPool(defs, SPARQL_CONCURRENCY, SPARQL_GAP_MS, async (def) => {
    try {
      if (def.lexemeCategory) {
        const payload = await sparql(lexemeSparql(def.lexemeCategory), `lex:${def.slug}`);
        const drafts = draftsFromLemmas(bindingsOf(payload).map((row) => row.lemma?.value ?? ''));
        console.error(`lex ${def.slug}: ${drafts.length}`);
        return { def, drafts };
      }
      const payload = await sparql(sparqlFor(def, 'full'), `full:${def.slug}`);
      if (bindingsOf(payload).length >= RESULT_CAP) {
        throw new Error(`hit the ${RESULT_CAP} row cap`);
      }
      const drafts = draftsFromItems(rawItemsFrom(payload), def.keepShortAliases === true);
      console.error(`sparql ${def.slug}: ${drafts.length}`);
      return { def, drafts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${def.slug}: ${message}`);
      return { def, drafts: [], error: message };
    }
  });

  const project = (def: PromptDef): string => pageviewProject(def);
  const titleKeys = new Map<string, { project: string; title: string }>();
  for (const row of fetched) {
    if (row.error) continue;
    for (const draft of row.drafts) {
      const title = draft.wiki ?? draft.name;
      titleKeys.set(`${project(row.def)}::${title}`, { project: project(row.def), title });
    }
  }
  const uniqueTitles = [...titleKeys.values()];
  console.error(`pageviews ${uniqueTitles.length} unique titles`);
  let done = 0;
  const viewEntries = await mapPool(uniqueTitles, PAGEVIEW_CONCURRENCY, PAGEVIEW_GAP_MS, async (entry) => {
    const views = await pageviewsFor(entry.project, entry.title);
    done += 1;
    if (done % 400 === 0 || done === uniqueTitles.length) {
      console.error(`pageviews ${done}/${uniqueTitles.length}`);
    }
    return [`${entry.project}::${entry.title}`, views] as const;
  });
  const views = new Map<string, number>(viewEntries);

  const prompts: Array<Prompt & { seoNoun?: string }> = [];
  const failures: string[] = [];
  for (const row of fetched) {
    if (row.error) {
      failures.push(`${row.def.slug}: ${row.error}`);
      continue;
    }
    try {
      let drafts = row.drafts.map((draft) => ({
        ...draft,
        aliases: [...draft.aliases],
        popularity: views.get(`${project(row.def)}::${draft.wiki ?? draft.name}`) ?? 0,
      }));
      applyExtraAliases(drafts, row.def.extraAliases);
      drafts = mergeDrafts(drafts);
      if (row.def.lexemeCategory) {
        const known = drafts.filter((draft) => draft.popularity > 0);
        if (known.length >= answerMinimum(row.def)) drafts = known;
      }
      const capped = drafts.length > MAX_ANSWERS;
      drafts = capDrafts(drafts);
      if (capped) console.error(`cap ${row.def.slug}: kept ${drafts.length}`);
      const maxPopularity = drafts.reduce((max, draft) => Math.max(max, draft.popularity), 0);
      if (maxPopularity === 0) throw new Error('every answer has 0 pageviews');
      const answers = scoreDrafts(drafts);
      if (answers.length < answerMinimum(row.def)) {
        throw new Error(`only ${answers.length} answers`);
      }
      const prompt: Prompt & { seoNoun?: string } = {
        id: row.def.slug,
        slug: row.def.slug,
        category: row.def.category,
        question: row.def.question,
        source: sourceLine(row.def),
        answers,
      };
      if (row.def.seoNoun) prompt.seoNoun = row.def.seoNoun;
      prompts.push(prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${row.def.slug}: ${message}`);
      console.error(`FAIL ${row.def.slug}: ${message}`);
    }
  }

  const counts = categoryCounts(prompts);
  const partial = process.argv.some((arg) => arg.startsWith('--only='));
  let short = false;
  for (const category of CATEGORY_ORDER) {
    const count = counts.get(category) ?? 0;
    console.error(`${category}: ${count} prompts`);
    if (!partial && count < 20) short = true;
    else if (!partial && count < 30) console.error(`WARN ${category} is under the 30-prompt target`);
  }
  const answers = prompts.reduce((sum, prompt) => sum + prompt.answers.length, 0);
  console.error(`ready ${prompts.length} prompts, ${answers} answers, skipped ${failures.length}`);
  if (prompts.length === 0 || short) {
    console.error('refusing to write an incomplete prompt set');
    process.exit(1);
  }
  writeOutputs(prompts);
  console.error(`wrote ${prompts.length} prompts to src/data/prompts`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
