/**
 * Browser controller for one [data-game-root]. Pure rules stay in the
 * sibling modules. This file is the only game code that touches the DOM.
 */

import { CATEGORY_LABELS, isCategoryKey, type CategoryKey } from './categories';
import {
  dailyRoundNumber,
  formatCountdown,
  formatLocalDate,
  localDateKey,
  msUntilNextLocalMidnight,
  selectCategory,
  selectDaily,
  selectUnlimited,
  withPinnedPrompt,
} from './daily';
import { createTried, matchGuess, rememberGuess, type Matchable, type Tried } from './match';
import {
  commonAnswers,
  couldHaveNamedLine,
  countRarer,
  isSlug,
  promptDataPath,
  PROMPT_INDEX_PATH,
  rarerThanLine,
  rarestAnswers,
  toClientPrompt,
  isPromptIndexEntry,
  type ClientPrompt,
} from './prompts';
import {
  applyScore,
  freshScore,
  PENALTY_MS,
  TIMER_MS,
  tierName,
  type RoundTier,
  type ScoreState,
} from './score';
import { buildShareText, sharePageUrl, type ShareMode } from './share';
import {
  readDaily,
  readSettings,
  readStats,
  recordDaily,
  recordFreeRound,
  writeDaily,
  writeSettings,
  writeStats,
  type DailySave,
  type KeyValueStore,
  type PromptResult,
} from './stats';
import type { PromptIndexEntry } from './types';

type Mode = ShareMode;
type PlayAction = 'load' | 'retry' | 'start' | 'resume' | 'results' | 'empty';

interface Session {
  mode: Mode;
  category: CategoryKey | '';
  origin: string;
  dateKey: string;
  roundNumber: number;
  slugs: string[];
  index: PromptIndexEntry[];
  score: ScoreState;
  spotlightArmed: boolean;
  noTimer: boolean;
  timerLocked: boolean;
  results: PromptResult[];
  recorded: boolean;
}

interface Ui {
  root: HTMLElement;
  date: HTMLElement;
  count: HTMLElement;
  streak: HTMLElement;
  best: HTMLElement;
  status: HTMLElement;
  startCountdown: HTMLElement;
  play: HTMLButtonElement;
  playLabel: HTMLElement;
  playIcon: HTMLElement;
  helpOpen: HTMLButtonElement;
  noTimer: HTMLButtonElement;
  noTimerLabel: HTMLElement;
  progress: HTMLElement;
  promptCat: HTMLElement;
  question: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  hint: HTMLElement;
  pass: HTMLButtonElement;
  spotlight: HTMLButtonElement;
  spotlightLabel: HTMLElement;
  timer: HTMLElement;
  seconds: HTMLElement;
  ring: SVGCircleElement;
  revealKicker: HTMLElement;
  revealTier: HTMLElement;
  revealAnswer: HTMLElement;
  revealPoints: HTMLElement;
  meter: HTMLElement;
  could: HTMLElement;
  rarer: HTMLElement;
  answersLink: HTMLAnchorElement;
  rarest: HTMLOListElement;
  common: HTMLOListElement;
  next: HTMLButtonElement;
  finalHeading: HTMLElement;
  finalScore: HTMLElement;
  squares: HTMLElement[];
  tierCounts: HTMLElement[];
  countdown: HTMLElement;
  sharePreview: HTMLElement;
  share: HTMLButtonElement;
  copy: HTMLButtonElement;
  download: HTMLButtonElement;
  shareStatus: HTMLElement;
  canvas: HTMLCanvasElement;
  again: HTMLButtonElement | null;
  live: HTMLElement;
  dialog: HTMLDialogElement;
  dialogClose: HTMLButtonElement;
  dialogTitle: HTMLElement;
}

export function mountGame(root: HTMLElement): void {
  if (root.dataset.mounted === '1') return;
  root.dataset.mounted = '1';
  let ui: Ui;
  try {
    ui = grab(root);
  } catch {
    const status = root.querySelector('[data-game-status]');
    if (status) status.textContent = 'This round could not start in this browser.';
    return;
  }
  void run(ui);
}

