/**
 * One prompt, stripped to the fields the player needs.
 * Built from the index at build time, so a later full prompt set shows up
 * without a code change. Route: /game-data/<slug>.json
 */
import type { APIRoute } from 'astro';
import { readClientPrompt, readPromptIndex } from '~/lib/game/load-prompts';

export function getStaticPaths() {
  return readPromptIndex().map((entry) => ({ params: { slug: entry.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const prompt = readClientPrompt(slug);
  if (!prompt) {
    throw new Error(`Prompt "${slug}" is missing or does not match the client schema`);
  }
  return new Response(JSON.stringify(prompt), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
