/**
 * Prompt catalog and the alias / rarity rules for scripts/build-prompts.ts.
 *
 * Each `where` clause is a SPARQL pattern that binds ?item. QIDs were resolved
 * against Wikidata labels before they were written here. The builder drops a
 * prompt that comes back under its answer minimum or that hits the result cap
 * (the set would be an arbitrary slice, so a true answer could be missing).
 * Living species prompts require species rank and exclude fossil taxa, extinct
 * taxa, and IUCN extinct. Dinosaur prompts are fossil genera on purpose: the
 * question is about dinosaurs. great-ape-species is the eight living species
 * and is the one prompt allowed under 15 answers.
 *
 * Rarity is the average-rank percentile of popularity within the prompt,
 * inverted so 1 is the least viewed. Ties share a rarity.
 * Tiers: <0.2 Common, <0.4 Familiar, <0.6 Uncommon, <0.8 Rare, <0.93 Epic, else Legendary.
 *
 * The answer shown to players is the English Wikipedia title. Wikidata's
 * English label is kept as an alias, which also keeps a vandalized label
 * from becoming the name. Other aliases come from altLabels, taxon names,
 * chemical symbols, and official short names, plus generated forms that
 * strip a leading The/A/An and parenthetical qualifiers. Too-short or
 * stopword aliases are dropped.
 * An alias used by two answers, or equal to another answer's name, is dropped.
 */
import type { Answer, CategoryKey } from '../../src/lib/game/types';

export const SOURCE_MONTH = '2026-10';
/** First day of the earliest complete month in the 12-month pageview window. */
export const VIEW_START = '20251101';
/** First day of the latest complete month (October 2026), inclusive. */
export const VIEW_END = '20261001';
export const MIN_ANSWERS = 15;
export const MAX_ANSWERS = 800;
/** Inner SPARQL limit. A full page of this size means the set was truncated. */
export const RESULT_CAP = 801;

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

export interface PromptDef {
  slug: string;
  category: CategoryKey;
  question: string;
  /** SPARQL graph pattern. Must bind ?item. */
  where?: string;
  /** Wikidata lexical category, English lexemes only. */
  lexemeCategory?: string;
  /** Accept 1-character chemical symbols as aliases. */
  keepShortAliases?: boolean;
  /** Overrides MIN_ANSWERS. great-ape-species is the only prompt under 15. */
  minAnswers?: number;
  /** Answer-page H1 noun. Not part of the Prompt type. */
  seoNoun?: string;
  /** Extra accepted names keyed by the English Wikipedia title. */
  extraAliases?: Readonly<Record<string, readonly string[]>>;
}

export type AliasKind = 'alt' | 'short' | 'symbol' | 'generated';

const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'with', 'as',
  'de', 'da', 'di', 'du', 'la', 'le', 'el', 'van', 'von', 'st', 'mr', 'mrs', 'ms', 'dr', 'sir',
  'jr', 'sr', 'new', 'old', 'north', 'south', 'east', 'west', 'upper', 'lower', 'great', 'little',
  'big', 'small', 'song', 'film', 'movie', 'album', 'single', 'city', 'country', 'state', 'island',
  'river', 'lake', 'mount', 'genus', 'species', 'family', 'order', 'class', 'group', 'band', 'team',
  'club', 'character', 'person', 'human', 'animal', 'food', 'game', 'world', 'national',
  'international', 'official', 'original', 'version', 'part', 'series', 'episode', 'season',
  'unknown', 'none', 'other', 'various', 'see', 'list', 'lists', 'category', 'template',
  'wikipedia', 'wiki', 'page', 'article', 'disambiguation', 'stub', 'redirect', 'male', 'female',
  'man', 'woman', 'men', 'women', 'one', 'two', 'three', 'type', 'types', 'kind', 'form', 'general',
  'common', 'true', 'false', 'all', 'any',
]);

export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function aliasAllowed(raw: string, kind: AliasKind, keepShort: boolean): boolean {
  const key = normalizeKey(raw);
  if (!key) return false;
  if (kind !== 'symbol' && STOPWORDS.has(key)) return false;
  if (raw.length > 80) return false;
  if (/https?:|www\./i.test(raw)) return false;
  if (/\b(list of|disambiguation|wikipedia|wikidata)\b/i.test(raw)) return false;
  if (kind !== 'symbol' && /[;:,]/.test(raw)) return false;
  if (kind === 'alt' && /\(.*\)/.test(raw)) return false;
  if (kind === 'alt' && key.split(' ').length > 5) return false;
  const min = kind === 'symbol' && keepShort ? 1 : kind === 'short' ? 2 : 3;
  if (key.length < min) return false;
  if (kind !== 'symbol' && /^\d+$/.test(key)) return false;
  return true;
}

/** Strip a leading article and a parenthetical qualifier. Also map "&" / "and". */
export function generatedVariants(name: string): string[] {
  const variants: string[] = [];
  const withoutArticle = name.replace(/^(?:the|a|an)\s+/i, '').trim();
  if (withoutArticle && withoutArticle !== name) variants.push(withoutArticle);
  const stripParens = (value: string): string => value.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const withoutParens = stripParens(name);
  if (withoutParens && withoutParens !== name) variants.push(withoutParens);
  if (withoutArticle !== name) {
    const both = stripParens(withoutArticle);
    if (both && both !== withoutArticle && both !== withoutParens) variants.push(both);
  }
  if (name.includes('&')) variants.push(name.replace(/\s*&\s*/g, ' and '));
  const book = name.match(/^Book of (?!the\b)(.+)$/i);
  if (book?.[1]) variants.push(book[1].trim());
  const gospel = name.match(/^Gospel of (.+)$/i);
  if (gospel?.[1]) variants.push(gospel[1].trim());
  return variants;
}

export function acceptLemma(lemma: string): boolean {
  const name = lemma.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 40) return false;
  if (name.split(' ').length > 4) return false;
  if (name.includes('.') || name.includes('_')) return false;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\- ]*$/u.test(name)) return false;
  const key = normalizeKey(name);
  return key.length >= 2 && !/^\d+$/.test(key);
}

export function answerMinimum(def: PromptDef): number {
  return def.minAnswers ?? MIN_ANSWERS;
}

export function rarityOf(popularity: number, all: readonly number[]): number {
  const n = all.length;
  if (n <= 1) return 1;
  let less = 0;
  let equal = 0;
  for (const value of all) {
    if (value < popularity) less += 1;
    else if (value === popularity) equal += 1;
  }
  const percentile = (less + (equal - 1) / 2) / (n - 1);
  return 1 - percentile;
}

export function tierFor(rarity: number): Answer['tier'] {
  if (rarity < 0.2) return 1;
  if (rarity < 0.4) return 2;
  if (rarity < 0.6) return 3;
  if (rarity < 0.8) return 4;
  if (rarity < 0.93) return 5;
  return 6;
}

export function round3(value: number): number {
  const rounded = Number(value.toFixed(3));
  if (rounded < 0) return 0;
  if (rounded > 1) return 1;
  return rounded;
}

export function sourceLine(def: PromptDef): string {
  if (def.lexemeCategory) return `Wikidata lexemes + Wiktionary pageviews (${SOURCE_MONTH})`;
  return `Wikidata + Wikipedia pageviews (${SOURCE_MONTH})`;
}

export function pageviewProject(def: PromptDef): 'en.wikipedia' | 'en.wiktionary' {
  return def.lexemeCategory ? 'en.wiktionary' : 'en.wikipedia';
}

function q(id: string): string {
  if (!/^Q\d+$/.test(id)) throw new Error(`Bad Wikidata id ${id}`);
  return id;
}

