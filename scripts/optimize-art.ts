/**
 * Build responsive raster art with sharp; no source PNGs enter public/.
 * Example:
 * node --import tsx scripts/optimize-art.ts --input .art-src/hero.png \
 *   --output public/images/world/hero-observatory --width 520 --height 780 \
 *   --max-kb 220 --avif
 *
 * --trim removes transparent padding; --contain preserves the entire subject.
 * --position north can protect high-placed subjects when making a wide crop.
 * Files include their actual dimensions, e.g. hero-observatory-520x780.webp.
 * AVIF variants are saved only when smaller than their WebP equivalent.
 * --max-kb is a strict per-file ceiling. Encoding fails if the budget cannot
 * be met without dropping below quality 42. Existing files are replaced only
 * after all variants have encoded successfully.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
    width: { type: 'string' },
    height: { type: 'string' },
    quality: { type: 'string', default: '78' },
    'alpha-quality': { type: 'string', default: '100' },
    'max-kb': { type: 'string', default: '220' },
    avif: { type: 'boolean', default: false },
    trim: { type: 'boolean', default: false },
    contain: { type: 'boolean', default: false },
    position: { type: 'string', default: 'centre' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(
    'Usage: node --import tsx scripts/optimize-art.ts --input source.png --output public/images/world/name --width 520 --height 780 [--quality 78] [--alpha-quality 100] [--max-kb 220] [--trim] [--contain] [--position centre|north|south|east|west|attention|entropy] [--avif]',
  );
  process.exit(0);
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

if (!values.input || !values.output) throw new Error('--input and --output are required');
const width = positiveInteger(values.width, '--width');
const height = positiveInteger(values.height, '--height');
const quality = positiveInteger(values.quality, '--quality');
if (quality < 42 || quality > 100) throw new Error('--quality must be between 42 and 100');
const alphaQuality = positiveInteger(values['alpha-quality'], '--alpha-quality');
if (alphaQuality > 100) throw new Error('--alpha-quality must be between 1 and 100');
const maxBytes = positiveInteger(values['max-kb'], '--max-kb') * 1024;
if (!['centre', 'north', 'south', 'east', 'west', 'attention', 'entropy'].includes(values.position))
  throw new Error('Unsupported --position');
const sourcePath = resolve(values.input);
const outputBase = resolve(values.output);
const source = sharp(sourcePath, { failOn: 'error' }).rotate();
if (values.trim) source.trim({ background: '#00000000', threshold: 8 });
const normalized = await source.png().toBuffer();
const formats = values.avif ? (['webp', 'avif'] as const) : (['webp'] as const);
const outputs: { path: string; data: Buffer; width: number; height: number; quality: number }[] =
  [];

for (const scale of [1, 2]) {
  const outputWidth = width * scale;
  const outputHeight = height * scale;
  for (const format of formats) {
    let encoded: Buffer | undefined;
    let usedQuality = quality;
    while (usedQuality >= 42) {
      const pipeline = sharp(normalized).resize(outputWidth, outputHeight, {
        fit: values.contain ? 'contain' : 'cover',
        position: values.position,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
      const candidate =
        format === 'webp'
          ? await pipeline.webp({ quality: usedQuality, alphaQuality, effort: 6 }).toBuffer()
          : await pipeline
              .avif({ quality: usedQuality, effort: 6, chromaSubsampling: '4:4:4' })
              .toBuffer();
      if (candidate.length <= maxBytes) {
        encoded = candidate;
        break;
      }
      usedQuality -= 3;
    }
    if (!encoded)
      throw new Error(
        `${outputWidth}x${outputHeight} ${format} exceeds ${values['max-kb']} KB at quality 42; use a larger budget or a smaller display size`,
      );
    const webp = outputs.find(
      (output) =>
        output.width === outputWidth &&
        output.height === outputHeight &&
        output.path.endsWith('.webp'),
    );
    if (format === 'avif' && webp && encoded.length >= webp.data.length) continue;
    outputs.push({
      path: `${outputBase}-${outputWidth}x${outputHeight}.${format}`,
      data: encoded,
      width: outputWidth,
      height: outputHeight,
      quality: usedQuality,
    });
  }
}

await mkdir(dirname(outputBase), { recursive: true });
for (const output of outputs) {
  await writeFile(output.path, output.data);
  console.log(
    JSON.stringify({
      file: output.path,
      width: output.width,
      height: output.height,
      bytes: output.data.length,
      quality: output.quality,
    }),
  );
}
