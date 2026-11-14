/**
 * Unique copy for the eight /trivia/<category>/ pages.
 * Kept out of categories.ts so the game script does not download it.
 */

import { CATEGORY_LABELS, isCategoryKey, type CategoryKey } from './categories';

export interface CategoryPageCopy {
  key: CategoryKey;
  label: string;
  keyword: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
}

export const CATEGORY_PAGES: Record<CategoryKey, CategoryPageCopy> = {
  geography: {
    key: 'geography',
    label: CATEGORY_LABELS.geography,
    keyword: 'geography trivia',
    title: 'Geography Trivia — Rarest Answer Game',
    h1: 'Geography Trivia',
    description:
      'Geography trivia for the Rarest Answer game. Name a place. The rarest correct answer scores the most. Free rounds, no account.',
    intro:
      'Geography trivia here is a naming game, not a map quiz with a single official key. A prompt asks you to name a place: a country, a capital, a river, a range, a coast. Every real answer counts. The capital everyone can point to is usually the low tier. The river you only met in a textbook is where the points are. This page deals geography prompts only, as many rounds as you want, with the same six tiers and the same Spotlight as the daily game.',
  },
  animals: {
    key: 'animals',
    label: CATEGORY_LABELS.animals,
    keyword: 'animal trivia',
    title: 'Animal Trivia — Rarest Answer Game',
    h1: 'Animal Trivia',
    description:
      'Animal trivia for the Rarest Answer game. Name a species, including a great ape. The rarest correct answer scores the most.',
    intro:
      'Animal trivia on Rarest Answer rewards the specific name. One prompt already loaded asks you to name a species of great ape: several species count, and the one fewer people read about scores higher than the one everyone says first. Later animal prompts work the same way, whether the list is breeds, birds, or fish. This page deals animal prompts only. Play it when you want another round after the daily, or when animals are the only topic you want.',
  },
  food: {
    key: 'food',
    label: CATEGORY_LABELS.food,
    keyword: 'food trivia',
    title: 'Food Trivia — Rarest Answer Game',
    h1: 'Food Trivia',
    description:
      'Food trivia for the Rarest Answer game. Name a dish, ingredient, or style. The rarest correct answer scores the most.',
    intro:
      'Food trivia here asks you to name something you could cook, order, or shop for. The item on a standard menu is the one other players type, so it sits in a low tier. A regional dish, a variety, or a technique you actually use is the rarer guess. Rounds on this page stay on food prompts. The timer, the tiers, and Spotlight match the daily Rarest Answer game.',
  },
  sports: {
    key: 'sports',
    label: CATEGORY_LABELS.sports,
    keyword: 'sports trivia',
    title: 'Sports Trivia — Rarest Answer Game',
    h1: 'Sports Trivia',
    description:
      'Sports trivia for the Rarest Answer game. Name a team, athlete, or event. The rarest correct answer scores the most.',
    intro:
      'Sports trivia on this page does not ask who won. It asks you to name a team, an athlete, a venue, or an event that fits the prompt. The dynasty everyone can list is the common answer. A club from a league you actually follow can score much higher. Rounds stay inside sports prompts, and you can deal a new one as soon as the last one ends.',
  },
  screen: {
    key: 'screen',
    label: CATEGORY_LABELS.screen,
    keyword: 'movie trivia',
    title: 'Movie Trivia and TV Trivia — Rarest Answer Game',
    h1: 'Movie and TV Trivia',
    description:
      'Movie trivia and TV trivia for the Rarest Answer game. Name a film, a show, or a character. The rarest correct answer scores the most.',
    intro:
      'Movie trivia and TV trivia share this page because both are answers from the screen. A prompt asks you to name a film, a series, or a character. The franchise everyone has seen lands in a low tier. A limited series, a supporting character, or a film you had to look up is where the score climbs. Rounds on this page use screen prompts only, with the same Spotlight and the same six tiers as the daily game.',
  },
  music: {
    key: 'music',
    label: CATEGORY_LABELS.music,
    keyword: 'music trivia',
    title: 'Music Trivia — Rarest Answer Game',
    h1: 'Music Trivia',
    description:
      'Music trivia for the Rarest Answer game. Name a song, artist, or instrument. The rarest correct answer scores the most.',
    intro:
      'Music trivia here is naming, not a clip quiz. A prompt can ask for a song, an artist, an album, or an instrument. The chorus you can hum is usually a low tier. A deep cut, a session player, or a form you studied is the rarer guess. This page deals music prompts only. Play another round whenever you want. It does not touch the daily streak.',
  },
  science: {
    key: 'science',
    label: CATEGORY_LABELS.science,
    keyword: 'science trivia',
    title: 'Science Trivia — Rarest Answer Game',
    h1: 'Science Trivia',
    description:
      'Science trivia for the Rarest Answer game. Name an element, a body, or a unit. The rarest correct answer scores the most.',
    intro:
      'Science trivia asks you to name a thing in the field: an element, a body in the sky, a unit, a scientist, a species of particle. The textbook example is the one the clock will tempt you to type. The name from a footnote is the one that scores. Rounds on this page use science prompts only, under the same 25-second clock you can switch off before you start.',
  },
  history: {
    key: 'history',
    label: CATEGORY_LABELS.history,
    keyword: 'history trivia',
    title: 'History Trivia — Rarest Answer Game',
    h1: 'History Trivia',
    description:
      'History trivia for the Rarest Answer game. Name a person, event, or place. The rarest correct answer scores the most.',
    intro:
      'History trivia on this page is a naming round. People, events, places, and objects from the past all fit, depending on the prompt. The name on the poster is the low tier. The name you met in a single chapter is the high one. Play history prompts only, as many rounds as you want, and share the square grid when you finish. The grid never shows the names you typed.',
  },
};

export function categoryPage(key: string): CategoryPageCopy | null {
  if (!isCategoryKey(key)) return null;
  return CATEGORY_PAGES[key];
}

export const CATEGORY_PAGE_LIST: readonly CategoryPageCopy[] = Object.values(CATEGORY_PAGES);
