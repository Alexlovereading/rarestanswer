/** Descriptions for the painted Observatory exhibits; labels and game facts stay in HTML. */
import type { Answer, CategoryKey } from '../../lib/game/types';

export const exhibitAlt = {
  geography: 'A turquoise globe and brass compass displayed above clouds in the starry observatory',
  animals: 'A red fox watches a glowing butterfly on a mossy observatory exhibit',
  food: 'A teal bowl of noodles, egg and greens steams in a lantern-lit observatory',
  sports: 'A golden star trophy and sports balls on a celestial exhibit plinth',
  screen: 'A brass film projector casts a beam of starlight through the observatory',
  music: 'A golden gramophone and indigo record beneath the observatory moon',
  science: 'A glowing turquoise laboratory flask and brass atom model in the observatory',
  history: 'An ivory column, golden laurel, blank scroll and star-filled hourglass in the observatory',
} satisfies Record<CategoryKey, string>;

export const tierTreasure = {
  1: { file: 'common', alt: 'Common treasure: a grey comet pebble with a silver tail' },
  2: { file: 'familiar', alt: 'Familiar treasure: a luminous teal crystal shard' },
  3: { file: 'uncommon', alt: 'Uncommon treasure: a green crystal wrapped in an aurora' },
  4: { file: 'rare', alt: 'Rare treasure: a blue star-sapphire orb in a brass crescent' },
  5: { file: 'epic', alt: 'Epic treasure: a violet orb holding a swirling nebula' },
  6: { file: 'legendary', alt: 'Legendary treasure: a radiant golden star crystal' },
} satisfies Record<Answer['tier'], { file: string; alt: string }>;

export const observatoryAlt =
  'Nova the owl watches six celestial treasures rise above the floating Rarity Observatory';
