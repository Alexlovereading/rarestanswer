/** Stats dialog presentation. Only opening it fetches the rest of today's answers. */
import { CATEGORY_LABELS } from './categories';
import { PLAY, answerCountLine, catalogLine, chartSummary, emptyScoresLine } from './copy';
import type { ClientPrompt } from './prompts';
import { catalogTotals, promptTierDistribution } from './round-summary';
import { maxRoundScore, tierName } from './score';
import { scoreDistribution, tierDistribution, type DistRow, type StatsV1 } from './stats';
import type { PromptIndexEntry } from './types';

interface Snapshot {
  stats: StatsV1;
  index: readonly PromptIndexEntry[];
  daily: readonly PromptIndexEntry[];
  loaded: boolean;
  /** Includes this round's hits only while they have not been recorded. */
  hits: readonly number[];
}

export function createStatsView(
  root: HTMLElement,
  loadPrompt: (slug: string) => Promise<ClientPrompt>,
) {
  function get<T extends Element = HTMLElement>(selector: string): T {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(selector);
    return node;
  }
  const personal = get('[data-game-personal-stats]');
  const today = get('[data-game-today-round]');
  const roundList = get('[data-game-today-prompts]');
  const roundSummary = get('[data-game-today-summary]');
  const catalog = get('[data-game-catalog]');
  const guessTitle = get('[data-game-guess-title]');
  const guessFigure = get('[data-game-guess-figure]');
  const guessSvg = get<SVGSVGElement>('[data-game-guess-svg]');
  const guessStatus = get('[data-game-guess-empty]');
  const scoreChart = get('[data-game-score-chart]');
  const scoreSvg = get<SVGSVGElement>('[data-game-score-svg]');
  const scoreEmpty = get('[data-game-score-empty]');
  let snapshot: Snapshot;
  let roundKey = '';
  let loadingKey: string | null = null;
  let roundRows: DistRow[] | null = null;
  let failed = false;

  function paint(next: Snapshot): void {
    snapshot = next;
    const key = next.daily.map((entry) => entry.slug).join('|');
    if (key !== roundKey) {
      roundKey = key;
      roundRows = null;
      failed = false;
    }
    const { stats } = next;
    const hasRound = stats.roundsPlayed > 0;
    personal.hidden = !hasRound;
    today.hidden = hasRound;
    const values: Record<string, number | string> = {
      streak: stats.streak,
      'best-streak': stats.bestStreak,
      best: stats.dailyPlayed > 0 ? stats.bestDailyScore : '–',
      dailies: stats.dailyPlayed,
      rounds: stats.roundsPlayed,
      points: stats.totalPoints,
    };
    for (const [name, value] of Object.entries(values)) {
      get(`[data-game-stat-${name}]`).textContent = String(value);
    }
    if (!hasRound) paintRound(next);
    catalog.textContent = next.loaded ? catalogLine(catalogTotals(next.index)) : PLAY.statsLoading;
    scoreChart.hidden = stats.dailyScores.length === 0;
    scoreEmpty.hidden = stats.dailyScores.length > 0;
    scoreEmpty.textContent = next.loaded
      ? emptyScoresLine(maxRoundScore(next.daily.length))
      : PLAY.statsLoading;
    if (stats.dailyScores.length > 0) {
      paintDistribution(scoreSvg, scoreDistribution(stats.dailyScores), PLAY.scoreChart);
    }
    paintGuesses();
  }

  function paintRound(next: Snapshot): void {
    roundList.replaceChildren();
    for (const entry of next.daily) {
      const item = document.createElement('li');
      // This panel shows before the player has finished a round, so the
      // daily question text stays hidden (it would hand out today's prompts
      // ahead of the 25-second clock). Category and answer count only.
      const question = document.createElement('p');
      question.className = 'font-semibold text-foreground';
      question.textContent = CATEGORY_LABELS[entry.category];
      const meta = document.createElement('p');
      meta.className = 'text-sm text-muted-foreground';
      meta.textContent = answerCountLine(entry.answerCount);
      item.append(question, meta);
      roundList.append(item);
    }
    roundSummary.replaceChildren();
    if (!next.loaded) {
      roundSummary.textContent = PLAY.statsLoading;
      return;
    }
    for (const [label, count] of [
      [PLAY.answerPool, catalogTotals(next.daily).answers],
      [PLAY.maxScore, maxRoundScore(next.daily.length)],
    ] as const) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.className = 'text-sm text-muted-foreground';
      term.textContent = label;
      const value = document.createElement('dd');
      value.className = 'font-bold tabular-nums text-foreground';
      value.textContent = count.toLocaleString('en-US');
      group.append(term, value);
      roundSummary.append(group);
    }
  }

  function paintGuesses(): void {
    const ownGuesses = snapshot.hits.some((count) => count > 0);
    const caption = ownGuesses ? PLAY.guessChart : PLAY.roundChart;
    const rows = ownGuesses ? tierDistribution(snapshot.hits) : roundRows;
    guessTitle.textContent = caption;
    // Keep the chart's reserved height while its data arrives.
    guessSvg.style.visibility = rows ? '' : 'hidden';
    guessSvg.setAttribute('aria-hidden', String(!rows));
    guessFigure.setAttribute('aria-busy', String(loadingKey === roundKey));
    guessStatus.textContent = !snapshot.loaded
      ? PLAY.statsLoading
      : failed
        ? PLAY.tiersError
        : snapshot.daily.length === 0
          ? PLAY.emptyAll
          : PLAY.tiersLoading;
    guessStatus.style.visibility = rows ? 'hidden' : '';
    if (rows) paintDistribution(guessSvg, rows, caption, true);
  }

  async function loadRound(): Promise<void> {
    if (!snapshot.loaded || snapshot.daily.length === 0 || snapshot.hits.some((n) => n > 0)) return;
    if (roundRows || loadingKey === roundKey) return;
    const key = roundKey;
    loadingKey = key;
    failed = false;
    paintGuesses();
    try {
      const prompts = await Promise.all(snapshot.daily.map((entry) => loadPrompt(entry.slug)));
      if (key === roundKey) roundRows = promptTierDistribution(prompts);
    } catch {
      if (key === roundKey) failed = true;
    } finally {
      if (loadingKey === key) loadingKey = null;
      paintGuesses();
    }
  }

  return { paint, loadRound };
}

