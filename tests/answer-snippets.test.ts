/**
 * Answer-page titles, meta descriptions, and opening sentences.
 * The title leads with "Rarest <singular>?" and the ranked count.
 * The description starts with "Name a rare …?", then the rarest pick.
 * The opening names that pick once, then the backup picks. noData rows are not that pick.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  answerTitleSuffix,
  capitalisedQuestionTokens,
  comparisonRows,
  derivePromptSeo,
  renderedAnswerTitle,
  selectRelated,
  type PromptSeo,
} from '~/components/answers/copy';
import { getPrompts } from '~/components/answers/prompts';
import { answerQuerySynonym, answerTitleNoun, answerTitleTokenSynonyms } from '~/config/answer-seo';
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

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

/** The rarest sentence, before backup picks, scope, or the ranking credit. */
function openingSentence(intro: string): string {
  const cut = intro.search(/ Backup picks | The backup pick | These rankings | Krillion'/);
  return cut > 0 ? intro.slice(0, cut) : intro;
}

describe('answer page snippets', () => {
  const ape = derivePromptSeo(greatApe);

  it('puts the query wording and the ranked-list promise in the great-ape title', () => {
    expect(ape.documentTitle).toBe('Rarest Species of Great Ape? All 8 Ranked for Rare Answers');
    expect(ape.documentTitle.length).toBeLessThanOrEqual(60);
    expect(ape.documentTitle).not.toMatch(/tapanuli|orangutan|gorilla|bonobo|human/i);
    expect(answerTitleSuffix(ape.documentTitle)).toBe('');
    expect(renderedAnswerTitle(ape.documentTitle)).toBe(ape.documentTitle);
    expect(ape.h1).toBe('Name a rare species of great ape: all 8, rarest to most common');
    expect(ape.h1).not.toMatch(/tapanuli|orangutan/i);
    expect(ape.heading).toBe('Rarest Species of Great Ape — All 8 Answers Ranked by Rarity');
    expect(ape.faq[0]?.question).toBe('What is the rarest species of great ape?');
    expect(ape.faq[0]?.answer).toContain('Tapanuli orangutan');
    expect(ape.faq.filter((item) => item.question === ape.faq[0]?.question)).toHaveLength(1);
  });

  it('names the rarest pick in a 140–160 character description and covers subspecies', () => {
    expect(ape.description.length).toBeGreaterThanOrEqual(140);
    expect(ape.description.length).toBeLessThanOrEqual(160);
    expect(ape.description.startsWith('Name a rare species of great ape? Tapanuli orangutan is the rarest pick.')).toBe(
      true,
    );
    expect(ape.description.toLowerCase()).toContain('backup pick');
    expect(ape.description).toContain('Subspecies like Cross River gorilla are covered.');
    expect(ape.description).not.toMatch(/krillion/i);
    expect(ape.description).not.toMatch(/stuck on/i);
  });

  it('answers the great-ape searches in the opening, once, without claiming to be Krillion', () => {
    expect(ape.intro.startsWith(
      'The rarest species of great ape on this list is Tapanuli orangutan (Legendary). Backup picks are Sumatran orangutan (Epic) and Eastern gorilla (Rare). ',
    )).toBe(true);
    expect(ape.intro.split('Tapanuli orangutan').length - 1).toBe(1);
    expect(ape.intro.toLowerCase()).toContain('backup picks');
    expect(ape.intro.toLowerCase()).not.toContain('looking for a rare');
    expect(ape.intro.toLowerCase()).not.toContain('name a rare');
    expect(ape.intro.toLowerCase()).not.toContain('rare great ape species');
    expect(ape.intro.toLowerCase()).not.toContain('rarest accepted answer is');
    expect(ape.intro).toContain('This list is the living great ape species.');
    expect(ape.intro).toContain(
      'Subspecies such as Cross River gorilla and mountain gorilla count as their species, Western gorilla and Eastern gorilla, not as separate answers.',
    );
    expect(ape.intro).toContain('includes gibbons');
    expect(ape.intro).toContain('Lemurs are a separate list.');
    expect(ape.intro).toContain("These rankings are Rarest Answer's Wikipedia-pageview rankings.");
    expect(ape.intro).toContain("Krillion's acceptance and scores may differ.");
    expect(ape.intro.toLowerCase().split('krillion').length - 1).toBe(1);
    expect(ape.intro).not.toMatch(/we are Krillion|this (site|page|game) is Krillion|same scor|matches Krillion/i);
    const visible = `${ape.documentTitle}\n${ape.h1}\n${ape.description}\n${ape.intro}`;
    expect(visible).toMatch(/Tapanuli orangutan/);
    expect(ape.guide.join('\n')).not.toContain('From fewest pageviews to most:');
    const subspeciesQuestions = ape.faq.filter((item) => /cross river gorilla/i.test(item.question));
    expect(subspeciesQuestions).toHaveLength(1);
    expect(subspeciesQuestions[0]?.answer).toContain('Western gorilla');
    expect(subspeciesQuestions[0]?.answer).toContain('Eastern gorilla');
    expect(subspeciesQuestions[0]?.answer).not.toMatch(/krillion/i);
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
    expect(page.intro).toContain('The backup pick is Human (Common).');
    expect(page.intro.split('Tapanuli orangutan').length - 1).toBe(1);
    expect(page.intro).not.toContain('Missing ape');
    expect(page.description).toContain('Tapanuli orangutan');
    expect(page.description).toContain('2 ranked');
    expect(page.description).toContain('3 accepted');
    expect(page.description.toLowerCase()).not.toContain('all 3 answers ranked');
    expect(page.description).not.toContain('Missing ape');
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it('does not name a rarest answer when every row is noData', () => {
    const page = prompt({
      slug: 'all-unranked',
      question: 'Name a fruit',
      answers: [answer('Fig', 1, 0, 6, true), answer('Date', 0.2, 0, 3, true)],
    });
    expect(page.documentTitle).toBe('Rarest Fruit? None Ranked');
    expect(page.h1).toBe('Name a rare fruit: all 2, none ranked');
    expect(page.description.startsWith('Name a rare fruit?')).toBe(true);
    expect(page.faq[0]?.question).toBe('What is the rarest fruit?');
    expect(page.faq[0]?.answer).toMatch(/^None\./);
    expect(page.intro).toMatch(/none is ranked/i);
    expect(page.intro).toContain("Krillion's acceptance and scores may differ.");
    expect(page.intro).not.toContain('These rankings are');
    expect(page.intro).not.toMatch(/rarest accepted answer is/i);
    expect(page.description).toMatch(/None is ranked/);
    expect(page.description).not.toMatch(/^Stuck on "/);
    expect(page.description).not.toMatch(/rarest pick/i);
    expect(page.description).not.toMatch(/ranked by rarity/);
    expect(page.description).not.toMatch(/fig|date/i);
    expect(page.description).not.toMatch(/backup pick/i);
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(answerTitleSuffix(page.documentTitle)).toBeUndefined();
    expect(renderedAnswerTitle(page.documentTitle)).toBe('Rarest Fruit? None Ranked — Rarest Answer');
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
    expect(page.documentTitle.startsWith('Rarest UNESCO World Heritage Site in Spain')).toBe(true);
    expect(page.documentTitle).not.toContain(longName);
    expect(page.documentTitle).toMatch(/All 2 Ranked/);
    expect(renderedAnswerTitle(page.documentTitle).length).toBeLessThanOrEqual(60);
    expect(page.h1).toBe('Name a rare UNESCO World Heritage Site in Spain: all 2, rarest to most common');
    expect(page.intro).toContain(longName);
    expect(occurrences(openingSentence(page.intro), longName)).toBe(1);
    expect(page.description).toContain(longName);
    expect(page.description.toLowerCase()).toContain('backup pick');
  });

  it('keeps the fruits title on the rarest-pick pattern and inside 60 characters', () => {
    const fruits = getPrompts().find((item) => item.slug === 'fruits');
    expect(fruits).toBeDefined();
    expect(fruits!.documentTitle).toMatch(/^Rarest Fruit\? All \d+ Ranked/);
    const rendered = renderedAnswerTitle(fruits!.documentTitle);
    expect(rendered.length).toBeLessThanOrEqual(60);
    if (fruits!.documentTitle.length + ' — Rarest Answer'.length <= 60) {
      expect(answerTitleSuffix(fruits!.documentTitle)).toBeUndefined();
      expect(rendered).toBe(`${fruits!.documentTitle} — Rarest Answer`);
    } else {
      expect(answerTitleSuffix(fruits!.documentTitle)).toBe('');
      expect(rendered).toBe(fruits!.documentTitle);
    }
  });

  it('uses Wiktionary, not Wikipedia, when that is the recorded source', () => {
    const page = getPrompts().find((item) => item.slug === 'english-interjections');
    expect(page).toBeDefined();
    expect(page!.intro).toContain("Rarest Answer's Wiktionary-pageview rankings");
    expect(page!.intro).not.toMatch(/wikipedia/i);
    expect(page!.description).toMatch(/rarest pick/i);
    expect(page!.description).not.toMatch(/wikipedia/i);
    expect(page!.description).not.toMatch(/krillion/i);
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
        expect(item.h1, item.slug).toMatch(/rarest to most common$/);
        expect(item.h1.toLowerCase(), item.slug).toMatch(/^name a rare /);
        expect(item.documentTitle, item.slug).toMatch(/^Rarest .+\? (?:All )?\d+ /);
        expect(item.documentTitle, item.slug).toContain('Ranked');
      }
      expect(item.h1.toLowerCase(), item.slug).toMatch(/^name a rare /);
      expect(item.description, item.slug).toMatch(/^Name a rare /);
      expect(item.faq[0]?.question, item.slug).toMatch(/^What is the rarest /);
      expect(new Set(item.faq.map((entry) => entry.question)).size, item.slug).toBe(item.faq.length);
      expect(item.description, item.slug).not.toMatch(/^Stuck on "/);
      expect(item.description, item.slug).not.toMatch(/krillion/i);
      const ranked = rankedRows[0];
      if (!ranked) {
        expect(item.description, item.slug).toMatch(/None is ranked/);
        expect(item.description, item.slug).not.toMatch(/rarest pick/i);
        expect(item.intro.toLowerCase(), item.slug).not.toContain('backup pick');
      } else {
        expect(item.description, item.slug).toContain(ranked.name);
        expect(item.description.toLowerCase(), item.slug).toMatch(/rarest pick/);
        const cluster = rankedRows.filter((row) => row.rarity === ranked.rarity);
        const backups = rankedRows.slice(cluster.length, cluster.length + 2);
        if (backups.length > 0) {
          expect(item.description.toLowerCase(), item.slug).toContain('backup pick');
          expect(item.intro.toLowerCase(), item.slug).toContain('backup pick');
          for (const backup of backups) expect(item.intro, item.slug).toContain(backup.name);
        } else {
          expect(item.intro.toLowerCase(), item.slug).not.toContain('backup pick');
          expect(item.description.toLowerCase(), item.slug).not.toContain('backup pick');
        }
        const opening = openingSentence(item.intro);
        const nounHits = occurrences(item.nounPhrase, ranked.name);
        expect(occurrences(opening, ranked.name), item.slug).toBe(1 + nounHits);
        const rest = item.intro.slice(opening.length);
        const overlap = backups.reduce((sum, backup) => sum + occurrences(backup.name, ranked.name), 0);
        expect(occurrences(rest, ranked.name), item.slug).toBe(overlap);
        if (!item.question.toLowerCase().includes(ranked.name.toLowerCase())) {
          expect(item.documentTitle.toLowerCase(), item.slug).not.toContain(ranked.name.toLowerCase());
          expect(item.h1.toLowerCase(), item.slug).not.toContain(ranked.name.toLowerCase());
        }
      }
    }
    for (const slug of [
      'world-wonders',
      'unesco-sites-in-japan',
      'best-supporting-actress-winners',
      'us-constitutional-amendments',
    ]) {
      const item = prompts.find((page) => page.slug === slug);
      expect(item, slug).toBeDefined();
      expect(item!.documentTitle.length, `${slug} ${item!.documentTitle}`).toBeLessThanOrEqual(60);
      expect(renderedAnswerTitle(item!.documentTitle).length, slug).toBeLessThanOrEqual(60);
      expect(item!.documentTitle.startsWith('Rarest '), slug).toBe(true);
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
    expect(page.documentTitle).toBe('Rarest Fruit? All 2 Ranked, 5 Accepted');
    expect(page.h1).toBe('Name a rare fruit: all 2 ranked, 5 accepted');
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

  it('keeps proper nouns in every prompt title and stays inside the snippet limits', () => {
    const dir = fileURLToPath(new URL('../src/data/prompts/', import.meta.url));
    const files = readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'index.json');
    expect(files.length).toBeGreaterThan(200);
    const prompts = getPrompts();
    expect(prompts.length).toBe(files.length);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Prompt;
      const page = prompts.find((item) => item.slug === raw.slug);
      expect(page, file).toBeDefined();
      const rendered = renderedAnswerTitle(page!.documentTitle);
      expect(rendered.length, `${raw.slug} ${rendered}`).toBeLessThanOrEqual(60);
      expect(page!.documentTitle.length, raw.slug).toBeLessThanOrEqual(60);
      expect(page!.description.length, `${raw.slug} ${page!.description}`).toBeGreaterThanOrEqual(140);
      expect(page!.description.length, raw.slug).toBeLessThanOrEqual(160);
      expect(page!.documentTitle, `${raw.slug} ${page!.documentTitle}`).not.toContain('Rare Awards for');
      expect(page!.documentTitle, `${raw.slug} ${page!.documentTitle}`).not.toContain('Cups');
      expect(page!.h1, raw.slug).not.toContain('Cups');
      // A hand-written short noun replaces the question noun on purpose.
      // Every other title keeps the H1 noun whole, so no cut fragment ships.
      if (answerTitleNoun(raw.slug)) continue;
      const titleNoun = /^Rarest (.+?)\?/.exec(page!.documentTitle)?.[1]?.toLowerCase();
      const h1Noun = /^Name an? rare (.+?): all \d/.exec(page!.h1)?.[1]?.toLowerCase();
      expect(titleNoun, `${raw.slug} title noun vs H1: ${page!.documentTitle} / ${page!.h1}`).toBe(h1Noun);
      const synonyms = answerTitleTokenSynonyms(raw.slug);
      const title = page!.documentTitle.toLowerCase();
      for (const token of capitalisedQuestionTokens(raw.question)) {
        const synonym = synonyms[token];
        const kept = title.includes(token) || (synonym ? title.includes(synonym.toLowerCase()) : false);
        expect(kept, `${raw.slug} title missing ${token}: ${page!.documentTitle}`).toBe(true);
      }
    }
  });

  it('uses each search synonym once in the description or the intro', () => {
    const prompts = getPrompts();
    for (const slug of [
      'ghibli-films',
      'champions-league-winners',
      'grammy-record-of-the-year',
      'chemical-elements',
    ]) {
      const page = prompts.find((item) => item.slug === slug);
      const synonym = answerQuerySynonym(slug);
      expect(page, slug).toBeDefined();
      expect(synonym, slug).toBeTruthy();
      const blob = `${page!.description}\n${page!.intro}`.toLowerCase();
      expect(blob, slug).toContain(synonym!.toLowerCase());
    }
    const ghibli = prompts.find((item) => item.slug === 'ghibli-films');
    expect(ghibli).toBeDefined();
    expect(occurrences(ghibli!.description.toLowerCase(), 'movie')).toBe(1);
    expect(ghibli!.intro.toLowerCase()).not.toContain('movie');
    const grammy = prompts.find((item) => item.slug === 'grammy-record-of-the-year');
    expect(grammy).toBeDefined();
    expect(occurrences(`${grammy!.description}\n${grammy!.intro}`, 'Grammy winner')).toBe(1);
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
