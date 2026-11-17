/**
 * Plausible custom events for play. The cookieless script is injected only
 * when PUBLIC_PLAUSIBLE_SRC is set; otherwise window.plausible is absent and
 * every call no-ops. Click events use the [data-track] listener in
 * BaseLayout. This module sends the three events that are not the click
 * itself: a round actually started, a warm-up prompt loaded, a scored round
 * recorded.
 *
 * Props are limited to mode and a public prompt slug. Typed guesses are not
 * sent.
 */

/** Same shape as prompts.ts isSlug. Local so this file does not pull the prompt loader. */
export const TRACK_SLUG_PATTERN = '^[a-z0-9]+(?:[-_][a-z0-9]+)*$';
const TRACK_SLUG = new RegExp(TRACK_SLUG_PATTERN);

export const TRACK_NAME_MAX = 80;

export const TRACK = {
  playStarted: 'Play started',
  roundCompleted: 'Round completed',
  warmup: 'Warm-up',
  playPrompt: 'Play this prompt',
  reportAnswer: 'Report wrong answer',
} as const;

const MODES = new Set(['daily', 'unlimited', 'category']);

type PlausibleSend = (name: string, options?: { props: Record<string, string> }) => void;

export function isTrackSlug(value: string): boolean {
  return TRACK_SLUG.test(value);
}

export function playStartedProps(
  mode: string,
  firstSlug: string | undefined,
  requested: string | null,
): Record<string, string> {
  const props: Record<string, string> = {};
  if (MODES.has(mode)) props.mode = mode;
  if (requested && firstSlug === requested && isTrackSlug(requested)) props.prompt = requested;
  return props;
}

export function roundCompletedProps(mode: string): Record<string, string> {
  return MODES.has(mode) ? { mode } : {};
}

export function warmupProps(slug: string): Record<string, string> {
  return isTrackSlug(slug) ? { prompt: slug } : {};
}

function cleanProps(props: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!props) return undefined;
  const clean: Record<string, string> = {};
  if (props.mode && MODES.has(props.mode)) clean.mode = props.mode;
  if (props.prompt && isTrackSlug(props.prompt)) clean.prompt = props.prompt;
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function readPlausible(): PlausibleSend | undefined {
  if (typeof window === 'undefined') return undefined;
  const candidate = (window as { plausible?: unknown }).plausible;
  if (typeof candidate !== 'function') return undefined;
  return candidate as PlausibleSend;
}

/** Sends one custom event. No-ops when the name is empty or Plausible is absent. */
export function trackEvent(
  name: string,
  props?: Record<string, string>,
  send: PlausibleSend | undefined = readPlausible(),
): void {
  if (!name || name.length > TRACK_NAME_MAX || typeof send !== 'function') return;
  const clean = cleanProps(props);
  try {
    if (clean) send(name, { props: clean });
    else send(name);
  } catch {
    /* analytics must not break play */
  }
}
