/** A2 art processing: node .art-src/a2/optimize.mjs from the repository root. */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const root = process.cwd();
const require = createRequire(`${root}/package.json`);
const sharp = require('sharp');
sharp.concurrency(2);
const manifest = JSON.parse(await readFile(`${root}/.art-src/a2/manifest.json`, 'utf8'));
const tierKeys = ['common', 'familiar', 'uncommon', 'rare', 'epic', 'legendary'];
const report = [];
for (const asset of manifest.assets) {
  const tier = tierKeys.includes(asset.key);
  const directory = `${root}/public/images/${tier ? 'tiers' : 'categories'}`;
  const sizes = tier ? [128, 192, 256, 384] : [64, 128, 256, 512, 1024];
  const source = `${root}/.art-src/a2/${asset.key}.png`;
  for (const width of sizes) {
    const quality = 78;
    let data;
    let alphaStep = 1;
    const { data: rgba, info } = await sharp(source).resize(width, width, { fit: 'contain', background: '#00000000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const step of tier ? [1, 4, 8, 16, 32] : [1]) {
      alphaStep = step;
      const pixels = Buffer.from(rgba);
      if (step > 1) for (let i = 3; i < pixels.length; i += 4) pixels[i] = Math.min(255, Math.round(pixels[i] / step) * step);
      data = await sharp(pixels, { raw: { width, height: width, channels: info.channels } }).webp({ quality, alphaQuality: 80, effort: 6 }).toBuffer();
      if (data.length <= (tier ? 25 : 220) * 1024) break;
    }
    if (data.length > (tier ? 25 : 220) * 1024) throw new Error(`Art budget exceeded: ${asset.key} ${width}`);
    const output = `${directory}/${asset.key}-${width}x${width}.webp`;
    await writeFile(output, data);
    report.push({ file: output.slice(root.length + 1), bytes: data.length, width, height: width, quality, alphaStep });
    if (!tier) {
      const avif = await sharp(source).resize(width, width).avif({ quality: 52, effort: 5, chromaSubsampling: '4:4:4' }).toBuffer();
      if (avif.length >= data.length) throw new Error(`AVIF does not save bytes: ${asset.key} ${width}`);
      const alternate = `${directory}/${asset.key}-${width}x${width}.avif`;
      await writeFile(alternate, avif);
      report.push({ file: alternate.slice(root.length + 1), bytes: avif.length, width, height: width, quality: 52 });
    }
  }
  console.log(`${asset.key}: optimized`);
}
await writeFile(`${root}/.art-src/a2/sizes.json`, JSON.stringify(report, null, 2));
console.log(`${report.length} responsive files; ${report.reduce((sum, entry) => sum + entry.bytes, 0)} total bytes`);