function prompt(
  category: CategoryKey,
  slug: string,
  question: string,
  where: string,
  keepShortAliases = false,
  extra?: Pick<PromptDef, 'seoNoun' | 'minAnswers' | 'extraAliases'>,
): PromptDef {
  const def: PromptDef = { slug, category, question, where };
  if (keepShortAliases) def.keepShortAliases = true;
  if (extra?.seoNoun) def.seoNoun = extra.seoNoun;
  if (extra?.minAnswers != null) def.minAnswers = extra.minAnswers;
  if (extra?.extraAliases) def.extraAliases = extra.extraAliases;
  return def;
}

const ended = 'FILTER NOT EXISTS { ?item wdt:P576 ?ended }';
const notCharacter = 'FILTER NOT EXISTS { ?item wdt:P31 ?role. VALUES ?role { wd:Q95074 wd:Q15773317 wd:Q15773347 wd:Q3658341 wd:Q15632617 } }';
/** Species rank, not a subspecies, not a fossil or extinct taxon, not IUCN Extinct. */
const EXTANT = [
  'FILTER NOT EXISTS { ?item wdt:P31 wd:Q23038290 }',
  'FILTER NOT EXISTS { ?item wdt:P31 wd:Q98961713 }',
  'FILTER NOT EXISTS { ?item wdt:P141 wd:Q237350 }',
  'FILTER NOT EXISTS { ?item wdt:P105 wd:Q68947 }',
  'FILTER(!REGEX(STR(?binomial), "(?i)^(palaeo|paleo|archaeo)"))',
].join(' ');

function admin(cls: string): string {
  return `?item wdt:P31 wd:${q(cls)}. ${ended}`;
}

function sovereignState(variable = '?item'): string {
  return `${variable} wdt:P31 wd:Q3624078. FILTER NOT EXISTS { ${variable} wdt:P576 ?ended } FILTER NOT EXISTS { ${variable} wdt:P31 wd:Q3024240 }`;
}

function countriesIn(continents: readonly string[]): string {
  const branches = continents.map((id) => `{ ?item wdt:P30 wd:${q(id)}. }`).join(' UNION ');
  const continent = continents.length === 1 ? `?item wdt:P30 wd:${q(continents[0] ?? '')}.` : `{ ${branches} }`;
  return `${sovereignState()} ${continent}`;
}

function capitalsIn(continent: string): string {
  return `${sovereignState('?state')} ?state wdt:P30 wd:${q(continent)}. ?state wdt:P36 ?item.`;
}

function membersOf(org: string, mode: 'sovereign' | 'country' = 'country'): string {
  const type = mode === 'sovereign'
    ? '?item wdt:P31 wd:Q3624078.'
    : 'FILTER EXISTS { { ?item wdt:P31 wd:Q6256. } UNION { ?item wdt:P31 wd:Q3624078. } }';
  return `?item p:P463 ?mem. ?mem ps:P463 wd:${q(org)}. FILTER NOT EXISTS { ?mem pq:P582 ?memEnded } ${ended} FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 } ${type}`;
}

function heritageIn(country: string): string {
  return `{ { ?item wdt:P1435 wd:Q9259. } UNION { ?item wdt:P31 wd:Q9259. } } ?item wdt:P17 wd:${q(country)}.`;
}

function species(taxon: string): string {
  return `?item wdt:P105 wd:Q7432. ?item wdt:P225 ?binomial. ?item wdt:P171* wd:${q(taxon)}. ${EXTANT}`;
}

function genus(taxon: string): string {
  return `?item wdt:P105 wd:Q34740. ?item wdt:P171* wd:${q(taxon)}.`;
}

function ordersIn(parent: string): string {
  return `?item wdt:P105 wd:Q36602. ?item wdt:P171* wd:${q(parent)}. FILTER NOT EXISTS { ?item wdt:P31 wd:Q23038290 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q98961713 }`;
}

function dishesFrom(country: string): string {
  return `?item wdt:P495 wd:${q(country)}. { { ?item wdt:P31 wd:Q746549. } UNION { ?item wdt:P279 wd:Q746549. } } FILTER(?item != wd:Q746549)`;
}

function cheesesFrom(country: string): string {
  return `{ { ?item wdt:P31 wd:Q10943. } UNION { ?item wdt:P279 wd:Q10943. } } { { ?item wdt:P495 wd:${q(country)}. } UNION { ?item wdt:P17 wd:${q(country)}. } } FILTER(?item != wd:Q10943)`;
}

function kindsOf(cls: string): string {
  const id = q(cls);
  return `{ { ?item wdt:P31 wd:${id}. } UNION { ?item wdt:P279 wd:${id}. } } FILTER(?item != wd:${id})`;
}

function teamsInLeague(league: string, teamClass: string): string {
  return `?item p:P118 ?leagueStmt. ?leagueStmt ps:P118 wd:${q(league)}. FILTER NOT EXISTS { ?leagueStmt pq:P582 ?leagueEnded } FILTER NOT EXISTS { ?item wdt:P576 ?teamEnded } ?item wdt:P31/wdt:P279* wd:${q(teamClass)}.`;
}

function held(position: string): string {
  return `?item wdt:P31 wd:Q5. ?item wdt:P39 wd:${q(position)}. ${notCharacter}`;
}

function awarded(award: string): string {
  return `?item wdt:P166 wd:${q(award)}.`;
}

function peopleAwarded(award: string): string {
  return `?item wdt:P31 wd:Q5. ?item wdt:P166 wd:${q(award)}. ${notCharacter}`;
}

function filmsWinning(award: string): string {
  return `?item wdt:P166 wd:${q(award)}. ${FILM}`;
}

function charactersOf(work: string): string {
  return `wd:${q(work)} wdt:P674 ?item.`;
}

function songsBy(artist: string): string {
  return `?item wdt:P175 wd:${q(artist)}. { { ?item wdt:P31 wd:Q7366. } UNION { ?item wdt:P31 wd:Q134556. } } FILTER NOT EXISTS { ?item wdt:P31 wd:Q482994 }`;
}

const FILM = '?item wdt:P31/wdt:P279* wd:Q11424.';

function directedBy(person: string): string {
  return `?item wdt:P57 wd:${q(person)}. ${FILM}`;
}

function producedBy(company: string): string {
  return `?item wdt:P272 wd:${q(company)}. ${FILM}`;
}

function seasonWinners(competition: string): string {
  return `?edition wdt:P3450 wd:${q(competition)}. ?edition wdt:P1346 ?item.`;
}

function seasonsOf(competition: string): string {
  return `?item wdt:P3450 wd:${q(competition)}.`;
}

function directSubclass(cls: string): string {
  const id = q(cls);
  return `?item wdt:P279 wd:${id}. FILTER(?item != wd:${id})`;
}

function moonsOf(planet: string): string {
  const id = q(planet);
  return `?item wdt:P397 wd:${id}. ?item wdt:P31/wdt:P279* wd:Q2537. FILTER(?item != wd:${id})`;
}

function atomicNumbers(filter: string): string {
  return `?item wdt:P31 wd:Q11344. ?item wdt:P1086 ?atomic. FILTER(${filter})`;
}

const GEO_COUNTRIES: readonly [string, string, string][] = [
  ['countries-in-africa', 'Name a country in Africa', 'Q15'],
  ['countries-in-europe', 'Name a country in Europe', 'Q46'],
  ['countries-in-asia', 'Name a country in Asia', 'Q48'],
  ['countries-in-north-america', 'Name a country in North America', 'Q49'],
];

const GEO_CAPITALS: readonly [string, string, string][] = [
  ['african-capitals', 'Name a national capital in Africa', 'Q15'],
  ['european-capitals', 'Name a national capital in Europe', 'Q46'],
  ['asian-capitals', 'Name a national capital in Asia', 'Q48'],
  ['north-american-capitals', 'Name a national capital in North America', 'Q49'],
];

