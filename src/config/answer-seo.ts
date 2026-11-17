/**
 * One extra sentence for an answer page, keyed by prompt slug.
 * The shared opening already says "The rarest <noun> on this list is …".
 * Add a slug only when a real query uses a different word order.
 * One sentence, shown once, with no second copy of the shared phrase.
 *
 * `ANSWER_TITLE_NOUNS` is an optional plural noun for the document title only,
 * already in title case ("Great Ape Species" → "Rare Great Ape Species: …").
 * It is not re-pluralized. The H1 still uses the noun from the question.
 */
export const ANSWER_SEO_SENTENCES: Readonly<Record<string, string>> = {
  'great-ape-species':
    'Use the table when you want a rare great ape species: it orders the living names by English Wikipedia pageviews.',
};

/** Plural title noun, keyed by prompt slug. Absent slugs use the question. */
export const ANSWER_TITLE_NOUNS: Readonly<Record<string, string>> = {
  'great-ape-species': 'Great Ape Species',
};

export function answerSeoSentence(slug: string): string | undefined {
  const sentence = ANSWER_SEO_SENTENCES[slug]?.replace(/\s+/g, ' ').trim();
  return sentence || undefined;
}

export function answerTitleNoun(slug: string): string | undefined {
  const noun = ANSWER_TITLE_NOUNS[slug]?.replace(/\s+/g, ' ').trim();
  return noun || undefined;
}
