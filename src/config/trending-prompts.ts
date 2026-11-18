/**
 * Prompt slugs people searched in Google Search Console, highest impressions first.
 * Refresh this list weekly from GSC. Callers drop any slug that is not in the catalog.
 */
export const TRENDING_PROMPT_SLUGS = [
  'great-ape-species',
  'countries-in-africa',
  'grammy-record-of-the-year',
  'chemical-elements',
  'champions-league-winners',
  'ghibli-films',
  'disney-animated-films',
  'mcu-characters',
  'canadian-prime-ministers',
  'english-monarchs',
] as const;

/** Home and /rarest-answers/ show at most this many trending links. */
export const TRENDING_LINK_LIMIT = 10;

/**
 * "Rarest <singular noun>". Pass `nounPhrase` (sentence case, still singular).
 * `nounTitle` can follow a plural seoNoun, so it is only a fallback.
 */
export function rarestKeywordAnchor(noun: string): string {
  const clean = noun.replace(/\s+/g, ' ').trim();
  return clean ? `Rarest ${clean}` : 'Rarest answer';
}

/** Trending slugs that exist in `known`, in GSC order, capped at 10. */
export function trendingPrompts<T extends { slug: string }>(known: readonly T[]): T[] {
  const bySlug = new Map(known.map((prompt) => [prompt.slug, prompt]));
  const found: T[] = [];
  for (const slug of TRENDING_PROMPT_SLUGS) {
    const hit = bySlug.get(slug);
    if (!hit) continue;
    found.push(hit);
    if (found.length === TRENDING_LINK_LIMIT) break;
  }
  return found;
}

/**
 * Up to `limit` prompts for one category.
 * Trending slugs in this category come first, in GSC order.
 * If that is fewer than `limit`, the rest follow `promptsInCategory` order.
 */
export function topTrendingPrompts<T extends { slug: string }>(
  promptsInCategory: readonly T[],
  limit = 3,
): T[] {
  if (limit <= 0) return [];
  const bySlug = new Map(promptsInCategory.map((prompt) => [prompt.slug, prompt]));
  const picked: T[] = [];
  const seen = new Set<string>();
  for (const slug of TRENDING_PROMPT_SLUGS) {
    const hit = bySlug.get(slug);
    if (!hit || seen.has(hit.slug)) continue;
    seen.add(hit.slug);
    picked.push(hit);
    if (picked.length === limit) return picked;
  }
  for (const prompt of promptsInCategory) {
    if (seen.has(prompt.slug)) continue;
    seen.add(prompt.slug);
    picked.push(prompt);
    if (picked.length === limit) break;
  }
  return picked;
}
