/**
 * One extra note for an answer page, keyed by prompt slug.
 * The shared opening already names the rarest answer once.
 * Add a slug only for a distinction that opening does not already say.
 * Do not repeat "the rarest … is" or a second "rare <noun>" phrase.
 *
 * `ANSWER_TITLE_NOUNS` is an optional plural noun for the document title only,
 * already in title case ("Great Ape Species" → "Rare Great Ape Species: …").
 * It is not re-pluralized. The H1 still uses the noun from the question.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANSWER_SEO_SENTENCES: Readonly<Record<string, string>> = {};

/** Plural title noun, keyed by prompt slug. Absent slugs use the question. */
export const ANSWER_TITLE_NOUNS: Readonly<Record<string, string>> = {
  'great-ape-species': 'Great Ape Species',
};

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
  apeScopeCache = `This list is the living great ape species. The ape species list is broader and includes gibbons.${fossilClause} Lemurs are a separate list.`;
  return apeScopeCache;
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