function run(ui: Ui): void {
  const store = browserStore();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mode = readMode(ui.root.dataset.mode);
  const categoryAttr = ui.root.dataset.category ?? '';
  const category = isCategoryKey(categoryAttr) ? categoryAttr : '';
  const promptCache = new Map<string, Promise<ClientPrompt>>();
  let stats = readStats(store);
  let action: PlayAction = 'load';
  let starting = false;
  let locked = false;
  let token = 0;
  let liveMs = TIMER_MS;
  let deadline = 0;
  let timerId = 0;
  let countdownId = 0;
  let announcedSecond = -1;
  let tried: Tried = createTried();
  let current: ClientPrompt | null = null;
  const session: Session = {
    mode,
    category: mode === 'category' ? category : '',
    origin: ui.root.dataset.origin ?? '',
    dateKey: localDateKey(new Date()),
    roundNumber: 1,
    slugs: [],
    index: [],
    score: freshScore(),
    spotlightArmed: false,
    noTimer: readSettings(store).noTimer,
    timerLocked: false,
    results: [],
    recorded: false,
  };

  ui.helpOpen.addEventListener('click', () => {
    ui.dialog.showModal();
    ui.dialogTitle.focus();
  });
  ui.dialogClose.addEventListener('click', () => ui.dialog.close());
  ui.noTimer.addEventListener('click', () => {
    if (ui.noTimer.disabled) return;
    session.noTimer = !session.noTimer;
    writeSettings(store, { version: 1, noTimer: session.noTimer });
    paintSwitch();
  });
  ui.play.addEventListener('click', () => {
    void onPlay();
  });
  ui.form.addEventListener('submit', (event) => {
    event.preventDefault();
    onGuess(ui.input.value);
  });
  ui.pass.addEventListener('click', () => resolve('pass'));
  ui.spotlight.addEventListener('click', () => {
    if (session.score.spotlightUsed) return;
    session.spotlightArmed = !session.spotlightArmed;
    paintSpotlight();
  });
  ui.next.addEventListener('click', () => {
    if (session.results.length >= session.slugs.length) showEnd();
    else void startPrompt();
  });
  ui.share.addEventListener('click', () => {
    void onShare();
  });
  ui.copy.addEventListener('click', () => {
    void copyText(currentShareText());
  });
  ui.download.addEventListener('click', () => downloadCard());
  if (ui.again) {
    ui.again.addEventListener('click', () => {
      stopCountdown();
      dealFree(randomSeed());
      void startPrompt();
    });
  }

  session.roundNumber = dailyRoundNumber(session.dateKey);
  paintSwitch();
  paintStats();
  paintDate();
  void loadIndex();

  async function loadIndex(): Promise<void> {
    action = 'load';
    ui.root.setAttribute('aria-busy', 'true');
    paintPlay();
    ui.status.textContent = '';
    try {
      const res = await fetch(PROMPT_INDEX_PATH);
      if (!res.ok) throw new Error('index');
      const body: unknown = await res.json();
      if (!Array.isArray(body)) throw new Error('index');
      session.index = body.filter(isPromptIndexEntry);
      session.dateKey = localDateKey(new Date());
      session.roundNumber = dailyRoundNumber(session.dateKey);
      prepareRound();
    } catch {
      action = 'retry';
      ui.status.textContent = 'The prompt list did not load. Try again.';
      paintPlay();
    } finally {
      ui.root.setAttribute('aria-busy', 'false');
    }
  }

  function prepareRound(): void {
    stats = readStats(store);
    paintStats();
    paintDate();
    session.results = [];
    session.score = freshScore();
    session.spotlightArmed = false;
    session.recorded = false;
    session.timerLocked = false;
    session.noTimer = readSettings(store).noTimer;

    if (session.mode === 'daily') {
      const save = readDaily(store, session.dateKey);
      if (save && save.slugs.every((slug) => session.index.some((entry) => entry.slug === slug))) {
        restoreSave(save);
      } else {
        session.slugs = selectDaily(session.index, new Date()).map((entry) => entry.slug);
      }
    } else if (session.mode === 'category' && session.category) {
      session.slugs = selectCategory(session.index, session.category, randomSeed()).map(
        (entry) => entry.slug,
      );
    } else if (session.mode === 'unlimited') {
      const round = selectUnlimited(session.index, randomSeed());
      session.slugs = withPinnedPrompt(round, requestedPrompt(), session.index).map(
        (entry) => entry.slug,
      );
    } else {
      session.slugs = [];
    }

    ui.count.textContent = session.slugs.length > 0 ? String(session.slugs.length) : '0';
    if (session.slugs.length === 0) {
      action = 'empty';
      ui.status.textContent = emptyMessage();
      paintSwitch();
      paintPlay();
      return;
    }
    if (
      session.recorded ||
      (session.mode === 'daily' &&
        session.results.length >= session.slugs.length &&
        session.slugs.length > 0)
    ) {
      action = 'results';
      ui.status.textContent = `You already played today. Score ${session.score.total}.`;
      paintCountdownLine();
      startCountdown();
    } else if (session.results.length > 0) {
      action = 'resume';
      ui.status.textContent = `Round in progress. Prompt ${session.results.length + 1} of ${session.slugs.length} is next.`;
    } else {
      action = 'start';
      ui.status.textContent =
        session.mode === 'daily'
          ? 'Same prompts for everyone on this date.'
          : 'A fresh set of prompts. The daily streak stays put.';
    }
    paintSwitch();
    paintPlay();
    prefetch(session.slugs[session.results.length]);
  }

  function restoreSave(save: DailySave): void {
    session.slugs = save.slugs.slice();
    session.results = save.results.map((row) => ({ ...row }));
    session.score = { total: save.score, spotlightUsed: save.spotlightUsed };
    session.noTimer = save.noTimer;
    session.timerLocked = true;
    session.recorded = save.recorded;
    if (save.completed && !save.recorded) finalizeStats();
  }

  async function onPlay(): Promise<void> {
    if (action === 'retry') {
      await loadIndex();
      return;
    }
    if (action === 'results') {
      showEnd();
      return;
    }
    if (action === 'empty' || action === 'load' || starting) return;
    starting = true;
    if (session.mode === 'daily' && session.results.length === 0) {
      session.dateKey = localDateKey(new Date());
      session.roundNumber = dailyRoundNumber(session.dateKey);
      session.slugs = selectDaily(session.index, new Date()).map((entry) => entry.slug);
      session.noTimer = ui.noTimer.getAttribute('aria-checked') === 'true';
      session.timerLocked = true;
      persistDaily();
    } else if (session.mode !== 'daily' && session.results.length === 0) {
      session.noTimer = ui.noTimer.getAttribute('aria-checked') === 'true';
      session.timerLocked = true;
    }
    try {
      await startPrompt();
    } finally {
      starting = false;
    }
  }

  async function startPrompt(): Promise<void> {
    const slug = session.slugs[session.results.length];
    if (!slug) {
      if (session.results.length === 0) {
        action = 'empty';
        ui.status.textContent = emptyMessage();
        showView(ui.root, 'start');
        paintPlay();
        return;
      }
      showEnd();
      return;
    }
    const my = ++token;
    showView(ui.root, 'play');
    locked = true;
    stopTimer();
    ui.question.textContent = 'Loading prompt';
    ui.input.disabled = true;
    ui.progress.textContent = `Prompt ${session.results.length + 1} of ${session.slugs.length}`;
    let prompt: ClientPrompt;
    try {
      prompt = await loadPrompt(slug);
    } catch {
      if (my !== token) return;
      action = 'retry';
      ui.status.textContent = 'That prompt did not load. Try again.';
      showView(ui.root, 'start');
      paintPlay();
      return;
    }
    if (my !== token) return;
    current = prompt;
    tried = createTried();
    liveMs = TIMER_MS;
    announcedSecond = session.noTimer ? -1 : Math.ceil(TIMER_MS / 1000);
    locked = false;
    ui.input.disabled = false;
    ui.input.value = '';
    ui.question.textContent = prompt.question;
    ui.promptCat.textContent = CATEGORY_LABELS[prompt.category];
    paintHint();
    paintSpotlight();
    paintTimer(session.noTimer ? null : liveMs);
    prefetch(session.slugs[session.results.length + 1]);
    startTimer();
    ui.input.focus();
  }

  function onGuess(raw: string): void {
    if (locked || !current) return;
    const result = matchGuess(current.answers, raw, tried);
    if (result.status === 'empty') return;
    rememberGuess(tried, raw, result);
    if (result.status === 'duplicate') {
      shake(ui.form);
      ui.hint.textContent = 'Already tried. That does not cost a second.';
      announce(ui, 'Already tried');
      ui.input.select();
      return;
    }
    if (result.status === 'miss') {
      shake(ui.form);
      if (!session.noTimer) {
        liveMs = Math.max(0, liveMs - PENALTY_MS);
        if (liveMs <= 0) {
          resolve('time');
          return;
        }
        deadline = performance.now() + liveMs;
        paintTimer(liveMs);
      }
      ui.hint.textContent = session.noTimer
        ? 'Not on the list.'
        : 'Not on the list. One second off the clock.';
      announce(ui, ui.hint.textContent);
      ui.input.select();
      return;
    }
    resolve('hit', result.answer);
  }

  function resolve(outcome: 'hit' | 'time' | 'pass', answer?: Matchable): void {
    if (locked || !current) return;
    locked = true;
    stopTimer();
    const tier: RoundTier = outcome === 'hit' && answer ? answer.tier : 0;
    const before = session.score.spotlightUsed;
    const applied = applyScore(session.score, tier, session.spotlightArmed);
    session.score = applied.state;
    const spotlight = !before && applied.state.spotlightUsed;
    session.spotlightArmed = false;
    const row: PromptResult = {
      slug: current.slug,
      tier,
      points: applied.points,
      answer: outcome === 'hit' && answer ? answer.name : null,
      outcome,
      spotlight,
    };
    session.results.push(row);
    persistDaily();
    showReveal(current, row);
  }

  function showReveal(prompt: ClientPrompt, result: PromptResult): void {
    const label = tierName(result.tier);
    ui.revealKicker.textContent = CATEGORY_LABELS[prompt.category];
    ui.revealTier.textContent = result.tier === 0 ? 'No points' : label;
    ui.revealAnswer.textContent =
      result.outcome === 'hit' && result.answer
        ? `You answered ${result.answer}.`
        : result.outcome === 'pass'
          ? 'You passed.'
          : 'Time ran out.';
    ui.revealPoints.textContent =
      result.points === 0
        ? '0 points'
        : result.spotlight
          ? `${result.points} points with Spotlight`
          : `${result.points} points`;
    ui.meter.setAttribute(
      'aria-label',
      result.tier === 0 ? 'No tier' : `${label}, tier ${result.tier} of 6`,
    );
    ui.meter.querySelectorAll<HTMLElement>('[data-tier]').forEach((seg) => {
      const n = Number(seg.dataset.tier);
      if (result.tier > 0 && n <= result.tier) seg.dataset.on = 'true';
      else delete seg.dataset.on;
    });
    ui.could.textContent = couldHaveNamedLine(prompt.answers.length);
    if (result.outcome === 'hit') {
      const mine = prompt.answers.find((row) => row.name === result.answer);
      ui.rarer.hidden = false;
      ui.rarer.textContent = rarerThanLine(countRarer(prompt.answers, mine?.rarity ?? 1));
    } else {
      ui.rarer.hidden = true;
      ui.rarer.textContent = '';
    }
    ui.answersLink.href = `/answers/${encodeURIComponent(prompt.slug)}/`;
    fillList(ui.rarest, rarestAnswers(prompt.answers), result.answer);
    fillList(ui.common, commonAnswers(prompt.answers), result.answer);
    const last = session.results.length >= session.slugs.length;
    ui.next.textContent = last ? 'See results' : 'Next prompt';
    showView(ui.root, 'reveal');
    announce(
      ui,
      result.tier === 0 ? 'No points on that prompt.' : `${label}. ${result.points} points.`,
    );
    ui.next.focus();
  }

  function showEnd(): void {
    finalizeStats();
    const tiers = session.results.map((row) => row.tier);
    ui.finalScore.textContent = String(session.score.total);
    ui.squares.forEach((square, index) => {
      const tier = tiers[index];
      if (tier === undefined) {
        square.hidden = true;
        return;
      }
      square.hidden = false;
      square.dataset.tier = String(tier);
    });
    const grid = ui.squares[0]?.parentElement;
    if (grid) {
      grid.setAttribute(
        'aria-label',
        tiers.map((tier) => (tier === 0 ? 'Passed' : tierName(tier))).join(', '),
      );
    }
    const counts = new Map<number, number>();
    for (const tier of tiers) counts.set(tier, (counts.get(tier) ?? 0) + 1);
    for (const node of ui.tierCounts) {
      const tier = Number(node.dataset.tier);
      node.textContent = String(counts.get(tier) ?? 0);
    }
    ui.sharePreview.textContent = currentShareText();
    ui.shareStatus.textContent = '';
    showView(ui.root, 'end');
    if (session.mode === 'daily') {
      ui.countdown.hidden = false;
      startCountdown();
    } else {
      ui.countdown.hidden = true;
      ui.countdown.textContent = '';
    }
    announce(ui, `Round complete. ${session.score.total} points.`);
    ui.finalHeading.focus();
  }

  function finalizeStats(): void {
    if (session.recorded) return;
    const tiers = session.results.map((row) => row.tier);
    if (session.mode === 'daily') {
      stats = recordDaily(stats, {
        dateKey: session.dateKey,
        score: session.score.total,
        tiers,
      });
    } else {
      stats = recordFreeRound(stats, { score: session.score.total, tiers });
    }
    writeStats(store, stats);
    session.recorded = true;
    persistDaily();
    paintStats();
  }

  function dealFree(seed: number): void {
    session.results = [];
    session.score = freshScore();
    session.spotlightArmed = false;
    session.recorded = false;
    session.dateKey = localDateKey(new Date());
    if (session.mode === 'category' && session.category) {
      session.slugs = selectCategory(session.index, session.category, seed).map(
        (entry) => entry.slug,
      );
    } else {
      session.slugs = selectUnlimited(session.index, seed).map((entry) => entry.slug);
    }
  }

  function persistDaily(): void {
    if (session.mode !== 'daily') return;
    const save: DailySave = {
      version: 1,
      date: session.dateKey,
      slugs: session.slugs.slice(),
      cursor: session.results.length,
      score: session.score.total,
      spotlightUsed: session.score.spotlightUsed,
      noTimer: session.noTimer,
      results: session.results.map((row) => ({ ...row })),
      completed: session.results.length >= session.slugs.length && session.slugs.length > 0,
      recorded: session.recorded,
    };
    writeDaily(store, save);
  }

  function startTimer(): void {
    stopTimer();
    if (session.noTimer) {
      paintTimer(null);
      return;
    }
    deadline = performance.now() + liveMs;
    timerId = window.setInterval(
      () => {
        liveMs = Math.max(0, deadline - performance.now());
        paintTimer(liveMs);
        if (liveMs <= 0) resolve('time');
      },
      reduceMotion ? 250 : 100,
    );
  }

  function stopTimer(): void {
    if (timerId) window.clearInterval(timerId);
    timerId = 0;
  }

  function paintTimer(ms: number | null): void {
    if (ms === null) {
      ui.seconds.textContent = 'Off';
      ui.timer.setAttribute('aria-label', 'Timer off');
      ui.ring.style.strokeDashoffset = '100';
      delete ui.ring.dataset.low;
      return;
    }
    const second = Math.ceil(ms / 1000);
    ui.seconds.textContent = String(second);
    ui.timer.setAttribute('aria-label', `${second} seconds left`);
    const progress = Math.min(1, Math.max(0, ms / TIMER_MS));
    ui.ring.style.strokeDashoffset = String(100 * (1 - progress));
    if (second <= 5) ui.ring.dataset.low = 'true';
    else delete ui.ring.dataset.low;
    if (second !== announcedSecond) {
      announcedSecond = second;
      if (second === 10 || second === 5) announce(ui, `${second} seconds left`);
    }
  }

  function paintSwitch(): void {
    ui.noTimer.disabled = session.timerLocked;
    ui.noTimer.setAttribute('aria-checked', session.noTimer ? 'true' : 'false');
    ui.noTimerLabel.textContent = session.noTimer ? 'No timer' : 'Timer on';
  }

  function paintSpotlight(): void {
    if (session.score.spotlightUsed) {
      ui.spotlight.disabled = true;
      ui.spotlight.setAttribute('aria-pressed', 'false');
      ui.spotlightLabel.textContent = 'Spotlight used';
      ui.spotlight.classList.remove('btn-primary');
      ui.spotlight.classList.add('btn-outline');
      return;
    }
    ui.spotlight.disabled = false;
    if (session.spotlightArmed) {
      ui.spotlight.setAttribute('aria-pressed', 'true');
      ui.spotlightLabel.textContent = 'Spotlight armed';
      ui.spotlight.classList.add('btn-primary');
      ui.spotlight.classList.remove('btn-outline');
      return;
    }
    ui.spotlight.setAttribute('aria-pressed', 'false');
    ui.spotlightLabel.textContent = 'Spotlight ×2';
    ui.spotlight.classList.remove('btn-primary');
    ui.spotlight.classList.add('btn-outline');
  }

  function paintHint(): void {
    ui.hint.textContent = session.noTimer
      ? 'Enter to guess. A wrong guess does not cost time. Pass to move on.'
      : 'Enter to guess. A wrong guess costs one second.';
  }

  function paintPlay(): void {
    ui.play.disabled = action === 'load' || action === 'empty';
    ui.playIcon.hidden = action === 'results' || action === 'retry' || action === 'empty';
    const labels: Record<PlayAction, string> = {
      load: 'Loading round',
      retry: 'Try again',
      start: 'Play',
      resume: 'Continue',
      results: 'See your result',
      empty: 'Nothing to play',
    };
    ui.playLabel.textContent = labels[action];
  }

  function paintDate(): void {
    const formatted = formatLocalDate(new Date());
    ui.date.textContent =
      session.mode === 'daily' ? `${formatted} · #${session.roundNumber}` : formatted;
  }

  function paintStats(): void {
    ui.streak.textContent = String(stats.streak);
    ui.best.textContent = stats.dailyPlayed > 0 ? String(stats.bestDailyScore) : '–';
  }

  function paintCountdownLine(): void {
    if (session.mode !== 'daily' || !session.recorded) {
      ui.startCountdown.textContent = '';
      return;
    }
    const ms = msUntilNextLocalMidnight(new Date());
    ui.startCountdown.textContent =
      ms <= 0
        ? 'The next daily is ready. Reload to play it.'
        : `Next daily in ${formatCountdown(ms)}`;
  }

  function startCountdown(): void {
    stopCountdown();
    const tick = () => {
      const ms = msUntilNextLocalMidnight(new Date());
      const text =
        ms <= 0
          ? 'The next daily is ready. Reload to play it.'
          : `Next daily in ${formatCountdown(ms)}`;
      ui.countdown.textContent = text;
      paintCountdownLine();
    };
    tick();
    countdownId = window.setInterval(tick, 1000);
  }

  function stopCountdown(): void {
    if (countdownId) window.clearInterval(countdownId);
    countdownId = 0;
  }

  function currentShareText(): string {
    return buildShareText({
      mode: session.mode,
      roundNumber: session.roundNumber,
      categoryLabel: session.category ? CATEGORY_LABELS[session.category] : undefined,
      tiers: session.results.map((row) => row.tier),
      score: session.score.total,
      spotlightUsed: session.score.spotlightUsed,
      noTimer: session.noTimer,
      url: sharePageUrl(session.origin, session.mode, session.category || undefined),
    });
  }

  async function onShare(): Promise<void> {
    const text = currentShareText();
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: 'Rarest Answer', text });
        ui.shareStatus.textContent = 'Shared';
        announce(ui, 'Shared');
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copyText(text);
  }

  async function copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      ui.shareStatus.textContent = 'Copied';
      announce(ui, 'Result copied');
    } catch {
      ui.shareStatus.textContent = 'Select the result below to copy it.';
      announce(ui, 'Select the result text to copy it');
    }
  }

  function downloadCard(): void {
    drawShareCard(ui.canvas, {
      title: shareHeading(),
      score: session.score.total,
      tiers: session.results.map((row) => row.tier),
      url: sharePageUrl(session.origin, session.mode, session.category || undefined),
    });
    ui.canvas.toBlob((blob) => {
      if (!blob) {
        ui.shareStatus.textContent = 'The image could not be built.';
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName();
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      ui.shareStatus.textContent = 'Image downloaded';
      announce(ui, 'Image downloaded');
    });
  }

  function shareHeading(): string {
    if (session.mode === 'daily') return `Daily #${session.roundNumber}`;
    if (session.mode === 'category' && session.category) return CATEGORY_LABELS[session.category];
    return 'Unlimited';
  }

  function downloadName(): string {
    if (session.mode === 'daily') return `rarest-answer-${session.dateKey}.png`;
    if (session.mode === 'category' && session.category)
      return `rarest-answer-${session.category}.png`;
    return 'rarest-answer-unlimited.png';
  }

  function emptyMessage(): string {
    if (session.mode === 'category' && session.category) {
      return `No ${CATEGORY_LABELS[session.category].toLowerCase()} prompts are loaded yet. The daily round still plays whatever is in the list.`;
    }
    return 'No prompts are loaded yet.';
  }

  function loadPrompt(slug: string): Promise<ClientPrompt> {
    const cached = promptCache.get(slug);
    if (cached) return cached;
    const pending = fetch(promptDataPath(slug)).then(async (res) => {
      if (!res.ok) throw new Error(slug);
      const body: unknown = await res.json();
      const prompt = toClientPrompt(body);
      if (!prompt || prompt.slug !== slug) throw new Error(slug);
      return prompt;
    });
    promptCache.set(slug, pending);
    pending.catch(() => {
      promptCache.delete(slug);
    });
    return pending;
  }

  function prefetch(slug: string | undefined): void {
    if (!slug) return;
    void loadPrompt(slug).catch(() => {});
  }
}

