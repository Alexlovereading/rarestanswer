/**
 * Unique copy for the eight /trivia/<category>/ pages, plus the shared
 * below-the-fold explanations the play pages render.
 * Kept out of categories.ts so the game script does not download it.
 * loadCatalog() is build-time only (node:fs). Do not import it from a client script.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_LABELS, isCategoryKey, type CategoryKey } from './categories';
import { isPromptIndexEntry } from './prompts';
import { readClientPrompt } from './load-prompts';
import { TIMER_MS } from './score';
import { TIERS } from './types';

const seconds = TIMER_MS / 1000;

export interface PlayFaq {
  question: string;
  answer: string;
}

/** One visible run in a neighbor note. `href` turns that run into a source link. */
export interface NeighborRun {
  text: string;
  href?: string;
}

/** Dated note for a category people also look up under a Krillion name. */
export interface CategoryNeighborNote {
  heading: string;
  /**
   * Verified facts. Each hostname is a source link, named once.
   * The heading already used the search phrase.
   */
  paragraphs: readonly (readonly NeighborRun[])[];
}

export interface CategoryPageCopy {
  key: CategoryKey;
  label: string;
  keyword: string;
  title: string;
  h1: string;
  description: string;
  /** One sentence above the game. */
  lead: string;
  intro: string;
  /** Shown when this category has at least one prompt. */
  listNote: string;
  /** Shown when this category has none. */
  emptyNote: string;
  /** Set only where a Krillion category was checked. See docs/krillion-variants-2026-11-16.md. */
  neighbor?: CategoryNeighborNote;
  faq: readonly PlayFaq[];
}

export interface CatalogPrompt {
  slug: string;
  category: CategoryKey;
  question: string;
  answerCount: number;
  /** Null when the prompt file is missing or has no source string. */
  source: string | null;
}

export interface TextLink {
  href: string;
  label: string;
}

/** Lobby copy stays in this build-only module, outside the game bundle. */
export const LOBBY = {
  world: 'The Rarity Observatory',
  dailyLead: 'Every correct answer is a star. Find the unexpected, and make yours shine brighter.',
  unlimitedLead:
    'The sky is full of possibilities. Deal a fresh round and keep searching for a rare find.',
  heroCaption: 'A whole sky of rare possibilities.',
  heroAlt:
    'Nova, a round owl with brass goggles, a teal scarf and a lantern, watches celestial treasures above a cloud-top observatory.',
  heroNote:
    'Join Nova above the clouds. Bring your curiosity; the rarest correct answers bring the points.',
  categoryKicker: 'Choose your constellation',
  categoryTitle: 'Where will your curiosity take you?',
  categoryNote: 'Eight categories. Follow your curiosity, or play to your strengths.',
  spotlightKicker: 'From the real answer collection',
  spotlightTitle: 'Rare finds',
  spotlightNote:
    'Actual rarest answers in these sets. The rankings use pageviews, not player guesses.',
  spotlightLink: 'See the ranking',
  howKicker: 'Ready in three moves',
  howTitle: 'How it works',
  howNote: 'A simple question. A surprising answer. A brighter star.',
  tierKicker: 'From comet pebble to golden star',
  tierTitle: 'Climb the rarity ladder',
  tierNote:
    'Lower pageviews within a prompt mean a higher tier and more points. Spotlight doubles one scored prompt per round.',
  browseKicker: 'Build your next brilliant guess',
  browseTitle: 'A rabbit hole of rare answers',
  browseNote:
    'Explore every accepted answer, ranked from rarest to most common. Find something you will remember next round.',
  browseLink: 'Browse the answer vault',
  prompts: 'prompts',
  answers: 'accepted answers',
  points: 'points',
  rarest: 'Rarest answer',
  categoryRound: 'Category round',
  catalog: 'The prompt collection',
  closeKicker: 'Nova saved you a place',
  novaAlt:
    'Nova the owl waves a wing, wearing brass goggles and a teal scarf and carrying a glowing lantern.',
  closeTitle: 'There is a rare find with your name on it.',
  closeNote:
    'One unexpected answer can light up a round. Take a little curiosity into the next one.',
  closePlay: 'Play a fresh round',
  closeDaily: 'Back to the daily',
  closeGuide: 'Learn how to find rare answers',
} as const;

export const CATEGORY_HOOKS: Record<CategoryKey, string> = {
  geography: 'Go off the map',
  animals: 'Think beyond the familiar',
  food: 'Serve a surprising answer',
  sports: 'Back your specialist knowledge',
  screen: 'Find a deep cut',
  music: 'Skip the greatest hits',
  science: 'Make a discovery',
  history: 'Look beyond the headlines',
};

