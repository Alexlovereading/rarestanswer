/**
 * One extra sentence for an answer page, keyed by prompt slug.
 * The shared opening already says "The rarest <noun> on this list is …".
 * Add a slug only when a real query uses a different word order.
 * One sentence, shown once, with no second copy of the shared phrase.
 */
export const ANSWER_SEO_SENTENCES: Readonly<Record<string, string>> = {
  'great-ape-species':
    'Use the table when you want a rare great ape species: it orders the living names by English Wikipedia pageviews.',
};

export function answerSeoSentence(slug: string): string | undefined {
  const sentence = ANSWER_SEO_SENTENCES[slug]?.replace(/\s+/g, ' ').trim();
  return sentence || undefined;
}
