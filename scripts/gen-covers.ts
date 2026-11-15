/**
 * gen-covers — illustrated, crop-safe 1200×675 article covers.
 *
 * Usage:
 *   pnpm gen-covers                    # missing covers + changed managed covers
 *   pnpm gen-covers --all              # also adopt existing local cover PNGs
 *   pnpm gen-covers --force            # ignore the manifest cache
 *   pnpm gen-covers --out <dir>        # render elsewhere — frontmatter is NOT touched
 *   pnpm gen-covers --fonts-dir <dir>  # offline source for Noto CJK OTFs (see below)
 *
 * Covers are 1200×675 PNGs (og:image standard since v2.0: Google Discover
 * large-image previews need ≥1200px width) rendered with satori + resvg.
 *
 * Fonts:
 *   - Latin: existing OFL Fraunces + Lato — deterministic, no network.
 *   - CJK titles: Noto Sans SC/JP. Full OTFs (~16MB each) are NOT committed;
 *     they download once into node_modules/.cache/gen-covers/fonts/ (or use
 *     --fonts-dir with pre-downloaded files) and are subset per title with
 *     subset-font (60–200KB per render) — satori only accepts TTF/OTF.
 *
 * Cache includes the live title, theme, illustration contents, fonts, and
 * layout version. Existing image paths keep their filenames. Unreferenced
 * PNGs and stale manifest entries are removed; draft references are kept.
 *
 * Frontmatter wiring (only when writing to the default covers dir and the
 * article has no `image:` yet): inserts `image: '<relative path>'` after the
 * `category:` line so the Zod image() helper picks the PNG up on next build.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import subsetFont from 'subset-font';
import { site } from '~/config/site';
import { NOTO_BASE } from './lib/fonts';
import {
  pickCjkScript,
  spliceImageIntoFrontmatter,
  stableHash,
  stripEmoji,
  subsetText,
} from '~/lib/covers';
import {
  COVER_FONT_FILES,
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
} from './lib/covers';
import type { CoverIllustration, CoverManifest, CoverPalette } from './lib/covers';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { width: W, height: H } = COVER_SIZE;
const CONTENT_DIR = join(root, 'src/content/wiki');
const COVERS_DIR = join(root, 'src/assets/covers');
const FONT_CACHE = join(root, 'node_modules/.cache/gen-covers/fonts');
const ART_DIR = join(root, 'public/images/brand');

// Per-locale merged CJK fonts (NotoSansCJKjp/sc, ~16MB each) — family names
// must match the internal font family satori matches on. The download base
// lives in scripts/lib/fonts.ts (pinned to a noto-cjk release tag, shared
// with gen-assets).
const NOTO_VARIANTS = {
  ja: { region: 'Japanese', family: 'Noto Sans CJK JP', prefix: 'NotoSansCJKjp' },
  zh: { region: 'SimplifiedChinese', family: 'Noto Sans CJK SC', prefix: 'NotoSansCJKsc' },
} as const;

type Script = keyof typeof NOTO_VARIANTS;
interface Article {
  id: string;
  absPath: string;
  locale: string;
  title: string;
  image?: string;
  draft: boolean;
}

// --- CLI ---------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const FORCE = flag('force');
const ALL = flag('all') || FORCE;
const OUT_DIR = opt('out') ? resolve(opt('out') as string) : COVERS_DIR;
const FONTS_DIR = opt('fonts-dir') ? resolve(opt('fonts-dir') as string) : undefined;
const WIRE_FRONTMATTER = OUT_DIR === COVERS_DIR;

// --- content scanning ----------------------------------------------------------

function listMdxFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) listMdxFiles(p, acc);
    else if (name.name.endsWith('.mdx')) acc.push(p);
  }
  return acc;
}

function collectArticles(): Article[] {
  return listMdxFiles(CONTENT_DIR)
    .sort()
    .map((absPath) => {
      const fm = readCoverFrontmatter(readFileSync(absPath, 'utf8'));
      // Normalize win32 separators before splitting: path.relative yields
      // backslashes there, and locale/coverFilename both split on '/'.
      const rel = relative(CONTENT_DIR, absPath)
        .split('\\')
        .join('/')
        .replace(/\.mdx$/, '');
      const [locale] = rel.split('/');
      return {
        id: rel,
        absPath,
        locale,
        title: fm.title,
        image: fm.image,
        draft: fm.draft,
      };
    });
}

// --- fonts ---------------------------------------------------------------------

interface SatoriFont {
  name: string;
  data: Buffer;
  /** satori's weight type is a literal union (100–900). */
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: 'normal';
}

