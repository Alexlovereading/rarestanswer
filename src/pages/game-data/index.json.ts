/**
 * Prompt index for the client. The route is /game-data/index.json
 * (no trailing slash: endpoint filenames keep their extension).
 * Slugs are whatever src/data/prompts/index.json lists. Nothing is hardcoded.
 */
import type { APIRoute } from 'astro';
import { readPromptIndex } from '~/lib/game/load-prompts';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(readPromptIndex()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