export const LOBBY_STEPS = [
  {
    scene: 'how-reading',
    alt: 'Nova the owl reads a constellation scroll by lantern light on the observatory balcony.',
    title: 'Read your prompt',
    body: 'One prompt, many correct answers. Think of a name that belongs on the accepted list.',
  },
  {
    scene: 'how-typing',
    alt: 'Nova the owl types at a brass typewriter beside a golden hourglass in the observatory.',
    title: 'Make your rarest guess',
    body: `Type an accepted answer. Rarer picks score more: ${TIERS[0]?.name ?? 'Common'} earns ${TIERS[0]?.points ?? 5} points; ${TIERS[TIERS.length - 1]?.name ?? 'Legendary'} earns ${TIERS[TIERS.length - 1]?.points ?? 100}.`,
  },
  {
    scene: 'how-catching',
    alt: 'Nova the owl holds a glass jar beneath a glowing blue star-sapphire above the clouds.',
    title: 'Reveal your rare find',
    body: 'Learn from the rankings, then share a result that keeps your answers a secret.',
  },
] as const;

/** A small, real-data selection; names and tiers never live in marketing copy. */
export function lobbySpotlights(catalog: readonly CatalogPrompt[]) {
  return ['countries-in-africa', 'great-ape-species', 'chemical-elements'].flatMap((slug) => {
    const entry = catalog.find((prompt) => prompt.slug === slug);
    const prompt = entry && readClientPrompt(slug);
    const rare = prompt?.answers[0];
    return entry && rare ? [{ ...entry, rare }] : [];
  });
}

export const GUIDE_LINKS: readonly TextLink[] = [
  { href: '/guides/how-to-find-rare-answers/', label: 'How to find a rare answer' },
  { href: '/guides/how-to-play-rarest-answer/', label: 'How to play Rarest Answer' },
];

export const COMPARE_LINKS: readonly TextLink[] = [
  { href: '/games/krillion/', label: 'One in a Krillion' },
  { href: '/games/games-like-krillion/', label: 'Games like Krillion' },
];

/**
 * Closing line for a category neighbor note.
 * One sentence: this site is not Krillion and is not affiliated with it,
 * then the two guide links. Do not add another Krillion name on that page.
 */
export const NEIGHBOR_CLOSE: readonly NeighborRun[] = [
  { text: 'Rarest Answer is not Krillion and is not affiliated with it; see ' },
  { text: 'One in a Krillion', href: '/games/krillion/' },
  { text: ' and ' },
  { text: 'games like Krillion', href: '/games/games-like-krillion/' },
  { text: '.' },
];

export const HOME_WHAT: readonly string[] = [
  'The Rarest Answer game is free daily trivia in the browser. Each prompt has many correct answers. You guess the rarest answer you can still defend, because the rarest answer wins the points. A rare answer game still scores a common guess. It just scores less. Finding rare answers means staying inside the set.',
  'There is no account. The daily round is one shared set for your local date, saved in this browser, and it resets at local midnight. Unlimited play and each category page deal extra rounds that do not move the streak.',
];

export const HOME_TIPS =
  'Finding rare answers means skipping the famous name when you still have a legal one. A guess the list does not accept scores nothing, and a common legal answer still beats a blank. Save Spotlight for a specific answer you can defend. The guides below are the long version.';

export const HOME_COMPARE =
  "Rarest Answer is the game on this site. Krillion is a separate daily game. The Krillion page here is unofficial. It says krillion.io has an Unlimited path, and that a public rules page for that path's limits was not available when the guide was checked on 14 November 2026. Unlimited rounds on this site do not use Krillion's scoring. The games-like-Krillion page is the comparison with other daily games opened for this site.";

export const UNLIMITED_TIPS =
  'Unlimited is where you practice without spending the daily streak. Turn the timer off until a more specific legal name comes easily, then turn it on. Leave the daily round for the run you want on the streak. The finding guide is that choice in full.';

export const UNLIMITED_COMPARE =
  'People searching for Krillion unlimited often land here. This page is the Rarest Answer game unlimited, not the unlimited path on krillion.io. The Krillion guide says that path exists, and that a public rules page for its limits was not available on 14 November 2026. Read that guide before treating the two games as the same.';

export function categoryTips(h1: string): string {
  return `${h1} uses the same six tiers and the same Spotlight as the daily Rarest Answer game. Skip the famous legal name when you have a more specific one, and do not leave the set. The finding guide and the how-to-play page are the long version.`;
}

export function tierSentence(): string {
  const list = TIERS.map((row) => `${row.name} (${row.points})`).join(', ');
  return `The six tiers, from most common to rarest, are ${list}.`;
}

