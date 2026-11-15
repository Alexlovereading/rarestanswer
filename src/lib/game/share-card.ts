/** Canvas export reuses the rendered TierBadge SVGs, including their theme colors. */
import { PLAY } from './copy';
import { tierName } from './score';

interface ShareCard {
  title: string;
  score: number;
  tiers: number[];
  spotlight: boolean;
  noTimer: boolean;
  url: string;
}

export async function drawShareCard(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  card: ShareCard,
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const badges = new Map(
    await Promise.all(
      [...new Set(card.tiers.filter((tier) => tier > 0))].map(
        async (tier) => [tier, await badgeImage(root, tier)] as const,
      ),
    ),
  );
  // Keep the browser's self-hosted font in the downloaded card too.
  await document.fonts.ready;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = token('--background');
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width - 120, 100, 10, width - 120, 100, 420);
  glow.addColorStop(0, token('--tier-6', 0.14));
  glow.addColorStop(1, token('--tier-6', 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = token('--tier-6', 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(22, 22, width - 44, height - 44, 28);
  else ctx.rect(22, 22, width - 44, height - 44);
  ctx.stroke();
  const accent = ctx.createLinearGradient(64, 0, width - 64, 0);
  accent.addColorStop(0, token('--brand'));
  accent.addColorStop(1, token('--tier-6'));
  ctx.fillStyle = accent;
  ctx.fillRect(64, 40, width - 128, 5);

  text(ctx, PLAY.wordmark, 64, 104, 42, 800, '--foreground');
  text(ctx, card.title, 64, 146, 27, 500, '--muted-foreground');
  text(ctx, String(card.score), 64, 272, 108, 800, '--foreground');
  const scoreWidth = ctx.measureText(String(card.score)).width;
  text(ctx, PLAY.pointsWord, 84 + scoreWidth, 272, 28, 500, '--muted-foreground');
  const flags = [card.spotlight ? PLAY.spotlightUsed : '', card.noTimer ? PLAY.noTimer : '']
    .filter(Boolean)
    .join(' · ');
  if (flags) text(ctx, flags, 64, 312, 22, 500, '--muted-foreground');
  const best = Math.max(0, ...card.tiers);
  const bestBadge = badges.get(best);
  if (bestBadge) ctx.drawImage(bestBadge, width - 240, 88, 156, 156);

  text(ctx, PLAY.resultCard, 64, 354, 21, 700, '--muted-foreground');
  const cell = (width - 128) / Math.max(7, card.tiers.length);
  card.tiers.forEach((tier, index) => {
    const left = 64 + index * cell;
    const badge = badges.get(tier);
    if (badge) ctx.drawImage(badge, left + (cell - 84) / 2, 368, 84, 84);
    else {
      ctx.strokeStyle = token('--border');
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(left + cell / 2, 410, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.textAlign = 'center';
    text(ctx, tierName(tier), left + cell / 2, 480, 18, 600, '--foreground');
    text(
      ctx,
      String(index + 1).padStart(2, '0'),
      left + cell / 2,
      505,
      16,
      600,
      '--muted-foreground',
    );
    ctx.textAlign = 'start';
  });
  text(ctx, PLAY.tagline, 64, height - 70, 25, 600, '--foreground');
  let host = card.url;
  try {
    host = new URL(card.url).host;
  } catch {
    /* Use the supplied URL. */
  }
  text(ctx, host, 64, height - 37, 21, 500, '--muted-foreground');
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
): void {
  ctx.fillStyle = token(color);
  ctx.font = `${weight} ${size}px "Source Sans 3", ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(value, x, y);
}

function token(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `hsl(${raw} / ${alpha})`;
}

async function badgeImage(root: HTMLElement, tier: number): Promise<HTMLImageElement> {
  const template = root.querySelector<HTMLTemplateElement>(`[data-game-badge-template="${tier}"]`);
  if (!template) throw new Error('Badge unavailable');
  const stage = document.createElement('span');
  stage.style.cssText =
    'position:fixed;left:-10000px;top:0;width:104px;height:104px;visibility:hidden;pointer-events:none';
  stage.setAttribute('aria-hidden', 'true');
  stage.append(template.content.cloneNode(true));
  root.append(stage);
  let url = '';
  try {
    const svg = stage.querySelector('svg');
    if (!svg) throw new Error('Badge SVG unavailable');
    const clone = svg.cloneNode(true);
    if (!(clone instanceof SVGSVGElement)) throw new Error('Badge SVG unavailable');
    const originals = [svg, ...svg.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    // Inline computed paint so currentColor, theme tokens and Astro-scoped CSS
    // survive rasterization without relying on the page stylesheet.
    originals.forEach((node, index) => {
      const css = getComputedStyle(node);
      const target = copies[index];
      target.removeAttribute('class');
      target.removeAttribute('style');
      for (const property of [
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'opacity',
        'fill-opacity',
        'stroke-opacity',
        'color',
      ]) {
        target.setAttribute(property, css.getPropertyValue(property));
      }
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '120');
    clone.setAttribute('height', '120');
    url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
    );
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    stage.remove();
    if (url) URL.revokeObjectURL(url);
  }
}
