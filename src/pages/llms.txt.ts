/**
 * llms.txt (/llms.txt) — a plain-text map of Rarest Answer for LLM crawlers.
 *
 * Sections match the product routes in docs/rarest-plan.md. Prompt rows are
 * read from src/data/prompts at build time, including each file's `source`
 * field, so a fixture is not described as live pageviews. Guide and game
 * rows come from the wiki collection.
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import { site, siteUrl } from '~/config/site';
import { contactEmail } from '~/lib/contact-email';
import { parseEntryId } from '~/lib/content';
import { newestFirst } from '~/lib/content-utils';
import { defaultLocale } from '~/i18n/routing';
import { detailPath } from '~/lib/url';

const TRIVIA: readonly [string, string][] = [
  ['geography', 'Geography'],
  ['animals', 'Animals'],
  ['food', 'Food'],
  ['sports', 'Sports'],
  ['screen', 'Screen'],
  ['music', 'Music'],
  ['science', 'Science'],
  ['history', 'History'],
];

interface PromptIndexEntry {
  slug: string;
  category: string;
  question: string;
  answerCount: number;
}

function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&');
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadPromptIndex(): PromptIndexEntry[] {
  const raw = readFileSync(join(process.cwd(), 'src/data/prompts/index.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const entries: PromptIndexEntry[] = [];
  for (const item of parsed) {
    if (!isRecord(item)) continue;
    if (typeof item.slug !== 'string' || typeof item.question !== 'string') continue;
    entries.push({
      slug: item.slug,
      category: typeof item.category === 'string' ? item.category : '',
      question: item.question,
      answerCount: typeof item.answerCount === 'number' ? item.answerCount : 0,
    });
  }
  return entries;
}

function promptSource(slug: string): string {
  const raw = readFileSync(join(process.cwd(), 'src/data/prompts', `${slug}.json`), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || typeof parsed.source !== 'string') return 'unspecified';
  return parsed.source;
}

function categoryLabel(key: string): string {
  const found = TRIVIA.find(([id]) => id === key);
  return found ? found[1] : key;
}

export const GET: APIRoute = async () => {
  const all = await getCollection('wiki');
  const articles = all
    .filter((e) => {
      const parsed = parseEntryId(e.id);
      return parsed?.locale === defaultLocale && !e.data.noindex && !e.data.draft;
    })
    .sort(
      (a, b) => a.data.category.localeCompare(b.data.category, defaultLocale) || newestFirst(a, b),
    );

  const lines: string[] = [
    `# ${site.game.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.game.name} is a free browser trivia game. A rarer correct answer scores more. A daily round is seven shared prompts and resets at local midnight. Unlimited play is a separate mode. There is no account. Streak and round stats stay in localStorage on the device.`,
    '',
    'Prompt lists are compiled from Wikidata (CC0) and Wikipedia or Wiktionary pageview counts. English interjections use Wiktionary pageviews. A prompt whose source is "fixture" would still have placeholder popularity numbers. The published prompts do not use that label. The site is not affiliated with Krillion or with any other game named on the game and guide pages.',
    '',
    'Six score tiers: Common 5, Familiar 10, Uncommon 20, Rare 40, Epic 70, Legendary 100. Legendary is the rarest. Spotlight doubles one prompt, once per round.',
    '',
    '## Play',
    '',
    `- [Daily game](${siteUrl}/): Shared daily round of seven prompts. The rarest correct answer scores the most.`,
    `- [Unlimited](${siteUrl}/unlimited/): Keep playing outside the daily round. Same six tiers. The timer can be turned off.`,
    '',
    '## Trivia categories',
    '',
    'One category per URL. Paths are `/trivia/<category>/`.',
    '',
  ];

  for (const [key, label] of TRIVIA) {
    lines.push(
      `- [${label} trivia](${siteUrl}/trivia/${key}/): ${label} prompts for ${site.game.name}.`,
    );
  }

  lines.push(
    '',
    '## Rarest answers',
    '',
    `- [Rarest answers](${siteUrl}/rarest-answers/): Index of prompts. Each prompt also has a page at /answers/<slug>/.`,
  );

  for (const prompt of loadPromptIndex()) {
    const source = promptSource(prompt.slug);
    const label = categoryLabel(prompt.category);
    lines.push(
      `- [${escapeLinkText(prompt.question)}](${siteUrl}/answers/${prompt.slug}/): ${label} prompt, ${prompt.answerCount} answers. Source: ${oneLine(source)}.`,
    );
  }

  const pushSection = (heading: string, path: string, blurb: string, category: string) => {
    lines.push('', `## ${heading}`, '', `- [${heading}](${siteUrl}${path}): ${blurb}`);
    for (const entry of articles) {
      if (entry.data.category !== category) continue;
      const parsed = parseEntryId(entry.id);
      const slug = parsed?.slug ?? '';
      const url = `${siteUrl}${detailPath(entry.data.category, slug, defaultLocale)}`;
      const summary = entry.data.summary ?? entry.data.description;
      lines.push(`- [${escapeLinkText(entry.data.title)}](${url}): ${oneLine(summary)}`);
    }
  };

  pushSection(
    'Games',
    '/games/',
    'Unofficial pages about other daily games. Rarest Answer is not affiliated with those games.',
    'games',
  );
  pushSection(
    'Guides',
    '/guides/',
    'How to play Rarest Answer, how scoring works, and how to look for a rarer correct answer.',
    'guides',
  );

  const covered = new Set(['games', 'guides']);
  const extras = articles.filter((entry) => !covered.has(entry.data.category));
  if (extras.length > 0) {
    lines.push('', '## Other pages', '');
    for (const entry of extras) {
      const parsed = parseEntryId(entry.id);
      const slug = parsed?.slug ?? '';
      const url = `${siteUrl}${detailPath(entry.data.category, slug, defaultLocale)}`;
      const summary = entry.data.summary ?? entry.data.description;
      lines.push(`- [${escapeLinkText(entry.data.title)}](${url}): ${oneLine(summary)}`);
    }
  }

  lines.push(
    '',
    '## Site',
    '',
    `- [About](${siteUrl}/about/): What the game is, how tiers score, and the non-affiliation notice.`,
    `- [FAQ](${siteUrl}/faq/): Daily rounds, localStorage stats, data sources, ads, and contact.`,
    `- [Contact](${siteUrl}/contact/): Email ${contactEmail()}. No account.`,
    `- [Privacy policy](${siteUrl}/privacy-policy/): localStorage, Wikidata, Wikipedia pageviews, and env-gated analytics, ads, and comments.`,
    `- [Terms of service](${siteUrl}/terms-of-service/): Rules of use, score accuracy, and trademarks.`,
    `- [Copyright](${siteUrl}/copyright/): Original text, the MIT software license, CC0 Wikidata, and takedown contact.`,
  );

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
