import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { describe, expect, test } from 'vitest';
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

async function render(component: string, env: AdEnv, props = {}, slots = {}) {
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
  provider: 'placeholder' | 'adsterra' | 'adsense',
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
    '(min-width: 1440px) and (min-height: 860px)': {
      matches: width >= 1440 && height >= 860,
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
  test('empty env and placeholders=false render no shell, head, unit, or legacy article mount', async () => {
    const env = { PUBLIC_AD_PLACEHOLDERS: 'false' };
    for (const file of [shell, head, anchorFile]) expect((await render(file, env)).trim()).toBe('');
    expect(
      (await render('src/components/ads/ReservedAdSlot.astro', env, { placement: 'left' })).trim(),
    ).toBe('');
    expect(configuredAdSenseClient({ PUBLIC_ADSENSE_CLIENT: 'ca-pub-test' })).toBe('');
    expect(requiresAdConsent(env)).toBe(false);
    const base = await render('src/components/layout/BaseLayout.astro', env,
      { title: 'Test', description: 'Test', locale: 'en' });
    expect(base).not.toMatch(/data-site-ad=|id="site-anchor-ad"|id="cookie-consent"|__awLoadTrackers/);

  });

  test('preview renders four exact-size, labeled boxes and no network units', async () => {
    const html = await render(shell, preview);
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
    const html = await render(shell, env);
    expect(html.match(/data-ad-provider="placeholder"/g)).toHaveLength(2);
    expect(html).toContain('data-ad-slot="123"');
    expect(html).toContain('display:block;width:160px;height:600px');
    expect(html).toContain('data-src="/ads/rail-right-160x600.html"');
    expect(html).not.toMatch(/<iframe[^>]*\ssrc=/);
    expect(html).not.toContain('data-adsterra-defer');
    expect(resolvePlacement(env, 'left').provider).toBe('adsense');
    expect(requiresAdConsent({ PUBLIC_ADSTERRA_SLOT_RAIL_LEFT_160X600: 'unit' })).toBe(true);
    const adsterraOnly = await render('src/components/layout/BaseLayout.astro',
      { PUBLIC_ADSTERRA_SLOT_RAIL_LEFT_160X600: 'unit' },
      { title: 'Test', description: 'Test', locale: 'en' });
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
    );
    const game = html.match(/<section data-game-root>[\s\S]*?<\/section>/)![0];
    expect(game).not.toMatch(/data-site-ad|adsbygoogle|<iframe/);
    expect(html.indexOf('data-ad-rail="left"')).toBeGreaterThan(html.indexOf('</main>'));
    expect(html.match(/id="site-anchor-ad"/g)).toHaveLength(1);
    for (const name of readdirSync(join(root, 'src/components/game')).filter((name) =>
      name.endsWith('.astro'),
    )) {
      expect(
        read(`src/components/game/${name}`).replace(/\/\*[\s\S]*?\*\//g, ''),
        name,
      ).not.toMatch(
        /from\s+['"][^'"]*components\/ads\/|<(?:AdSenseSlot|AdsterraSlot|ReservedAdSlot|SiteAds)\b/,
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

  test('real ads wait for consent and do not load hidden rails or the alternate bottom size', () => {
    const state = runtime('adsterra', 1280, 'declined');
    expect(state.anchor.hidden).toBe(true);
    expect(state.units.every((unit) => unit.frame.src === '')).toBe(true);
    state.events['aw:consent-accepted']();
    expect(state.units.map((unit) => unit.frame.src)).toEqual(['', '', '/ads/desktop.html', '']);
    state.queries['(min-width: 1440px) and (min-height: 860px)'].matches = true;
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
    expect(css).toContain('108px + env(safe-area-inset-bottom');
    expect(css).toContain('148px + env(safe-area-inset-bottom');
  });
});
