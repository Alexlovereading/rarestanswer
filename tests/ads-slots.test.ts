import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { describe, expect, test } from 'vitest';
import { HOUSE_ADS, type HouseAdImage, type HouseAds } from '../src/config/house-ads';
import en from '../src/locales/en.json';
import {
  configuredAdSenseClient,
  requiresAdConsent,
  resolvePlacement,
  type AdEnv,
} from '../src/components/ads/placements';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
// Use the installed Astro compiler and container, with no dev server or network.
const { transform } = astroRequire('@astrojs/compiler-rs');

async function render(component: string, env: AdEnv, props = {}, slots = {}, houseAds?: HouseAds) {
  const result = await build({
    entryPoints: [join(root, component)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    alias: { '~': join(root, 'src') },
    define: { 'import.meta.env': JSON.stringify(env) },
    plugins: [
      {
        name: 'astro-ad-test',
        setup(builder) {
          if (houseAds !== undefined) {
            builder.onLoad({ filter: /\/config\/house-ads\.ts$/ }, () => ({
              contents: `export const HOUSE_ADS = ${JSON.stringify(houseAds)};`,
              loader: 'ts',
            }));
          }
          builder.onResolve({ filter: /^astro\// }, (args) => ({
            path: pathToFileURL(astroRequire.resolve(args.path)).href,
            external: true,
          }));
          builder.onResolve({ filter: /\.css\?inline$/ }, (args) => ({
            path: args.path.replace(/^~\//, join(root, 'src') + '/').replace(/\?inline$/, ''),
            namespace: 'inline-css',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'inline-css' }, (args) => ({
            contents: JSON.stringify(readFileSync(args.path, 'utf8')),
            loader: 'js',
          }));
          builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
          builder.onLoad({ filter: /\.astro$/ }, (args) => ({
            contents: transform(readFileSync(args.path, 'utf8'), {
              filename: args.path,
              internalURL: 'astro/compiler-runtime',
              resultScopedSlot: true,
              resolvePath: (value: string) => value,
            }).code,
            loader: 'ts',
            resolveDir: dirname(args.path),
          }));
        },
      },
    ],
  });
  const module = await import(
    /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  );
  const { experimental_AstroContainer } = await import(
    /* @vite-ignore */ pathToFileURL(require.resolve('astro/container')).href
  );
  const container = await experimental_AstroContainer.create();
  return container.renderToString(module.default, {
    props,
    slots,
    request: new Request('https://example.test/'),
  });
}

const preview = { PUBLIC_AD_PLACEHOLDERS: 'true' };
const shell = 'src/components/ads/SiteAds.astro';
const head = 'src/components/ads/AdLayoutHead.astro';
const anchorFile = 'src/components/ads/MobileAnchorAd.astro';

// Keep enabled-house-ad coverage independent of the owner's shipped on/off choice.
function fixtureCreative(stem: string, width: number, height: number): HouseAdImage {
  const base = `/images/promos/${stem}`;
  return {
    src: `/images/promos/${stem}-${width}x${height}.webp`,
    srcSet: `${base}-${width}x${height}.webp 1x, ${base}-${width * 2}x${height * 2}.webp 2x`,
    avifSrcSet: `${base}-${width}x${height}.avif 1x, ${base}-${width * 2}x${height * 2}.avif 2x`,
    width,
    height,
  };
}

const houseAdsFixture: HouseAds = {
  'rail-left': {
    href: 'https://fivoraco.com/house/20-christmas-gift-ideas/',
    images: { desktop: fixtureCreative('christmas-gifts', 160, 600) },
    ...en.houseAds.christmas,
    sponsored: true,
  },
  'rail-right': {
    href: 'https://join.trendndailyofficial.com/aff_c?offer_id=16783&aff_id=2130',
    images: { desktop: fixtureCreative('gift-card', 160, 600) },
    ...en.houseAds.giftCard,
    sponsored: true,
  },
  anchor: {
    href: 'https://synthpulseai.com/',
    images: {
      desktop: fixtureCreative('ai-music', 728, 90),
      mobile: fixtureCreative('ai-music', 320, 50),
    },
    ...en.houseAds.synthpulse,
    sponsored: true,
  },
};

function classList(initial: string[] = []) {
  const values = new Set(initial);
  return {
    add: (value: string) => values.add(value),
    remove: (value: string) => values.delete(value),
    contains: (value: string) => values.has(value),
    toggle(value: string, enabled: boolean) {
      if (enabled) values.add(value);
      else values.delete(value);
    },
  };
}

/** Execute the actual inline controller against only the DOM APIs it consumes. */
function runtime(
  provider: 'house' | 'placeholder' | 'adsterra' | 'adsense',
  width: number,
  choice: string | null = null,
  dismissed = false,
  height = 1000,
) {
  const events: Record<string, () => void> = {};
  const changes: Record<string, () => void> = {};
  const memory = new Map<string, string>(dismissed ? [['site-anchor-dismissed', '1']] : []);
  const documentElement = { classList: classList(dismissed ? [] : ['has-site-ad-anchor']) };
  const anchor = {
    hidden: true,
    removed: false,
    remove() {
      this.removed = true;
    },
  };
  const close = {
    addEventListener(_type: string, listener: () => void) {
      events.close = listener;
    },
  };
  const units = ['left', 'right', 'desktop', 'mobile'].map((placement) => {
    const attrs = new Map([
      ['data-site-ad', placement],
      ['data-ad-provider', provider],
    ]);
    const frameAttrs = new Map([
      ['data-src', `/ads/${placement}.html`],
      ['data-ad-managed', '1'],
    ]);
    const frame = {
      src: '',
      getAttribute: (name: string) => frameAttrs.get(name),
      removeAttribute: (name: string) => frameAttrs.delete(name),
    };
    const ins = {
      managed: true,
      removeAttribute() {
        this.managed = false;
      },
    };
    return {
      placement,
      frame,
      ins,
      classList: classList(),
      getAttribute: (name: string) => attrs.get(name),
      querySelector(selector: string) {
        return selector.startsWith('iframe') &&
          provider === 'adsterra' &&
          frameAttrs.has('data-ad-managed')
          ? frame
          : selector.startsWith('ins') && provider === 'adsense' && ins.managed
            ? ins
            : null;
      },
    };
  });
  const queries = {
    '(min-width: 768px)': {
      matches: width >= 768,
      addEventListener(_type: string, listener: () => void) {
        changes.desktop = listener;
      },
    },
    '(min-width: 1440px) and (min-height: 812px)': {
      matches: width >= 1440 && height >= 812,
      addEventListener(_type: string, listener: () => void) {
        changes.wide = listener;
      },
    },
  };
  const window = {
    matchMedia: (query: keyof typeof queries) => queries[query],
    adsbygoogle: [] as object[],
  };
  const context = {
    document: {
      documentElement,
      getElementById: (id: string) => (id === 'site-anchor-ad' ? anchor : close),
      querySelectorAll: () =>
        units.filter((unit) => !anchor.removed || ['left', 'right'].includes(unit.placement)),
      addEventListener: (event: string, listener: () => void) => {
        events[event] = listener;
      },
    },
    window,
    localStorage: { getItem: () => choice },
    sessionStorage: { setItem: (key: string, value: string) => memory.set(key, value) },
  };
  const script = read(anchorFile).match(/<script is:inline>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, context);
  return { units, anchor, documentElement, events, changes, queries, window, memory };
}

describe('reserved ads outside the game', () => {
  test('shipped house config and wrangler vars render no ad shell or layout reservation', async () => {
    const vars = read('wrangler.toml').match(/(?:^|\n)\[vars\]\r?\n([\s\S]*?)(?=\r?\n\[|$)/)![1];
    const env: AdEnv = Object.fromEntries(
      [...vars.matchAll(/^(PUBLIC_\w+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [
        match[1],
        match[2],
      ]),
    );
    expect(HOUSE_ADS).toEqual({});
    expect(env.PUBLIC_AD_PLACEHOLDERS).toBe('false');
    for (const placement of ['left', 'right', 'desktop', 'mobile'] as const) {
      expect(resolvePlacement(env, placement).provider).toBe('none');
      expect(
        (await render('src/components/ads/ReservedAdSlot.astro', env, { placement })).trim(),
      ).toBe('');
    }
    for (const file of [shell, head, anchorFile]) {
      expect((await render(file, env, { siteWide: true })).trim()).toBe('');
    }
    const html = await render(
      'src/components/layout/BaseLayout.astro',
      env,
      { title: 'Test', description: 'Test', locale: 'en' },
      { default: '<main id="main">Normal content</main>' },
    );
    expect(html).toContain('<main id="main">Normal content</main>');
    expect(html).not.toMatch(
      /site-anchor-ad|site-ad-rail|has-site-ad|data-ad-anchor|data-site-ad|Advertisement|Sponsored|fivoraco|trendndailyofficial|synthpulseai|padding-bottom|100% - 384px/,
    );
  });

  test('disabled house ads, empty env and placeholders=false render no shell or network code', async () => {
    const env = { PUBLIC_AD_PLACEHOLDERS: 'false' };
    for (const file of [shell, head, anchorFile])
      expect((await render(file, env, {}, {}, {})).trim()).toBe('');
    expect(
      (
        await render('src/components/ads/ReservedAdSlot.astro', env, { placement: 'left' }, {}, {})
      ).trim(),
    ).toBe('');
    expect(configuredAdSenseClient({ PUBLIC_ADSENSE_CLIENT: 'ca-pub-test' })).toBe('');
    expect(requiresAdConsent(env)).toBe(false);
    const base = await render(
      'src/components/layout/BaseLayout.astro',
      env,
      { title: 'Test', description: 'Test', locale: 'en' },
      {},
      {},
    );
    expect(base).not.toMatch(
      /data-site-ad=|id="site-anchor-ad"|id="cookie-consent"|__awLoadTrackers/,
    );
  });

  test('preview renders four exact-size, labeled boxes and no network units', async () => {
    const html = await render(shell, preview, {}, {}, {});
    expect(html.match(/data-ad-provider="placeholder"/g)).toHaveLength(4);
    expect(html.match(/--ad-width:160px;--ad-height:600px/g)).toHaveLength(2);
    expect(html).toContain('--ad-width:728px;--ad-height:90px');
    expect(html).toContain('--ad-width:320px;--ad-height:50px');
    expect(html).toContain('aria-label="Advertisement"');
    expect(html).toContain('aria-label="Close ad"');
    expect(html).not.toMatch(/<iframe|<ins|https:\/\/.*(?:googlesyndication|adsterra)/);
    expect((await render(anchorFile, preview)).trim()).toBe('');
  });

  test('real slots replace only their placeholders and defer every network unit', async () => {
    const env = {
      ...preview,
      PUBLIC_ADSENSE_CLIENT: 'ca-pub-test',
      PUBLIC_ADSENSE_SLOT_RAIL_LEFT: '123',
      PUBLIC_ADSTERRA_SLOT_RAIL_LEFT_160X600: 'unit',
      PUBLIC_ADSTERRA_SLOT_RAIL_RIGHT_160X600: 'unit',
    };
    const html = await render(shell, env, {}, {}, {});
    expect(html.match(/data-ad-provider="placeholder"/g)).toHaveLength(2);
    expect(html).toContain('data-ad-slot="123"');
    expect(html).toContain('display:block;width:160px;height:600px');
    expect(html).toContain('data-src="/ads/rail-right-160x600.html"');
    expect(html).not.toMatch(/<iframe[^>]*\ssrc=/);
    expect(html).not.toContain('data-adsterra-defer');
    expect(resolvePlacement(env, 'left').provider).toBe('adsense');
    expect(requiresAdConsent({ PUBLIC_ADSTERRA_SLOT_RAIL_LEFT_160X600: 'unit' })).toBe(true);
    const adsterraOnly = await render(
      'src/components/layout/BaseLayout.astro',
      { PUBLIC_ADSTERRA_SLOT_RAIL_LEFT_160X600: 'unit' },
      { title: 'Test', description: 'Test', locale: 'en' },
    );
    expect(adsterraOnly).toContain('id="cookie-consent"');
    expect(adsterraOnly).not.toMatch(/<iframe[^>]*\ssrc=/);
  });

  test('BaseLayout renders shell ads after game markup, never inside the play card', async () => {
    const html = await render(
      'src/components/layout/BaseLayout.astro',
      preview,
      { title: 'Test', description: 'Test', locale: 'en' },
      {
        default:
          '<main id="main"><section data-game-root><input aria-label="Answer"></section></main>',
      },
      houseAdsFixture,
    );
    const game = html.match(/<section data-game-root>[\s\S]*?<\/section>/)![0];
    expect(game).not.toMatch(/data-site-ad|data-house-ad|sponsored|adsbygoogle|<iframe/);
    expect(html).toContain('data-ad-provider="house"');
    expect(html.indexOf('data-ad-rail="left"')).toBeGreaterThan(html.indexOf('</main>'));
    expect(html.match(/id="site-anchor-ad"/g)).toHaveLength(1);
    for (const name of readdirSync(join(root, 'src/components/game')).filter((name) =>
      name.endsWith('.astro'),
    )) {
      expect(
        read(`src/components/game/${name}`).replace(/\/\*[\s\S]*?\*\//g, ''),
        name,
      ).not.toMatch(
        /from\s+['"][^'"]*components\/ads\/|<(?:AdSenseSlot|AdsterraSlot|ReservedAdSlot|SiteAds|HouseAd)\b/,
      );
    }
  });

  test('placeholders load nothing and show only the active responsive positions', () => {
    const mobile = runtime('placeholder', 375);
    expect(mobile.anchor.hidden).toBe(false);
    expect(
      mobile.units
        .filter((unit) => unit.classList.contains('site-ad-ready'))
        .map((unit) => unit.placement),
    ).toEqual(['mobile']);
    expect(mobile.window.adsbygoogle).toHaveLength(0);
    expect(mobile.units.every((unit) => unit.frame.src === '')).toBe(true);
    const wide = runtime('placeholder', 1440);
    expect(
      wide.units
        .filter((unit) => unit.classList.contains('site-ad-ready'))
        .map((unit) => unit.placement),
    ).toEqual(['left', 'right', 'desktop']);
  });

  test('house ads render sponsored links, visible disclosures and local dimensioned art', async () => {
    const html = await render(shell, preview, {}, {}, houseAdsFixture);
    expect(html.match(/data-ad-provider="house"/g)).toHaveLength(4);
    expect(html.match(/rel="sponsored noopener" target="_blank"/g)).toHaveLength(4);
    expect(html.match(/class="house-ad-sponsored">Sponsored</g)).toHaveLength(4);
    expect(html).toContain('Christmas gift ideas');
    expect(html).toContain('Walmart Gift Card');
    expect(html).toContain('Make a song with AI');
    expect(html).toContain('Try SynthPulse');
    expect(html).not.toMatch(/<iframe|<ins|data-ad-provider="placeholder"/);
    for (const image of html.match(/<img\b[^>]*>/g) ?? []) {
      expect(image).toContain('src="/images/promos/');
      expect(image).toMatch(/width="(?:160|728|320)" height="(?:600|90|50)"/);
      expect(image).toMatch(/\salt(?:="")?(?=\s|>)/);
      expect(image).toContain('loading="lazy"');
    }
    expect(Object.keys(houseAdsFixture)).toEqual(['rail-left', 'rail-right', 'anchor']);
    expect(houseAdsFixture['rail-left']?.href).toBe(
      'https://fivoraco.com/house/20-christmas-gift-ideas/',
    );
    expect(houseAdsFixture['rail-right']?.href).toBe(
      'https://join.trendndailyofficial.com/aff_c?offer_id=16783&aff_id=2130',
    );
    expect(houseAdsFixture.anchor?.href).toBe('https://synthpulseai.com/');
    for (const ad of Object.values(houseAdsFixture)) {
      for (const image of Object.values(ad.images)) {
        expect(existsSync(join(root, 'public', image.src))).toBe(true);
        for (const srcSet of [image.srcSet, image.avifSrcSet]) {
          for (const variant of srcSet?.split(',') ?? []) {
            expect(existsSync(join(root, 'public', variant.trim().split(' ')[0]))).toBe(true);
          }
        }
      }
    }
  });

  test('network inventory wins per slot, then house ads, placeholders, or nothing', async () => {
    for (const [placement, adsense, adsterra] of [
      ['left', 'RAIL_LEFT', 'RAIL_LEFT_160X600'],
      ['right', 'RAIL_RIGHT', 'RAIL_RIGHT_160X600'],
      ['desktop', 'ANCHOR_DESKTOP', 'ANCHOR_728X90'],
      ['mobile', 'ANCHOR_MOBILE', 'STICKY_320X50'],
    ] as const) {
      const env: AdEnv = {
        ...preview,
        PUBLIC_ADSENSE_CLIENT: 'ca-pub-test',
        [`PUBLIC_ADSENSE_SLOT_${adsense}`]: '123',
        [`PUBLIC_ADSTERRA_SLOT_${adsterra}`]: 'unit',
      };
      const file = 'src/components/ads/ReservedAdSlot.astro';
      const adsenseHtml = await render(file, env, { placement }, {}, houseAdsFixture);
      expect(adsenseHtml).toContain('data-ad-provider="adsense"');
      expect(adsenseHtml).not.toContain('data-house-ad');
      env[`PUBLIC_ADSENSE_SLOT_${adsense}`] = '';
      const adsterraHtml = await render(file, env, { placement }, {}, houseAdsFixture);
      expect(adsterraHtml).toContain('data-ad-provider="adsterra"');
      expect(adsterraHtml).not.toContain('data-house-ad');
      expect(resolvePlacement({}, placement, houseAdsFixture).provider).toBe('house');
      expect(await render(file, {}, { placement }, {}, houseAdsFixture)).toContain(
        'data-ad-provider="house"',
      );
      expect(resolvePlacement(preview, placement, {}).provider).toBe('placeholder');
      expect(resolvePlacement({}, placement, {}).provider).toBe('none');
    }
  });

  test('house ads ignore consent, load no network inventory, and keep dismissal working', () => {
    expect(requiresAdConsent({})).toBe(false);
    const mobile = runtime('house', 375, 'declined');
    expect(mobile.anchor.hidden).toBe(false);
    expect(
      mobile.units
        .filter((unit) => unit.classList.contains('site-ad-ready'))
        .map((unit) => unit.placement),
    ).toEqual(['mobile']);
    expect(mobile.units.every((unit) => unit.frame.src === '')).toBe(true);
    expect(mobile.window.adsbygoogle).toHaveLength(0);
    mobile.events.close();
    expect(mobile.anchor.removed).toBe(true);
    expect(mobile.memory.get('site-anchor-dismissed')).toBe('1');
    mobile.events['aw:consent-accepted']();
    expect(mobile.anchor.hidden).toBe(true);
    const wide = runtime('house', 1440, null, false, 812);
    expect(
      wide.units
        .filter((unit) => unit.classList.contains('site-ad-ready'))
        .map((unit) => unit.placement),
    ).toEqual(['left', 'right', 'desktop']);
  });

  test('real ads wait for consent and do not load hidden rails or the alternate bottom size', () => {
    const state = runtime('adsterra', 1280, 'declined');
    expect(state.anchor.hidden).toBe(true);
    expect(state.units.every((unit) => unit.frame.src === '')).toBe(true);
    state.events['aw:consent-accepted']();
    expect(state.units.map((unit) => unit.frame.src)).toEqual(['', '', '/ads/desktop.html', '']);
    state.queries['(min-width: 1440px) and (min-height: 812px)'].matches = true;
    state.changes.wide();
    expect(state.units.map((unit) => unit.frame.src)).toEqual([
      '/ads/left.html',
      '/ads/right.html',
      '/ads/desktop.html',
      '',
    ]);
    const adsense = runtime('adsense', 375, 'accepted');
    expect(adsense.anchor.hidden).toBe(false);
    expect(adsense.window.adsbygoogle).toHaveLength(1);
    adsense.events['aw:consent-accepted']();
    expect(adsense.window.adsbygoogle).toHaveLength(1);
    const short = runtime('adsterra', 1440, 'accepted', false, 800);
    expect(short.units.map((unit) => unit.frame.src)).toEqual(['', '', '/ads/desktop.html', '']);
  });

  test('dismissal is remembered per session and a later consent event cannot reopen it', () => {
    const state = runtime('placeholder', 375);
    state.events.close();
    expect(state.memory.get('site-anchor-dismissed')).toBe('1');
    expect(state.anchor.removed).toBe(true);
    expect(state.documentElement.classList.contains('has-site-ad-anchor')).toBe(false);
    state.events['aw:consent-accepted']();
    expect(state.anchor.hidden).toBe(true);
    const returning = runtime('adsterra', 375, 'accepted', true);
    expect(returning.anchor.removed).toBe(true);
    expect(returning.units.every((unit) => unit.frame.src === '')).toBe(true);
  });

  test('prepaint reservation follows the same session dismissal and exact shell geometry', async () => {
    const html = await render(head, preview);
    const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
    for (const dismissed of [false, true]) {
      const documentElement = { classList: classList(), setAttribute() {} };
      runInNewContext(script, {
        document: { documentElement },
        sessionStorage: { getItem: () => (dismissed ? '1' : null) },
      });
      expect(documentElement.classList.contains('has-site-ad-anchor')).toBe(!dismissed);
      expect(documentElement.classList.contains('has-site-ad-rails')).toBe(true);
    }
    const css = read('src/styles/ads.css');
    expect(css).toContain('@media (min-width: 1440px)');
    expect(css).toContain('width: calc(100% - 384px)');
    expect(css).toContain('position: sticky');
    // Tight anchor bar (2026-11-15): unit height + 12px — 50+12 mobile, 90+12 desktop.
    // Body padding must reserve exactly the bar height so nothing is covered.
    expect(css).toContain('height: calc(62px + env(safe-area-inset-bottom');
    expect(css).toContain('padding-bottom: calc(62px + env(safe-area-inset-bottom');
    expect(css).toContain('height: calc(102px + env(safe-area-inset-bottom');
    expect(css).toContain('padding-bottom: calc(102px + env(safe-area-inset-bottom');
  });
});