async function readLatinFonts(glyphs: string): Promise<SatoriFont[]> {
  return [
    {
      name: 'Fraunces',
      data: await subsetFont(readFileSync(join(root, COVER_FONT_FILES[0])), glyphs, {
        targetFormat: 'sfnt',
      }),
      weight: 700,
      style: 'normal',
    },
    {
      name: 'Lato',
      data: readFileSync(join(root, COVER_FONT_FILES[1])),
      weight: 700,
      style: 'normal',
    },
  ];
}

async function ensureNotoOtf(script: Script, weight: 'Regular' | 'Bold'): Promise<Buffer> {
  const v = NOTO_VARIANTS[script];
  const file = `${v.prefix}-${weight}.otf`;
  const candidates = [FONTS_DIR, FONT_CACHE].filter(Boolean) as string[];
  for (const dir of candidates) {
    const p = join(dir, file);
    if (existsSync(p)) return readFileSync(p);
  }
  const url = `${NOTO_BASE}/${v.region}/${file}`;
  console.log(`  downloading ${file} (~16MB, cached for future runs) …`);
  // AbortSignal — without it a stalled connection hangs the script forever.
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(
      `${url} → HTTP ${res.status}. Offline? Pre-download ${file} into a dir and pass --fonts-dir <dir>.`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000)
    throw new Error(`${file} looks truncated (${buf.length} bytes) — not cached.`);
  mkdirSync(FONT_CACHE, { recursive: true });
  writeFileSync(join(FONT_CACHE, file), buf);
  return buf;
}

async function subsetNoto(script: Script, glyphs: string): Promise<SatoriFont[]> {
  const v = NOTO_VARIANTS[script];
  const full = {
    400: await ensureNotoOtf(script, 'Regular'),
    700: await ensureNotoOtf(script, 'Bold'),
  };
  return Promise.all(
    (
      [
        [400, full[400]],
        [700, full[700]],
      ] as const
    ).map(async ([weight, buffer]) => ({
      name: v.family,
      weight,
      style: 'normal' as const,
      data: await subsetFont(buffer, glyphs, { targetFormat: 'sfnt' }),
    })),
  );
}

// --- rendering -------------------------------------------------------------------

interface Element {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: unknown;
    [key: string]: unknown;
  };
}

function el(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
  extra: Record<string, unknown> = {},
): Element {
  return { type, props: { ...extra, style, ...(children !== undefined ? { children } : {}) } };
}

/** Data URIs keep SVG assets untouched and require no network during rendering. */
function artImage(
  file: string,
  left: number,
  top: number,
  width: number,
  height: number,
  rotate = 0,
): Element {
  return el(
    'img',
    {
      position: 'absolute',
      left,
      top,
      width,
      height,
      ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}),
    },
    undefined,
    {
      width,
      height,
      src: `data:image/svg+xml;base64,${readFileSync(join(ART_DIR, file)).toString('base64')}`,
    },
  );
}

function illustrationElements(illustration: CoverIllustration): Element[] {
  if (illustration !== 'hero') {
    return [
      artImage('hero-scene.svg', 136, 138, 400, 334),
      artImage(`category-${illustration}.svg`, 156, 164, 352, 352),
    ];
  }
  // The site's original trivia scene, composed from its existing layers.
  // Cards contain abstract strokes, not invented answers or player statistics.
  return [
    artImage('hero-scene.svg', 136, 142, 400, 334),
    artImage('answer-card-epic.svg', 186, 200, 172, 92, -13),
    artImage('answer-card-rare.svg', 331, 300, 172, 92, 11),
    artImage('legendary-gem.svg', 273, 237, 142, 154),
    artImage('magnifier.svg', 188, 331, 102, 113, -12),
  ];
}

