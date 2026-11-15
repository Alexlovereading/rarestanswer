/**
 * Pure-helper tests for `pnpm gen-covers` (src/lib/covers.ts).
 * Rendering itself (satori/resvg/CJK download) is exercised by running the
 * script — these pin the deterministic logic only.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '~/config/site';
import {
  coverFilename,
  hasCjk,
  hexToHsl,
  hslToHex,
  parseBrandHsl,
  pickCjkScript,
  pickFontSize,
  spliceImageIntoFrontmatter,
  stableHash,
  stripEmoji,
  subsetText,
  titleWidthUnits,
} from '~/lib/covers';
import {
  COVER_FONT_FILES,
  COVER_SAFE_AREA,
  COVER_SIZE,
  COVER_TITLE_BOX,
  COVER_VERSION,
  coverArtFiles,
  coverCacheKey,
  managedCoverFile,
  orphanCoverFiles,
  pickCoverIllustration,
  readCoverFrontmatter,
  readCoverManifest,
  readCoverPalette,
} from '../scripts/lib/covers';

describe('parseBrandHsl / hslToHex', () => {
  test('parses the light-mode --brand declaration', () => {
    const css = ':root {\n  --brand: 22 90% 52%;\n  --brand-light: 22 90% 62%;\n}';
    expect(parseBrandHsl(css)).toEqual({ h: 22, s: 90, l: 52 });
  });

  test('returns null when --brand is missing', () => {
    expect(parseBrandHsl(':root { --brand-light: 22 90% 62%; }')).toBeNull();
  });

  test('hslToHex matches known values', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    expect(hslToHex(0, 0, 0)).toBe('#000000');
  });
});

describe('hexToHsl', () => {
  test('matches the reference values apply-template has always produced', () => {
    // Pinned against the previous inline implementation in apply-template.ts
    // (math was ported verbatim) — these feed globals.css + manifest.
    expect(hexToHsl('#f97316')).toEqual({ h: 25, s: 95, l: 53 });
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl('#ffffff')).toEqual({ h: 0, s: 0, l: 100 });
  });

  test('expands #rgb shorthand and accepts uppercase', () => {
    expect(hexToHsl('#abc')).toEqual(hexToHsl('#aabbcc'));
    expect(hexToHsl('#F97316')).toEqual(hexToHsl('#f97316'));
  });

  test('rejects malformed input with null', () => {
    expect(hexToHsl('nothex')).toBeNull();
    expect(hexToHsl('#12345')).toBeNull();
    expect(hexToHsl('#1234g6')).toBeNull();
    expect(hexToHsl('')).toBeNull();
  });
});

describe('spliceImageIntoFrontmatter', () => {
  test('inserts after category on LF files, byte-identical EOL', () => {
    const src = '---\ntitle: T\ncategory: bosses\ndescription: D\n---\n\nBody';
    const out = spliceImageIntoFrontmatter(src, '../../assets/covers/x.png');
    expect(out).toBe(
      "---\ntitle: T\ncategory: bosses\nimage: '../../assets/covers/x.png'\ndescription: D\n---\n\nBody",
    );
    expect(out!.includes('\r')).toBe(false);
  });

  test('keeps a CRLF page uniformly CRLF (no mixed EOL, no doubled CR)', () => {
    const src = '---\r\ntitle: T\r\ncategory: bosses\r\ndescription: D\r\n---\r\n\r\nBody';
    const out = spliceImageIntoFrontmatter(src, 'c.png');
    expect(out).toContain("category: bosses\r\nimage: 'c.png'\r\n");
    expect(out).toContain('\r\n---\r\n');
    expect(out!.includes('\r\r')).toBe(false);
    // Uniform CRLF: after removing CRLF pairs, no bare LF remains.
    expect(out!.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  test('$-sequences in frontmatter text survive the splice unchanged', () => {
    // String-mode replace would expand these: `$'` drags the document tail
    // into the frontmatter, `$1` repeats the whole old block, `$$` silently
    // loses a dollar — all without failing the build.
    const src = "---\ntitle: Cost $1 $' $$ 5\ncategory: bosses\n---\n\nBody text";
    const out = spliceImageIntoFrontmatter(src, 'c.png');
    expect(out).toBe(
      "---\ntitle: Cost $1 $' $$ 5\ncategory: bosses\nimage: 'c.png'\n---\n\nBody text",
    );
  });

  test('falls back to description, then appends when neither exists', () => {
    expect(spliceImageIntoFrontmatter('---\ntitle: T\ndescription: D\n---\n', 'c.png')).toBe(
      "---\ntitle: T\ndescription: D\nimage: 'c.png'\n---\n",
    );
    expect(spliceImageIntoFrontmatter('---\ntitle: T\n---\n', 'c.png')).toBe(
      "---\ntitle: T\nimage: 'c.png'\n---\n",
    );
  });

  test('returns null without frontmatter or when an image already exists', () => {
    expect(spliceImageIntoFrontmatter('no frontmatter here', 'c.png')).toBeNull();
    expect(spliceImageIntoFrontmatter('---\nimage: a.png\n---\n', 'c.png')).toBeNull();
  });
});

describe('CJK detection', () => {
  test('hasCjk flags Han and kana, not Latin', () => {
    expect(hasCjk('Emberfang ボス攻略')).toBe(true);
    expect(hasCjk('完全ガイド')).toBe(true);
    expect(hasCjk('Plain English title')).toBe(false);
  });

  test('ja locale or kana picks JP glyph shapes; other Han picks SC', () => {
    expect(pickCjkScript('ja', '完全ガイド')).toBe('ja');
    expect(pickCjkScript('en', '火の玉')).toBe('ja'); // の is kana → JP glyphs
    expect(pickCjkScript('en', 'Anvil Quest')).toBeNull();
  });

  test('kana in text forces ja even on non-ja locale', () => {
    expect(pickCjkScript('en', 'ボス攻略')).toBe('ja');
    expect(pickCjkScript('en', '武器强度排行')).toBe('zh');
  });
});

describe('stripEmoji', () => {
  test('strips pictographs but keeps text', () => {
    expect(stripEmoji('Fire Titan ⚔️🔥')).toBe('Fire Titan');
    expect(stripEmoji('No emoji here')).toBe('No emoji here');
  });
});

describe('naming / hashing / subsetting', () => {
  test('coverFilename flattens the content id', () => {
    expect(coverFilename('en/bosses/emberfang')).toBe('en-bosses-emberfang.png');
    expect(coverFilename('ja/guides/beginner-guide')).toBe('ja-guides-beginner-guide.png');
  });

  test('stableHash is deterministic and hash-like', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
    expect(stableHash('abc')).toMatch(/^[0-9a-f]{8}$/);
  });

  test('subsetText dedupes and sorts glyphs', () => {
    expect(subsetText('abc', 'cbd')).toBe('abcd');
  });
});

describe('font sizing heuristics', () => {
  test('CJK chars count as full width, Latin as narrow', () => {
    expect(titleWidthUnits('ああ')).toBeGreaterThan(titleWidthUnits('aa'));
  });

  test('short titles get the max size, very long titles clamp to the floor', () => {
    expect(pickFontSize('Fire Titan')).toBe(84);
    const veryLong = 'x'.repeat(200);
    expect(pickFontSize(veryLong)).toBe(36);
  });
});

describe('illustrated cover inputs', () => {
  test('reads the current YAML title, including quotes, folded lines, and comments', () => {
    const fm = readCoverFrontmatter(
      `---\r\ntitle: 'Brainer: Gamebunny''s Daily Trivia Show'\r\ndraft: true # unpublished\r\nimage: '../../../../assets/covers/keep-this-name.png'\r\n---\r\nBody`,
    );
    expect(fm.title).toBe("Brainer: Gamebunny's Daily Trivia Show");
    expect(fm.draft).toBe(true);
    expect(fm.image).toContain('keep-this-name.png');
    expect(readCoverFrontmatter('---\ntitle: >-\n  Games Like\n  Krillion\n---\n').title).toBe(
      'Games Like Krillion',
    );
    expect(() => readCoverFrontmatter('---\ncategory: games\n---\n')).toThrow('title');
  });

  test.each([
    ['en/games/farflung-game', 'Farflung Game', 'geography'],
    ['en/games/ball-knowledge-game', 'Ball Knowledge Game', 'sports'],
    ['en/games/dartle-game', 'Dartle Game', 'sports'],
    ['en/games/cosmillion', 'Cosmillion Game', 'science'],
    ['en/guides/animals', 'Rarest Answers for Animal Prompts', 'animals'],
    ['en/guides/characters', 'Stranger Things Characters Trivia', 'screen'],
    ['en/games/games-like-krillion', 'Games Like Krillion', 'hero'],
    ['en/guides/how-to-play', 'How to Play Rarest Answer', 'hero'],
  ] as const)('chooses topic art for %s', (id, title, illustration) => {
    expect(pickCoverIllustration(id, title)).toBe(illustration);
  });

  test('preserves a wired PNG filename and leaves external/custom images alone', () => {
    const dir = '/repo/src/assets/covers';
    const article = '/repo/src/content/wiki/en/games/changed-slug.mdx';
    expect(
      managedCoverFile(
        'en/games/changed-slug',
        '../../../../assets/covers/original-name.png',
        article,
        dir,
      ),
    ).toBe('original-name.png');
    expect(managedCoverFile('en/games/changed-slug', undefined, article, dir)).toBe(
      'en-games-changed-slug.png',
    );
    expect(
      managedCoverFile('en/games/changed-slug', '/images/custom.png', article, dir),
    ).toBeNull();
    expect(
      managedCoverFile('en/games/changed-slug', 'https://example.com/cover.png', article, dir),
    ).toBeNull();
  });

  test('title, art, font, and theme changes each invalidate the rendering cache', () => {
    const palette = {
      background: '#ffffff',
      foreground: '#111111',
      muted: '#eeeeee',
      brand: '#221166',
      gold: '#ddbb55',
      border: '#dddddd',
    };
    const input = {
      title: 'Games Like Krillion',
      shortName: 'Rarest Answer',
      palette,
      illustration: 'hero' as const,
      assets: ['original art hash'],
      fonts: ['font hash'],
    };
    const key = coverCacheKey(input);
    expect(coverCacheKey({ ...input })).toBe(key);
    expect(coverCacheKey({ ...input, title: 'A New Title' })).not.toBe(key);
    expect(coverCacheKey({ ...input, assets: ['changed art hash'] })).not.toBe(key);
    expect(coverCacheKey({ ...input, fonts: ['changed font hash'] })).not.toBe(key);
    expect(coverCacheKey({ ...input, palette: { ...palette, brand: '#331177' } })).not.toBe(key);
  });

  test('finds orphan PNGs while keeping draft references and unrelated files', () => {
    expect(
      orphanCoverFiles(
        ['live.png', 'draft.png', 'deleted.png', '.gen-covers-manifest.json'],
        new Set(['live.png', 'draft.png']),
      ),
    ).toEqual(['deleted.png']);
    expect(
      orphanCoverFiles(
        ['deleted.png', 'unrelated-preview.png'],
        new Set(),
        new Set(['deleted.png']),
      ),
    ).toEqual(['deleted.png']);
    expect(
      readCoverManifest('{"version":1,"entries":{"live.png":"abc","../escape.png":"bad"}}'),
    ).toEqual({ version: COVER_VERSION, entries: { 'live.png': 'abc' } });
    expect(() => readCoverManifest('{"entries":null}')).toThrow('manifest');
  });

  test('keeps the title box inside the 12% crop-safe area', () => {
    const safe = COVER_SAFE_AREA;
    expect(safe.left).toBeGreaterThanOrEqual(COVER_SIZE.width * 0.12);
    expect(COVER_SIZE.width - safe.right).toBeGreaterThanOrEqual(COVER_SIZE.width * 0.12);
    expect(safe.top).toBeGreaterThanOrEqual(COVER_SIZE.height * 0.12);
    expect(COVER_SIZE.height - safe.bottom).toBeGreaterThanOrEqual(COVER_SIZE.height * 0.12);
    expect(COVER_TITLE_BOX.left).toBeGreaterThanOrEqual(safe.left);
    expect(COVER_TITLE_BOX.left + COVER_TITLE_BOX.width).toBeLessThanOrEqual(safe.right);
    expect(COVER_TITLE_BOX.top + COVER_TITLE_BOX.height).toBeLessThanOrEqual(safe.bottom);
  });
});

describe('published cover assets', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const contentDir = join(root, 'src/content/wiki');
  const coversDir = join(root, 'src/assets/covers');
  const palette = readCoverPalette(readFileSync(join(root, 'src/styles/globals.css'), 'utf8'));
  const filesIn = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)],
    );

  test('every current article has a matching title/art hash and a 1200×675 PNG, with no orphans', () => {
    const manifest = readCoverManifest(
      readFileSync(join(coversDir, '.gen-covers-manifest.json'), 'utf8'),
    );
    const referenced = new Set<string>();
    const fontHashes = COVER_FONT_FILES.map((file) =>
      stableHash(readFileSync(join(root, file)).toString('base64')),
    );
    for (const path of filesIn(contentDir).filter((path) => path.endsWith('.mdx'))) {
      const fm = readCoverFrontmatter(readFileSync(path, 'utf8'));
      const id = relative(contentDir, path)
        .split('\\')
        .join('/')
        .replace(/\.mdx$/, '');
      const file = managedCoverFile(id, fm.image, path, coversDir);
      if (!file) continue;
      referenced.add(file);
      if (fm.draft) continue;
      expect(fm.image, id).toBeTruthy();
      const png = readFileSync(resolve(coversDir, file));
      expect(png.subarray(1, 4).toString(), file).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([1200, 675]);
      const illustration = pickCoverIllustration(id, fm.title);
      expect(manifest.entries[file], `stale cover: ${id}`).toBe(
        coverCacheKey({
          title: fm.title,
          shortName: site.shortName,
          palette,
          illustration,
          assets: coverArtFiles(illustration).map((asset) =>
            stableHash(readFileSync(join(root, 'public/images/brand', asset), 'utf8')),
          ),
          fonts: fontHashes,
        }),
      );
    }
    expect(orphanCoverFiles(readdirSync(coversDir), referenced)).toEqual([]);
    expect(Object.keys(manifest.entries).filter((file) => !referenced.has(file))).toEqual([]);
  });

  test('title and brand text meet 4.5:1 against the cover background', () => {
    const luminance = (hex: string): number => {
      const rgb = [1, 3, 5]
        .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        );
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const background = luminance(palette.background);
    for (const color of [palette.foreground, palette.brand]) {
      const text = luminance(color);
      expect(
        (Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
