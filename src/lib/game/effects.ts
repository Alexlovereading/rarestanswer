/** Small DOM effects, isolated from the game engine and its persisted state. */
import { PLAY, answerCountLine, comboLine, lineupLabel } from './copy';
import { celebrationParticles, currentCombo, scoreAtProgress } from './visuals';
import type { PromptIndexEntry } from './types';
import { CATEGORY_LABELS } from './categories';
import { tierName, type RoundTier } from './score';

export function createGameEffects(root: HTMLElement) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = root.querySelector<HTMLElement>('[data-game-particles]');
  let scoreFrame = 0;
  let burstTimer = 0;
  let shownScore = 0;
  let targetScore = 0;

  function art(target: HTMLElement | null, kind: 'category' | 'badge', key: string): void {
    if (!target) return;
    const template = root.querySelector<HTMLTemplateElement>(
      `[data-game-${kind}-template="${key}"]`,
    );
    target.replaceChildren(...(template ? [template.content.cloneNode(true)] : []));
  }

  function lineup(entries: readonly PromptIndexEntry[]): void {
    const list = root.querySelector<HTMLElement>('[data-game-lineup]');
    if (!list) return;
    list.replaceChildren();
    entries.forEach(({ category, answerCount }) => {
      const item = document.createElement('li');
      item.className = 'ra-lineup-item';
      item.title = `${CATEGORY_LABELS[category]}, ${answerCountLine(answerCount)}`;
      item.setAttribute('aria-label', item.title);
      const illustration = document.createElement('span');
      illustration.className = 'ra-lineup-art';
      illustration.setAttribute('aria-hidden', 'true');
      art(illustration, 'category', category);
      const label = document.createElement('span');
      label.className = 'ra-lineup-label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = lineupLabel(CATEGORY_LABELS[category], answerCount);
      item.append(illustration, label);
      list.append(item);
    });
  }

  function paintScore(value: number): void {
    shownScore = value;
    root.querySelectorAll<HTMLElement>('[data-game-running-score]').forEach((node) => {
      node.textContent = String(value);
    });
  }

  function score(value: number, animate = true): void {
    window.cancelAnimationFrame(scoreFrame);
    targetScore = value;
    const from = shownScore;
    if (motion.matches || !animate || from === value) {
      paintScore(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 620);
      paintScore(scoreAtProgress(from, value, progress));
      if (progress < 1) scoreFrame = window.requestAnimationFrame(tick);
    };
    scoreFrame = window.requestAnimationFrame(tick);
  }

  function combo(results: readonly { tier: RoundTier }[]): void {
    const count = currentCombo(results);
    root.querySelectorAll<HTMLElement>('[data-game-combo]').forEach((node) => {
      node.dataset.active = count > 1 ? 'true' : 'false';
      const label = node.querySelector<HTMLElement>('[data-game-combo-label]');
      if (label) label.textContent = count > 1 ? comboLine(count) : PLAY.combo;
    });
  }

  function clearBurst(): void {
    window.clearTimeout(burstTimer);
    particles?.replaceChildren();
  }

  function burst(tier: RoundTier): void {
    clearBurst();
    if (!particles || motion.matches || tier === 0) return;
    const anchor = root.querySelector('[data-game-reveal-badge]')?.getBoundingClientRect();
    if (anchor) {
      const frame = root.getBoundingClientRect();
      particles.style.left = `${anchor.left - frame.left + anchor.width / 2}px`;
      particles.style.top = `${anchor.top - frame.top + anchor.height / 2}px`;
    }
    particles.style.setProperty('--ra-burst-color', `var(--tier-${tier})`);
    for (const particle of celebrationParticles(tier)) {
      const piece = document.createElement('i');
      piece.className = particle.ribbon ? 'ra-particle ra-particle-ribbon' : 'ra-particle';
      piece.style.setProperty('--ra-x', `${particle.x}px`);
      piece.style.setProperty('--ra-y', `${particle.y}px`);
      piece.style.setProperty('--ra-spin', `${particle.rotation}deg`);
      piece.style.setProperty('--ra-delay', `${particle.delay}ms`);
      piece.style.setProperty('--ra-size', `${particle.size}px`);
      particles.append(piece);
    }
    burstTimer = window.setTimeout(clearBurst, 1_200);
  }

  function badge(target: HTMLElement | null, tier: RoundTier): void {
    art(target, 'badge', String(tier));
    if (!target) return;
    target.dataset.tier = String(tier);
  }

  function resultBadge(target: HTMLElement, tier: RoundTier, index: number): void {
    badge(target, tier);
    target.title = `${PLAY.promptLabel} ${index + 1}: ${tierName(tier)}`;
    const label = document.createElement('span');
    label.className = 'ra-result-label';
    label.textContent = tier === 0 ? '–' : String(index + 1).padStart(2, '0');
    target.append(label);
  }

  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    clearBurst();
    window.cancelAnimationFrame(scoreFrame);
    paintScore(targetScore);
  });
  window.addEventListener(
    'pagehide',
    () => {
      clearBurst();
      window.cancelAnimationFrame(scoreFrame);
    },
    { once: true },
  );

  return { art, lineup, score, combo, burst, clearBurst, badge, resultBadge };
}
