/**
 * Answer-page titles, meta descriptions, and opening sentences.
 * The rarest name is a ranked answer. noData rows are skipped.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  answerTitleSuffix,
  derivePromptSeo,
  renderedAnswerTitle,
  type PromptSeo,
} from '~/components/answers/copy';
import { getPrompts } from '~/components/answers/prompts';
import type { Answer, CategoryKey, Prompt } from '~/lib/game/types';

const greatApe = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/prompts/great-ape-species.json', import.meta.url)), 'utf8'),
) as Prompt;

function prompt(partial: Partial<Prompt> & Pick<Prompt, 'slug' | 'question' | 'answers'>): PromptSeo {
  return derivePromptSeo({
    id: partial.slug,
    category: 'animals' satisfies CategoryKey,
    source: 'Wikidata + Wikipedia pageviews (2026-10)',
    ...partial,
  });
}

function answer(name: string, rarity: number, popularity: number, tier: Answer['tier'], noData = false): Answer {
  const row: Answer = { name, aliases: [], popularity, rarity, tier };
  if (!noData) row.wiki = name;
  if (noData) row.noData = true;
  return row;
}

describe('answer page snippets', () => {
  const ape = derivePromptSeo(greatApe);

  it('leads the great-ape title with the search phrasing and the rarest ranked name', () => {
    expect(ape.documentTitle).toBe('Rare Species of Great Ape: Tapanuli orangutan & All 8 Ranked');
    expect(ape.documentTitle.length).toBeLessThanOrEqual(60);
    expect(answerTitleSuffix(ape.documentTitle)).toBe('');
    expect(renderedAnswerTitle(ape.documentTitle)).toBe(ape.documentTitle);
    expect(ape.h1).toBe('Rare Species of Great Ape: Tapanuli orangutan and All 8 Ranked');
    expect(ape.h1.startsWith('Rare Species of Great Ape: Tapanuli orangutan')).toBe(true);
    expect(ape.h1.length).toBeGreaterThan(ape.documentTitle.length);
    expect(ape.heading).toBe('Rarest Species of Great Ape — All 8 Answers Ranked by Rarity');
  });

  it('writes a 140–160 character description that names the next rare answers and the question', () => {
    expect(ape.description.length).toBeGreaterThanOrEqual(140);
    expect(ape.description.length).toBeLessThanOrEqual(160);
    expect(ape.description).toBe(
      'Rarest answer: Tapanuli orangutan (Legendary). Also rare: Sumatran orangutan, Eastern gorilla. For "Name a species of great ape", ranked by Wikipedia views.',
    );
  });

  it('answers the great-ape searches in the opening, once, without claiming to be Krillion', () => {
    expect(ape.intro.startsWith('Looking for a rare species of great ape to name? ')).toBe(true);
    expect(ape.intro).toContain('The rarest accepted answer is Tapanuli orangutan (Legendary).');
    const needle = 'name a rare species of great ape';
    expect(ape.intro.toLowerCase().split(needle).length - 1).toBe(1);
    expect(`${ape.documentTitle} ${ape.h1} ${ape.description}`.toLowerCase()).not.toContain(needle);
    expect(ape.intro).toContain(
      'If you met this prompt in Krillion or another rare-answer game, rarity here is English Wikipedia pageviews over the last 12 months.',
    );
    expect(ape.intro.toLowerCase().split('krillion').length - 1).toBe(1);
    expect(ape.intro).not.toMatch(/we are Krillion|this (site|page|game) is Krillion|same scor|matches Krillion/i);
    const visible = `${ape.documentTitle}\n${ape.h1}\n${ape.description}\n${ape.intro}`;
    expect(visible).toMatch(/rare species of great ape/i);
    expect(visible).toMatch(/Tapanuli orangutan/);
    expect(visible.toLowerCase()).not.toMatch(/rare great ape species,\s*name a rare/);
  });

  it('skips noData answers when choosing the rarest name', () => {
    const page = prompt({
      slug: 'skip-nodata',
      question: 'Name a species of great ape',
      answers: [
        answer('Missing ape', 1, 0, 6, true),
        answer('Tapanuli orangutan', 0.4, 80, 4),
        answer('Human', 0, 900, 1),
      ],
    });
    expect(page.documentTitle).toContain('Tapanuli orangutan');
    expect(page.documentTitle).not.toContain('Missing ape');
    expect(page.intro).toContain('The rarest accepted answer is Tapanuli orangutan (Rare).');
    expect(page.intro).not.toContain('Missing ape');
    expect(page.description).toContain('Tapanuli orangutan');
    expect(page.description).not.toContain('Missing ape');
  });

  it('does not name a rarest answer when every row is noData', () => {
    const page = prompt({
      slug: 'all-unranked',
      question: 'Name a fruit',
      answers: [answer('Fig', 1, 0, 6, true), answer('Date', 0.2, 0, 3, true)],
    });
    expect(page.documentTitle).toBe('Rare Fruits: None Ranked');
    expect(page.intro).toMatch(/none is ranked as the rarest/i);
    expect(page.intro).not.toMatch(/rarest accepted answer is/i);
    expect(page.description).toMatch(/No ranked rarest answer/i);
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it('falls back to a shorter title when the rarest name is very long', () => {
    const longName = 'Routes of Santiago de Compostela: Camino Francés and Routes of Northern Spain';
    const page = prompt({
      slug: 'long-name',
      category: 'history',
      question: 'Name a UNESCO World Heritage Site in Spain',
      answers: [answer(longName, 1, 10, 6), answer('Alhambra', 0, 100, 1)],
    });
    expect(page.documentTitle.length).toBeLessThanOrEqual(60);
    expect(page.documentTitle.startsWith('Rare UNESCO World Heritage Sites in Spain')).toBe(true);
    expect(renderedAnswerTitle(page.documentTitle).length).toBeLessThanOrEqual(60);
    expect(page.intro).toContain(longName);
    expect(page.h1.length).toBeGreaterThan(0);
  });

  it('keeps the brand suffix only when the rendered title still fits in 60 characters', () => {
    const fruits = getPrompts().find((item) => item.slug === 'fruits');
    expect(fruits).toBeDefined();
    expect(answerTitleSuffix(fruits!.documentTitle)).toBeUndefined();
    expect(renderedAnswerTitle(fruits!.documentTitle)).toBe(`${fruits!.documentTitle} — Rarest Answer`);
    expect(renderedAnswerTitle(fruits!.documentTitle).length).toBeLessThanOrEqual(60);
  });

  it('uses Wiktionary, not Wikipedia, when that is the recorded source', () => {
    const page = getPrompts().find((item) => item.slug === 'english-interjections');
    expect(page).toBeDefined();
    expect(page!.intro).toContain('English Wiktionary pageviews over the last 12 months');
    expect(page!.intro).not.toMatch(/wikipedia/i);
    expect(page!.description).toContain('Wiktionary views');
    expect(page!.description).not.toMatch(/wikipedia/i);
  });

  it('keeps every published answer page inside the snippet limits', () => {
    const prompts = getPrompts();
    expect(prompts.length).toBeGreaterThan(200);
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const item of prompts) {
      expect(item.documentTitle.length, item.slug).toBeLessThanOrEqual(60);
      const rendered = renderedAnswerTitle(item.documentTitle);
      expect(rendered.length, item.slug).toBeLessThanOrEqual(60);
      expect(titles.has(rendered), item.slug).toBe(false);
      titles.add(rendered);
      expect(item.description.length, `${item.slug} ${item.description}`).toBeGreaterThanOrEqual(140);
      expect(item.description.length, item.slug).toBeLessThanOrEqual(160);
      expect(descriptions.has(item.description), item.slug).toBe(false);
      descriptions.add(item.description);
      expect(item.intro).toContain('If you met this prompt in Krillion or another rare-answer game');
      expect(item.intro.toLowerCase().split('krillion').length - 1).toBe(1);
      expect(item.intro).not.toMatch(/we are Krillion|same scor|matches Krillion/i);
      const needle = `name a rare ${item.nounPhrase}`.toLowerCase();
      if (item.documentTitle.includes('None Ranked')) {
        expect(item.intro.toLowerCase()).not.toContain(needle);
      } else {
        expect(item.intro.toLowerCase().split(needle).length - 1, item.slug).toBe(1);
      }
      const ranked = item.answers.find((row) => row.noData !== true);
      if (ranked && item.documentTitle.length === 60) {
        expect(item.documentTitle.toLowerCase().includes(ranked.name.toLowerCase()) || item.intro.includes(ranked.name)).toBe(
          true,
        );
      }
    }
  });
});
