/**
 * Prompt catalog integrity: noData scoring, unique names, and Stranger Things
 * articles that are actually about the character.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { normalizeKey, scoreAnswerDrafts, wikiTokensAgree } from '../scripts/data/prompt-defs';
import { isShortForm, mergeCharactersByActor, pickCharacterWiki, type WikiProbe } from '../scripts/data/wikipedia-characters';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const promptDir = join(root, 'src', 'data', 'prompts');

interface StoredAnswer {
  name: string;
  aliases: string[];
  popularity: number;
  rarity: number;
  tier: number;
  noData?: true;
  wiki?: string;
}

interface StoredPrompt {
  slug: string;
  answers: StoredAnswer[];
}

function loadPrompt(file: string): StoredPrompt {
  return JSON.parse(readFileSync(join(promptDir, file), 'utf8')) as StoredPrompt;
}

function prompts(): StoredPrompt[] {
  return readdirSync(promptDir)
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => loadPrompt(name));
}

const FORBIDDEN_ST_WIKIS = [
  'Alaska',
  'Troy',
  'Illithid',
  '2',
  '11',
  'United States Army',
  'KGB',
  'Mormons',
  'Satanic panic',
  'Hospital volunteer',
  'Reno Riggins',
  "Stranger Things: Tales from '85",
  'United States Department of Energy',
  'James Hopper',
  'Michael Wheeler',
  'Stacy',
  'Grigory',
  'Vicky',
  'Alexey',
  'Illusion',
];

describe('answer scoring contract', () => {
  test('noData answers are excluded from the other answers percentile', () => {
    const answers = scoreAnswerDrafts([
      { name: 'Rare', aliases: [], popularity: 10, wiki: 'Rare' },
      { name: 'Missing', aliases: ['short'], popularity: 1, noData: true, wiki: 'Wrong' },
      { name: 'Common', aliases: [], popularity: 40, wiki: 'Common' },
    ]);
    const missing = answers.find((answer) => answer.name === 'Missing');
    expect(missing).toEqual({
      name: 'Missing',
      aliases: ['short'],
      popularity: 0,
      rarity: 0.5,
      tier: 3,
      noData: true,
    });
    expect(answers.find((answer) => answer.name === 'Rare')).toMatchObject({ rarity: 1, tier: 6, popularity: 10 });
    expect(answers.find((answer) => answer.name === 'Common')).toMatchObject({ rarity: 0, tier: 1, popularity: 40 });
    expect(answers.map((answer) => answer.name)).toEqual(['Rare', 'Missing', 'Common']);
  });
});

describe('character linking rules', () => {
  test('a short name merges into the full name only when the actor is the same', () => {
    expect(isShortForm('Troy', 'Troy Walsh')).toBe(true);
    expect(isShortForm('Tina', 'Tina Turnbow')).toBe(true);
    expect(isShortForm('Tommy H', 'Tommy Hagan')).toBe(true);
    expect(isShortForm('Alexei', 'Dr. Alexei')).toBe(true);
    expect(isShortForm('Vicki', 'Vickie Dunne')).toBe(false);

    const merged = mergeCharactersByActor([
      { name: 'Troy', aliases: [], actor: 'Peyton Wich' },
      { name: 'Troy Walsh', aliases: [], actor: 'Peyton Wich' },
      { name: 'Tina', aliases: [], actor: 'Madelyn Cline' },
      { name: 'Tina Turnbow', aliases: [], actor: 'Caroline Elle Abrams' },
      { name: 'Vicki', aliases: [], actor: 'Abigail Cowen' },
      { name: 'Vickie Dunne', aliases: [], actor: 'Amybeth McNulty' },
    ]);
    const troy = merged.find((character) => character.name === 'Troy Walsh');
    expect(troy?.aliases).toContain('Troy');
    expect(merged.some((character) => character.name === 'Troy')).toBe(false);
    expect(merged.map((character) => character.name).sort()).toEqual(['Tina', 'Tina Turnbow', 'Troy Walsh', 'Vicki', 'Vickie Dunne']);
  });

  test('wiki titles have to be about that character', () => {
    expect(wikiTokensAgree('Eleven', 'Eleven (Stranger Things)')).toBe(true);
    expect(wikiTokensAgree('Troy Walsh', 'Troy')).toBe(false);
    expect(wikiTokensAgree('Yuri Ismaylov', 'Alaska')).toBe(false);

    const probes: WikiProbe[] = [
      { requested: 'Troy', title: 'Troy', description: 'Ancient city in northwest Asia Minor' },
      { requested: 'Troy (Stranger Things)', missing: true },
      { requested: 'Troy Walsh', missing: true },
      { requested: 'Troy Walsh (Stranger Things)', missing: true },
      { requested: 'Yuri Ismaylov', missing: true },
      { requested: 'Yuri Ismaylov (Stranger Things)', missing: true },
      { requested: 'Eleven', title: '11', redirectTo: '11', description: 'Natural number' },
      { requested: 'Eleven (Stranger Things)', title: 'Eleven (Stranger Things)', description: 'Protagonist of Stranger Things' },
      { requested: 'Eddie Munson', redirectTo: 'List of Stranger Things characters', fragment: 'Eddie Munson', title: 'List of Stranger Things characters' },
      { requested: 'Eddie Munson (Stranger Things)', missing: true },
      { requested: 'Suzie Bingham', redirectTo: 'List of Stranger Things characters', fragment: 'Also starring', title: 'List of Stranger Things characters', description: 'List of Stranger Things characters' },
      { requested: 'Will Byers', title: 'Will Byers', description: 'Stranger Things character' },
      { requested: 'Will Byers (Stranger Things)', missing: true },
      { requested: 'Barbara Holland', title: 'Barbara Holland', description: 'American writer (1933-2010)' },
      { requested: 'Mind Flayer', title: 'Illithid', redirectTo: 'Illithid', description: 'Fictional monster' },
    ];
    const forName = (name: string, aliases: string[] = []): WikiProbe[] => {
      const wanted = new Set(aliases.concat(name).flatMap((candidate) => [candidate, `${candidate} (Stranger Things)`]).map((value) => value.toLowerCase()));
      return probes.filter((probe) => wanted.has(probe.requested.toLowerCase()));
    };
    expect(pickCharacterWiki('Troy Walsh', ['Troy'], forName('Troy Walsh', ['Troy']))).toBeUndefined();
    expect(pickCharacterWiki('Yuri Ismaylov', [], forName('Yuri Ismaylov'))).toBeUndefined();
    expect(pickCharacterWiki('Eleven', [], forName('Eleven'))).toBe('Eleven (Stranger Things)');
    expect(pickCharacterWiki('Eddie Munson', [], forName('Eddie Munson'))).toBe('Eddie Munson');
    expect(pickCharacterWiki('Suzie Bingham', [], forName('Suzie Bingham'))).toBeUndefined();
    expect(pickCharacterWiki('Will Byers', [], forName('Will Byers'))).toBe('Will Byers');
    expect(pickCharacterWiki('Barbara Holland', [], forName('Barbara Holland'))).toBeUndefined();
    expect(pickCharacterWiki('Mind Flayer', [], forName('Mind Flayer'))).toBeUndefined();
  });
});

describe('built prompt catalog', () => {
  const catalog = prompts();

  test('no answer is scored on a one-view or placeholder popularity', () => {
    const offenders: string[] = [];
    for (const prompt of catalog) {
      for (const answer of prompt.answers) {
        if (answer.popularity > 0 && answer.popularity <= 1) offenders.push(`${prompt.slug}: ${answer.name} ${answer.popularity}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('noData answers follow the contract and everyone else has a real count', () => {
    let noData = 0;
    for (const prompt of catalog) {
      for (const answer of prompt.answers) {
        if (answer.noData === true) {
          noData += 1;
          expect(answer.popularity, prompt.slug + ' ' + answer.name).toBe(0);
          expect(answer.rarity).toBe(0.5);
          expect(answer.tier).toBe(3);
          expect(answer.wiki).toBeUndefined();
          continue;
        }
        expect(answer.noData, prompt.slug + ' ' + answer.name).toBeUndefined();
        expect(answer.popularity).toBeGreaterThan(1);
      }
    }
    expect(noData).toBeGreaterThan(0);
  });

  test('no two answers in a prompt share a normalized name or alias', () => {
    const collisions: string[] = [];
    for (const prompt of catalog) {
      const seen = new Map<string, string>();
      for (const answer of prompt.answers) {
        const keys = [answer.name, ...answer.aliases];
        for (const value of keys) {
          const key = normalizeKey(value);
          if (!key) continue;
          const owner = seen.get(key);
          if (owner) collisions.push(`${prompt.slug}: ${key} on ${owner} and ${answer.name}`);
          else seen.set(key, answer.name);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  test('Stranger Things links are not generic places or other topics', () => {
    const prompt = catalog.find((item) => item.slug === 'stranger-things-characters');
    expect(prompt).toBeDefined();
    if (!prompt) return;
    const wikis = prompt.answers.map((answer) => answer.wiki).filter((wiki): wiki is string => Boolean(wiki));
    for (const wiki of FORBIDDEN_ST_WIKIS) expect(wikis).not.toContain(wiki);
    for (const answer of prompt.answers) {
      if (!answer.wiki) continue;
      expect(wikiTokensAgree(answer.name, answer.wiki), `${answer.name} -> ${answer.wiki}`).toBe(true);
    }
    expect(prompt.answers.some((answer) => answer.name === 'Troy')).toBe(false);
    const walsh = prompt.answers.find((answer) => answer.name === 'Troy Walsh');
    expect(walsh?.aliases.some((alias) => normalizeKey(alias) === 'troy')).toBe(true);
    expect(walsh?.wiki).not.toBe('Troy');
    const yuri = prompt.answers.find((answer) => answer.name === 'Yuri Ismaylov');
    expect(yuri?.noData).toBe(true);
    expect(yuri?.wiki).toBeUndefined();
    expect(prompt.answers.find((answer) => answer.name === 'Eleven')?.wiki).toBe('Eleven (Stranger Things)');
    expect(prompt.answers.some((answer) => answer.name === 'Tina')).toBe(true);
    expect(prompt.answers.some((answer) => answer.name === 'Tina Turnbow')).toBe(true);
  });
});