export function unlimitedFaq(): PlayFaq[] {
  return [
    {
      question: 'Is this Krillion unlimited?',
      answer:
        "No. This is the Rarest Answer game unlimited, on this site. Krillion is a separate game. Its guide here says krillion.io has an Unlimited path, and that a public rules page for that path's limits was not available when the guide was checked on 14 November 2026.",
    },
    {
      question: 'Does unlimited play change the daily streak?',
      answer:
        'No. The daily round is once per local date, and it is the only round that moves the streak. Unlimited deals a new set each time you start, including before midnight.',
    },
    {
      question: 'How does an unlimited round score?',
      answer: `${tierSentence()} Spotlight doubles one scored prompt per round. You can turn the ${seconds}-second timer off before you start.`,
    },
  ];
}

export function promptSectionTitle(keyword: string): string {
  return `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)} prompts`;
}

export function promptCountLine(keyword: string, count: number): string {
  if (count === 1) return `1 ${keyword} prompt is in the catalog.`;
  return `${count} ${keyword} prompts are in the catalog.`;
}

export function answerCountLabel(count: number): string {
  if (count === 1) return '1 answer';
  return `${count} answers`;
}

/** Search title. The site-name suffix stays off because the formula already names the game. */
export function categorySearchTitle(label: string, count: number): string {
  const unit = count === 1 ? 'Prompt' : 'Prompts';
  return `${label} Trivia: Name the Rarest Answer (${count} ${unit})`;
}

/**
 * Snippet with two real prompts. The pair is the first length-sorted combination
 * that lands in 140–160 characters, then shown in alphabetical order.
 */
export function categorySearchDescription(
  keyword: string,
  count: number,
  prompts: readonly Pick<CatalogPrompt, 'question' | 'slug'>[],
): string {
  if (prompts.length < 2) {
    throw new Error(`${keyword} needs two real prompts for the description`);
  }
  const ordered = [...prompts].sort(
    (a, b) =>
      a.question.length - b.question.length ||
      a.question.localeCompare(b.question, 'en') ||
      a.slug.localeCompare(b.slug, 'en'),
  );
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const left = ordered[i];
      const right = ordered[j];
      if (!left || !right) continue;
      const pair = [left, right].sort(
        (a, b) => a.question.localeCompare(b.question, 'en') || a.slug.localeCompare(b.slug, 'en'),
      );
      const earlier = pair[0];
      const later = pair[1];
      if (!earlier || !later) continue;
      const description = `Play ${count} ${keyword} prompts where the rarest correct answer wins — e.g. "${earlier.question}" and "${later.question}". Free daily and unlimited rounds.`;
      if (description.length >= 140 && description.length <= 160) return description;
    }
  }
  throw new Error(`${keyword} description does not fit 140–160 characters`);
}

/** Object of "Name a …", keeping the question's own capitals. */
export function promptNoun(question: string): string {
  const bare = question.replace(/[.?!]+$/u, '').trim();
  const named = bare.match(/^name\s+(?:a|an|the|some|any)\s+(.+)$/i);
  const noun = (named?.[1] ?? bare).trim();
  return noun.length > 0 ? noun : 'answer';
}

export function rarestNounLabel(question: string): string {
  return `rarest ${promptNoun(question)}`;
}

/** Most accepted answers first. Ties break on slug, then question. */
export function topAnswerPrompts(prompts: readonly CatalogPrompt[], limit = 6): CatalogPrompt[] {
  return [...prompts]
    .sort(
      (a, b) =>
        b.answerCount - a.answerCount ||
        a.slug.localeCompare(b.slug, 'en') ||
        a.question.localeCompare(b.question, 'en'),
    )
    .slice(0, limit);
}

export function answerPageLinks(prompts: readonly CatalogPrompt[], limit = 6): TextLink[] {
  return uniqueLinks(
    topAnswerPrompts(prompts, limit).map((prompt) => ({
      href: `/answers/${encodeURIComponent(prompt.slug)}/`,
      label: rarestNounLabel(prompt.question),
    })),
    'category answer links',
  );
}

/**
 * Great-ape page first, then the largest prompt in each other category
 * until `extra` more pages are chosen.
 */
export function popularAnswerLinks(catalog: readonly CatalogPrompt[], extra = 5): TextLink[] {
  const first = catalog.find((prompt) => prompt.slug === 'great-ape-species');
  const seen = new Set<CategoryKey>();
  if (first) seen.add(first.category);
  const rest = [...catalog]
    .filter((prompt) => prompt.slug !== first?.slug)
    .sort(
      (a, b) =>
        b.answerCount - a.answerCount ||
        a.slug.localeCompare(b.slug, 'en') ||
        a.question.localeCompare(b.question, 'en'),
    );
  const picked: CatalogPrompt[] = [];
  for (const prompt of rest) {
    if (seen.has(prompt.category)) continue;
    seen.add(prompt.category);
    picked.push(prompt);
    if (picked.length === extra) break;
  }
  const pages = first ? [first, ...picked] : picked;
  return uniqueLinks(
    pages.map((prompt) => ({
      href: `/answers/${encodeURIComponent(prompt.slug)}/`,
      label: rarestNounLabel(prompt.question),
    })),
    'popular answer links',
  );
}

