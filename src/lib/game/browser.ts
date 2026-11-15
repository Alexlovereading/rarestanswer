/**
 * Browser controller for one [data-game-root]. Pure rules stay in the
 * sibling modules. Presentation effects and canvas export have their own
 * DOM helpers in effects.ts and share-card.ts.
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
  answerRank,
  couldHaveNamedLine,
  countRarer,
  isSlug,
  placementLine,
  promptDataPath,
  PROMPT_INDEX_PATH,
  revealLists,
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
  PLAY,
  alreadyPlayedLine,
  answersLinkLabel,
  chartSummary,
  emptyCategoryLine,
  meterLabel,
  nextDailyLine,
  pointsLine,
  progressLine,
  resumeLine,
  revealAnswerLine,
  roundCompleteLive,
  shareHeading,
  streakLine,
  tierLive,
  timerLabel,
} from './copy';
import {
  readDaily,
  readSettings,
  readStats,
  recordDaily,
  recordFreeRound,
  scoreDistribution,
  tierDistribution,
  writeDaily,
  writeSettings,
  writeStats,
  type DailySave,
  type KeyValueStore,
  type PromptResult,
} from './stats';
import type { PromptIndexEntry } from './types';
import { createGameEffects } from './effects';
import { clockVisual } from './visuals';
import { drawShareCard } from './share-card';

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
  seenRules: boolean;
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
  playView: HTMLElement;
  revealView: HTMLElement;
  endView: HTMLElement;
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
  rarestHeading: HTMLElement;
  rarest: HTMLOListElement;
  commonBlock: HTMLElement;
  common: HTMLOListElement;
  outside: HTMLElement;
  next: HTMLButtonElement;
  finalHeading: HTMLElement;
  cardTitle: HTMLElement;
  endStreak: HTMLElement;
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
  statsOpen: HTMLButtonElement[];
  statsDialog: HTMLDialogElement;
  statsClose: HTMLButtonElement;
  statsTitle: HTMLElement;
  statStreak: HTMLElement;
  statBestStreak: HTMLElement;
  statBest: HTMLElement;
  statDailies: HTMLElement;
  statRounds: HTMLElement;
  statPoints: HTMLElement;
  guessSvg: SVGSVGElement;
  scoreSvg: SVGSVGElement;
  guessEmpty: HTMLElement;
  scoreEmpty: HTMLElement;
}

export function mountGame(root: HTMLElement): void {
  if (root.dataset.mounted === '1') return;
  root.dataset.mounted = '1';
  let ui: Ui;
  try {
    ui = grab(root);
  } catch {
    const status = root.querySelector('[data-game-status]');
    if (status) status.textContent = PLAY.mountFailed;
    return;
  }
  void run(ui);
}

function run(ui: Ui): void {
  const store = browserStore();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effects = createGameEffects(ui.root);
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
  let hitTimer = 0;
  let statsReturn: HTMLElement | null = null;
  const settings = readSettings(store);
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
    noTimer: settings.noTimer,
    seenRules: settings.seenRules,
    timerLocked: false,
    results: [],
    recorded: false,
  };

  ui.helpOpen.addEventListener('click', () => openHowTo());
  ui.dialogClose.addEventListener('click', () => ui.dialog.close());
  ui.dialog.addEventListener('close', () => {
    markRulesSeen();
    if (!ui.play.disabled && !ui.playView.hidden) return;
    if (!ui.play.disabled) ui.play.focus();
  });
  ui.dialog.addEventListener('click', (event) => {
    if (event.target === ui.dialog) ui.dialog.close();
  });
  ui.noTimer.addEventListener('click', () => {
    if (ui.noTimer.disabled) return;
    session.noTimer = !session.noTimer;
    persistSettings();
    paintSwitch();
  });
  for (const button of ui.statsOpen) {
    button.addEventListener('click', () => openStats(button));
  }
  ui.statsClose.addEventListener('click', () => ui.statsDialog.close());
  ui.statsDialog.addEventListener('close', () => {
    statsReturn?.focus();
  });
  ui.statsDialog.addEventListener('click', (event) => {
    if (event.target === ui.statsDialog) ui.statsDialog.close();
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
  ui.download.addEventListener('click', () => {
    void downloadCard();
  });
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
    ui.status.textContent = PLAY.loadingStatus;
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
      ui.status.textContent = PLAY.loadError;
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

    const entries = new Map(session.index.map((entry) => [entry.slug, entry]));
    effects.lineup(
      session.slugs.flatMap((slug) => {
        const entry = entries.get(slug);
        return entry ? [entry.category] : [];
      }),
    );
    effects.score(session.score.total, false);
    effects.combo(session.results);
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
      ui.status.textContent = alreadyPlayedLine(session.score.total);
      paintCountdownLine();
      startCountdown();
    } else if (session.results.length > 0) {
      action = 'resume';
      ui.status.textContent = resumeLine(session.results.length + 1, session.slugs.length);
    } else {
      action = 'start';
      ui.status.textContent = session.mode === 'daily' ? PLAY.samePrompts : PLAY.freshSet;
    }
    paintSwitch();
    paintPlay();
    prefetch(session.slugs[session.results.length]);
    if (action === 'resume' || action === 'results') markRulesSeen();
    else if (action === 'start') maybeCoach();
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
    markRulesSeen();
    if (ui.dialog.open) ui.dialog.close();
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
    effects.clearBurst();
    effects.score(session.score.total, false);
    effects.combo(session.results);
    effects.art(
      ui.root.querySelector('[data-game-prompt-art]'),
      'category',
      session.index.find((entry) => entry.slug === slug)?.category ?? '',
    );
    showView(ui.root, 'play');
    locked = true;
    stopTimer();
    clearHit();
    ui.question.textContent = PLAY.loadingPrompt;
    ui.input.disabled = true;
    ui.input.removeAttribute('aria-invalid');
    ui.progress.textContent = progressLine(session.results.length + 1, session.slugs.length);
    let prompt: ClientPrompt;
    try {
      prompt = await loadPrompt(slug);
    } catch {
      if (my !== token) return;
      action = 'retry';
      ui.status.textContent = PLAY.promptError;
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
    effects.art(ui.root.querySelector('[data-game-prompt-art]'), 'category', prompt.category);
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
      ui.input.setAttribute('aria-invalid', 'true');
      ui.hint.textContent = PLAY.duplicate;
      announce(ui, PLAY.alreadyTried);
      ui.input.select();
      return;
    }
    if (result.status === 'miss') {
      shake(ui.form);
      ui.input.setAttribute('aria-invalid', 'true');
      if (!session.noTimer) {
        liveMs = Math.max(0, liveMs - PENALTY_MS);
        if (liveMs <= 0) {
          resolve('time');
          return;
        }
        deadline = performance.now() + liveMs;
        paintTimer(liveMs);
      }
      ui.hint.textContent = session.noTimer ? PLAY.missUntimed : PLAY.missTimed;
      announce(ui, ui.hint.textContent);
      ui.input.select();
      return;
    }
    ui.input.removeAttribute('aria-invalid');
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
    const prompt = current;
    const go = () => showReveal(prompt, row);
    if (row.outcome === 'hit' && !reduceMotion) {
      ui.playView.classList.add('ra-hit');
      ui.hint.textContent = PLAY.lockedIn;
      hitTimer = window.setTimeout(() => {
        hitTimer = 0;
        ui.playView.classList.remove('ra-hit');
        go();
      }, 220);
      return;
    }
    go();
  }

  function showReveal(prompt: ClientPrompt, result: PromptResult): void {
    const label = tierName(result.tier);
    ui.revealKicker.textContent = CATEGORY_LABELS[prompt.category];
    ui.revealTier.textContent = result.tier === 0 ? PLAY.noPoints : label;
    ui.revealAnswer.textContent = revealAnswerLine(result.outcome, result.answer);
    ui.revealPoints.textContent = pointsLine(result.points, result.spotlight);
    ui.meter.setAttribute('aria-label', meterLabel(result.tier, label));
    ui.meter.querySelectorAll<HTMLElement>('[data-tier]').forEach((seg) => {
      const n = Number(seg.dataset.tier);
      if (result.tier > 0 && n <= result.tier) seg.dataset.on = 'true';
      else delete seg.dataset.on;
    });
    ui.could.textContent = couldHaveNamedLine(prompt.answers.length);
    if (result.outcome === 'hit') {
      const mine = prompt.answers.find((row) => row.name === result.answer);
      ui.rarer.hidden = false;
      ui.rarer.textContent = placementLine(
        answerRank(countRarer(prompt.answers, mine?.rarity ?? 1)),
        prompt.answers.length,
      );
    } else {
      ui.rarer.hidden = true;
      ui.rarer.textContent = '';
    }
    ui.answersLink.href = `/answers/${encodeURIComponent(prompt.slug)}/`;
    ui.answersLink.textContent = answersLinkLabel(prompt.answers.length);
    const lists = revealLists(prompt.answers);
    ui.rarestHeading.textContent = lists.complete ? PLAY.everyAnswer : PLAY.rarestHeading;
    ui.commonBlock.hidden = lists.complete;
    fillList(ui.rarest, lists.rarest, result.answer);
    fillList(ui.common, lists.common, result.answer);
    const listed =
      !result.answer ||
      lists.rarest.some((row) => row.name === result.answer) ||
      lists.common.some((row) => row.name === result.answer);
    ui.outside.hidden = result.outcome !== 'hit' || listed;
    const last = session.results.length >= session.slugs.length;
    ui.next.textContent = last ? PLAY.seeResults : PLAY.nextPrompt;
    ui.root.dataset.revealHit = result.tier > 0 ? 'true' : 'false';
    effects.badge(ui.root.querySelector('[data-game-reveal-badge]'), result.tier);
    showView(ui.root, 'reveal');
    effects.score(session.score.total);
    effects.combo(session.results);
    effects.burst(result.tier);
    announce(ui, result.tier === 0 ? PLAY.noPointsLive : tierLive(label, result.points));
    ui.revealTier.focus({ preventScroll: true });
    ui.next.focus({ preventScroll: true });
  }

  function showEnd(): void {
    finalizeStats();
    const tiers = session.results.map((row) => row.tier);
    ui.cardTitle.textContent = shareHeading(
      session.mode,
      session.roundNumber,
      session.category ? CATEGORY_LABELS[session.category] : undefined,
    );
    ui.endStreak.textContent =
      session.mode === 'daily' && stats.streak > 0 ? streakLine(stats.streak) : '';
    ui.squares.forEach((square, index) => {
      const tier = tiers[index];
      if (tier === undefined) {
        square.hidden = true;
        return;
      }
      square.hidden = false;
      square.dataset.tier = String(tier);
      effects.resultBadge(square, tier, index);
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
    effects.clearBurst();
    effects.score(0, false);
    effects.score(session.score.total);
    if (session.mode === 'daily') {
      ui.countdown.hidden = false;
      startCountdown();
    } else {
      ui.countdown.hidden = true;
      ui.countdown.textContent = '';
    }
    announce(ui, roundCompleteLive(session.score.total));
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
    const visual = clockVisual(ms, TIMER_MS);
    ui.timer.dataset.phase = visual.phase;
    ui.ring.style.strokeDashoffset = String(visual.offset);
    if (ms === null) {
      ui.seconds.textContent = PLAY.clockOff;
      ui.timer.setAttribute('aria-label', timerLabel(null));
      return;
    }
    const second = Math.ceil(ms / 1000);
    ui.seconds.textContent = String(second);
    ui.timer.setAttribute('aria-label', timerLabel(second));
    if (second !== announcedSecond) {
      announcedSecond = second;
      if (second === 10 || second === 5) announce(ui, timerLabel(second));
    }
  }

  function paintSwitch(): void {
    ui.noTimer.disabled = session.timerLocked;
    ui.noTimer.setAttribute('aria-checked', session.noTimer ? 'true' : 'false');
    ui.noTimerLabel.textContent = session.noTimer ? PLAY.noTimer : PLAY.timerOn;
  }

  function paintSpotlight(): void {
    if (session.score.spotlightUsed) {
      ui.spotlight.disabled = true;
      ui.spotlight.setAttribute('aria-pressed', 'false');
      ui.spotlightLabel.textContent = PLAY.spotlightUsed;
      ui.spotlight.classList.remove('btn-primary');
      ui.spotlight.classList.add('btn-outline');
      return;
    }
    ui.spotlight.disabled = false;
    if (session.spotlightArmed) {
      ui.spotlight.setAttribute('aria-pressed', 'true');
      ui.spotlightLabel.textContent = PLAY.spotlightArmed;
      ui.spotlight.classList.add('btn-primary');
      ui.spotlight.classList.remove('btn-outline');
      return;
    }
    ui.spotlight.setAttribute('aria-pressed', 'false');
    ui.spotlightLabel.textContent = PLAY.spotlight;
    ui.spotlight.classList.remove('btn-primary');
    ui.spotlight.classList.add('btn-outline');
  }

  function paintHint(): void {
    ui.hint.textContent = session.noTimer ? PLAY.hintUntimed : PLAY.hintTimed;
  }

  function paintPlay(): void {
    const phase =
      action === 'load'
        ? 'loading'
        : action === 'retry'
          ? 'error'
          : action === 'empty'
            ? 'empty'
            : 'ready';
    ui.root.dataset.gamePhase = phase;
    ui.play.disabled = action === 'load' || action === 'empty';
    ui.playIcon.hidden = action === 'results' || action === 'retry' || action === 'empty';
    const labels: Record<PlayAction, string> = {
      load: PLAY.loadingRound,
      retry: PLAY.tryAgain,
      start: PLAY.play,
      resume: PLAY.continue,
      results: PLAY.seeYourResult,
      empty: PLAY.nothingToPlay,
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
    ui.statStreak.textContent = String(stats.streak);
    ui.statBestStreak.textContent = String(stats.bestStreak);
    ui.statDailies.textContent = String(stats.dailyPlayed);
    ui.statRounds.textContent = String(stats.roundsPlayed);
    ui.statPoints.textContent = String(stats.totalPoints);
    ui.statBest.textContent = stats.dailyPlayed > 0 ? String(stats.bestDailyScore) : '–';
    paintCharts();
  }

  function paintCountdownLine(): void {
    if (session.mode !== 'daily' || !session.recorded) {
      ui.startCountdown.textContent = '';
      return;
    }
    const ms = msUntilNextLocalMidnight(new Date());
    ui.startCountdown.textContent = nextDailyLine(ms <= 0 ? null : formatCountdown(ms));
  }

  function startCountdown(): void {
    stopCountdown();
    const tick = () => {
      const ms = msUntilNextLocalMidnight(new Date());
      const text = nextDailyLine(ms <= 0 ? null : formatCountdown(ms));
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
        await nav.share({ title: PLAY.wordmark, text });
        ui.shareStatus.textContent = PLAY.shared;
        announce(ui, PLAY.shared);
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
      ui.shareStatus.textContent = PLAY.copied;
      announce(ui, PLAY.resultCopied);
    } catch {
      ui.shareStatus.textContent = PLAY.copyFallback;
      announce(ui, PLAY.selectToCopy);
    }
  }

  async function downloadCard(): Promise<void> {
    ui.download.disabled = true;
    try {
      await drawShareCard(ui.canvas, ui.root, {
        title: shareHeading(
          session.mode,
          session.roundNumber,
          session.category ? CATEGORY_LABELS[session.category] : undefined,
        ),
        score: session.score.total,
        tiers: session.results.map((row) => row.tier),
        spotlight: session.score.spotlightUsed,
        noTimer: session.noTimer,
        url: sharePageUrl(session.origin, session.mode, session.category || undefined),
      });
      const blob = await new Promise<Blob | null>((resolve) => ui.canvas.toBlob(resolve));
      if (!blob) {
        ui.shareStatus.textContent = PLAY.imageFailed;
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
      ui.shareStatus.textContent = PLAY.downloaded;
      announce(ui, PLAY.downloaded);
    } catch {
      ui.shareStatus.textContent = PLAY.imageFailed;
    } finally {
      ui.download.disabled = false;
    }
  }

  function downloadName(): string {
    if (session.mode === 'daily') return `rarest-answer-${session.dateKey}.png`;
    if (session.mode === 'category' && session.category)
      return `rarest-answer-${session.category}.png`;
    return 'rarest-answer-unlimited.png';
  }

  function emptyMessage(): string {
    if (session.mode === 'category' && session.category) {
      return emptyCategoryLine(CATEGORY_LABELS[session.category]);
    }
    return PLAY.emptyAll;
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

  function persistSettings(): void {
    writeSettings(store, { version: 1, noTimer: session.noTimer, seenRules: session.seenRules });
  }

  function markRulesSeen(): void {
    if (session.seenRules) return;
    session.seenRules = true;
    persistSettings();
  }

  // The start card already shows the three short rules under Play, so the
  // full How-to dialog opens only on request. Auto-opening it covered the
  // game on first visit (2026-11-15 review). First visit just records that
  // the rules were shown on the card.
  function maybeCoach(): void {
    markRulesSeen();
  }

  function openHowTo(): void {
    if (ui.dialog.open) return;
    ui.dialog.showModal();
    ui.dialogTitle.focus();
  }

  function openStats(from: HTMLElement): void {
    statsReturn = from;
    paintCharts();
    if (ui.statsDialog.open) return;
    ui.statsDialog.showModal();
    ui.statsTitle.focus();
  }

  function clearHit(): void {
    if (hitTimer) window.clearTimeout(hitTimer);
    hitTimer = 0;
    ui.playView.classList.remove('ra-hit');
  }

  function paintCharts(): void {
    const guesses = tierDistribution(stats.tierHits).map((row) => ({
      label: tierName(Number(row.key)),
      count: row.count,
      share: row.share,
      tier: Number(row.key),
    }));
    const scores = scoreDistribution(stats.dailyScores).map((row) => ({
      label: row.key,
      count: row.count,
      share: row.share,
    }));
    paintDistribution(ui.guessSvg, guesses, PLAY.guessChart);
    paintDistribution(ui.scoreSvg, scores, PLAY.scoreChart);
    ui.guessEmpty.hidden = guesses.some((row) => row.count > 0);
    ui.scoreEmpty.hidden = stats.dailyScores.length > 0;
  }
}

function readMode(value: string | undefined): Mode {
  if (value === 'unlimited' || value === 'category') return value;
  return 'daily';
}

function showView(root: HTMLElement, name: string): void {
  const celebrate = root.dataset.revealHit === 'true';
  root.querySelectorAll<HTMLElement>('[data-game-view]').forEach((node) => {
    const on = node.dataset.gameView === name;
    node.hidden = !on;
    node.classList.toggle('ra-reveal-in', on && name === 'reveal' && celebrate);
    node.classList.toggle('ra-end-in', on && name === 'end');
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
    const yours = player !== null && answer.name === player;
    const item = document.createElement('li');
    item.className = 'ra-row flex items-center justify-between gap-3 py-2 text-sm';
    if (yours) {
      item.dataset.yours = 'true';
      item.setAttribute('aria-current', 'true');
    }
    const name = document.createElement('span');
    name.className = 'min-w-0 flex-1 break-words text-foreground';
    name.textContent = answer.name;
    if (yours) {
      const mark = document.createElement('span');
      mark.className = 'ml-2 text-xs font-semibold text-nav';
      mark.textContent = PLAY.you;
      name.append(mark);
    }
    const tier = document.createElement('span');
    tier.className = 'tier-pill shrink-0';
    tier.dataset.tier = String(answer.tier);
    tier.textContent = tierName(answer.tier);
    item.append(name, tier);
    list.append(item);
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function paintDistribution(
  svg: SVGSVGElement,
  rows: { label: string; count: number; share: number; tier?: number }[],
  caption: string,
): void {
  svg.setAttribute('aria-label', chartSummary(caption, rows));
  svg.replaceChildren();
  rows.forEach((row, index) => {
    const y = 4 + index * 28;
    const text = svgEl('text');
    text.setAttribute('x', '0');
    text.setAttribute('y', String(y + 14));
    text.setAttribute('fill', 'currentColor');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-family', 'Source Sans 3, ui-sans-serif, system-ui, sans-serif');
    text.textContent = row.label;
    const track = svgEl('rect');
    track.setAttribute('x', '108');
    track.setAttribute('y', String(y + 4));
    track.setAttribute('width', '150');
    track.setAttribute('height', '12');
    track.setAttribute('rx', '6');
    track.setAttribute('fill', hslFromToken('--muted'));
    svg.append(text, track);
    if (row.share > 0) {
      const fill = svgEl('rect');
      const width = Math.max(8, Math.round(row.share * 150));
      fill.setAttribute('x', '108');
      fill.setAttribute('y', String(y + 4));
      fill.setAttribute('width', String(width));
      fill.setAttribute('height', '12');
      fill.setAttribute('rx', '6');
      fill.setAttribute(
        'fill',
        row.tier ? hslFromToken(`--tier-${row.tier}`) : hslFromToken('--brand'),
      );
      svg.append(fill);
    }
    const count = svgEl('text');
    count.setAttribute('x', '316');
    count.setAttribute('y', String(y + 14));
    count.setAttribute('text-anchor', 'end');
    count.setAttribute('fill', 'currentColor');
    count.setAttribute('font-size', '12');
    count.setAttribute('font-family', 'Source Sans 3, ui-sans-serif, system-ui, sans-serif');
    count.textContent = String(row.count);
    svg.append(count);
  });
}

function svgEl(name: string): SVGElement {
  return document.createElementNS(SVG_NS, name);
}

function hslFromToken(name: string): string {
  const css = getComputedStyle(document.documentElement);
  const raw = css.getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : css.color;
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
    playView: must(root, '[data-game-view="play"]'),
    revealView: must(root, '[data-game-view="reveal"]'),
    endView: must(root, '[data-game-view="end"]'),
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
    rarestHeading: must(root, '[data-game-rarest-heading]'),
    rarest: mustList(root, '[data-game-rarest]'),
    commonBlock: must(root, '[data-game-common-block]'),
    common: mustList(root, '[data-game-common]'),
    outside: must(root, '[data-game-outside]'),
    next: mustButton(root, '[data-game-next]'),
    finalHeading: must(root, '[data-game-final-heading]'),
    cardTitle: must(root, '[data-game-card-title]'),
    endStreak: must(root, '[data-game-end-streak]'),
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
    statsOpen: mustButtons(root, '[data-game-stats-open]'),
    statsDialog: mustDialog(root, '[data-game-stats-dialog]'),
    statsClose: mustButton(root, '[data-game-stats-close]'),
    statsTitle: must(root, '[data-game-stats-title]'),
    statStreak: must(root, '[data-game-stat-streak]'),
    statBestStreak: must(root, '[data-game-stat-best-streak]'),
    statBest: must(root, '[data-game-stat-best]'),
    statDailies: must(root, '[data-game-stat-dailies]'),
    statRounds: must(root, '[data-game-stat-rounds]'),
    statPoints: must(root, '[data-game-stat-points]'),
    guessSvg: mustSvg(root, '[data-game-guess-svg]'),
    scoreSvg: mustSvg(root, '[data-game-score-svg]'),
    guessEmpty: must(root, '[data-game-guess-empty]'),
    scoreEmpty: must(root, '[data-game-score-empty]'),
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

function mustButtons(root: ParentNode, selector: string): HTMLButtonElement[] {
  const nodes = [...root.querySelectorAll(selector)].filter(
    (node) => node instanceof HTMLButtonElement,
  );
  if (nodes.length === 0) throw new Error(selector);
  return nodes;
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

function mustSvg(root: ParentNode, selector: string): SVGSVGElement {
  const node = root.querySelector(selector);
  if (!(node instanceof SVGSVGElement)) throw new Error(selector);
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
