import type { CategoryKey } from '~/lib/game/types';

/** Illustration hints only; article copy and game data remain the source of truth. */
export function articleArtCategory(title: string): CategoryKey | undefined {
  const hints: Array<[CategoryKey, RegExp]> = [
    ['animals', /animal|great ape|species|wildlife/i],
    ['geography', /geograph|farflung|countr|capital/i],
    ['screen', /stranger things|character|movie|television|roblox/i],
    ['sports', /sport|ball knowledge|football|basketball/i],
    ['music', /music|song|singer/i],
    ['food', /food|recipe|cuisine/i],
    ['science', /science|planet|element/i],
    ['history', /histor|ancient|centur/i],
  ];
  return hints.find(([, expression]) => expression.test(title))?.[0];
}
