/**
 * Spoiler-free share text. Colored squares are the result grid, not UI
 * chrome. The text never includes the answers themselves.
 */

export type ShareMode = 'daily' | 'unlimited' | 'category';

/** Index 0 is a miss. Tiers 1–6 are our own palette, not another game's. */
const SQUARES = ['⬛', '⬜', '🟨', '🟩', '🟦', '🟪', '🟧'] as const;

export function tierSquare(tier: number): string {
  if (tier >= 1 && tier <= 6) return SQUARES[tier] ?? SQUARES[0];
  return SQUARES[0];
}

export function sharePageUrl(origin: string, mode: ShareMode, category?: string): string {
  const base = origin.replace(/\/$/, '');
  if (mode === 'unlimited') return `${base}/unlimited/`;
  if (mode === 'category' && category) return `${base}/trivia/${category}/`;
  return `${base}/`;
}

export function buildShareText(opts: {
  mode: ShareMode;
  roundNumber: number;
  categoryLabel?: string;
  tiers: readonly number[];
  score: number;
  spotlightUsed: boolean;
  noTimer: boolean;
  url: string;
}): string {
  const head =
    opts.mode === 'daily'
      ? `Rarest Answer #${opts.roundNumber}`
      : opts.mode === 'category'
        ? `Rarest Answer · ${opts.categoryLabel ?? 'Category'}`
        : 'Rarest Answer · Unlimited';
  const lines = [head, opts.tiers.map((tier) => tierSquare(tier)).join(''), `${opts.score} points`];
  if (opts.spotlightUsed) lines.push('Spotlight used');
  if (opts.noTimer) lines.push('No timer');
  lines.push(opts.url);
  return lines.join('\n');
}