const GEO_ADMIN: readonly [string, string, string][] = [
  ['us-states', 'Name a US state', 'Q35657'],
  ['japanese-prefectures', 'Name a prefecture of Japan', 'Q50337'],
  ['german-states', 'Name a state of Germany', 'Q1221156'],
  ['brazilian-states', 'Name a Brazilian state or the Federal District', 'Q485258'],
  ['swiss-cantons', 'Name a canton of Switzerland', 'Q23058'],
  ['irish-counties', 'Name a county of Ireland', 'Q179872'],
  ['london-boroughs', 'Name a London borough', 'Q211690'],
  ['mexican-states', 'Name a state of Mexico', 'Q15149663'],
  ['chinese-provinces', 'Name a province of China', 'Q1615742'],
];

const GEO_HERITAGE: readonly [string, string, string][] = [
  ['unesco-sites-in-italy', 'Name a UNESCO World Heritage Site in Italy', 'Q38'],
  ['unesco-sites-in-france', 'Name a UNESCO World Heritage Site in France', 'Q142'],
  ['unesco-sites-in-spain', 'Name a UNESCO World Heritage Site in Spain', 'Q29'],
  ['unesco-sites-in-china', 'Name a UNESCO World Heritage Site in China', 'Q148'],
  ['unesco-sites-in-germany', 'Name a UNESCO World Heritage Site in Germany', 'Q183'],
  ['unesco-sites-in-the-uk', 'Name a UNESCO World Heritage Site in the United Kingdom', 'Q145'],
  ['unesco-sites-in-mexico', 'Name a UNESCO World Heritage Site in Mexico', 'Q96'],
  ['unesco-sites-in-india', 'Name a UNESCO World Heritage Site in India', 'Q668'],
  ['unesco-sites-in-japan', 'Name a UNESCO World Heritage Site in Japan', 'Q17'],
  ['unesco-sites-in-the-us', 'Name a UNESCO World Heritage Site in the United States', 'Q30'],
];

const GEO_MEMBERS: readonly [string, string, string, 'sovereign' | 'country'][] = [
  ['un-member-states', 'Name a UN member state', 'Q1065', 'sovereign'],
  ['eu-member-states', 'Name a European Union member state', 'Q458', 'country'],
  ['nato-members', 'Name a NATO member state', 'Q7184', 'country'],
  ['commonwealth-members', 'Name a Commonwealth member state', 'Q7785', 'country'],
];

const geography: PromptDef[] = [
  ...GEO_COUNTRIES.map(([slug, question, id]) => prompt('geography', slug, question, countriesIn([id]))),
  prompt(
    'geography',
    'countries-in-central-or-south-america',
    'Name a country in Central America or South America',
    `${sovereignState()} { { ?item wdt:P30 wd:Q18. } UNION { ?item wdt:P30 wd:Q27611. } UNION { ?item wdt:P361 wd:Q27611. } }`,
  ),
  ...GEO_CAPITALS.map(([slug, question, id]) => prompt('geography', slug, question, capitalsIn(id))),
  prompt('geography', 'us-state-capitals', 'Name a US state capital', '?state wdt:P31 wd:Q35657. ?state wdt:P36 ?item.'),
  ...GEO_ADMIN.map(([slug, question, id]) => prompt('geography', slug, question, admin(id))),
  prompt(
    'geography',
    'spanish-autonomous-communities',
    'Name an autonomous community of Spain',
    `{ { ?item wdt:P31 wd:Q10742. } UNION { ?item wdt:P31 wd:Q3297051. } } ${ended}`,
  ),
  prompt(
    'geography',
    'italian-regions',
    'Name a region of Italy',
    `{ { ?item wdt:P31 wd:Q16110. } UNION { ?item wdt:P31 wd:Q1710033. } } ?item wdt:P17 wd:Q38. ${ended}`,
  ),
  prompt(
    'geography',
    'us-national-parks',
    'Name a US national park',
    `?item wdt:P31 wd:Q34918903. ${ended} ?parkArticle schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?parkName. FILTER(!CONTAINS(?parkName, "and Preserve")) FILTER(?parkName != "Chiricahua National Park")`,
  ),
  prompt(
    'geography',
    'indian-states-and-territories',
    'Name a state or union territory of India',
    `{ { ?item wdt:P31 wd:Q12443800. } UNION { ?item wdt:P31 wd:Q467745. } } ${ended}`,
  ),
  ...GEO_MEMBERS.map(([slug, question, id, mode]) => prompt('geography', slug, question, membersOf(id, mode))),
  prompt(
    'geography',
    'euro-countries',
    'Name a country that uses the euro',
    `${sovereignState()} ?item p:P38 ?cur. ?cur ps:P38 wd:Q4916. FILTER NOT EXISTS { ?cur pq:P582 ?curEnded } FILTER(?item != wd:Q954)`,
  ),
  prompt(
    'geography',
    'landlocked-countries',
    'Name a landlocked country',
    `${sovereignState()} ?item wdt:P31 wd:Q123480.`,
  ),
  prompt(
    'geography',
    'mediterranean-countries',
    'Name a country on the Mediterranean Sea',
    `${sovereignState()} ?item wdt:P206 wd:Q4918.`,
  ),
  prompt(
    'geography',
    'english-official-countries',
    'Name a country where English is an official language',
    `${sovereignState()} ?item wdt:P37 wd:Q1860.`,
  ),
  ...GEO_HERITAGE.map(([slug, question, id]) => prompt('geography', slug, question, heritageIn(id))),
];

const ANIMALS: readonly [string, string, string][] = [
  ['gibbon-species', 'Name a species of gibbon', 'Q185939'],
  ['ape-species', 'Name a species of ape', 'Q102470'],
  ['penguin-species', 'Name a species of penguin', 'Q9147'],
  ['crocodilian-species', 'Name a species of crocodile, alligator, caiman, or gharial', 'Q25363'],
  ['cobra-species', 'Name a species of cobra', 'Q220475'],
  ['python-species', 'Name a species of python', 'Q184018'],
  ['monitor-lizard-species', 'Name a species of monitor lizard', 'Q81228'],
  ['falcon-species', 'Name a species of falcon', 'Q43489'],
  ['crow-species', 'Name a species of crow or raven', 'Q43365'],
  ['seal-species', 'Name a species of seal, sea lion, or walrus', 'Q30263'],
  ['tortoise-species', 'Name a species of tortoise', 'Q46360'],
  ['crane-species', 'Name a species of crane', 'Q25365'],
  ['albatross-species', 'Name a species of albatross', 'Q55805'],
  ['toucan-species', 'Name a species of toucan', 'Q1325045'],
  ['hornbill-species', 'Name a species of hornbill', 'Q26773'],
  ['felid-species', 'Name a species in the cat family', 'Q25265'],
  ['canid-species', 'Name a species in the dog family', 'Q25324'],
  ['deer-species', 'Name a species of deer', 'Q23390'],
  ['lemur-species', 'Name a species of lemur', 'Q37212'],
  ['whale-or-dolphin-species', 'Name a species of whale or dolphin', 'Q160'],
  ['kingfisher-species', 'Name a species of kingfisher', 'Q8154335'],
  ['iguana-species', 'Name a species of iguana', 'Q235589'],
  ['newt-species', 'Name a species of newt or true salamander', 'Q319469'],
  ['flying-fox-species', 'Name a species of flying fox', 'Q185230'],
  ['woodpecker-species', 'Name a species of woodpecker', 'Q25439'],
  ['gull-species', 'Name a species of gull or tern', 'Q27589'],
  ['pheasant-species', 'Name a species of pheasant, quail, grouse, or turkey', 'Q26375'],
  ['waterfowl-species', 'Name a species of duck, goose, or swan', 'Q7556'],
  ['marsupial-species', 'Name a species of kangaroo, wallaby, koala, wombat, or possum', 'Q26332'],
  ['owl-species', 'Name a species of owl', 'Q25222'],
  ['hummingbird-species', 'Name a species of hummingbird', 'Q43624'],
  ['parrot-species', 'Name a species of parrot', 'Q31431'],
  ['viper-species', 'Name a species of viper', 'Q163656'],
  ['pigeon-species', 'Name a species of pigeon or dove', 'Q10856'],
  ['finch-species', 'Name a species of finch', 'Q160835'],
  ['squirrel-species', 'Name a species of squirrel', 'Q9482'],
  ['poison-dart-frog-species', 'Name a species of poison dart frog', 'Q53750'],
  ['bumblebee-species', 'Name a species of bumblebee', 'Q25407'],
  ['octopus-species', 'Name a species of octopus', 'Q40152'],
  ['chameleon-species', 'Name a species of chameleon', 'Q37686'],
];

