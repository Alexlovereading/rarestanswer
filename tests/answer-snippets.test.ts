/**
 * Answer-page titles, meta descriptions, and opening sentences.
 * The title and description give a reason to open the page.
 * The rarest name stays in the intro. noData rows are not that name.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  answerTitleSuffix,
  comparisonRows,
  derivePromptSeo,
  renderedAnswerTitle,
  selectRelated,
  type PromptSeo,
} from '~/components/answers/copy';
import { getPrompts } from '~/components/answers/prompts';
import { RELATED_TOPICS } from '~/config/related-prompts';
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

  it('puts the ranking promise in the great-ape title and leaves the answer name off it', () => {
    expect(ape.documentTitle).toBe('Rare Great Ape Species: All 8 Ranked, Rarest to Most Common');
    expect(ape.documentTitle.length).toBeLessThanOrEqual(60);
    expect(ape.documentTitle).not.toMatch(/tapanuli|orangutan|gorilla|bonobo|human/i);
    expect(answerTitleSuffix(ape.documentTitle)).toBe('');
    expect(renderedAnswerTitle(ape.documentTitle)).toBe(ape.documentTitle);
    expect(ape.h1).toBe('Species of great ape: all 8, ranked from rarest to most common');
    expect(ape.h1).not.toMatch(/tapanuli|orangutan/i);
    expect(ape.heading).toBe('Rarest Species of Great Ape — All 8 Answers Ranked by Rarity');
  });

  it('writes a 140–160 character description with the question and no answer names', () => {
    expect(ape.description.length).toBeGreaterThanOrEqual(140);
    expect(ape.description.length).toBeLessThanOrEqual(160);
    expect(ape.description).toBe(
      'Stuck on "Name a species of great ape" in Krillion or another rare-answer game? See all 8 answers ranked by rarity, with scores and spellings that count.',
    );
    expect(ape.description).not.toMatch(/tapanuli|orangutan|gorilla|bonobo|human/i);
  });

  it('answers the great-ape searches in the opening, once, without claiming to be Krillion', () => {
    expect(ape.intro).toContain('The rarest species of great ape on this list is Tapanuli orangutan (Legendary).');
    expect(ape.intro.split('Tapanuli orangutan').length - 1).toBe(1);
    expect(ape.intro.toLowerCase()).not.toContain('looking for a rare');
    expect(ape.intro.toLowerCase()).not.toContain('name a rare');
    expect(ape.intro.toLowerCase()).not.toContain('rare great ape species');
    expect(ape.intro.toLowerCase()).not.toContain('rarest accepted answer is');
    expect(ape.intro).toContain('This list is the living great ape species.');
    expect(ape.intro).toContain('includes gibbons');
    expect(ape.intro).toContain('Lemurs are a separate list.');
    expect(ape.intro).toContain("These rankings are Rarest Answer's Wikipedia-pageview rankings.");
    expect(ape.intro).toContain("Krillion's acceptance and scores may differ.");
    expect(ape.intro.toLowerCase().split('krillion').length - 1).toBe(1);
    expect(ape.intro).not.toMatch(/we are Krillion|this (site|page|game) is Krillion|same scor|matches Krillion/i);
    const visible = `${ape.documentTitle}\n${ape.h1}\n${ape.description}\n${ape.intro}`;
    expect(visible).toMatch(/Tapanuli orangutan/);
    expect(ape.guide.join('\n')).not.toContain('From fewest pageviews to most:');
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
    expect(page.documentTitle).not.toContain('Tapanuli orangutan');
    expect(page.documentTitle).not.toContain('Missing ape');
    expect(page.h1).not.toContain('Tapanuli orangutan');
    expect(page.h1).not.toContain('Missing ape');
    expect(page.intro).toContain('The rarest species of great ape on this list is Tapanuli orangutan (Rare).');
    expect(page.intro.split('Tapanuli orangutan').length - 1).toBe(1);
    expect(page.intro).not.toContain('Missing ape');
    expect(page.description).not.toContain('Tapanuli orangutan');
    expect(page.description).not.toContain('Missing ape');
  });

  it('does not name a rarest answer when every row is noData', () => {
    const page = prompt({
      slug: 'all-unranked',
      question: 'Name a fruit',
      answers: [answer('Fig', 1, 0, 6, true), answer('Date', 0.2, 0, 3, true)],
    });
    expect(page.documentTitle).toBe('Rare Fruits: None Ranked');
    expect(page.h1).toBe('Fruits: all 2, none ranked');
    expect(page.intro).toMatch(/none is ranked/i);
    expect(page.intro).toContain("Krillion's acceptance and scores may differ.");
    expect(page.intro).not.toContain('These rankings are');
    expect(page.intro).not.toMatch(/rarest accepted answer is/i);
    expect(page.description).toMatch(/^Stuck on "Name a fruit"/);
    expect(page.description).toMatch(/None is ranked/);
    expect(page.description).not.toMatch(/ranked by rarity/);
    expect(page.description).not.toMatch(/fig|date/i);
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(answerTitleSuffix(page.documentTitle)).toBeUndefined();
    expect(renderedAnswerTitle(page.documentTitle)).toBe('Rare Fruits: None Ranked — Rarest Answer');
  });

  it('uses the shorter title when the long ranking formula does not fit', () => {
    const longName = 'Routes of Santiago de Compostela: Camino Francés and Routes of Northern Spain';
    const page = prompt({
      slug: 'long-name',
      category: 'history',
      question: 'Name a UNESCO World Heritage Site in Spain',
      answers: [answer(longName, 1, 10, 6), answer('Alhambra', 0, 100, 1)],
    });
    expect(page.documentTitle.length).toBeLessThanOrEqual(60);
    expect(page.documentTitle.startsWith('Rare UNESCO World Heritage Sites in Spain')).toBe(true);
    expect(page.documentTitle).not.toContain(longName);
    expect(page.documentTitle).toMatch(/All 2 Ranked/);
    expect(renderedAnswerTitle(page.documentTitle).length).toBeLessThanOrEqual(60);
    expect(page.h1).toBe(
      'UNESCO World Heritage Sites in Spain: all 2, ranked from rarest to most common',
    );
    expect(page.intro).toContain(longName);
    expect(page.description).not.toContain(longName);
  });

  it('drops the brand suffix when the ranking title already fills the 60-character core', () => {
    const fruits = getPrompts().find((item) => item.slug === 'fruits');
    expect(fruits).toBeDefined();
    expect(fruits!.documentTitle.startsWith('Rare Fruits: All ')).toBe(true);
    expect(answerTitleSuffix(fruits!.documentTitle)).toBe('');
    expect(renderedAnswerTitle(fruits!.documentTitle)).toBe(fruits!.documentTitle);
    expect(renderedAnswerTitle(fruits!.documentTitle).length).toBeLessThanOrEqual(60);
  });

  it('uses Wiktionary, not Wikipedia, when that is the recorded source', () => {
    const page = getPrompts().find((item) => item.slug === 'english-interjections');
    expect(page).toBeDefined();
    expect(page!.intro).toContain("Rarest Answer's Wiktionary-pageview rankings");
    expect(page!.intro).not.toMatch(/wikipedia/i);
    expect(page!.description).toMatch(/^Stuck on "/);
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
      expect(item.intro, item.slug).toContain("Krillion's acceptance and scores may differ.");
      expect(item.intro.toLowerCase().split('krillion').length - 1, item.slug).toBe(1);
      expect(item.intro, item.slug).not.toMatch(/we are Krillion|same scor|matches Krillion|looking for a rare/i);
      const needle = `name a rare ${item.nounPhrase}`.toLowerCase();
      expect(item.intro.toLowerCase().split(needle).length - 1, item.slug).toBe(0);
      const rankedRows = item.answers.filter((row) => row.noData !== true);
      if (rankedRows.length === 0) {
        expect(item.intro.toLowerCase(), item.slug).toMatch(/none is ranked/);
        expect(item.h1, item.slug).toMatch(/none ranked$/);
        expect(item.documentTitle, item.slug).toMatch(/None Ranked/);
      } else if (rankedRows.length < item.answers.length) {
        expect(item.documentTitle, item.slug).toContain(`All ${rankedRows.length} Ranked`);
        expect(item.documentTitle, item.slug).not.toContain(`All ${item.answers.length} Ranked`);
        expect(item.h1.toLowerCase(), item.slug).toContain(`${rankedRows.length} ranked`);
        expect(item.h1.toLowerCase(), item.slug).toContain(`${item.answers.length} accepted`);
        expect(item.description, item.slug).toContain(String(rankedRows.length));
        expect(`${item.documentTitle} ${item.h1} ${item.description}`.toLowerCase(), item.slug).toContain(
          `${item.answers.length} accepted`,
        );
        expect(item.description.toLowerCase(), item.slug).not.toContain(
          `all ${item.answers.length} answers ranked`,
        );
      } else {
        expect(item.h1, item.slug).toMatch(/ranked from rarest to most common$/);
        expect(item.documentTitle, item.slug).toMatch(/^Rare .+: All \d+ Ranked/);
      }
      expect(item.description, item.slug).toMatch(/^Stuck on "/);
      const ranked = item.answers.find((row) => row.noData !== true);
      if (ranked && !item.question.toLowerCase().includes(ranked.name.toLowerCase())) {
        expect(item.documentTitle.toLowerCase(), item.slug).not.toContain(ranked.name.toLowerCase());
        expect(item.h1.toLowerCase(), item.slug).not.toContain(ranked.name.toLowerCase());
        expect(item.description.toLowerCase(), item.slug).not.toContain(ranked.name.toLowerCase());
        expect(item.intro, item.slug).toContain(ranked.name);
      }
    }
  });

  it('states the ranked count and the accepted count when some answers have noData', () => {
    const page = prompt({
      slug: 'mixed-counts',
      question: 'Name a fruit',
      answers: [
        answer('Fig', 1, 10, 6),
        answer('Date', 0.5, 20, 3),
        answer('Lime', 0, 0, 3, true),
        answer('Pear', 0, 0, 3, true),
        answer('Plum', 0, 0, 3, true),
      ],
    });
    expect(page.documentTitle).toBe('Rare Fruits: All 2 Ranked, 5 Accepted');
    expect(page.h1).toBe('Fruits: all 2 ranked, 5 accepted');
    expect(page.heading).toBe('Rarest Fruit — 2 Ranked, 5 Accepted');
    expect(page.description.toLowerCase()).toContain('2 ranked');
    expect(page.description.toLowerCase()).toContain('5 accepted');
    expect(page.description.toLowerCase()).not.toContain('all 5 answers ranked');
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(comparisonRows(page.answers).map((row) => row.answer.name)).toEqual(['Fig', 'Date']);
  });

  it('puts every ranked great ape in the comparison and links the primate lists', () => {
    const rows = comparisonRows(ape.answers);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows[0]?.answer.name).toBe('Tapanuli orangutan');
    expect(rows[7]?.answer.name).toBe('Human');
    const prompts = getPrompts();
    const page = prompts.find((item) => item.slug === 'great-ape-species');
    expect(page).toBeDefined();
    expect(selectRelated(page!, prompts).map((item) => item.slug)).toEqual([
      'ape-species',
      'gibbon-species',
      'lemur-species',
    ]);
    const stranger = prompts.find((item) => item.slug === 'stranger-things-characters');
    expect(stranger).toBeDefined();
    const ranked = stranger!.answers.filter((row) => row.noData !== true).length;
    const total = stranger!.answers.length;
    expect(ranked).toBeGreaterThan(0);
    expect(ranked).toBeLessThan(total);
    expect(stranger!.documentTitle).toContain(`All ${ranked} Ranked`);
    expect(stranger!.documentTitle).not.toContain(`All ${total} Ranked`);
    expect(stranger!.h1.toLowerCase()).toContain(`${total} accepted`);
    expect(stranger!.description.toLowerCase()).toContain(`${total} accepted`);
    const published = new Set(prompts.map((item) => item.slug));
    for (const group of RELATED_TOPICS) {
      for (const slug of group) expect(published.has(slug), slug).toBe(true);
    }
  });

  it('samples a long ranking instead of listing every row in the comparison', () => {
    const answers = Array.from({ length: 15 }, (_, index) =>
      answer(`River ${String(index).padStart(2, '0')}`, 1 - index / 14, 100 + index, 3),
    );
    const page = prompt({ slug: 'long-rank', question: 'Name a river', answers });
    expect(comparisonRows(page.answers).map((row) => row.rank)).toEqual([1, 2, 3, 15]);
    expect(comparisonRows(page.answers).at(-1)?.answer.name).toBe('River 14');
  });
});