function readMode(value: string | undefined): Mode {
  if (value === 'unlimited' || value === 'category') return value;
  return 'daily';
}

function showView(root: HTMLElement, name: string): void {
  root.querySelectorAll<HTMLElement>('[data-game-view]').forEach((node) => {
    node.hidden = node.dataset.gameView !== name;
  });
}

function announce(ui: Ui, message: string): void {
  ui.live.textContent = '';
  window.setTimeout(() => {
    ui.live.textContent = message;
  }, 30);
}

function shake(form: HTMLElement): void {
  form.classList.remove('ra-shake');
  void form.offsetWidth;
  form.classList.add('ra-shake');
}

function fillList(
  list: HTMLOListElement,
  answers: ClientPrompt['answers'],
  player: string | null,
): void {
  list.replaceChildren();
  for (const answer of answers) {
    const item = document.createElement('li');
    item.className =
      'flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm';
    const name = document.createElement('span');
    name.className =
      player && answer.name === player
        ? 'min-w-0 flex-1 break-words font-semibold text-nav'
        : 'min-w-0 flex-1 break-words text-foreground';
    name.textContent = answer.name;
    if (player && answer.name === player) item.setAttribute('aria-current', 'true');
    const tier = document.createElement('span');
    tier.className = 'shrink-0 text-muted-foreground';
    tier.textContent = tierName(answer.tier);
    item.append(name, tier);
    list.append(item);
  }
}