function coverElement(opts: {
  title: string;
  fontSize: number;
  palette: CoverPalette;
  illustration: CoverIllustration;
  lang: string;
  fontFamily: string;
}): Element {
  const p = opts.palette;
  const box = COVER_TITLE_BOX;
  return el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      position: 'relative',
      backgroundColor: p.background,
      color: p.foreground,
      fontFamily: 'Lato',
      overflow: 'hidden',
    },
    [
      // Full-bleed decoration may crop; the brand/title/art are kept well inside.
      el('div', {
        position: 'absolute',
        left: -240,
        top: -25,
        width: 800,
        height: 800,
        borderRadius: '50%',
        backgroundColor: p.muted,
      }),
      el('div', {
        position: 'absolute',
        left: -180,
        top: 42,
        width: 660,
        height: 660,
        borderRadius: '50%',
        border: `1px solid ${p.border}`,
      }),
      ...illustrationElements(opts.illustration),
      el(
        'div',
        {
          position: 'absolute',
          left: box.left,
          top: 150,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 40,
        },
        [
          el('img', { width: 34, height: 37 }, undefined, {
            width: 34,
            height: 37,
            src: `data:image/svg+xml;base64,${readFileSync(join(ART_DIR, 'legendary-gem.svg')).toString('base64')}`,
          }),
          el(
            'div',
            {
              fontSize: 25,
              fontWeight: 700,
              color: p.brand,
              letterSpacing: '0.5px',
            },
            site.shortName,
          ),
        ],
      ),
      el(
        'div',
        {
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          display: 'flex',
          alignItems: 'center',
        },
        el(
          'div',
          {
            width: box.width,
            fontSize: opts.fontSize,
            fontFamily: opts.fontFamily,
            fontWeight: 700,
            lineHeight: 1.08,
            color: p.foreground,
          },
          opts.title,
          { id: 'cover-title' },
        ),
      ),
      el('div', {
        position: 'absolute',
        left: box.left,
        top: 550,
        width: 58,
        height: 5,
        backgroundColor: p.gold,
        borderRadius: 3,
      }),
    ],
    { lang: opts.lang },
  );
}

async function renderCover(
  article: Article,
  palette: CoverPalette,
  illustration: CoverIllustration,
  latinFonts: SatoriFont[],
): Promise<Buffer> {
  const title = stripEmoji(article.title);
  if (title !== article.title) console.warn(`  stripped pictographs from "${article.title}"`);
  const script = pickCjkScript(article.locale, title);
  const fonts = [...latinFonts];
  let fontFamily = 'Fraunces, Lato';
  let lang = 'en';
  if (script) {
    fonts.push(...(await subsetNoto(script, subsetText(title, site.shortName))));
    fontFamily += `, ${NOTO_VARIANTS[script].family}`;
    lang = script === 'ja' ? 'ja-JP' : 'zh-CN';
  }
  // Measure the actual font layout, rather than trusting character counts.
  // Never truncate the live title: shrink to fit, or fail before writing a PNG.
  for (let fontSize = 76; fontSize >= 28; fontSize -= 2) {
    let titleFits = false;
    const element = coverElement({ title, fontSize, palette, illustration, lang, fontFamily });
    const svg = await satori(element as Parameters<typeof satori>[0], {
      width: W,
      height: H,
      fonts,
      onNodeDetected(node) {
        if (node.props.id === 'cover-title') {
          titleFits =
            node.width <= COVER_TITLE_BOX.width + 0.5 &&
            node.height <= COVER_TITLE_BOX.height + 0.5 &&
            node.left >= COVER_TITLE_BOX.left - 0.5 &&
            node.top >= COVER_TITLE_BOX.top - 0.5 &&
            node.top + node.height <= COVER_TITLE_BOX.top + COVER_TITLE_BOX.height + 0.5;
        }
      },
    });
    if (titleFits) return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  }
  throw new Error(`Title cannot fit the crop-safe area: ${article.title}`);
}

// --- frontmatter wiring ------------------------------------------------------------

function wireFrontmatter(mdxPath: string, imageRelPath: string): boolean {
  const src = readFileSync(mdxPath, 'utf8');
  const updated = spliceImageIntoFrontmatter(src, imageRelPath);
  if (updated === null) return false;
  // Atomic replace (same dir + rename): a crash mid-write must never leave a
  // truncated MDX behind — same contract as sync-codes.
  const tmpPath = `${mdxPath}.tmp`;
  writeFileSync(tmpPath, updated, 'utf8');
  renameSync(tmpPath, mdxPath);
  return true;
}

