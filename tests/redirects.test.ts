import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

/**
 * public/_redirects was the demo landing storefront's 301 list (handbook
 * slug renames, /zh and /en guesses, root → /zh/landing/). This fork removed
 * that file with the landing layer. What is still live is the removal
 * machinery: apply-template and setup.yml must keep listing the file and
 * src/pages/demo.astro, and must never list RootGateway.astro (index.astro
 * imports it). project.ts still carries the dead demoRootGateway constant.
 */
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('the landing redirect file is gone', () => {
  expect(existsSync(`${repoRoot}public/_redirects`)).toBe(false);
});

test('fork initialization removes the file on both channels (CLI + setup.yml)', () => {
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

test('fork initialization deletes src/pages/demo.astro on both channels — and never RootGateway.astro', () => {
  const cli = readFileSync(`${repoRoot}scripts/apply-template.ts`, 'utf8');
  expect(cli).toMatch(/'src\/pages\/demo\.astro'/);
  const yml = readFileSync(`${repoRoot}.github/workflows/setup.yml`, 'utf8');
  const landingStep = yml.split('\n').find((line) => line.includes('rm -rf src/components/landing'));
  expect(landingStep).toContain('src/pages/demo.astro');
  const demoStep = yml.split('\n').find((line) => line.includes('scripts/clear-demo-public.ts'));
  expect(demoStep).not.toContain('src/pages/demo.astro');

  // Survive pin: RootGateway.astro must NEVER enter a deletion channel —
  // index.astro statically imports it, so listing it makes the fork's build
  // fail at module resolution.
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