function uniqueLinks(links: TextLink[], where: string): TextLink[] {
  const seen = new Set<string>();
  for (const link of links) {
    const key = link.label.toLocaleLowerCase('en');
    if (seen.has(key)) throw new Error(`${where} repeats “${link.label}”`);
    seen.add(key);
  }
  return links;
}

/** Guides that are actually about that category. Other categories use the finding guide. */
export const CATEGORY_GUIDE_LINKS: Partial<Record<CategoryKey, TextLink>> = {
  geography: {
    href: '/guides/rarest-answer-game-tips-geography/',
    label: 'How to answer a geography prompt',
  },
  animals: {
    href: '/guides/rarest-answers-animals/',
    label: 'How the great-ape list is ranked',
  },
};

const MEASURED = /wikipedia|wiktionary|page\s*views?/i;

function run(text: string): NeighborRun {
  return { text };
}

function source(text: string, href: string): NeighborRun {
  return { text, href };
}

const KRILLION_ABOUT = 'https://www.krillion.org/about/';

/**
 * How rarity is measured, then what the source strings on `sources` actually say.
 * `none` is used when the list is empty. A source that does not mention
 * Wikipedia, Wiktionary, or pageviews is placeholder popularity.
 */
export function measureCopy(sources: readonly (string | null)[], none: string): string {
  const method =
    'Rarity is a rank inside one prompt. A name is common or legendary only beside the other accepted answers on that prompt. When the source names Wikipedia, the answer list is compiled from Wikidata (CC0) and the rank uses English Wikipedia views, last 12 months. More views means a lower tier. When the source names Wiktionary, the rank uses English Wiktionary views, last 12 months. Any other source is placeholder popularity, not a live pageview count.';
  return `${method} ${sourceStatus(sources, none)}`;
}

