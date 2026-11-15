import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// This site removed the template's GitHub workflows; setup.yml parity checks only apply when it exists.
const HAS_SETUP_YML = existsSync(new URL('../.github/workflows/setup.yml', import.meta.url));

/**
 * public/_redirects was the demo landing storefront's 301 list (handbook
 * slug renames, /zh and /en guesses, root → /zh/landing/). This fork removed
 * that file with the landing layer. What is still live is the removal
 * machinery: apply-template and setup.yml must keep listing the file and
 * src/pages/demo.astro, and must never list RootGateway.astro. This site's
 * index.astro does not import that component; the survive pin still forbids
 * deleting it. project.ts still carries the dead demoRootGateway constant.
 */
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// public/_redirects now holds this site's own 301s for merged guide pages
// (GEO audit G4, 2026-11-15). The landing storefront rules must not return,
// every source must be a removed page, and every target a live MDX page.
test('site redirects point removed pages at live pages, with no landing rules', () => {
  const file = `${repoRoot}public/_redirects`;
  if (!existsSync(file)) return;
  const rules = readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/));
  expect(rules.length).toBeGreaterThan(0);
  for (const [from, to, status] of rules) {
    expect(status).toBe('301');
    expect(from).not.toMatch(/landing|^\/zh|^\/en\b|^\/$/);
    const live = (path: string) =>
      existsSync(`${repoRoot}src/content/wiki/en${path.replace(/\/$/, '')}.mdx`);
    expect(live(from)).toBe(false);
    expect(to.endsWith('/')).toBe(true);
    expect(live(to)).toBe(true);
  }
});

test.skipIf(!HAS_SETUP_YML)('fork initialization removes the file on both channels (CLI + setup.yml)', () => {
  const cli = readFileSync(`${repoRoot}scripts/apply-template.ts`, 'utf8');
  expect(cli).toMatch(/'public\/_redirects'/);
  const yml = readFileSync(`${repoRoot}.github/workflows/setup.yml`, 'utf8');
  const landingStep = yml.split('\n').find((line) => line.includes('rm -rf src/components/landing'));
  expect(landingStep, 'landing removal step in setup.yml').toBeDefined();
  expect(landingStep).toContain('public/_redirects');
  // It rides the unconditional landing step, not the demo-content step —
  // forks never serve /landing/docs regardless of clear_demo_content.
  const demoStep = yml.split('\n').find((line) => line.includes('scripts/clear-demo-public.ts'));
  expect(demoStep, 'content-aware demo public cleanup step').toBeDefined();
  expect(demoStep).not.toContain('public/_redirects');
});

test.skipIf(!HAS_SETUP_YML)('fork initialization deletes src/pages/demo.astro on both channels — and never RootGateway.astro', () => {
  const cli = readFileSync(`${repoRoot}scripts/apply-template.ts`, 'utf8');
  expect(cli).toMatch(/'src\/pages\/demo\.astro'/);
  const yml = readFileSync(`${repoRoot}.github/workflows/setup.yml`, 'utf8');
  const landingStep = yml.split('\n').find((line) => line.includes('rm -rf src/components/landing'));
  expect(landingStep).toContain('src/pages/demo.astro');
  const demoStep = yml.split('\n').find((line) => line.includes('scripts/clear-demo-public.ts'));
  expect(demoStep).not.toContain('src/pages/demo.astro');

  // Survive pin: RootGateway.astro must NEVER enter a deletion channel.
  // This site's index.astro no longer imports it; the pin still keeps the
  // file out of both removal lists.
  expect(cli).not.toMatch(/'src\/components\/RootGateway\.astro'/);
  expect(landingStep).not.toContain('src/components/RootGateway.astro');
});

test('the survive gateway constant still names /zh/landing/ and the landing link is off', () => {
  // The root 301 that used to match this target was in public/_redirects,
  // which this fork deleted. The constant stays in project.ts (the file
  // survives apply-template) and must not drift from the path the removed
  // rule used, and the flag that gates it stays false.
  const projectTs = readFileSync(`${repoRoot}src/config/project.ts`, 'utf8');
  expect(projectTs).toContain("target: '/zh/landing/'");
  expect(projectTs).toContain('landingLinkEnabled = false');
});
