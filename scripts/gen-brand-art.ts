/** Reproducible original SVG + 1200×675 WebP artwork. No network or image downloads. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  answerCardSvg,
  categoryArt,
  categoryKeys,
  categorySvg,
  gemSvg,
  heroSceneSvg,
  magnifierSvg,
} from '../src/components/art/artwork';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/images/brand');
await mkdir(out, { recursive: true });

async function save(name: string, data: string | Buffer): Promise<void> {
  const destination = resolve(out, name);
  const temp = `${destination}.${process.pid}.tmp`;
  await writeFile(temp, data);
  await rename(temp, destination);
}

const assets: Record<string, string> = {
  'hero-scene.svg': heroSceneSvg(),
  'legendary-gem.svg': gemSvg(),
  'answer-card-epic.svg': answerCardSvg('#cbb1ff'),
  'answer-card-rare.svg': answerCardSvg('#8dcaff'),
  'magnifier.svg': magnifierSvg(),
};
for (const key of categoryKeys) assets[`category-${key}.svg`] = categorySvg(key);
for (const [name, svg] of Object.entries(assets)) await save(name, svg);

function socialBase(label: string): string {
  const safeLabel = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <defs><radialGradient id="bg"><stop stop-color="#3c2b88"/><stop offset="1" stop-color="#100b2b"/></radialGradient><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0v42" fill="none" stroke="#b5a7f2" stroke-opacity=".045"/></pattern></defs>
    <rect width="1200" height="675" fill="url(#bg)"/><rect width="1200" height="675" fill="url(#grid)"/>
    <rect x="25" y="25" width="1150" height="625" rx="28" fill="none" stroke="#b5a7f2" stroke-opacity=".2"/>
    <path d="M72 94h48" stroke="#f7ca59" stroke-width="4" stroke-linecap="round"/>
    <text x="140" y="103" fill="#ebe5ff" font-family="sans-serif" font-size="23" font-weight="700" letter-spacing="4">RAREST ANSWER</text>
    <text x="76" y="255" fill="#ffffff" font-family="serif" font-size="72" font-weight="700">${safeLabel}</text>
    <text x="80" y="322" fill="#c6bce9" font-family="sans-serif" font-size="30">Think beyond the obvious.</text>
    <text x="80" y="368" fill="#c6bce9" font-family="sans-serif" font-size="30">Find your rare answer.</text>
    <rect x="80" y="448" width="204" height="51" rx="25" fill="#f7ca59"/>
    <text x="182" y="481" text-anchor="middle" fill="#17113e" font-family="sans-serif" font-size="23" font-weight="700">Daily trivia</text>
    <path d="m83 570 13-8 13 8v15l-13 11-13-11Z" fill="#f7ca59"/>
    <text x="125" y="588" fill="#c6bce9" font-family="sans-serif" font-size="22">The rarest correct answer wins.</text>
  </svg>`;
}

async function renderLayer(svg: string, width: number): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
}

for (const key of categoryKeys) {
  const image = await sharp(Buffer.from(socialBase(categoryArt[key].label)))
    .composite([{ input: await renderLayer(categorySvg(key), 470), left: 658, top: 105 }])
    .webp({ quality: 86, effort: 6 })
    .toBuffer();
  await save(`category-${key}-1200x675.webp`, image);
  console.log(`category-${key}-1200x675.webp  ${(image.length / 1024).toFixed(1)} KB`);
}

const hero = await sharp(Buffer.from(socialBase('Rarest Answer')))
  .composite([
    { input: await renderLayer(heroSceneSvg(), 680), left: 510, top: 90 },
    { input: await renderLayer(answerCardSvg('#cbb1ff'), 247), left: 623, top: 198 },
    { input: await renderLayer(answerCardSvg('#8dcaff'), 247), left: 876, top: 325 },
    { input: await renderLayer(gemSvg(), 227), left: 740, top: 254 },
    { input: await renderLayer(magnifierSvg(), 170), left: 625, top: 390 },
  ])
  .webp({ quality: 86, effort: 6 })
  .toBuffer();
await save('hero-1200x675.webp', hero);
console.log(`hero-1200x675.webp  ${(hero.length / 1024).toFixed(1)} KB`);
console.log(
  `Generated ${Object.keys(assets).length} SVGs and 9 social images in public/images/brand/`,
);