function drawShareCard(
  canvas: HTMLCanvasElement,
  card: { title: string; score: number; tiers: number[]; url: string },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = hslFromToken('--background');
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = hslFromToken('--brand', 40);
  ctx.fillRect(0, 0, width, 16);
  ctx.fillStyle = hslFromToken('--foreground');
  ctx.font = '700 64px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Rarest Answer', 72, 150);
  ctx.fillStyle = hslFromToken('--muted-foreground');
  ctx.font = '500 28px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(card.title, 72, 202);
  ctx.fillStyle = hslFromToken('--foreground');
  ctx.font = '700 92px ui-sans-serif, system-ui, sans-serif';
  const scoreText = String(card.score);
  ctx.fillText(scoreText, 72, 330);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.fillStyle = hslFromToken('--muted-foreground');
  ctx.font = '500 28px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('points', 72 + scoreWidth + 20, 330);

  const size = 64;
  const gap = 16;
  const total = card.tiers.length * size + Math.max(0, card.tiers.length - 1) * gap;
  let x = (width - total) / 2;
  const y = 390;
  for (const tier of card.tiers) {
    ctx.fillStyle = tier === 0 ? hslFromToken('--muted') : hslFromToken(`--tier-${tier}`);
    roundRect(ctx, x, y, size, size, 12);
    x += size + gap;
  }

  let host = card.url;
  try {
    host = new URL(card.url).host;
  } catch {
    host = card.url;
  }
  ctx.fillStyle = hslFromToken('--muted-foreground');
  ctx.font = '500 24px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(host, 72, height - 56);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function hslFromToken(name: string, lightness?: number): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/);
  if (parts.length < 3) return 'hsl(0, 0%, 45%)';
  const light = lightness === undefined ? parts[2] : `${lightness}%`;
  return `hsl(${parts[0]}, ${parts[1]}, ${light})`;
}