function paintDistribution(
  svg: SVGSVGElement,
  rows: readonly DistRow[],
  caption: string,
  tiers = false,
): void {
  const labelled = rows.map((row) => ({
    ...row,
    label: tiers ? tierName(Number(row.key)) : row.key,
  }));
  svg.setAttribute('aria-label', chartSummary(caption, labelled));
  svg.replaceChildren();
  labelled.forEach((row, index) => {
    const y = 4 + index * 28;
    const label = svgNode('text', {
      x: '0',
      y: String(y + 14),
      fill: 'currentColor',
      'font-size': '12',
    });
    label.textContent = row.label;
    const track = svgNode('rect', {
      x: '108',
      y: String(y + 4),
      width: '150',
      height: '12',
      rx: '6',
      fill: 'hsl(var(--muted))',
    });
    const fill = svgNode('rect', {
      x: '108',
      y: String(y + 4),
      width: String(row.share * 150),
      height: '12',
      rx: '6',
      fill: tiers ? `hsl(var(--tier-${row.key}))` : 'hsl(var(--brand))',
    });
    const count = svgNode('text', {
      x: '316',
      y: String(y + 14),
      'text-anchor': 'end',
      fill: 'currentColor',
      'font-size': '12',
    });
    count.textContent = String(row.count);
    svg.append(label, track, fill, count);
  });
}

function svgNode(name: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