const DINOS: readonly [string, string, string][] = [
  ['ceratopsian-dinosaurs', 'Name a ceratopsian dinosaur', 'Q131381'],
  ['tyrannosaurid-dinosaurs', 'Name a tyrannosaurid dinosaur', 'Q131050'],
  ['stegosaurian-dinosaurs', 'Name a stegosaurian dinosaur', 'Q131484'],
  ['ankylosaurian-dinosaurs', 'Name an ankylosaurian dinosaur', 'Q273617'],
  ['hadrosaur-dinosaurs', 'Name a hadrosaur', 'Q271841'],
  ['sauropod-dinosaurs', 'Name a sauropod dinosaur', 'Q14416'],
];

const animals: PromptDef[] = [
  {
    slug: 'great-ape-species',
    category: 'animals',
    question: 'Name a species of great ape',
    minAnswers: 8,
    extraAliases: {
      Human: ['Homo sapiens', 'humans', 'modern human'],
    },
    where: `VALUES ?item { wd:Q5 wd:Q4126704 wd:Q19537 wd:Q737838 wd:Q307157 wd:Q599672 wd:Q543424 wd:Q42564025 }`,
  },
  ...ANIMALS.map(([slug, question, id]) => prompt('animals', slug, question, species(id))),
  prompt(
    'animals',
    'rattlesnake-species',
    'Name a species of rattlesnake',
    `?item wdt:P105 wd:Q7432. ?item wdt:P225 ?binomial. { { ?item wdt:P171* wd:Q463637. } UNION { ?item wdt:P171* wd:Q244198. } } ${EXTANT}`,
  ),
  ...DINOS.map(([slug, question, id]) => prompt('animals', slug, question, genus(id))),
  prompt('animals', 'bird-orders', 'Name an order of birds', ordersIn('Q5113')),
  prompt('animals', 'dog-breeds', 'Name a dog breed', '?item wdt:P31 wd:Q39367.'),
  prompt('animals', 'cat-breeds', 'Name a cat breed', '?item wdt:P31 wd:Q43577.'),
];

const CHEESES: readonly [string, string, string][] = [
  ['french-cheeses', 'Name a French cheese', 'Q142'],
  ['italian-cheeses', 'Name an Italian cheese', 'Q38'],
  ['spanish-cheeses', 'Name a Spanish cheese', 'Q29'],
  ['british-cheeses', 'Name a British cheese', 'Q145'],
  ['dutch-cheeses', 'Name a Dutch cheese', 'Q55'],
  ['swiss-cheeses', 'Name a Swiss cheese', 'Q39'],
  ['greek-cheeses', 'Name a Greek cheese', 'Q41'],
  ['german-cheeses', 'Name a German cheese', 'Q183'],
  ['mexican-cheeses', 'Name a Mexican cheese', 'Q96'],
  ['american-cheeses', 'Name an American cheese', 'Q30'],
];

const DISHES: readonly [string, string, string][] = [
  ['french-dishes', 'Name a French dish', 'Q142'],
  ['italian-dishes', 'Name an Italian dish', 'Q38'],
  ['japanese-dishes', 'Name a Japanese dish', 'Q17'],
  ['mexican-dishes', 'Name a Mexican dish', 'Q96'],
  ['thai-dishes', 'Name a Thai dish', 'Q869'],
  ['greek-dishes', 'Name a Greek dish', 'Q41'],
  ['spanish-dishes', 'Name a Spanish dish', 'Q29'],
  ['korean-dishes', 'Name a Korean dish', 'Q884'],
  ['vietnamese-dishes', 'Name a Vietnamese dish', 'Q881'],
  ['turkish-dishes', 'Name a Turkish dish', 'Q43'],
  ['british-dishes', 'Name a British dish', 'Q145'],
  ['german-dishes', 'Name a German dish', 'Q183'],
  ['brazilian-dishes', 'Name a Brazilian dish', 'Q155'],
  ['indian-dishes', 'Name an Indian dish', 'Q668'],
  ['chinese-dishes', 'Name a Chinese dish', 'Q148'],
  ['american-dishes', 'Name an American dish', 'Q30'],
  ['indonesian-dishes', 'Name an Indonesian dish', 'Q252'],
  ['philippine-dishes', 'Name a Philippine dish', 'Q928'],
  ['egyptian-dishes', 'Name an Egyptian dish', 'Q79'],
  ['iranian-dishes', 'Name an Iranian dish', 'Q794'],
  ['argentine-dishes', 'Name an Argentine dish', 'Q414'],
  ['polish-dishes', 'Name a Polish dish', 'Q36'],
  ['swedish-dishes', 'Name a Swedish dish', 'Q34'],
  ['irish-dishes', 'Name an Irish dish', 'Q27'],
  ['nigerian-dishes', 'Name a Nigerian dish', 'Q1033'],
  ['australian-dishes', 'Name an Australian dish', 'Q408'],
];

const FOOD_KINDS: readonly [string, string, string][] = [
  ['spices', 'Name a spice', 'Q42527'],
  ['culinary-herbs', 'Name a culinary herb', 'Q207123'],
  ['fruits', 'Name a fruit', 'Q3314483'],
  ['beer-styles', 'Name a beer style', 'Q1998962'],
  ['coffee-drinks', 'Name a coffee drink', 'Q37756327'],
  ['wine-grapes', 'Name a wine grape', 'Q139941266'],
  ['breads', 'Name a kind of bread', 'Q7802'],
  ['sushi', 'Name a kind of sushi', 'Q46383'],
  ['soups', 'Name a soup', 'Q41415'],
  ['sausages', 'Name a sausage', 'Q131419'],
  ['pastries', 'Name a pastry', 'Q477248'],
  ['condiments', 'Name a condiment', 'Q2596997'],
  ['distilled-spirits', 'Name a distilled spirit', 'Q56139'],
  ['liqueurs', 'Name a liqueur', 'Q178780'],
  ['cooking-methods', 'Name a cooking method', 'Q11795121'],
  ['beef-cuts', 'Name a cut of beef', 'Q2051651'],
];

