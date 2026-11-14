/**
 * English copy for the play pages. en.json belongs to W1-UI, so the game
 * keeps its strings here and the pages render them (title, H1, and
 * description share one source with the keyword checks).
 */

import { TIERS } from './types';
import { PENALTY_MS, TIMER_MS } from './score';
import { ROUND_SIZE } from './daily';

const seconds = TIMER_MS / 1000;
const penaltySeconds = PENALTY_MS / 1000;
const common = TIERS[0];
const legendary = TIERS[TIERS.length - 1];

export const HOME = {
  title: 'Rarest Answer Game — Guess the Rarest Answer',
  h1: 'Rarest Answer Game — Guess the Rarest Answer',
  description:
    'Guess the rarest answer in the Rarest Answer game. Free daily games and trivia where the rarest answer wins. A rare answer game for finding rare answers.',
  kicker: 'Daily trivia',
  intro:
    'Finding rare answers is the skill. Every prompt has many right answers, and the rarest answer wins the points. A common guess still counts.',
};

export const UNLIMITED = {
  title: 'Rarest Answer Game Unlimited',
  h1: 'Rarest Answer Game Unlimited',
  description:
    'Play the Rarest Answer game unlimited. Searching for Krillion unlimited? Start a free round anytime, with the same scoring and no daily lock.',
  kicker: 'Unlimited',
  intro:
    'The daily round is once per local date. Unlimited deals a new set each time you play: same tiers, same 25-second clock, same one Spotlight. If you searched for Krillion unlimited, you can keep going here without waiting for midnight.',
};

export const HOW_TO_STEPS: readonly string[] = [
  `Press Play. A daily round deals ${ROUND_SIZE} prompts when the list is full, fewer when a category is still empty, and the same prompts for everyone on your local date.`,
  'Type any real answer and press Enter. Capital letters, accents, punctuation, and a leading "the" do not matter. On a name of six letters or more, one wrong character still counts.',
  `You have ${seconds} seconds. A wrong guess takes ${penaltySeconds} second off the clock and you can try again. Turn the timer off before the round if you want to think, then use Pass when you are done.`,
  'Arm Spotlight once per round to double that prompt. It is spent only when you score, and you can turn it off again before you submit.',
  'After each prompt you see your tier, ten of the rarest answers, and ten of the most common. The share grid is colored squares. It does not include what you typed.',
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQ: readonly FaqItem[] = [
  {
    question: 'What is the Rarest Answer game?',
    answer:
      'A free daily trivia game in the browser. Each prompt has many correct answers. You type one, and rarer answers score more points. There is no account and no download.',
  },
  {
    question: 'How do you guess the rarest answer?',
    answer:
      'Skip the first name that comes to mind. Other players will type it too, and it lands in a low tier. A specific answer you know from a niche usually scores higher. A common answer still beats a blank one. Finding rare answers is mostly refusing your own first instinct.',
  },
  {
    question: 'When does the daily round change?',
    answer:
      'At midnight in your own time zone. Everyone on the same local date gets the same prompts. The round is saved in this browser, so a reload continues it. Play again the next local day and the streak continues. Skip a day and it starts over.',
  },
  {
    question: 'What happens on a wrong guess?',
    answer: `A wrong guess costs ${penaltySeconds} second and the box shakes. You can try again until the ${seconds}-second clock runs out. Typing the same guess again is rejected and does not cost another second. With the timer off, a wrong guess only shakes, and Pass ends the prompt with no points.`,
  },
  {
    question: 'What is Spotlight?',
    answer:
      'Once each round you can arm Spotlight before you answer. That prompt scores double. It is spent only when you actually score, so a timeout with Spotlight armed does not waste it. Tap it again to disarm it before you submit.',
  },
  {
    question: 'How is rarity decided?',
    answer: `Answers are ranked only against the other answers on the same prompt. The signal is public Wikipedia pageviews: names people read about more often sit in lower tiers. The tiers are ${TIERS.map((row) => row.name).join(', ')}. ${common?.name ?? 'Common'} scores ${common?.points ?? 5}. ${legendary?.name ?? 'Legendary'} scores ${legendary?.points ?? 100}.`,
  },
  {
    question: 'Can I play more than once a day?',
    answer:
      'The daily round is once per local day. Unlimited mode deals a fresh round whenever you want. Each category page does the same for one topic. Those rounds do not change the daily streak.',
  },
  {
    question: 'Is Rarest Answer free?',
    answer:
      'Yes. The daily round, unlimited mode, the category rounds, and the no-timer option are free. If ads are turned on later, they stay outside the play area.',
  },
];

export const TIER_BLURBS: Record<(typeof TIERS)[number]['tier'], string> = {
  1: 'Most players will say it',
  2: 'Widely known',
  3: 'A solid, less obvious pick',
  4: 'Specialist knowledge',
  5: 'Few people land here',
  6: 'Among the least known answers on this prompt',
};