export const CATEGORY_PAGES: Record<CategoryKey, CategoryPageCopy> = {
  geography: {
    key: 'geography',
    label: CATEGORY_LABELS.geography,
    keyword: 'geography trivia',
    title: 'Geography Trivia: Rarest Answer Game',
    h1: 'Geography Trivia',
    description:
      'Geography trivia for Rarest Answer. Searched Krillion Geography? Name a country or capital. The rarest answer scores the most. Free daily and unlimited rounds.',
    lead: 'Name a place. The rarest correct answer scores the most.',
    intro:
      "Geography trivia here is a naming game, not a map quiz with a single official key. A prompt asks you to name a place: a country, a capital, a river, a range, a coast. Only a place on that prompt's list counts. The capital with the most-viewed article is usually the low tier. A river with a less-viewed article is where the points are. This page deals geography prompts only, as many rounds as you want, with the same six tiers and the same Spotlight as the daily game.",
    listNote:
      'A place prompt is a naming round. The ranking is inside that prompt, not a map score.',
    emptyNote:
      'No geography trivia prompts are in the catalog yet. The daily round still plays whatever other categories have loaded.',
    neighbor: {
      heading: 'Looking for Krillion Geography?',
      paragraphs: [
        [
          run('On 16 November 2026, the geography round published by AFK LLC at '),
          source('krillion.to', 'https://krillion.to/en/geography'),
          run(
            ' used seven questions on countries, capitals, borders, and islands, with 25 seconds each, more points for a rarer accepted answer, and free play capped at ',
          ),
          source('three games a day', 'https://krillion.to/en/how-to-play'),
          run('.'),
        ],
        [
          run('The same day, '),
          source('krillion.io', 'https://krillion.io/packs'),
          run(
            ' listed a separate Geography pack of 30 expeditions and called its packs free for now, in beta, while ',
          ),
          source('krillion.org', 'https://www.krillion.org/play/geography/'),
          run(', which '),
          source('says it is not affiliated with that site', KRILLION_ABOUT),
          run(', showed a seven-question geography challenge it marked free in that build.'),
        ],
        [
          run(
            'This page is Rarest Answer. Prompts such as “Name a country in Europe,” “Name a national capital in Africa,” and “Name a US state” come from Wikidata, and a rarer correct answer is the one with fewer English Wikipedia pageviews over the last 12 months, on the daily round or as many extra rounds as you want.',
          ),
        ],
      ],
    },
    faq: [
      {
        question: 'What is geography trivia in the Rarest Answer game?',
        answer:
          'It is a naming round. You type a place that fits the prompt, and the rarest correct answer scores the most. There is no single pin on a map. A geography round does not move the daily streak.',
      },
      {
        question: 'Which places count as the rare ones?',
        answer:
          "Only the places on that prompt's list, ranked by how rarely their Wikipedia articles are viewed. A famous capital is usually the low tier. A place with a less-viewed article can score higher when the list accepts it. The prompts in the catalog are listed on this page.",
      },
    ],
  },
  animals: {
    key: 'animals',
    label: CATEGORY_LABELS.animals,
    keyword: 'animal trivia',
    title: 'Animal Trivia — Rarest Answer Game',
    h1: 'Animal Trivia',
    description:
      'Animal trivia for the Rarest Answer game. Name a species, including a great ape. The rarest correct answer scores the most. Free rounds, no account.',
    lead: 'Name a species. The rarest correct answer scores the most.',
    intro:
      'Animal trivia on Rarest Answer rewards the specific name. A prompt asks you to name an animal the list accepts. The finding guide uses a great-ape species list as its sample: the species with the most-viewed article is the low tier, and a species with a less-viewed article scores higher. That rank is pageviews among accepted names, not a count of how many animals are left. This page deals animal prompts only. The catalog under the game is whatever is published now, one prompt or a few hundred.',
    listNote:
      'An animal prompt ranks accepted names. It does not rank how many animals are left in the wild.',
    emptyNote:
      'No animal trivia prompts are in the catalog yet. A species prompt will be linked here when one is published.',
    faq: [
      {
        question: 'What is animal trivia in the Rarest Answer game?',
        answer:
          'You name an animal the prompt accepts. The rarest correct name scores the most. The finding guide uses a great-ape species list as the sample of that move. An animal round does not move the daily streak.',
      },
      {
        question: 'Is the rarest answer the animal with the fewest left alive?',
        answer:
          'No. The rank is how the name sits among the other accepted answers. How many animals are left in the wild is a different fact. The finding guide says that about the great-ape sample.',
      },
    ],
  },
  food: {
    key: 'food',
    label: CATEGORY_LABELS.food,
    keyword: 'food trivia',
    title: 'Food Trivia — Rarest Answer Game',
    h1: 'Food Trivia',
    description:
      'Food trivia for the Rarest Answer game. Name a dish, ingredient, or cuisine. The rarest correct answer scores the most. Free rounds, no account.',
    lead: 'Name a dish or an ingredient. The rarest correct answer scores the most.',
    intro:
      'Food trivia here asks you to name something you could cook, order, or shop for. A familiar menu item is often a low tier. A regional dish, a variety, or a technique the list accepts can score higher. Rounds on this page stay on food prompts. The timer, the tiers, and Spotlight match the daily Rarest Answer game.',
    listNote: 'A food prompt ranks accepted names. It does not rank how good the dish tastes.',
    emptyNote:
      'No food trivia prompts are in the catalog yet. Each dish prompt will be linked here when one is published.',
    faq: [
      {
        question: 'What is food trivia in the Rarest Answer game?',
        answer:
          'You name a dish, an ingredient, or a style the prompt accepts. The rarest correct answer scores the most. A food round does not move the daily streak.',
      },
      {
        question: 'Does a better-tasting dish score more?',
        answer:
          "No. The score is rarity inside the prompt's list, not a review. A heavily viewed article is the low tier.",
      },
    ],
  },
  sports: {
    key: 'sports',
    label: CATEGORY_LABELS.sports,
    keyword: 'sports trivia',
    title: 'Sports Trivia: Rarest Answer Game',
    h1: 'Sports Trivia',
    description:
      'Sports trivia for Rarest Answer. Searched Krillion Sports? Name a team or athlete. The rarest correct answer scores the most. Free daily and unlimited rounds.',
    lead: 'Name a team, an athlete, or an event. The rarest correct answer scores the most.',
    intro:
      'Sports trivia on this page does not ask who won. It asks you to name a team, an athlete, a venue, or an event that fits the prompt. The dynasty with the most-viewed article is the common answer. A club with a less-viewed article can score much higher. Rounds stay inside sports prompts, and you can deal a new one as soon as the last one ends.',
    listNote: 'A sports prompt ranks accepted names. It does not rank who won.',
    emptyNote:
      'No sports trivia prompts are in the catalog yet. Team and athlete prompts will be linked here when they are published.',
    neighbor: {
      heading: 'Like Krillion Sports?',
      paragraphs: [
        [
          run('On 16 November 2026, the sports round published by AFK LLC at '),
          source('krillion.to', 'https://krillion.to/en/sports'),
          run(', its '),
          source('Game On pack', 'https://krillion.to/en/packs/sports'),
          run(
            ', used seven questions on stars, teams, rules, and competitions, 25 seconds each, with tiers that site’s editors assigned rather than a count of typed answers.',
          ),
        ],
        [
          run('The same day, '),
          source('krillion.io', 'https://krillion.io/packs'),
          run(
            ' listed a separate sports pack of 30 games and marked its packs free for now, in beta, while ',
          ),
          source('krillion.org', 'https://www.krillion.org/play/sports/'),
          run(', which '),
          source('says it is not affiliated with that site', KRILLION_ABOUT),
          run(', listed The Deep Bench as seven daily sports questions.'),
        ],
        [
          run(
            'Prompts here include current NBA basketball teams, NFL football teams, Premier League soccer clubs, and current MLB baseball teams, from Wikidata, ranked by English Wikipedia pageviews over the last 12 months.',
          ),
        ],
      ],
    },
    faq: [
      {
        question: 'What is sports trivia in the Rarest Answer game?',
        answer:
          'You name a team, an athlete, a venue, or an event that fits. The rarest correct answer scores the most. The question is not who won. A sports round does not move the daily streak.',
      },
      {
        question: 'Does the winner of the match score more?',
        answer:
          'No. Winning is not the rank. A dynasty with a heavily viewed article is the common answer. A legal name with a less-viewed article can score higher.',
      },
    ],
  },
  screen: {
    key: 'screen',
    label: CATEGORY_LABELS.screen,
    keyword: 'movie trivia',
    title: 'Movie Trivia: Rarest Answer Game',
    h1: 'Movie and TV Trivia',
    description:
      'Movie trivia for the Rarest Answer game. Searched Krillion movies? Name a film, show, or character. The rarest correct answer scores the most. Free rounds.',
    lead: 'Name a film, a show, or a character. The rarest correct answer scores the most.',
    intro:
      'Movie trivia and TV trivia share this page because both are answers from the screen. A prompt asks you to name a film, a series, or a character. The franchise with the most-viewed article lands in a low tier. A limited series, a supporting character, or a film with a less-viewed article is where the score climbs. Rounds on this page use screen prompts only, with the same Spotlight and the same six tiers as the daily game.',
    listNote:
      'A movie or TV prompt ranks accepted titles and characters. It does not rank reviews or box office.',
    emptyNote:
      'No movie trivia prompts are in the catalog yet. Film and show prompts will be linked here when they are published.',
    neighbor: {
      heading: 'For Krillion at the Movies fans',
      paragraphs: [
        [
          run('On 16 November 2026, the Movies and TV pack published by AFK LLC at '),
          source('krillion.to', 'https://krillion.to/en/packs/movies'),
          run(
            ' held 174 games of seven questions on lines, characters, franchises, and shows, 25 seconds each, and a top answer there is worth 700 points.',
          ),
        ],
        [
          source('krillion.io', 'https://krillion.io/packs'),
          run(' called its own movie pack At the Movies, with 30 pictures, and '),
          source('krillion.org', 'https://www.krillion.org/play/movies/'),
          run(', which '),
          source('says it is not affiliated with that site', KRILLION_ABOUT),
          run(', used that same label for seven daily questions.'),
        ],
        [
          run(
            'Here you can name a Pixar film, a Marvel Cinematic Universe film, or a James Bond film, from Wikidata lists ranked by English Wikipedia pageviews over the last 12 months.',
          ),
        ],
      ],
    },
    faq: [
      {
        question: 'What is movie trivia in the Rarest Answer game?',
        answer:
          'Movie trivia and TV trivia share this page. You name a film, a show, or a character. The rarest correct answer scores the most. A screen round does not move the daily streak.',
      },
      {
        question: 'Does a higher-rated film score more?',
        answer:
          'No. Ratings and box office are not the rank. A franchise with a heavily viewed article is the low tier. A legal title or character with a less-viewed article can score higher.',
      },
    ],
  },
  music: {
    key: 'music',
    label: CATEGORY_LABELS.music,
    keyword: 'music trivia',
    title: 'Music Trivia: Rarest Answer Game',
    h1: 'Music Trivia',
    description:
      'Music trivia for Rarest Answer. Searched Krillion pop culture? Name a song, an artist, or an instrument. The rarest correct answer scores most. Free rounds.',
    lead: 'Name a song, an artist, or an instrument. The rarest correct answer scores the most.',
    intro:
      'Music trivia here is naming, not a clip quiz. A prompt can ask for a song, an artist, an album, or an instrument. The chorus you can hum is usually a low tier. A deep cut, a session player, or a form you studied is the rarer guess. This page deals music prompts only. Play another round whenever you want. It does not touch the daily streak.',
    listNote: 'A music prompt ranks accepted names. This page does not play a clip.',
    emptyNote:
      'No music trivia prompts are in the catalog yet. Song and artist prompts will be linked here when they are published.',
    neighbor: {
      heading: 'Looking for Krillion pop culture?',
      paragraphs: [
        [
          run('On 16 November 2026, '),
          source('krillion.to', 'https://krillion.to/en/music'),
          run(' had no music page (that address was a 404), and music questions sat inside '),
          source('Endless Pop', 'https://krillion.to/en/packs/pop-culture'),
          run(
            ', the pop culture pack of video games, animation, and songs, as 319 games of seven questions.',
          ),
        ],
        [
          source('krillion.io', 'https://krillion.io/packs'),
          run(' marked Music as coming soon and its '),
          source('music address', 'https://krillion.io/music'),
          run(' was a 404, while '),
          source('krillion.org', 'https://www.krillion.org/play/music/'),
          run(', which '),
          source('says it is not affiliated with that site', KRILLION_ABOUT),
          run(
            ', had a music round called The Deep Cut: seven questions, 20 seconds each, and no headphones required.',
          ),
        ],
        [
          run(
            'This page asks you to name a Beyoncé song, a Taylor Swift song, a Queen song, or a brass instrument, from Wikidata, ranked by English Wikipedia pageviews over the last 12 months.',
          ),
        ],
      ],
    },
    faq: [
      {
        question: 'What is music trivia in the Rarest Answer game?',
        answer:
          'You name a song, an artist, an album, or an instrument. There is no clip to identify. The rarest correct answer scores the most. A music round does not move the daily streak.',
      },
      {
        question: 'Is the name everyone can hum the rare one?',
        answer:
          'No. A name with a heavily viewed article is the low tier. A less-viewed legal name can score higher. Being able to hum it is not what the score measures.',
      },
    ],
  },
  science: {
    key: 'science',
    label: CATEGORY_LABELS.science,
    keyword: 'science trivia',
    title: 'Science Trivia — Rarest Answer Game',
    h1: 'Science Trivia',
    description:
      'Science trivia for the Rarest Answer game. Name an element, a body, a unit, or a scientist. The rarest correct answer scores the most. Free rounds.',
    lead: 'Name an element, a body, or a unit. The rarest correct answer scores the most.',
    intro: `Science trivia asks you to name a thing in the field: an element, a body in the sky, a unit, a scientist, a species of particle. The textbook example is the one the clock will tempt you to type. A name from a footnote can score higher when the list accepts it. Rounds on this page use science prompts only, under the same ${seconds}-second clock you can switch off before you start.`,
    listNote: 'A science prompt ranks accepted names. It does not decide which fact is more true.',
    emptyNote:
      'No science trivia prompts are in the catalog yet. Each science prompt will be linked here when one is published.',
    faq: [
      {
        question: 'What is science trivia in the Rarest Answer game?',
        answer: `You name something the prompt accepts, such as an element, a body, or a unit. The rarest correct answer scores the most. You can turn the ${seconds}-second timer off before the round. A science round does not move the daily streak.`,
      },
      {
        question: 'Is a truer fact a rarer answer?',
        answer:
          'No. Accepted answers are all treated as correct. The rank is which Wikipedia article is viewed less inside that list, not which statement is more scientific.',
      },
    ],
  },
  history: {
    key: 'history',
    label: CATEGORY_LABELS.history,
    keyword: 'history trivia',
    title: 'History Trivia — Rarest Answer Game',
    h1: 'History Trivia',
    description:
      'History trivia for the Rarest Answer game. Name a person, an event, or a place. The rarest correct answer scores the most. Free rounds, no account.',
    lead: 'Name a person, an event, or a place. The rarest correct answer scores the most.',
    intro:
      'History trivia on this page is a naming round. People, events, places, and objects from the past all fit, depending on the prompt. The name on the poster is the low tier. The name you met in a single chapter is the high one. Play history prompts only, as many rounds as you want, and share the square grid when you finish. The grid never shows the names you typed.',
    listNote: 'A history prompt ranks accepted names. It does not rank which event mattered more.',
    emptyNote:
      'No history trivia prompts are in the catalog yet. Person and event prompts will be linked here when they are published.',
    faq: [
      {
        question: 'What is history trivia in the Rarest Answer game?',
        answer:
          'You name a person, an event, or a place from the prompt. The rarest correct answer scores the most. A history round does not move the daily streak.',
      },
      {
        question: 'Does a more important event score more?',
        answer:
          'No. Importance is not the rank. The name on the poster is the low tier. A legal name from a single chapter can score higher.',
      },
    ],
  },
};

