/**
 * Tier points and the once-per-round Spotlight double.
 * Points come from TIERS in types.ts (Common 5 … Legendary 100).
 */

import { TIERS, type Answer } from './types';

export type RoundTier = 0 | Answer['tier'];

/** A prompt gives the player 25 seconds. A wrong guess costs one second. */
export const TIMER_MS = 25_000;
export const PENALTY_MS = 1_000;

export function pointsForTier(tier: Answer['tier']): number {
  for (const row of TIERS) {
    if (row.tier === tier) return row.points;
  }
  return 0;
}

export function tierName(tier: number): string {
  for (const row of TIERS) {
    if (row.tier === tier) return row.name;
  }
  return 'Passed';
}

/** Misses score 0. Spotlight doubles a scored tier. */
export function scorePrompt(tier: RoundTier, spotlight: boolean): number {
  if (tier === 0) return 0;
  const base = pointsForTier(tier);
  return spotlight ? base * 2 : base;
}

export interface ScoreState {
  total: number;
  spotlightUsed: boolean;
}

export function freshScore(): ScoreState {
  return { total: 0, spotlightUsed: false };
}

/**
 * Apply one prompt. Spotlight is spent only when it doubles a scored
 * answer, so arming it and then timing out does not waste the boost.
 */
export function applyScore(
  state: ScoreState,
  tier: RoundTier,
  armed: boolean,
): { points: number; state: ScoreState } {
  const useSpotlight = armed && !state.spotlightUsed && tier !== 0;
  const points = scorePrompt(tier, useSpotlight);
  return {
    points,
    state: {
      total: state.total + points,
      spotlightUsed: state.spotlightUsed || useSpotlight,
    },
  };
}
