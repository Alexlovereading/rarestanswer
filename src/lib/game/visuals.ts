/** Presentation-only calculations. None of these change scoring or the clock. */
import type { RoundTier } from './score';

export type ClockPhase = 'steady' | 'warning' | 'urgent' | 'off';

export type NovaMood = 'thinking' | 'celebrating' | 'surprised' | 'sleeping';

/** Nova responds to the awarded tier; Spotlight never changes the reaction. */
export function novaReaction(tier: RoundTier): NovaMood {
  return tier === 0 ? 'surprised' : tier >= 4 ? 'celebrating' : 'thinking';
}

export function clockVisual(
  ms: number | null,
  duration: number,
): {
  phase: ClockPhase;
  offset: number;
} {
  if (ms === null) return { phase: 'off', offset: 100 };
  const left = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const fraction = duration > 0 ? Math.min(1, left / duration) : 0;
  return {
    phase: left <= 5_000 ? 'urgent' : left <= 10_000 ? 'warning' : 'steady',
    offset: 100 * (1 - fraction),
  };
}

/** Consecutive scored prompts; an invalid guess does not end a combo. */
export function currentCombo(results: readonly { tier: RoundTier }[]): number {
  let count = 0;
  for (let index = results.length - 1; index >= 0 && results[index].tier > 0; index--) count++;
  return count;
}

export function scoreAtProgress(from: number, to: number, progress: number): number {
  const t = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1;
  return Math.round(from + (to - from) * (1 - (1 - t) ** 3));
}

export interface CelebrationParticle {
  x: number;
  y: number;
  rotation: number;
  delay: number;
  size: number;
  ribbon: boolean;
}

/** Deterministic, bounded burst: Legendary gets a wider shower of gold ribbons. */
export function celebrationParticles(tier: RoundTier): CelebrationParticle[] {
  if (tier === 0) return [];
  const count = 8 + tier * 7;
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.3999632297;
    const radius = 45 + tier * 14 + ((index * 17) % 61);
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius - 35),
      rotation: (index % 2 ? -1 : 1) * (180 + ((index * 47) % 360)),
      delay: (index % 5) * 18,
      size: 4 + (index % 4),
      ribbon: tier === 6 || index % 3 === 0,
    };
  });
}