const food: PromptDef[] = [
  ...CHEESES.filter(([slug]) => slug !== 'british-cheeses').map(([slug, question, id]) => prompt('food', slug, question, cheesesFrom(id))),
  prompt(
    'food',
    'british-cheeses',
    'Name a British cheese',
    '{ { ?item wdt:P31 wd:Q10943. } UNION { ?item wdt:P279 wd:Q10943. } } { { ?item wdt:P495 wd:Q145. } UNION { ?item wdt:P495 wd:Q21. } UNION { ?item wdt:P495 wd:Q22. } UNION { ?item wdt:P495 wd:Q25. } UNION { ?item wdt:P17 wd:Q145. } UNION { ?item wdt:P17 wd:Q21. } UNION { ?item wdt:P17 wd:Q22. } UNION { ?item wdt:P17 wd:Q25. } } FILTER(?item != wd:Q10943)',
  ),
  ...DISHES.map(([slug, question, id]) => prompt('food', slug, question, dishesFrom(id))),
  ...FOOD_KINDS.map(([slug, question, id]) => prompt('food', slug, question, kindsOf(id))),
  prompt('food', 'citrus-fruits', 'Name a citrus fruit', species('Q81513')),
  prompt(
    'food',
    'pasta-shapes',
    'Name a pasta shape',
    '{ { ?item wdt:P31 wd:Q2625877. } UNION { ?item wdt:P279 wd:Q178. } UNION { ?item wdt:P31 wd:Q178. } } FILTER(?item != wd:Q178)',
  ),
  prompt(
    'food',
    'iba-cocktails',
    'Name an IBA official cocktail',
    '{ { ?item wdt:P31 wd:Q2536409. } UNION { ?item wdt:P361 wd:Q2536409. } } FILTER(?item != wd:Q2536409)',
  ),
];

const LEAGUES: readonly [string, string, string, string][] = [
  ['nba-teams', 'Name a current NBA team', 'Q155223', 'Q13393265'],
  ['nfl-teams', 'Name a current NFL team', 'Q1215884', 'Q17156793'],
  ['mlb-teams', 'Name a current MLB team', 'Q1163715', 'Q13027888'],
  ['nhl-teams', 'Name a current NHL team', 'Q1215892', 'Q4498974'],
  ['premier-league-clubs', 'Name a current Premier League club', 'Q9448', 'Q476028'],
  ['la-liga-clubs', 'Name a current La Liga club', 'Q324867', 'Q476028'],
  ['bundesliga-clubs', 'Name a current Bundesliga club', 'Q82595', 'Q476028'],
  ['serie-a-clubs', 'Name a current Serie A club', 'Q15804', 'Q476028'],
  ['ligue-1-clubs', 'Name a current Ligue 1 club', 'Q13394', 'Q476028'],
  ['mls-clubs', 'Name a current MLS club', 'Q18543', 'Q476028'],
  ['primeira-liga-clubs', 'Name a current Primeira Liga club', 'Q182994', 'Q476028'],
  ['eredivisie-clubs', 'Name a current Eredivisie club', 'Q167541', 'Q476028'],
  ['scottish-premiership-clubs', 'Name a current Scottish Premiership club', 'Q14377162', 'Q476028'],
  ['j1-league-clubs', 'Name a current J1 League club', 'Q276445', 'Q476028'],
  ['brasileirao-clubs', 'Name a current Campeonato Brasileiro Série A club', 'Q206813', 'Q476028'],
  ['liga-mx-clubs', 'Name a current Liga MX club', 'Q764690', 'Q476028'],
  ['a-league-clubs', 'Name a current A-League Men club', 'Q219586', 'Q476028'],
  ['belgian-pro-league-clubs', 'Name a current Belgian Pro League club', 'Q216022', 'Q476028'],
];

const CUP_NAME = 'FILTER(LANG(?cupName) = "en" && REGEX(STR(?cupName), "^[0-9]{4} FIFA World Cup$"))';

const sports: PromptDef[] = [
  ...LEAGUES.map(([slug, question, league, teamClass]) => prompt('sports', slug, question, teamsInLeague(league, teamClass))),
  prompt('sports', 'champions-league-winners', 'Name a club that has won the European Cup or UEFA Champions League', seasonWinners('Q18756')),
  prompt('sports', 'world-series-winners', 'Name a World Series winning team', seasonWinners('Q265538')),
  prompt('sports', 'super-bowl-winners', 'Name a Super Bowl winning team', '?item wdt:P2522 wd:Q32096. ?item wdt:P31/wdt:P279* wd:Q17156793.'),
  prompt('sports', 'stanley-cup-winners', 'Name a Stanley Cup winning team', '?item wdt:P2522 wd:Q211872. ?item wdt:P31/wdt:P279* wd:Q4498974.'),
  prompt('sports', 'tour-de-france-winners', 'Name a winner of the Tour de France', '?item wdt:P2522 wd:Q33881. ?item wdt:P31 wd:Q5.'),
  prompt('sports', 'summer-olympics', 'Name a Summer Olympics', seasonsOf('Q159821')),
  prompt(
    'sports',
    'paris-2024-sports',
    'Name a sport at the 2024 Summer Olympics',
    '?event wdt:P361 wd:Q995653. ?event wdt:P641 ?item. FILTER(?item != wd:Q212434)',
  ),
  prompt(
    'sports',
    'martial-arts',
    'Name a martial art',
    `${kindsOf('Q11417')} FILTER NOT EXISTS { ?item wdt:P31 wd:Q43229 } ?art schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?artName. FILTER(!REGEX(?artName, "(?i)(institute|federation|association|championship|university)"))`,
  ),
  prompt(
    'sports',
    'combat-sports',
    'Name a combat sport',
    `${kindsOf('Q7128792')} ?art schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?artName. FILTER(!REGEX(?artName, "(?i)(lock|technique|institute|championship)"))`,
  ),
  prompt(
    'sports',
    'spiel-des-jahres',
    'Name a Spiel des Jahres winner',
    '?item wdt:P166 wd:Q1128609. FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }',
  ),
  prompt(
    'sports',
    'fifa-world-cup-tournaments',
    'Name a FIFA World Cup tournament',
    `?item wdt:P3450 wd:Q19317. ?item rdfs:label ?cupName. ${CUP_NAME}`,
  ),
  prompt(
    'sports',
    'summer-olympics-host-countries',
    'Name a country that has hosted the Summer Olympics',
    '?games wdt:P3450 wd:Q159821. ?games wdt:P585 ?when. FILTER(YEAR(?when) <= 2026) ?games wdt:P17 ?item.',
  ),
  prompt(
    'sports',
    'summer-olympics-host-cities',
    'Name a city that has hosted the Summer Olympics',
    '?games wdt:P3450 wd:Q159821. ?games wdt:P585 ?when. FILTER(YEAR(?when) <= 2026) ?games wdt:P276 ?item.',
  ),
  prompt(
    'sports',
    'world-cup-host-countries',
    'Name a country that has hosted the FIFA World Cup',
    `?edition wdt:P3450 wd:Q19317. ?edition rdfs:label ?cupName. ${CUP_NAME} ?edition wdt:P585 ?when. FILTER(YEAR(?when) <= 2026) ?edition wdt:P17 ?item.`,
  ),
];

const SHOWS: readonly [string, string, string][] = [
  ['stranger-things-characters', 'Name a Stranger Things character', 'Q19798734'],
  ['friends-characters', 'Name a Friends character', 'Q79784'],
  ['breaking-bad-characters', 'Name a Breaking Bad character', 'Q1079'],
  ['game-of-thrones-characters', 'Name a Game of Thrones character', 'Q23572'],
  ['the-office-characters', 'Name a character from The Office (US)', 'Q23831'],
  ['parks-and-recreation-characters', 'Name a Parks and Recreation character', 'Q218035'],
  ['brooklyn-nine-nine-characters', 'Name a Brooklyn Nine-Nine character', 'Q13417244'],
  ['avatar-characters', 'Name an Avatar: The Last Airbender character', 'Q11572'],
  ['spongebob-characters', 'Name a SpongeBob SquarePants character', 'Q83279'],
  ['doctor-who-characters', 'Name a Doctor Who character', 'Q34316'],
];