function randomSeed(): number {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  } catch {
    return Date.now() % 4294967295 || 1;
  }
}

function browserStore(): KeyValueStore {
  return {
    getItem(key) {
      return localStorage.getItem(key);
    },
    setItem(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

function grab(root: HTMLElement): Ui {
  return {
    root,
    date: must(root, '[data-game-date]'),
    count: must(root, '[data-game-prompt-count]'),
    streak: must(root, '[data-game-streak]'),
    best: must(root, '[data-game-best]'),
    status: must(root, '[data-game-status]'),
    startCountdown: must(root, '[data-game-start-countdown]'),
    play: mustButton(root, '[data-game-play]'),
    playLabel: must(root, '[data-game-play-label]'),
    playIcon: must(root, '[data-game-play-icon]'),
    helpOpen: mustButton(root, '[data-game-help-open]'),
    noTimer: mustButton(root, '[data-game-notimer]'),
    noTimerLabel: must(root, '[data-game-notimer-label]'),
    progress: must(root, '[data-game-progress]'),
    promptCat: must(root, '[data-game-prompt-cat]'),
    question: must(root, '[data-game-question]'),
    form: mustForm(root, '[data-game-form]'),
    input: mustInput(root, '[data-game-input]'),
    hint: must(root, '[data-game-hint]'),
    pass: mustButton(root, '[data-game-pass]'),
    spotlight: mustButton(root, '[data-game-spotlight]'),
    spotlightLabel: must(root, '[data-game-spotlight-label]'),
    timer: must(root, '[data-game-timer]'),
    seconds: must(root, '[data-game-seconds]'),
    ring: mustCircle(root, '[data-game-ring]'),
    revealKicker: must(root, '[data-game-reveal-kicker]'),
    revealTier: must(root, '[data-game-reveal-tier]'),
    revealAnswer: must(root, '[data-game-reveal-answer]'),
    revealPoints: must(root, '[data-game-reveal-points]'),
    meter: must(root, '[data-game-meter]'),
    could: must(root, '[data-game-could]'),
    rarer: must(root, '[data-game-rarer]'),
    answersLink: mustAnchor(root, '[data-game-answers]'),
    rarest: mustList(root, '[data-game-rarest]'),
    common: mustList(root, '[data-game-common]'),
    next: mustButton(root, '[data-game-next]'),
    finalHeading: must(root, '[data-game-final-heading]'),
    finalScore: must(root, '[data-game-final-score]'),
    squares: mustAll(root, '[data-game-sq]'),
    tierCounts: mustAll(root, '[data-game-tier-count]'),
    countdown: must(root, '[data-game-countdown]'),
    sharePreview: must(root, '[data-game-share-preview]'),
    share: mustButton(root, '[data-game-share]'),
    copy: mustButton(root, '[data-game-copy]'),
    download: mustButton(root, '[data-game-download]'),
    shareStatus: must(root, '[data-game-share-status]'),
    canvas: mustCanvas(root, '[data-game-canvas]'),
    again: optionalButton(root, '[data-game-again]'),
    live: must(root, '[data-game-live]'),
    dialog: mustDialog(root, '[data-game-dialog]'),
    dialogClose: mustButton(root, '[data-game-dialog-close]'),
    dialogTitle: must(root, '[data-game-dialog-title]'),
  };
}

function must(root: ParentNode, selector: string): HTMLElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(selector);
  return node;
}

function mustAll(root: ParentNode, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)].filter((node) => node instanceof HTMLElement);
}

