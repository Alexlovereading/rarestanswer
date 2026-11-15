/** Build-time cover inputs. Shared theme/color helpers stay in src/lib/covers. */
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import { coverFilename, hslToHex, stableHash } from '../../src/lib/covers';

export const COVER_VERSION = 2;
export const COVER_SIZE = { width: 1200, height: 675 } as const;
// Also survives a centered 4:3 crop (150px lost on each side), and a 21:9
// crop (81px lost at top/bottom). Only decoration extends outside this box.
export const COVER_SAFE_AREA = { left: 156, top: 96, right: 1044, bottom: 579 } as const;
export const COVER_TITLE_BOX = { left: 552, top: 218, width: 492, height: 312 } as const;
export const COVER_FONT_FILES = [
  'public/fonts/fraunces-700.woff2',
  'scripts/fonts/Lato-Bold.ttf',
] as const;

export interface CoverFrontmatter {
  title: string;
  image?: string;
  draft: boolean;
}

export function readCoverFrontmatter(source: string): CoverFrontmatter {
  const block = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!block) throw new Error('Missing article frontmatter');
  const data: unknown = parse(block);
  if (
    !data ||
    typeof data !== 'object' ||
    !('title' in data) ||
    typeof data.title !== 'string' ||
    !data.title.trim()
  ) {
    throw new Error('Cover needs a nonempty frontmatter title');
  }
  return {
    title: data.title,
    image: 'image' in data && typeof data.image === 'string' ? data.image : undefined,
    draft: 'draft' in data && data.draft === true,
  };
}

export type CoverIllustration =
  'hero' | 'geography' | 'animals' | 'food' | 'sports' | 'screen' | 'music' | 'science' | 'history';

/** Match the subject, rather than treating every page in games as one topic. */
export function pickCoverIllustration(id: string, title: string): CoverIllustration {
  const topic = `${id} ${title}`.toLowerCase().replace(/[-_/]/g, ' ');
  if (/\b(animals?|wildlife|apes?)\b/.test(topic)) return 'animals';
  if (/\b(geography|farflung|countries|capitals)\b/.test(topic)) return 'geography';
  if (/\b(sports?|football|ball knowledge|dartle)\b/.test(topic)) return 'sports';
  if (/\b(science|cosmillion|size it up|chemistry)\b/.test(topic)) return 'science';
  if (/\b(stranger things|movies?|films?|screen|tv)\b/.test(topic)) return 'screen';
  if (/\b(music|songs?)\b/.test(topic)) return 'music';
  if (/\b(food|recipes?|cooking)\b/.test(topic)) return 'food';
  if (/\b(history|historical)\b/.test(topic)) return 'history';
  return 'hero';
}

export function coverArtFiles(illustration: CoverIllustration): string[] {
  return illustration === 'hero'
    ? [
        'hero-scene.svg',
        'answer-card-epic.svg',
        'answer-card-rare.svg',
        'legendary-gem.svg',
        'magnifier.svg',
      ]
    : ['hero-scene.svg', `category-${illustration}.svg`, 'legendary-gem.svg'];
}

export function readCoverPalette(css: string) {
  const token = (name: string): string => {
    const match = css.match(
      new RegExp(`--${name}:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`),
    );
    if (!match) throw new Error(`Missing cover theme token --${name}`);
    return hslToHex(Number(match[1]), Number(match[2]), Number(match[3]));
  };
  return {
    background: token('background'),
    foreground: token('foreground'),
    muted: token('muted'),
    brand: token('brand'),
    gold: token('gold'),
    border: token('border'),
  };
}

export type CoverPalette = ReturnType<typeof readCoverPalette>;

/** Honor an existing local cover name, including names unlike the article id. */
export function managedCoverFile(
  id: string,
  image: string | undefined,
  articlePath: string,
  coversDir: string,
): string | null {
  if (!image) return coverFilename(id);
  const path = resolve(dirname(articlePath), image);
  if (dirname(path) !== resolve(coversDir) || !path.endsWith('.png')) return null;
  return path.slice(dirname(path).length + 1);
}

export function coverCacheKey(input: {
  title: string;
  shortName: string;
  palette: CoverPalette;
  illustration: CoverIllustration;
  assets: string[];
  fonts: string[];
}): string {
  return stableHash(
    JSON.stringify({
      version: COVER_VERSION,
      size: COVER_SIZE,
      safeArea: COVER_SAFE_AREA,
      titleBox: COVER_TITLE_BOX,
      ...input,
    }),
  );
}

export interface CoverManifest {
  version: number;
  entries: Record<string, string>;
}

export function readCoverManifest(source: string): CoverManifest {
  const data: unknown = JSON.parse(source);
  if (
    !data ||
    typeof data !== 'object' ||
    !('entries' in data) ||
    !data.entries ||
    typeof data.entries !== 'object' ||
    Array.isArray(data.entries)
  ) {
    throw new Error('Invalid cover manifest');
  }
  return {
    version: COVER_VERSION,
    entries: Object.fromEntries(
      Object.entries(data.entries).filter(
        ([file, key]) => /^[^/\\]+\.png$/.test(file) && typeof key === 'string',
      ),
    ),
  };
}

/** Keep references from drafts too; an unpublished article still owns its art. */
export function orphanCoverFiles(
  files: string[],
  referenced: ReadonlySet<string>,
  managedFiles?: ReadonlySet<string>,
): string[] {
  return files.filter(
    (file) =>
      file.endsWith('.png') && !referenced.has(file) && (!managedFiles || managedFiles.has(file)),
  );
}