const DIRECTORS: readonly [string, string, string][] = [
  ['hitchcock-films', 'Name an Alfred Hitchcock film', 'Q7374'],
  ['spielberg-films', 'Name a Steven Spielberg film', 'Q8877'],
  ['scorsese-films', 'Name a Martin Scorsese film', 'Q41148'],
  ['miyazaki-films', 'Name a Hayao Miyazaki film', 'Q55400'],
];

const STUDIOS: readonly [string, string, string][] = [
  ['pixar-films', 'Name a Pixar film', 'Q127552'],
  ['ghibli-films', 'Name a Studio Ghibli film', 'Q182950'],
  ['disney-animated-films', 'Name a Walt Disney Animation Studios film', 'Q1047410'],
];

const screen: PromptDef[] = [
  ...SHOWS.map(([slug, question, id]) => {
    const def = prompt('screen', slug, question, charactersOf(id));
    if (slug === 'stranger-things-characters') def.seoNoun = 'Stranger Things characters';
    return def;
  }),
  prompt('screen', 'harry-potter-characters', 'Name a Harry Potter character', charactersOf('Q8337')),
  ...DIRECTORS.map(([slug, question, id]) => prompt('screen', slug, question, directedBy(id))),
  ...STUDIOS.map(([slug, question, id]) => prompt('screen', slug, question, producedBy(id))),
  prompt(
    'screen',
    'pixar-characters',
    'Name a Pixar character',
    '?film wdt:P272 wd:Q127552. ?film wdt:P31/wdt:P279* wd:Q11424. ?film wdt:P674 ?item.',
  ),
  prompt(
    'screen',
    'ghibli-characters',
    'Name a Studio Ghibli character',
    '?film wdt:P272 wd:Q182950. ?film wdt:P31/wdt:P279* wd:Q11424. ?film wdt:P674 ?item.',
  ),
  prompt(
    'screen',
    'star-wars-films',
    'Name a Star Wars film',
    '?item p:P179 ?starWarsSeries. ?starWarsSeries ps:P179 wd:Q22092344. ?item wdt:P31/wdt:P279* wd:Q11424.',
  ),
  prompt(
    'screen',
    'star-trek-films',
    'Name a Star Trek film',
    '{ { ?item wdt:P179 wd:Q1092. } UNION { ?item wdt:P361 wd:Q1092. } } ?item wdt:P31/wdt:P279* wd:Q11424.',
  ),
  prompt(
    'screen',
    'james-bond-films',
    'Name a James Bond film',
    '?item wdt:P31/wdt:P279* wd:Q11424. wd:Q2009573 wdt:P1441 ?item.',
  ),
  prompt(
    'screen',
    'james-bond-characters',
    'Name a James Bond character',
    '?film wdt:P31 wd:Q11424. wd:Q2009573 wdt:P1441 ?film. ?item wdt:P1441 ?film. ?item wdt:P31/wdt:P279* wd:Q95074.',
  ),
  prompt('screen', 'best-picture-winners', 'Name a Best Picture winner', filmsWinning('Q102427')),
  prompt('screen', 'palme-dor-films', "Name a film that won the Palme d'Or", filmsWinning('Q179808')),
  prompt(
    'screen',
    'best-animated-feature-films',
    'Name a film that won the Oscar for Best Animated Feature',
    filmsWinning('Q106800'),
  ),
  prompt(
    'screen',
    'best-director-winners',
    'Name a winner of the Academy Award for Best Director',
    peopleAwarded('Q103360'),
  ),
  prompt(
    'screen',
    'tony-best-musical-winners',
    'Name a Tony Award for Best Musical winner',
    awarded('Q1780176'),
  ),
  prompt(
    'screen',
    'pokemon-types',
    'Name a Pokémon type',
    '?item wdt:P31 wd:Q1266830. FILTER NOT EXISTS { ?item rdfs:label "???"@en }',
  ),
  prompt(
    'screen',
    'generation-one-pokemon',
    'Name a Generation I Pokémon',
    '?item wdt:P31 wd:Q3966183. ?item wdt:P1685 ?dex. FILTER(?dex >= 1 && ?dex <= 151)',
  ),
  prompt('screen', 'minecraft-mobs', 'Name a Minecraft mob', '?item wdt:P31 wd:Q113904998.'),
  prompt(
    'screen',
    'smash-ultimate-fighters',
    'Name a fighter in Super Smash Bros. Ultimate',
    charactersOf('Q54093632'),
  ),
  prompt(
    'screen',
    'mcu-films',
    'Name a Marvel Cinematic Universe film',
    '?item wdt:P179 wd:Q642878. ?item wdt:P31/wdt:P279* wd:Q11424.',
  ),
];

const ARTISTS: readonly [string, string, string][] = [
  ['beatles-songs', 'Name a Beatles song', 'Q1299'],
  ['queen-songs', 'Name a Queen song', 'Q15862'],
  ['abba-songs', 'Name an ABBA song', 'Q18233'],
  ['pink-floyd-songs', 'Name a Pink Floyd song', 'Q2306'],
  ['radiohead-songs', 'Name a Radiohead song', 'Q44190'],
  ['nirvana-songs', 'Name a Nirvana song', 'Q11649'],
  ['led-zeppelin-songs', 'Name a Led Zeppelin song', 'Q2331'],
  ['david-bowie-songs', 'Name a David Bowie song', 'Q5383'],
  ['michael-jackson-songs', 'Name a Michael Jackson song', 'Q2831'],
  ['taylor-swift-songs', 'Name a Taylor Swift song', 'Q26876'],
  ['rolling-stones-songs', 'Name a Rolling Stones song', 'Q11036'],
  ['beyonce-songs', 'Name a Beyoncé song', 'Q36153'],
  ['elvis-songs', 'Name an Elvis Presley song', 'Q303'],
  ['madonna-songs', 'Name a Madonna song', 'Q1744'],
  ['bob-dylan-songs', 'Name a Bob Dylan song', 'Q392'],
  ['u2-songs', 'Name a U2 song', 'Q396'],
  ['metallica-songs', 'Name a Metallica song', 'Q15920'],
  ['eminem-songs', 'Name an Eminem song', 'Q5608'],
  ['prince-songs', 'Name a Prince song', 'Q7542'],
  ['the-who-songs', 'Name a song by The Who', 'Q93346'],
];

const INSTRUMENTS: readonly [string, string, string][] = [
  ['woodwind-instruments', 'Name a woodwind instrument', 'Q181247'],
  ['brass-instruments', 'Name a brass instrument', 'Q180744'],
  ['string-instruments', 'Name a string instrument', 'Q1798603'],
  ['percussion-instruments', 'Name a percussion instrument', 'Q133163'],
  ['keyboard-instruments', 'Name a keyboard instrument', 'Q52954'],
];

const GENRES: readonly [string, string, string][] = [
  ['music-genres', 'Name a genre of music', 'Q188451'],
  ['rock-genres', 'Name a genre of rock music', 'Q11399'],
  ['jazz-genres', 'Name a genre of jazz', 'Q8341'],
  ['hip-hop-genres', 'Name a genre of hip-hop', 'Q11401'],
  ['electronic-genres', 'Name a genre of electronic music', 'Q9778'],
  ['folk-genres', 'Name a genre of folk music', 'Q43343'],
  ['classical-genres', 'Name a genre of classical music', 'Q9730'],
];