function mustButton(root: ParentNode, selector: string): HTMLButtonElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLButtonElement)) throw new Error(selector);
  return node;
}

function optionalButton(root: ParentNode, selector: string): HTMLButtonElement | null {
  const node = root.querySelector(selector);
  return node instanceof HTMLButtonElement ? node : null;
}

function mustForm(root: ParentNode, selector: string): HTMLFormElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLFormElement)) throw new Error(selector);
  return node;
}

function mustInput(root: ParentNode, selector: string): HTMLInputElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLInputElement)) throw new Error(selector);
  return node;
}

function requestedPrompt(): string | null {
  try {
    const value = new URLSearchParams(window.location.search).get('prompt');
    return value && isSlug(value) ? value : null;
  } catch {
    return null;
  }
}

function mustAnchor(root: ParentNode, selector: string): HTMLAnchorElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLAnchorElement)) throw new Error(selector);
  return node;
}

function mustList(root: ParentNode, selector: string): HTMLOListElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLOListElement)) throw new Error(selector);
  return node;
}

function mustCircle(root: ParentNode, selector: string): SVGCircleElement {
  const node = root.querySelector(selector);
  if (!(node instanceof SVGCircleElement)) throw new Error(selector);
  return node;
}

function mustCanvas(root: ParentNode, selector: string): HTMLCanvasElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLCanvasElement)) throw new Error(selector);
  return node;
}

function mustDialog(root: ParentNode, selector: string): HTMLDialogElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLDialogElement)) throw new Error(selector);
  return node;
}
