/**
 * English copy for the play pages. en.json belongs to W1-UI, so the game
 * keeps its strings here and the pages render them (title, H1, and
 * description share one source with the keyword checks).
 */

import { TIERS } from './types';
import { PENALTY_MS, TIMER_MS } from './score';
import { ROUND_SIZE } from './daily';
import type { ShareMode } from './share';

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
  'After each prompt you see your tier. A list of ten or fewer answers is shown in full, rarest first. A longer list shows the ten rarest and the ten most common. The share grid is colored squares. It does not include what you typed.',
  'From the answer box, Enter submits. Tab moves to Guess and Pass. Escape closes a dialog.',
];

const commonPoints = common?.points ?? 5;
const legendaryPoints = legendary?.points ?? 100;

/** Three lines on the start card, before Play. The dialog has the full rules. */
export const RULES_AT_A_GLANCE: readonly string[] = [
  `Rarer answers score more, from ${commonPoints} to ${legendaryPoints}.`,
  `${seconds} seconds on the clock. A miss costs ${penaltySeconds} second.`,
  'Spotlight doubles one prompt, and only when you score.',
];

export const PLAY = {
  wordmark: 'Rarest Answer',
  tagline: 'The rarest correct answer wins.',
  rulesTitle: 'Before you play',
  dailyKicker: 'Daily round',
  unlimitedKicker: 'Unlimited round',
  categoryKicker: 'Category round',
  todayFallback: "Today's round",
  prompts: 'Prompts',
  streak: 'Streak',
  best: 'Best',
  loadingRound: 'Loading round',
  loadingStatus: 'Loading the prompt list.',
  loadError: 'The prompt list did not load. Try again.',
  promptError: 'That prompt did not load. Try again.',
  emptyAll: 'No prompts are loaded yet.',
  samePrompts: 'Same prompts for everyone on this date.',
  freshSet: 'A fresh set of prompts. The daily streak stays put.',
  tryAgain: 'Try again',
  play: 'Play',
  continue: 'Continue',
  seeYourResult: 'See your result',
  nothingToPlay: 'Nothing to play',
  howTo: 'How to play',
  gotIt: 'Got it',
  close: 'Close',
  stats: 'Stats',
  statsTitle: 'Your stats',
  timerOn: 'Timer on',
  noTimer: 'No timer',
  timerOff: 'Timer off',
  jsRequired:
    'The round needs JavaScript. The rules under the game still explain how scoring works.',
  yourAnswer: 'Your answer',
  guess: 'Guess',
  pass: 'Pass',
  hintTimed: 'Enter to guess. A wrong guess costs one second.',
  hintUntimed: 'Enter to guess. A wrong guess does not cost time. Pass to move on.',
  lockedIn: "That's on the list.",
  duplicate: 'Already tried. That does not cost a second.',
  missTimed: 'Not on the list. One second off the clock.',
  missUntimed: 'Not on the list.',
  alreadyTried: 'Already tried',
  spotlight: 'Spotlight ×2',
  spotlightArmed: 'Spotlight armed',
  spotlightUsed: 'Spotlight used',
  spotlightNote:
    'Doubles one prompt this round. Tap again to cancel. A miss does not spend it.',
  loadingPrompt: 'Loading prompt',
  promptLabel: 'Prompt',
  noPoints: 'No points',
  youPassed: 'You passed.',
  timeUp: 'Time ran out.',
  everyAnswer: 'Every answer, rarest first',
  rarestHeading: 'Rarest answers',
  commonHeading: 'Most common answers',
  seeAll: 'See all answers',
  you: 'You',
  outside: 'Your answer sits between these two lists.',
  nextPrompt: 'Next prompt',
  seeResults: 'See results',
  roundComplete: 'Round complete',
  totalPoints: 'Total points',
  passed: 'Passed',
  shareTextLabel: 'Share text',
  share: 'Share',
  copyText: 'Copy text',
  saveImage: 'Save image',
  playAgain: 'Play again',
  shared: 'Shared',
  copied: 'Copied',
  downloaded: 'Image downloaded',
  copyFallback: 'Select the result below to copy it.',
  imageFailed: 'The image could not be built.',
  mountFailed: 'This round could not start in this browser.',
  resultCopied: 'Result copied',
  selectToCopy: 'Select the result text to copy it',
  noPointsLive: 'No points on that prompt.',
  bestStreak: 'Best streak',
  dailies: 'Dailies',
  rounds: 'Rounds',
  pointsTotal: 'Points',
  bestDaily: 'Best daily',
  guessChart: 'Guesses by tier',
  scoreChart: 'Daily scores',
  guessEmpty: 'Scored guesses will show up here after you play.',
  scoreEmpty: 'Finish a daily round and your scores will show up here.',
  resultGrid: 'Result grid',
  tierMeter: 'Tier meter',
  secondsWord: 'seconds left',
  reloadNext: 'The next daily is ready. Reload to play it.',
  pointsWord: 'points',
  lineup: 'This round’s lineup',
  combo: 'Combo',
  resultCard: 'Your rarity collection',
  clockOff: 'Off',
} as const;

export function comboLine(count: number): string {
  return `${count} in a row`;
}

export function emptyCategoryLine(label: string): string {
  return `No ${label.toLowerCase()} prompts are loaded yet. The daily round still plays whatever is in the list.`;
}

export function alreadyPlayedLine(score: number): string {
  return `You already played today. Score ${score}.`;
}

export function resumeLine(next: number, total: number): string {
  return `Round in progress. Prompt ${next} of ${total} is next.`;
}

export function progressLine(current: number, total: number): string {
  return `Prompt ${current} of ${total}`;
}

export function pointsLine(points: number, spotlight: boolean): string {
  if (points === 0) return '0 points';
  if (spotlight) return `${points} points with Spotlight`;
  return `${points} points`;
}

export function revealAnswerLine(outcome: 'hit' | 'time' | 'pass', answer: string | null): string {
  if (outcome === 'hit' && answer) return `You answered ${answer}.`;
  if (outcome === 'pass') return 'You passed.';
  return 'Time ran out.';
}

export function nextDailyLine(countdown: string | null): string {
  if (!countdown) return PLAY.reloadNext;
  return `Next daily in ${countdown}`;
}

export function timerLabel(left: number | null): string {
  if (left === null) return PLAY.timerOff;
  if (left === 1) return '1 second left';
  return `${left} seconds left`;
}

export function meterLabel(tier: number, name: string): string {
  if (tier <= 0) return 'No tier';
  return `${name}, tier ${tier} of 6`;
}

export function streakLine(streak: number): string {
  if (streak === 1) return '1-day streak';
  return `${streak}-day streak`;
}

export function answersLinkLabel(count: number): string {
  if (count === 1) return 'See the 1 answer';
  return `See all ${count} answers`;
}

export function shareHeading(mode: ShareMode, roundNumber: number, categoryLabel?: string): string {
  if (mode === 'daily') return `Daily #${roundNumber}`;
  if (mode === 'category') return categoryLabel ?? 'Category';
  return 'Unlimited';
}

export function roundCompleteLive(score: number): string {
  return `Round complete. ${score} points.`;
}

export function tierLive(name: string, points: number): string {
  return `${name}. ${points} points.`;
}

export function chartSummary(caption: string, rows: readonly { label: string; count: number }[]): string {
  const body = rows.map((row) => `${row.label} ${row.count}`).join(', ');
  return `${caption}. ${body}`;
}

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