const music: PromptDef[] = [
  ...ARTISTS.map(([slug, question, id]) => prompt('music', slug, question, songsBy(id))),
  ...INSTRUMENTS.map(([slug, question, id]) =>
    prompt(
      'music',
      slug,
      question,
      slug === 'string-instruments'
        ? `?item wdt:P31 wd:Q34379. ?item wdt:P279* wd:${q(id)}. FILTER(?item != wd:${q(id)})`
        : `?item wdt:P279* wd:${q(id)}. FILTER(?item != wd:${q(id)})`,
    ),
  ),
  ...GENRES.map(([slug, question, id]) =>
    prompt(
      'music',
      slug,
      question,
      slug === 'folk-genres'
        ? `?item wdt:P279* wd:${q(id)}. FILTER(?item != wd:${q(id)})`
        : directSubclass(id),
    ),
  ),
  prompt(
    'music',
    'national-anthems',
    'Name a national anthem',
    '?country wdt:P31 wd:Q3624078. FILTER NOT EXISTS { ?country wdt:P576 ?countryEnded } ?country wdt:P85 ?item.',
  ),
  prompt(
    'music',
    'christmas-carols',
    'Name a Christmas carol',
    '?item wdt:P31/wdt:P279* wd:Q503354. FILTER(?item != wd:Q503354)',
  ),
  prompt('music', 'nursery-rhymes', 'Name a nursery rhyme', '?item wdt:P31 wd:Q1123037.'),
  prompt('music', 'sea-shanties', 'Name a sea shanty', '?item wdt:P31 wd:Q1195253.'),
  prompt(
    'music',
    'verdi-operas',
    'Name an opera by Giuseppe Verdi',
    '?item wdt:P86 wd:Q7317. { { ?item wdt:P136 wd:Q1344. } UNION { ?item wdt:P31 wd:Q1344. } }',
  ),
  prompt(
    'music',
    'mozart-operas',
    'Name an opera by Mozart',
    '?item wdt:P86 wd:Q254. { { ?item wdt:P136 wd:Q1344. } UNION { ?item wdt:P31 wd:Q1344. } }',
  ),
  prompt(
    'music',
    'beethoven-piano-sonatas',
    'Name a piano sonata by Beethoven',
    '?item wdt:P86 wd:Q255. { { ?item wdt:P31 wd:Q1546995. } UNION { ?item wdt:P136 wd:Q1546995. } }',
  ),
  prompt(
    'music',
    'grammy-album-of-the-year',
    'Name an album that won the Grammy for Album of the Year',
    '?item wdt:P166 wd:Q904528. ?item wdt:P31/wdt:P279* wd:Q482994.',
  ),
  prompt(
    'music',
    'grammy-record-of-the-year',
    'Name a Grammy Award for Record of the Year winner',
    '?item wdt:P166 wd:Q843219.',
  ),
  prompt('music', 'dances', 'Name a dance', kindsOf('Q11639')),
];

const science: PromptDef[] = [
  prompt(
    'science',
    'chemical-elements',
    'Name a chemical element',
    '?item wdt:P31 wd:Q11344. ?item wdt:P1086 ?atomic. FILTER(?atomic >= 1 && ?atomic <= 118)',
    true,
  ),
  prompt(
    'science',
    'transition-metals',
    'Name a transition metal',
    atomicNumbers('(?atomic >= 21 && ?atomic <= 30) || (?atomic >= 39 && ?atomic <= 48) || (?atomic >= 72 && ?atomic <= 80) || (?atomic >= 104 && ?atomic <= 112)'),
  ),
  prompt('science', 'lanthanides', 'Name a lanthanide', atomicNumbers('?atomic >= 57 && ?atomic <= 71')),
  prompt('science', 'actinides', 'Name an actinide', atomicNumbers('?atomic >= 89 && ?atomic <= 103')),
  prompt(
    'science',
    'planets-and-dwarf-planets',
    'Name a planet or dwarf planet',
    '{ { ?item wdt:P31/wdt:P279* wd:Q634. } UNION { ?item wdt:P31/wdt:P279* wd:Q2199. } } { { ?item wdt:P361 wd:Q544. } UNION { ?item wdt:P397 wd:Q525. } } FILTER(?item != wd:Q525) FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q2537 }',
  ),
  prompt('science', 'moons-of-jupiter', 'Name a moon of Jupiter', moonsOf('Q319')),
  prompt('science', 'moons-of-saturn', 'Name a moon of Saturn', moonsOf('Q193')),
  prompt('science', 'moons-of-uranus', 'Name a moon of Uranus', moonsOf('Q324')),
  prompt('science', 'moons-of-neptune', 'Name a moon of Neptune', moonsOf('Q332')),
  prompt('science', 'constellations', 'Name a constellation', `?item wdt:P31 wd:Q8928. ${ended}`),
  prompt(
    'science',
    'messier-objects',
    'Name a Messier object',
    '{ { ?item wdt:P361 wd:Q14530. } UNION { wd:Q14530 wdt:P527 ?item. } } FILTER(?item != wd:Q14530)',
  ),
  prompt('science', 'proteinogenic-amino-acids', 'Name a proteinogenic amino acid', '?item wdt:P31 wd:Q3241589.'),
  prompt('science', 'vitamins', 'Name a vitamin', kindsOf('Q34956')),
  prompt(
    'science',
    'human-chromosomes',
    'Name a human chromosome',
    `VALUES ?chrLabel { ${[
      ...Array.from({ length: 22 }, (_, index) => `"human chromosome ${index + 1}"@en`),
      '"human chromosome X"@en',
      '"human chromosome Y"@en',
    ].join(' ')} } ?item rdfs:label ?chrLabel.`,
  ),
  prompt('science', 'tectonic-plates', 'Name a tectonic plate', '?item wdt:P31 wd:Q215680.'),
  prompt('science', 'igneous-rocks', 'Name an igneous rock', kindsOf('Q42045')),
  prompt('science', 'sedimentary-rocks', 'Name a sedimentary rock', kindsOf('Q82480')),
  prompt('science', 'metamorphic-rocks', 'Name a metamorphic rock', kindsOf('Q47069')),
  prompt('science', 'gemstones', 'Name a gemstone', kindsOf('Q83437')),
  prompt(
    'science',
    'programming-languages-before-1980',
    'Name a programming language created before 1980',
    '?item wdt:P31 wd:Q9143. ?item wdt:P571 ?inception. FILTER(YEAR(?inception) < 1980 && YEAR(?inception) > 1800)',
  ),
  prompt('science', 'sorting-algorithms', 'Name a sorting algorithm', '?item wdt:P31 wd:Q181593.'),
  prompt('science', 'data-structures', 'Name a data structure', kindsOf('Q175263')),
  prompt('science', 'si-units', 'Name an SI unit', '?item wdt:P31 wd:Q68618328.'),
  prompt(
    'science',
    'si-prefixes',
    'Name an SI prefix',
    '?item wdt:P31 wd:Q131299. FILTER NOT EXISTS { ?item rdfs:label ?prefixLabel. FILTER(LANG(?prefixLabel) = "en" && REGEX(STR(?prefixLabel), "^(?i)(demi|semi)-?$")) }',
  ),
  prompt('science', 'elementary-particles', 'Name an elementary particle', kindsOf('Q43116')),
  prompt('science', 'space-stations', 'Name a space station', '?item wdt:P31 wd:Q25956.'),
  prompt('science', 'space-telescopes', 'Name a space telescope', kindsOf('Q148578')),
  prompt(
    'science',
    'apollo-missions',
    'Name an Apollo program mission',
    '?item wdt:P361 wd:Q46611. ?item rdfs:label ?apolloName. FILTER(LANG(?apolloName) = "en" && REGEX(STR(?apolloName), "^Apollo ([0-9]|1[0-9])$"))',
  ),
  prompt('science', 'nobel-physics-laureates', 'Name a Nobel laureate in Physics', peopleAwarded('Q38104')),
  prompt('science', 'nobel-chemistry-laureates', 'Name a Nobel laureate in Chemistry', peopleAwarded('Q44585')),
  prompt(
    'science',
    'nobel-medicine-laureates',
    'Name a Nobel laureate in Physiology or Medicine',
    peopleAwarded('Q80061'),
  ),
  prompt('science', 'fields-medalists', 'Name a Fields medalist', peopleAwarded('Q28835')),
  prompt('science', 'turing-award-winners', 'Name a Turing Award winner', peopleAwarded('Q185667')),
  prompt(
    'science',
    'local-group-galaxies',
    'Name a galaxy in the Local Group',
    '?item wdt:P361 wd:Q3944. ?item wdt:P31 wd:Q318. FILTER(?item != wd:Q3944)',
  ),
  prompt('science', 'hormones', 'Name a hormone', kindsOf('Q11364')),
  prompt('science', 'neurotransmitters', 'Name a neurotransmitter', kindsOf('Q162657')),
  prompt('science', 'functional-groups', 'Name a functional group', kindsOf('Q170409')),
  prompt('science', 'human-bones', 'Name a human bone', kindsOf('Q25513701')),
  prompt(
    'science',
    'human-muscles',
    'Name a human muscle',
    '{ { ?item wdt:P31 wd:Q7365. } UNION { ?item wdt:P279 wd:Q7365. } } ?item wdt:P703 wd:Q5. FILTER(?item != wd:Q7365)',
  ),
];