// --- main ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(CONTENT_DIR)) {
    console.error('No src/content/wiki — run from the repo root.');
    process.exit(1);
  }
  const css = readFileSync(join(root, 'src/styles/globals.css'), 'utf8');
  const palette = readCoverPalette(css);

  const allArticles = collectArticles();
  const articles = allArticles.filter((a) => !a.draft);
  const manifestPath = join(OUT_DIR, '.gen-covers-manifest.json');
  let manifest: CoverManifest = { version: COVER_VERSION, entries: {} };
  let adoptExisting = ALL;
  if (existsSync(manifestPath)) {
    try {
      manifest = readCoverManifest(readFileSync(manifestPath, 'utf8'));
    } catch {
      console.warn('manifest unreadable — regenerating all covers.');
      adoptExisting = true;
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let generated = 0;
  let skipped = 0;
  let wired = 0;
  const fontHashes = COVER_FONT_FILES.map((file) =>
    stableHash(readFileSync(join(root, file)).toString('base64')),
  );
  const latinFonts = await readLatinFonts(
    subsetText(site.shortName, ...articles.map((article) => stripEmoji(article.title))),
  );

  for (const article of articles) {
    const file = managedCoverFile(article.id, article.image, article.absPath, COVERS_DIR);
    // Custom images outside the covers directory are never overwritten.
    if (!file) continue;
    const ours = manifest.entries[file] !== undefined;
    // --all adopts the previously untracked PNGs without changing MDX paths.
    const eligible = !WIRE_FRONTMATTER || !article.image || ours || adoptExisting;
    if (!eligible) continue;

    const illustration = pickCoverIllustration(article.id, article.title);
    const key = coverCacheKey({
      title: article.title,
      shortName: site.shortName,
      palette,
      illustration,
      assets: coverArtFiles(illustration).map((asset) =>
        stableHash(readFileSync(join(ART_DIR, asset), 'utf8')),
      ),
      fonts: fontHashes,
    });
    if (!FORCE && manifest.entries[file] === key && existsSync(join(OUT_DIR, file))) {
      skipped++;
    } else {
      console.log(`Rendering ${file} — ${article.title} (${illustration})`);
      const png = await renderCover(article, palette, illustration, latinFonts);
      const tmpPath = join(OUT_DIR, `${file}.tmp`);
      writeFileSync(tmpPath, png);
      renameSync(tmpPath, join(OUT_DIR, file));
      manifest.entries[file] = key;
      generated++;
    }

    if (WIRE_FRONTMATTER && !article.image) {
      const absCover = join(COVERS_DIR, file);
      const relFromMdx = relative(dirname(article.absPath), absCover).split('\\').join('/');
      if (wireFrontmatter(article.absPath, relFromMdx)) {
        wired++;
        console.log('  wired frontmatter image');
      }
    }
  }

  const referenced = new Set(
    allArticles.flatMap((article) => {
      const file = managedCoverFile(article.id, article.image, article.absPath, COVERS_DIR);
      return file ? [file] : [];
    }),
  );
  // The default directory contains only article covers. A preview directory
  // may also contain unrelated PNGs: remove only its previously managed files.
  // Draft article references are intentionally kept in either mode.
  const orphans = orphanCoverFiles(
    readdirSync(OUT_DIR),
    referenced,
    WIRE_FRONTMATTER ? undefined : new Set(Object.keys(manifest.entries)),
  );
  for (const file of orphans) {
    unlinkSync(join(OUT_DIR, file));
    console.log(`Removed orphan ${file}`);
  }
  manifest.entries = Object.fromEntries(
    Object.entries(manifest.entries).filter(([file]) => referenced.has(file)),
  );
  const manifestTmp = `${manifestPath}.tmp`;
  writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2) + '\n');
  renameSync(manifestTmp, manifestPath);
  console.log(
    `\nDone: ${generated} generated, ${skipped} cached, ${wired} wired, ${orphans.length} orphan PNGs removed → ${relative(root, OUT_DIR)}`,
  );
  if (!WIRE_FRONTMATTER) console.log('(custom --out: frontmatter untouched)');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
