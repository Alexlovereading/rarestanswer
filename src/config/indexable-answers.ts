/** GSC Round 2: featured answer guides; all other prompts remain playable. */
export const INDEXABLE_ANSWER_SLUGS = [
  'great-ape-species',
  'countries-in-africa',
  'mlb-teams',
  'countries-in-north-america',
  'ape-species',
  'ghibli-films',
  'countries-in-europe',
  'african-capitals',
  'chemical-elements',
  'james-bond-films',
  'grammy-record-of-the-year',
  'disney-animated-films',
  'asian-capitals',
  'champions-league-winners',
  'hormones',
  'italian-dishes',
  'english-interjections',
  'american-dishes',
  'queen-songs',
  'holy-roman-emperors',
  'mcu-characters',
  'world-wonders',
  'unesco-sites-in-the-us',
  'australian-prime-ministers',
  'f1-constructors-champions',
  'countries-in-asia',
  'english-monarchs',
  'canadian-prime-ministers',
  'stranger-things-characters',
  'best-actor-winners',
] as const;

export const INDEXABLE_ANSWER_SLUG_SET: ReadonlySet<string> = new Set(INDEXABLE_ANSWER_SLUGS);

export function isIndexableAnswerSlug(slug: string): boolean {
  return INDEXABLE_ANSWER_SLUG_SET.has(slug);
}

/** Match a single answer slug, with or without its trailing slash. */
export function isIndexableAnswerPath(pagePath: string): boolean {
  const path = pagePath.endsWith('/') ? pagePath.slice(0, -1) : pagePath;
  const prefix = '/answers/';
  return path.startsWith(prefix) && isIndexableAnswerSlug(path.slice(prefix.length));
}