const OFFICES: readonly [string, string, string][] = [
  ['us-presidents', 'Name a president of the United States', 'Q11696'],
  ['us-vice-presidents', 'Name a vice president of the United States', 'Q11699'],
  ['uk-prime-ministers', 'Name a prime minister of the United Kingdom', 'Q14211'],
  ['canadian-prime-ministers', 'Name a prime minister of Canada', 'Q839078'],
  ['australian-prime-ministers', 'Name a prime minister of Australia', 'Q319145'],
  ['indian-prime-ministers', 'Name a prime minister of India', 'Q192711'],
  ['french-presidents', 'Name a president of France', 'Q191954'],
  ['english-monarchs', 'Name a monarch of England', 'Q18810062'],
  ['us-chief-justices', 'Name a chief justice of the United States', 'Q11147'],
  ['us-associate-justices', 'Name an associate justice of the US Supreme Court', 'Q11144'],
  ['us-first-ladies', 'Name a first lady of the United States', 'Q7166256'],
  ['popes', 'Name a pope', 'Q19546'],
  ['roman-emperors', 'Name a Roman emperor', 'Q842606'],
  ['holy-roman-emperors', 'Name a Holy Roman Emperor', 'Q181765'],
  ['ottoman-sultans', 'Name an Ottoman sultan', 'Q15315411'],
  ['mughal-emperors', 'Name a Mughal emperor', 'Q15390704'],
  ['pharaohs', 'Name a pharaoh', 'Q37110'],
];

const history: PromptDef[] = [
  ...OFFICES.map(([slug, question, id]) => prompt('history', slug, question, held(id))),
  prompt(
    'history',
    'bible-books',
    'Name a book of the Protestant Bible',
    '?item wdt:P31 wd:Q29154430.',
    false,
    { extraAliases: { 'Song of Songs': ['Song of Solomon', 'Canticle of Canticles'] } },
  ),
  prompt('history', 'greek-deities', 'Name a Greek deity', '?item wdt:P31 wd:Q22989102.'),
  prompt('history', 'norse-deities', 'Name a Norse deity', '?item wdt:P31 wd:Q16513881.'),
  prompt(
    'history',
    'language-families',
    'Name a language family',
    '?item wdt:P31 wd:Q25295. FILTER NOT EXISTS { ?item wdt:P31 wd:Q34770 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q315 }',
  ),
  prompt('history', 'constructed-languages', 'Name a constructed language', '?item wdt:P31 wd:Q33215.'),
  prompt('history', 'writing-systems', 'Name a writing system', '?item wdt:P31 wd:Q8192.'),
  prompt('history', 'chinese-dynasties', 'Name a Chinese dynasty', '?item wdt:P31 wd:Q12857432.'),
  prompt(
    'history',
    'us-constitutional-amendments',
    'Name an amendment to the United States Constitution',
    '?item wdt:P31 wd:Q102410240. FILTER NOT EXISTS { ?item rdfs:label ?rightsLabel. FILTER(LANG(?rightsLabel) = "en" && CONTAINS(LCASE(STR(?rightsLabel)), "bill of rights")) }',
  ),
  prompt(
    'history',
    'decades',
    'Name a decade since the 1800s',
    '?item wdt:P31 wd:Q39911. ?item rdfs:label ?decadeName. FILTER(LANG(?decadeName) = "en" && REGEX(STR(?decadeName), "^(18[0-9]{2}|19[0-9]{2}|20[0-2][0-9])s$"))',
  ),
  prompt(
    'history',
    'centuries',
    'Name a century from the 1st century through the 21st century',
    '?item wdt:P31 wd:Q578. ?item rdfs:label ?centuryName. FILTER(LANG(?centuryName) = "en" && REGEX(STR(?centuryName), "^(1st|2nd|3rd|[4-9]th|1[0-9]th|20th|21st) century$"))',
  ),
  prompt('history', 'soviet-republics', 'Name a republic of the Soviet Union', 'wd:Q15180 wdt:P150 ?item.'),
  prompt(
    'history',
    'declaration-signers',
    'Name a signer of the United States Declaration of Independence',
    '{ { wd:Q127912 wdt:P1891 ?item. } UNION { ?item wdt:P1344 wd:Q127912. } }',
  ),
  {
    slug: 'english-interjections',
    category: 'history',
    question: 'Name an English interjection',
    seoNoun: 'English interjections',
    lexemeCategory: 'Q83034',
  },
];

export const PROMPT_DEFS: readonly PromptDef[] = [
  ...geography,
  ...animals,
  ...food,
  ...sports,
  ...screen,
  ...music,
  ...science,
  ...history,
];

export function assertPromptDefs(): void {
  const slugs = new Set<string>();
  const counts = new Map<CategoryKey, number>();
  for (const category of CATEGORY_ORDER) counts.set(category, 0);
  for (const def of PROMPT_DEFS) {
    if (slugs.has(def.slug)) throw new Error(`duplicate slug ${def.slug}`);
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(def.slug)) throw new Error(`bad slug ${def.slug}`);
    if (def.question.trim().length < 8) throw new Error(`bad question ${def.slug}`);
    if (def.seoNoun && def.seoNoun.length > 80) throw new Error(`seoNoun too long ${def.slug}`);
    if (def.minAnswers != null && def.slug !== 'great-ape-species') {
      throw new Error(`${def.slug} cannot set a custom answer minimum`);
    }
    if (def.slug === 'great-ape-species' && def.minAnswers !== 8) {
      throw new Error('great-ape-species must allow 8 answers');
    }
    if (def.slug === 'stranger-things-characters' && def.seoNoun !== 'Stranger Things characters') {
      throw new Error('stranger-things-characters needs seoNoun');
    }
    if (def.slug === 'english-interjections' && def.seoNoun !== 'English interjections') {
      throw new Error('english-interjections needs seoNoun');
    }
    if (!def.where && !def.lexemeCategory) throw new Error(`no source ${def.slug}`);
    if (def.where && !def.where.includes('?item')) throw new Error(`where does not bind ?item: ${def.slug}`);
    if (!CATEGORY_ORDER.includes(def.category)) throw new Error(`bad category ${def.slug}`);
    slugs.add(def.slug);
    counts.set(def.category, (counts.get(def.category) ?? 0) + 1);
  }
  for (const category of CATEGORY_ORDER) {
    const count = counts.get(category) ?? 0;
    if (count < 30) throw new Error(`${category} defines only ${count} prompts`);
  }
}
