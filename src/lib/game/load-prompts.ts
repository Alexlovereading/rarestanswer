/**
 * Read prompt files at build time. Do not import this module from the
 * browser bundle: it uses node:fs. The client fetches the JSON routes.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPromptIndexEntry, toClientPrompt, type ClientPrompt } from './prompts';
import type { PromptIndexEntry } from './types';

/**
 * Astro bundles this module into dist/.prerender during the build, so a
 * relative URL from import.meta.url no longer points at src/data/prompts.
 * Walk up to the repo root, which still has the source files.
 */
function promptsDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'src/data/prompts');
    if (existsSync(join(candidate, 'index.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('src/data/prompts/index.json was not found');
}

export function readPromptIndex(): PromptIndexEntry[] {
  const raw = readFileSync(join(promptsDir(), 'index.json'), 'utf8');
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('src/data/prompts/index.json must be an array');
  }
  return data.filter(isPromptIndexEntry);
}

export function readClientPrompt(slug: string): ClientPrompt | null {
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug)) return null;
  let raw: string;
  try {
    raw = readFileSync(join(promptsDir(), `${slug}.json`), 'utf8');
  } catch {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const prompt = toClientPrompt(data);
  if (!prompt || prompt.slug !== slug) return null;
  return prompt;
}
