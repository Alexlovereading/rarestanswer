/**
 * Extra SEO lines for one answer page, keyed by prompt slug.
 * The shared opening names the rarest answer once, then the backup picks.
 * A scope sentence may add a distinction that opening does not already say.
 * Do not repeat the rarest name, "the rarest … is", or "backup picks".
 *
 * `ANSWER_TITLE_NOUNS` is an optional singular title noun, already in title case.
 * It replaces the noun taken from the question: "Rarest <noun>?".
 * `ANSWER_TITLE_TAILS` is the count clause when that short noun would drop a
 * proper name ("All 49 Record of the Year Ranked").
 * `ANSWER_TITLE_TOKEN_SYNONYMS` maps a capitalised question token to a phrase
 * that may stand in for it. The phrase has to appear in the title.
 * `ANSWER_QUERY_SYNONYMS` is search wording used once in the description or intro.
 *
 * `answerDescriptionNote` is one sentence the meta description must keep.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANSWER_SEO_SENTENCES: Readonly<Record<string, string>> = {};

/** Singular title noun, keyed by prompt slug. Absent slugs use the question. */
export const ANSWER_TITLE_NOUNS: Readonly<Record<string, string>> = {
  'great-ape-species': 'Species of Great Ape',
  'grammy-record-of-the-year': 'Grammy Winner',
  'emmy-comedy-series': 'Primetime Emmy Comedy Series',
  'f1-constructors-champions': "Formula One Constructors' Champion",
  'unesco-sites-in-the-uk': 'UNESCO World Heritage Site in the UK',
  'unesco-sites-in-the-us': 'UNESCO World Heritage Site in the US',
  // The question noun does not fit in 60 characters, or the derived noun is
  // plural. Each entry is a short singular form of the same question.
  'best-actress-winners': 'Best Actress Oscar Winner',
  'best-animated-feature-films': 'Best Animated Feature Oscar Winner',
  'best-director-winners': 'Best Director Oscar Winner',
  'best-supporting-actor-winners': 'Best Supporting Actor Oscar Winner',
  'best-supporting-actress-winners': 'Best Supporting Actress Oscar Winner',
  centuries: 'Century (1st to 21st)',
  'champions-league-winners': 'Champions League Winner',
  'countries-in-central-or-south-america': 'Country in Central or South America',
  'crocodilian-species': 'Crocodile or Alligator Species',
  'declaration-signers': 'Declaration of Independence Signer',
  'doctor-who-incarnations': 'Doctor Who Incarnation',
  'english-interjections': 'English Interjection',
  'english-official-countries': 'Country Where English Is Official',
  'lotr-characters': 'Lord of the Rings Character',
  'marsupial-species': 'Marsupial Species',
  'mcu-characters': 'MCU Character',
  'pheasant-species': 'Pheasant or Quail Species',
  'simpsons-characters': 'Simpsons Character',
  'stranger-things-characters': 'Stranger Things Character',
  'us-constitutional-amendments': 'Constitutional Amendment',
  'world-wonders': 'Wonder of the World',
};

/**
 * Words after "All <N> " in the title. The clause already ends with "Ranked".
 * Used when the short noun would hide a proper name that still fits in the tail.
 */
export const ANSWER_TITLE_TAILS: Readonly<Record<string, string>> = {
  'grammy-record-of-the-year': 'Record of the Year Ranked',
};

/**
 * Lowercase question token → phrase that may replace it in the title.
 * The phrase has to appear in the title, so "Award" can become "Winner".
 */
export const ANSWER_TITLE_TOKEN_SYNONYMS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'grammy-record-of-the-year': {
    award: 'Winner',
  },
  'emmy-comedy-series': {
    award: 'Emmy',
    outstanding: 'Comedy',
  },
  'f1-constructors-champions': {
    world: 'Formula One',
  },
  'unesco-sites-in-the-uk': {
    united: 'UK',
    kingdom: 'UK',
  },
  'unesco-sites-in-the-us': {
    united: 'US',
    states: 'US',
  },
};

/** Search wording used once in the description or the intro. */
export const ANSWER_QUERY_SYNONYMS: Readonly<Record<string, string>> = {
  'ghibli-films': 'movie',
  'champions-league-winners': 'Champions League',
  'grammy-record-of-the-year': 'Grammy winner',
  'chemical-elements': 'rare chemical element',
};

const GREAT_APE_DESCRIPTION_NOTE = 'Subspecies like Cross River gorilla are covered.';

/**
 * Fossil names that have appeared on the ape-species list.
 * Mention one only when that published file still contains it.
 */
const APE_FOSSIL_EXAMPLES = [
  'Lufengpithecus hudienensis',
  'Ankarapithecus meteai',
  'Ugandapithecus major',
  'Dali Man',
  'Pongo grovesei',
] as const;

let apeScopeCache: string | undefined;

function readApeSpecies(): string {
  const fromCwd = join(process.cwd(), 'src/data/prompts/ape-species.json');
  const fromHere = fileURLToPath(new URL('../data/prompts/ape-species.json', import.meta.url));
  for (const path of [fromCwd, fromHere]) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      // try the next path
    }
  }
  return '';
}

/** Living great apes versus the broader ape list. The fossil example is read from data. */
function greatApeScope(): string {
  if (apeScopeCache) return apeScopeCache;
  const text = readApeSpecies();
  const fossil = APE_FOSSIL_EXAMPLES.find((name) => text.includes(`"name": "${name}"`));
  const fossilClause = fossil ? ` It also includes fossil names such as ${fossil}.` : '';
  apeScopeCache = `This list is the living great ape species. Subspecies such as Cross River gorilla and mountain gorilla count as their species, Western gorilla and Eastern gorilla, not as separate answers. The ape species list is broader and includes gibbons.${fossilClause} Lemurs are a separate list.`;
  return apeScopeCache;
}

/** One sentence the meta description keeps. Absent slugs use the shared pattern. */
export function answerDescriptionNote(slug: string): string | undefined {
  const note = slug === 'great-ape-species' ? GREAT_APE_DESCRIPTION_NOTE : undefined;
  const clean = note?.replace(/\s+/g, ' ').trim();
  return clean || undefined;
}

export function answerSeoSentence(slug: string): string | undefined {
  const sentence =
    slug === 'great-ape-species'
      ? greatApeScope()
      : ANSWER_SEO_SENTENCES[slug];
  const clean = sentence?.replace(/\s+/g, ' ').trim();
  return clean || undefined;
}

export function answerTitleNoun(slug: string): string | undefined {
  const noun = ANSWER_TITLE_NOUNS[slug]?.replace(/\s+/g, ' ').trim();
  return noun || undefined;
}

export function answerTitleTail(slug: string): string | undefined {
  const tail = ANSWER_TITLE_TAILS[slug]?.replace(/\s+/g, ' ').trim();
  return tail || undefined;
}

export function answerTitleTokenSynonyms(slug: string): Readonly<Record<string, string>> {
  return ANSWER_TITLE_TOKEN_SYNONYMS[slug] ?? {};
}

export function answerQuerySynonym(slug: string): string | undefined {
  const synonym = ANSWER_QUERY_SYNONYMS[slug]?.replace(/\s+/g, ' ').trim();
  return synonym || undefined;
}