/**
 * Search titles follow the live catalog. The strings above are replaced
 * before any page reads them, then checked for length and the category keyword.
 */
function applyCategorySearchCopy(catalog: readonly CatalogPrompt[]): void {
  for (const page of Object.values(CATEGORY_PAGES)) {
    const prompts = promptsFor(catalog, page.key);
    page.title = categorySearchTitle(page.label, prompts.length);
    page.description = categorySearchDescription(page.keyword, prompts.length, prompts);
  }
}

export function categoryPage(key: string): CategoryPageCopy | null {
  if (!isCategoryKey(key)) return null;
  return CATEGORY_PAGES[key];
}

export const CATEGORY_PAGE_LIST: readonly CategoryPageCopy[] = Object.values(CATEGORY_PAGES);

export function promptsFor(catalog: readonly CatalogPrompt[], key: CategoryKey): CatalogPrompt[] {
  return catalog
    .filter((entry) => entry.category === key)
    .sort(
      (a, b) => a.question.localeCompare(b.question, 'en') || a.slug.localeCompare(b.slug, 'en'),
    );
}

/**
 * Read src/data/prompts/index.json and each prompt's source string.
 * A half-written prompt file throws, so a build does not describe it as measured.
 */
export function loadCatalog(): CatalogPrompt[] {
  const dir = promptsDirectory();
  const raw = readFileSync(join(dir, 'index.json'), 'utf8');
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('src/data/prompts/index.json must be an array');
  }
  const prompts: CatalogPrompt[] = [];
  for (const row of data) {
    if (!isPromptIndexEntry(row)) continue;
    prompts.push({
      slug: row.slug,
      category: row.category,
      question: row.question,
      answerCount: row.answerCount,
      source: readSource(dir, row.slug),
    });
  }
  return prompts;
}

