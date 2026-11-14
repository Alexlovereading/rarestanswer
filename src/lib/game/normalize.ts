/**
 * Guess normalization and a length-capped edit distance.
 * Matching is case, diacritic, punctuation, and leading-article insensitive.
 */

const APOSTROPHE = /['’‘ʼ`´]/g;
const LEADING_ARTICLES = new Set(['a', 'an', 'the']);

/**
 * Fold a guess or an answer into the form the matcher compares.
 * Apostrophes are deleted (`Grauer's` → `grauers`). Other punctuation
 * becomes a space (`x-ray` → `x ray`). A leading a/an/the is removed only
 * when a word remains, so a one-word answer is kept.
 */
export function normalize(raw: string): string {
  const prepared = raw.replace(/İ/g, 'I').replace(/ı/g, 'i');
  const folded = prepared
    .normalize('NFD')
    .replace(APOSTROPHE, '')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
  const spaced = folded
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/ +/g, ' ');
  if (!spaced) return '';
  const parts = spaced.split(' ');
  while (parts.length > 1 && LEADING_ARTICLES.has(parts[0] ?? '')) parts.shift();
  return parts.join(' ');
}

/**
 * Levenshtein distance, capped at 2. Callers only care whether the distance
 * is ≤ 1, so a gap larger than 1 returns 2 immediately.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const aa = [...a];
  const bb = [...b];
  const n = aa.length;
  const m = bb.length;
  if (Math.abs(n - m) > 1) return 2;
  if (n === 0) return m > 1 ? 2 : m;
  if (m === 0) return n > 1 ? 2 : n;

  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = cur[0] ?? i;
    const leftCh = aa[i - 1];
    for (let j = 1; j <= m; j++) {
      const cost = leftCh === bb[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (cur[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      const val = Math.min(del, ins, sub);
      cur[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > 1) return 2;
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  const dist = prev[m] ?? 2;
  return dist > 1 ? 2 : dist;
}