function promptsDirectory(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'src/data/prompts');
    if (existsSync(join(candidate, 'index.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fromCwd = join(process.cwd(), 'src/data/prompts');
  if (existsSync(join(fromCwd, 'index.json'))) return fromCwd;
  throw new Error('src/data/prompts/index.json was not found');
}

function readSource(dir: string, slug: string): string | null {
  const path = join(dir, `${slug}.json`);
  if (!existsSync(path)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`src/data/prompts/${slug}.json is not readable JSON (${message})`);
  }
  if (!isRecord(data)) return null;
  const source = data.source;
  if (typeof source !== 'string') return null;
  const trimmed = source.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sourceStatus(sources: readonly (string | null)[], none: string): string {
  if (sources.length === 0) return none;
  const measured = new Set<string>();
  const placeholder = new Set<string>();
  let missing = 0;
  for (const source of sources) {
    if (!source) {
      missing += 1;
      continue;
    }
    if (MEASURED.test(source)) measured.add(source);
    else placeholder.add(source);
  }
  const missingBit =
    missing === 0
      ? ''
      : missing === 1
        ? ' 1 prompt has no readable source.'
        : ` ${missing} prompts have no readable source.`;
  if (measured.size > 0 && placeholder.size === 0 && missing === 0) {
    return `Every prompt in this list records a pageview source: ${showLabels(measured)}.`;
  }
  if (measured.size === 0 && placeholder.size > 0 && missing === 0) {
    return `Every prompt in this list is labeled ${showLabels(placeholder)}. Those popularity numbers are placeholders, not a live pageview count.`;
  }
  if (measured.size === 0 && placeholder.size === 0) {
    return `None of the prompts in this list has a readable source.${missingBit}`;
  }
  const parts: string[] = [];
  if (measured.size > 0) parts.push(`pageview sources ${showLabels(measured)}`);
  if (placeholder.size > 0) {
    parts.push(`placeholder labels ${showLabels(placeholder)} (not a live pageview count)`);
  }
  return `This list includes ${joinList(parts)}.${missingBit}`;
}

function showLabels(values: Iterable<string>): string {
  const sorted = [...values].sort((a, b) => a.localeCompare(b, 'en'));
  const shown = sorted.slice(0, 4).map((value) => `"${value}"`);
  if (sorted.length <= 4) return joinList(shown);
  return `${shown.join(', ')}, and ${sorted.length - 4} more`;
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

applyCategorySearchCopy(loadCatalog());

for (const page of Object.values(CATEGORY_PAGES)) {
  if (page.title.length > 60) {
    throw new Error(`${page.key} title is ${page.title.length} characters`);
  }
  if (!page.title.includes('Rarest Answer')) {
    throw new Error(`${page.key} title would pick up a site-name suffix`);
  }
  const length = page.description.length;
  if (length < 140 || length > 160) {
    throw new Error(`${page.key} description is ${length} characters`);
  }
  if (!page.description.toLowerCase().includes(page.keyword)) {
    throw new Error(`${page.key} description is missing ${page.keyword}`);
  }
}
