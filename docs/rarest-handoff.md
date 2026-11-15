## W0 done

Rebranded this tree with `pnpm apply-template --answers` (19 answers, site type `1` game-wiki, homepage preset `2` guides, clear demo content, remove landing). English only. Domain `rarestanswer.com`.

Identity written by the CLI: site name `Rarest Answer Wiki`, short name `RA Wiki`, game `Rarest Answer`, platform `Web`, genre `Daily trivia game`, developer `Rarest Answer` (an empty developer answer falls back to the demo studio name). `landingLinkEnabled` is `false`. `ja` locale JSON and `src/content/wiki/ja` are gone. Demo wiki MDX, demo covers, gallery images, article images, Adsterra unit pages, the GSC token, and the landing storefront (`LANDING_PATHS`, including `src/content/tutorials` and `public/_redirects`) are removed. `wrangler.toml` `[vars]` `SITE_URL` is `https://rarestanswer.com`. Giscus, AdSense, Adsterra, GA, CF beacon, and VibeCafé values are blank. `.indexnow-key` was generated. Theme is `#6D28D9` (the eight `--brand*` lines only).

`games` is not in the game-wiki preset allowlist, so the CLI would have exited before any write. For this one run, `games` was added to that allowlist and given the `lucide:gamepad-2` icon default, then `scripts/lib/site-presets.ts` and `scripts/apply-template.ts` were restored. Do not re-run `apply-template` until `games` is allowed again; the post-check will reject `games,guides` and write nothing.

Navigation is exactly `games`, `guides`. `en.json` has `nav.games` / `nav.guides` and matching `overview.*`. Placeholder pages (published, not draft, so the list pages and sitemap include them):

- `/games/games-like-krillion/`
- `/guides/how-to-find-rare-answers/`

`src/lib/game/types.ts` has the §2 contract plus `TIERS` (Common 5, Familiar 10, Uncommon 20, Rare 40, Epic 70, Legendary 100). Fixture `src/data/prompts/index.json` and `great-ape-species.json` (8 answers, rarest-first, `source: "fixture"`, popularity figures are rough placeholders).

`astro.config.ts` now reads `SITE_URL` from `wrangler.toml` when the env var is unset, so a local `pnpm build` does not fall back to `https://anvil.wiki`. `home.hero.videoId` is `""` so `HomePage` still typechecks; the trailer does not render.

Gates, all green: `pnpm lint`, `pnpm typecheck`, `pnpm check-config`, `pnpm check-content`, `pnpm build` (with `SITE_URL` unset), `pnpm check-links` (276 links, 16 pages). No commit.

### Requests

- W0-FOUNDATION → W1-UI: `src/locales/en.json` home copy is still the guides preset skeleton (title "Guides, Bosses & Progression", hero mentions bosses/items, explore steps mention starter codes and a first boss). Rewrite it. Keep `home.hero.videoId` or teach `HomePage` to tolerate a missing key. Brand color is `#6D28D9` in `src/styles/globals.css`. Favicon and `public/images/hero.webp` are still the demo binaries; `pnpm gen-assets` is yours.
- W0-FOUNDATION → W1-CONTENT-A / W1-CONTENT-B: replace the two placeholder MDX files. They are live, not `draft`.
- W0-FOUNDATION → W1-DATA: `src/data/prompts/great-ape-species.json` is a fixture (`source: "fixture"`). Replace the popularity numbers with real pageviews; keep the `Prompt` shape in `src/lib/game/types.ts`.
- W0-FOUNDATION → W2-QA: `wrangler.toml` `name` is still `anvilwiki` (Cloudflare project name; the CLI does not rewrite it). `tsconfig.json` excludes `tests/community-digest.test.ts` and `tests/landing-paths.test.ts` so `astro check` can pass after the landing modules were deleted.

### Tests left red

`pnpm test`: 15 files passed. These failed because they still assert the AnvilWiki demo (landing modules, `ja`, demo MDX, demo covers, demo wrangler). Not rewritten.

- `tests/community-digest.test.ts` — imports deleted `~/components/landing/community-digest.json`. Also excluded from `tsconfig.json`.
- `tests/landing-paths.test.ts` — imports deleted `~/config/landing`. Also excluded from `tsconfig.json`.
- `tests/redirects.test.ts` — reads deleted `public/_redirects`.
- `tests/handbook.test.ts` — 3 failures, all reading deleted landing components (`HandbookChapter.astro`, `CommunityHighlights.astro`, `LandingLayout.astro`).
- `tests/changelog.test.ts` — `PROJECT_VERSION` sync reads deleted `src/config/landing-shared.ts`.
- `tests/versions.test.ts` — same deleted `landing-shared.ts` version surface.
- `tests/workflows.test.ts` — expects the pre-fork wrangler header to still contain `FORKERS READ THIS FIRST`.
- `tests/apply-template.test.ts` — 44 failures. Drift guards against the old demo tree: live `SITE_URL` is not a `DEMO_VAR_VALUES` entry, demo ad HTML / `ja.json` / demo MDX / demo covers / demo `site.ts` / demo author block are gone, and `LEGAL_CONTENT_TYPES` is now `games`+`guides` so the game-wiki preset's `bosses` key is no longer legal. Plus the preset demo internal-link whitelist, one test per deleted demo MDX.

Trivial rebrand fixes that did land: `tests/seo.test.ts` page-title case uses `site.game.name`; `tests/routing-flags.test.ts` expects `['en']`; `tests/content-utils.test.ts` extension-strip case uses an `en` id; `tests/url.test.ts`, `tests/tags.test.ts`, and `tests/seo.test.ts` pass a non-default locale through `asLocale()` so the prefix branch still runs now that `Locale` is `'en'` only.

## W1-CONTENT-A done

Replaced the games placeholder and published 15 English MDX pages under `src/content/wiki/en/games/` (category `games`), each with a 1200×675 cover in `src/assets/covers/en-games-*.png` and `image` wired. Covers were rendered with `pnpm gen-covers --out` and only the `en-games-*` PNGs were copied, so guide MDX and `.gen-covers-manifest.json` were not touched. Tags stay inside `daily-games`, `trivia`, `krillion`, `word-games`, `alternatives`.

Pages: `/games/games-like-krillion/` (pillar), `/games/krillion/`, `/games/cosmillion/`, `/games/seldom-game/`, `/games/size-it-up-game/`, `/games/dartle-game/`, `/games/jinxed-game/`, `/games/farflung-game/`, `/games/one-in-a-million-game/`, `/games/games-like-wordle/`, `/games/wonderhop/`, `/games/majority-game/`, `/games/deep-dive-game/`, `/games/ball-knowledge-game/`, `/games/brainer/`. Each names the official URL checked on 14 November 2026. Rarest Answer is described from this site's own rules (seven shared prompts, Common–Legendary at 5/10/20/40/70/100, unlimited at `/unlimited/`) and marked as a separate game.

Left unpublished on purpose, not `draft`: no current daily browser game titled One in a Million (1967 ABC show + the idiom only); Deep Dive is a disambiguation (Otomates static trivia page vs Zygomatic arcade diver vs Krillion's "daily dive"); Brainer's official pages do not publish a question count or score table, so third-party numbers were omitted; Krillion's FAQ does not publish the fan-site 25-second clock or six-tier point table, so those were omitted; `krillion.io/unlimited/classic` exists but did not expose a rules sheet; `majority.wtf` returned an error and is not described. No `docs/rarest-todo.md` entry, because the pages are live and honest rather than drafts.

`pnpm check-content` clean (19 MDX, including in-progress guides). `pnpm exec eslint src/content/wiki/en/games` exit 0 (ESLint has no MDX block). `pnpm build` succeeded and emitted all 15 `/games/` routes. `pnpm typecheck` failed only in `src/components/article/TagListPage.astro` (W1-UI, mid-edit: `entry` undefined). Not mine.

- W1-CONTENT-A → W2-QA: `pnpm typecheck` is red only in `src/components/article/TagListPage.astro`; game MDX is not the cause. `pnpm build` was green.
- W1-CONTENT-A → W2-QA: game pages link to `/unlimited/` and `/rarest-answers/` before those routes exist, so `pnpm check-links` will 404 them until W1-GAME and W1-ANSWERS land.
- W1-CONTENT-A → W2-QA: game covers are not in `.gen-covers-manifest.json`; they already have `image:`, so a later `pnpm gen-covers` should skip them.

## W1-CONTENT-B done

Replaced the guides placeholder and published six English guides in `src/content/wiki/en/guides/` (category `guides`), plus a rewrite of `src/pages/about.astro`. About no longer renders `LegalContent` (that copy still talked about bosses, codes, and Discord). Covers are 1200×675 `src/assets/covers/en-guides-*.png`, rendered with `pnpm gen-covers --out /tmp/w1b-covers` and only the guide PNGs copied, so game MDX and `.gen-covers-manifest.json` were not touched. Each body is about 1,200–1,400 words, with a 40–60 word summary, five FAQs, question-shaped H2s, and tags from `daily-games`, `trivia`, `strategy`, `krillion`, `roblox`.

Pages: `/guides/how-to-find-rare-answers/` (pillar; sample prompt `great-ape-species`, tiers from that file, Tapanuli orangutan facts from Wikipedia, popularity figures called out as fixture placeholders), `/guides/how-to-play-rarest-answer/` (seven shared prompts, local-midnight reset, TIERS Common 5 through Legendary 100, one Spotlight 2x per round, unlimited vs daily, optional no-timer, per-category play), `/guides/rarest-answer-strategy/`, `/guides/rarest-answer-party-roblox/`, `/guides/best-daily-trivia-games/`, `/guides/stranger-things-characters-trivia/`.

Roblox page uses only the place page and the games API read on 14 November 2026 (place `70967715806705`, universe `10772648808`, group Torrey Pines `421623341`, verified badge, created 2026-10-24, updated 2026-11-14T03:17:49Z, playing 7712, visits 4492606, favorites 132487, votes 2266 up / 2079 down, maxPlayers 6, price null, Party & Casual / Quiz). The HTML said "There are currently no running experiences" in the same session the API reported 7712 playing. Description advertises free customizable private servers; `createVipServersAllowed` was false. No points table, timer, difficulty definitions, mic/chair rules, or codes were on that description, so none were invented. Separate place ids for Rarest Answer Wins and Roblox Krillion are named only by verified title and URL.

Daily roundup includes only URLs that returned a page on 14 November 2026 (NYT Wordle, Connections, Strands, Spelling Bee at `/puzzles/spelling-bee`, Merriam-Webster Quordle, Nerdle, Waffle, Squaredle, Semantle, Contexto, Absurdle, Worldle, globle-game.com, Flagle, Travle, Tradle at `/en/games/tradle`, Framed, TimeGuessr, GeoGuessr as a non-daily neighbor, Sporcle, Puzzmo, krillion.io). Left out rather than guessed: JetPunk and Immaculate Grid (403), Redactle (no readable description), NYT `/games/spelling-bee` and `/games/quordle` (404). globle.org is a different host and is not treated as the same game. Stranger Things has no prompt in `src/data/prompts` yet, so that guide cites https://en.wikipedia.org/wiki/List_of_Stranger_Things_characters and does not assign tiers. Eddie Munson is explicitly not a rare pick.

`pnpm check-content` clean (21 MDX). `pnpm exec eslint src/pages/about.astro` clean. Guide MDX is ESLint-ignored, same as the games files. `pnpm typecheck` 0 errors. `pnpm build` succeeded and emitted all six `/guides/` routes plus `/about/`. Built HTML checked for those H1s and FAQ questions. No browser click-through.

- W1-CONTENT-B → W1-GAME: guides and about link to `/unlimited/`, `/trivia/animals/`, and `/trivia/screen/`, which 404 until those routes exist.
- W1-CONTENT-B → W1-ANSWERS: `/guides/how-to-find-rare-answers/` and the Stranger Things guide link to `/rarest-answers/` and `/answers/great-ape-species/`, which 404 until the answers routes exist.
- W1-CONTENT-B → W1-DATA: there is still no Stranger Things prompt. When one lands, the characters guide should be revised against that list. Do not quote the fixture popularity numbers as pageviews; the finding guide already says they are placeholders.
- W1-CONTENT-B → W2-QA: `pnpm check-links` will 404 `/unlimited/`, `/trivia/animals/`, `/trivia/screen/`, `/rarest-answers/`, and `/answers/great-ape-species/` until those routes exist. Guide covers are not in `.gen-covers-manifest.json`; they already have `image:`, so a later `pnpm gen-covers` should skip them. `/about/` no longer uses `LegalContent`.

## W1-META done

Rewrote `README.md` for Rarest Answer: what the game is (seven shared prompts, six tiers from `TIERS`, Spotlight, no account, stats in `localStorage`), local `pnpm dev` / `pnpm build`, `pnpm build-prompts` (documented, not in `package.json` yet; `great-ape-species` is still `source: "fixture"`), Cloudflare Pages deploy (`name = "rarestanswer"`, build `pnpm build`, output `dist`, `SITE_URL` already in `[vars]`), credits for AnvilWiki (MIT), Wikidata (CC0), and Wikipedia pageviews. The MIT copyright and permission notice from `LICENSE` is repeated in the README.

`wrangler.toml`: header comments now describe this project, and `name` is `rarestanswer`. `[vars]` was not edited (diff is header + `name` only).

`/llms.txt` lists `/`, `/unlimited/`, `/trivia/<category>/` for the eight category keys, `/rarest-answers/`, each prompt in `src/data/prompts/index.json` with that file's `source`, then live `/games/` and `/guides/` articles from the wiki collection, plus about/FAQ/contact/legal. `/robots.txt` allows every crawler and points at the sitemap. `public/ads.txt` stays comments-only; the Google line is still commented so there is no placeholder publisher id.

English `/privacy-policy/`, `/terms-of-service/`, `/copyright/`, and `/contact/` now carry their own copy (last updated 2026-11-14) instead of `LegalContent`. The game is described as a free browser trivia game with no account and streak/stats in `localStorage`. Wikidata (CC0) and Wikipedia pageviews are disclosed, including that a `fixture` source is not live pageviews. Env-gated AdSense, Adsterra, Google Analytics (consent), Cloudflare Web Analytics (cookieless, no consent gate), VibeCafé (no consent gate), giscus, YouTube embeds, and Cloudflare hosting match the current components. Contact address is `contact@rarestanswer.com`. Each of those pages says the site is not affiliated with Krillion or with other games named here. `/faq` has its own questions (tiers read from `TIERS`) covering the same facts. HTML links on these pages point at routes that already exist (`/about/`, `/faq/`, `/contact/`, the legal pages, `/guides/how-to-play-rarest-answer/`).

`pnpm lint` passed. `pnpm exec eslint` on the seven page files I edited passed after the last FAQ edit. `pnpm typecheck` exited 1 with two errors, neither in these files: `tests/community-digest.test.ts` cannot import `~/components/landing/community-digest.json`, and `tests/landing-paths.test.ts` cannot import `~/config/landing`. W0 had excluded both from `tsconfig.json`; that exclude is no longer in the file. I did not edit `tsconfig.json`.

Created `docs/rarest-todo.md` with the unverified mailbox, the fixture prompt, the empty `site.contactEmail`, the stale `LegalContent` body, and the second FAQ in `en.json`.

- W1-META → W1-UI: `src/components/layout/LegalContent.astro` still describes a fan wiki (bosses, codes, Discord). English privacy, terms, copyright, and contact no longer render it, and `about.astro` does not either. `src/pages/[locale]/[legal].astro` still renders it and currently generates no pages (`locales` is `['en']`). Replace those branches before adding a locale, or the old copy comes back.
- W1-META → W1-UI: `/faq` does not read `home.faq` in `src/locales/en.json`. That block is a shorter second FAQ, and its "built from Wikidata" answer overclaims while `great-ape-species.json` is still `source: "fixture"`. The homepage does not render `FaqSection`. Keep one source.
- W1-META → W2-QA: `src/config/site.ts` `contactEmail` is still `""`. The contact page hardcodes `contact@rarestanswer.com` and does not read the config field. The mailbox is a placeholder (see `docs/rarest-todo.md`).
- W1-META → W2-QA: `pnpm typecheck` is red only on `tests/community-digest.test.ts` and `tests/landing-paths.test.ts` (deleted landing imports). `tests/workflows.test.ts` still expects the wrangler header to contain `FORKERS READ THIS FIRST`; the header is now the Rarest Answer comment and `name = "rarestanswer"`. `[vars]` was not changed. `pnpm lint` was green.

## W1-TESTS done

`pnpm exec vitest run --exclude 'tests/game-*.test.ts'` is green: 24 files, 461 passed, 2 skipped. No `tests/game-*.test.ts` existed at that run. `vitest.config.ts` was left as-is.

Deleted `tests/community-digest.test.ts` and `tests/landing-paths.test.ts` (they imported the removed landing digest and `~/config/landing`). Dropped both paths from the `tsconfig.json` exclude list. The AGENTS.md `pnpm test` line is now 24 suites, without those two names. That also removes the two `astro check` import errors W1-META reported.

Suites that still guard live code, with only the failing assertions rewritten:

- `redirects.test.ts` — `public/_redirects` is absent. The apply-template and setup.yml removal lines, the RootGateway survive pin, and `demoRootGateway.target` / `landingLinkEnabled = false` stay.
- `handbook.test.ts` — dropped the reads of `HandbookChapter.astro`, `CommunityHighlights.astro`, and `LandingLayout.astro`. SearchButton's inline script, the Pagefind ES2018 postbuild, the handbook markdown parity, and `src/lib/handbook.ts` stay.
- `changelog.test.ts` — dropped the `PROJECT_VERSION` read of deleted `src/config/landing-shared.ts`. The Unreleased / compare-link contract stays.
- `versions.test.ts` — `project-version` is expected red because that file is gone. `skills-README.md` is expected red only while `README.md` does not list the anvil-* skills (W1-META rewrote it). Changelog, roadmap, AGENTS status, ops semver, and the other three skill surfaces must still match.
- `workflows.test.ts` — the shipped `wrangler.toml` must not contain `FORKERS READ THIS FIRST`. The python rewriter is still run against a fixture header, and a file that already lacks the block must warn instead of exiting.
- `apply-template.test.ts` — drift guards now describe this fork: `[vars]` is `https://rarestanswer.com` plus empty strings and `pathname`, with no `DEMO_VAR_VALUES`; `en.json` is not demo content and `ja.json` is absent; on-disk wiki articles are not Anvil Quest copy and are not preset-demo paths (no article count); registered demo MDX, covers, and Adsterra HTML are absent; `authors.ts` is already clean and both author regexes still strip a fixture block; the catalog is `games` + `guides`; the Japanese first-run label check uses a fixture because `ja.json` is gone. Assigned `site.ts` fields are `rarestanswer.com` / `Rarest Answer` (interface comments still mention Anvil Quest).

The two skips are `codes-consistency` cases that no-op when there is no codes page.

## W1-UI done

Visual identity and site chrome for Rarest Answer. Deep indigo with a gold mark. Headings use self-hosted Fraunces; body uses self-hosted Source Sans 3. Licenses are `public/fonts/OFL-Fraunces.txt` and `public/fonts/OFL-SourceSans3.txt`. Source Sans 3 was not modified (the OFL reserves the name "Source"). No third-party CSS. Cards are glassy, focus rings use the brand color, and motion is off under `prefers-reduced-motion`.

`src/config/site.ts`, the `site` block in `src/locales/en.json`, and `public/manifest.json` use name and shortName "Rarest Answer". The description and tagline describe a free daily trivia game where the rarest correct answer wins. `contactEmail` stays `""`. `legalNotice` says pages about other games are unofficial. `home.hero.videoId` is `""`. Home CTA fields stay strings. The homepage still renders that `home` copy until `index.astro` is replaced.

Brand tokens are HSL components. Use `hsl(var(--token))`.
Light `:root`: `--brand` 246 64% 34% (manifest `theme_color` `#2a1f8e`), `--brand-light` 246 78% 62%, `--brand-h` 246, `--brand-s` 64%. `--brand-text` is that hue and saturation at 30%.
Dark: `--brand` 248 78% 72%, `--brand-light` 248 90% 80%, `--brand-h` 248, `--brand-s` 78%. `--brand-text` is at 76%.
`--gold` is 43 92% 58% in light and 43 92% 62% in dark. It is the gem and the header hairline. Do not use it as body text on a light page.
`--caution` is 32 88% 36% in light and 38 92% 62% in dark.

Tier tokens for W1-GAME. Names are `shared.tierNames["1".."6"]`: Common, Familiar, Uncommon, Rare, Epic, Legendary. Points 5/10/20/40/70/100 are not a JSON map.
Light values are fills. White text on a solid fill is at least 5:1.
`--tier-1` 220 9% 42%; `--tier-2` 174 62% 28%; `--tier-3` 152 56% 30%; `--tier-4` 217 72% 36%; `--tier-5` 272 58% 40%; `--tier-6` 40 74% 32%.
Dark values are bright text and border colors, not fills.
`--tier-1` 220 10% 74%; `--tier-2` 174 52% 62%; `--tier-3` 152 46% 60%; `--tier-4` 212 90% 72%; `--tier-5` 272 85% 78%; `--tier-6` 43 92% 62%.
A chip is `.tier-pill` with `data-tier="1"` through `"6"`: solid fill and white text in light mode, a 16% tint with the token as the text color in dark mode. Do not put white text on a solid dark-mode tier fill. Tailwind `text-tier-n` and `bg-tier-n` accept an opacity modifier. `nav` and `card` do not, so an active nav pill is `bg-[hsl(var(--brand-text)/0.12)]`.

`shared.categories` keys are geography, animals, food, sports, screen, music, science, history. The screen label is "Movies & TV". Footer trivia links are `/trivia/<key>/`. `shared.spotlight` is "Spotlight". It is not in `home.faq`.
Nav labels: `nav.play`, `nav.unlimited`, `nav.rarestAnswers`, `nav.games` ("Games like Krillion"), `nav.guides`. The header links Play to the home URL (exact match), Unlimited to `/unlimited/`, Rarest Answers to `/rarest-answers/` (also highlighted on `/answers/`), Games like Krillion to `/games/`, and Guides to `/guides/`. Search stays. The language switcher is hidden while English is the only locale.
List titles: `overview.games.overviewTitle` is "Games Like Krillion & Other Daily Trivia Games". `overview.guides.overviewTitle` is "Rarest Answer Guides & Strategy".
Footer attribution is exactly "Data: Wikidata & Wikipedia pageviews".

- W1-UI → W1-GAME: pass `fullBleed` to `LocaleLayout`. It forwards the prop to `BaseLayout`, sets `data-layout="full-bleed"` on `body`, and makes `<main id="main">` full width with no padding. The header and footer stay. The sticky header is in normal flow, not an overlay. Article pages leave the prop off. Do not edit `globals.css`; the tokens above are ready.
- W1-UI → W1-META: `LegalContent.astro` is already rewritten. About, privacy, terms, copyright, and contact no longer describe a fan wiki, bosses, codes, or a Discord server. The Discord row renders only when `site.social.discord` is set, and it is not set. The about branch says the sample prompt is still a fixture. English legal pages do not render this component. `src/pages/[locale]/[legal].astro` does, and it generates no pages while `locales` is `['en']`. `home.faq` "Where do the answers come from?" now includes the same fixture disclosure. `/faq` does not read `home.faq`.
- W1-UI → W2-QA: `pnpm typecheck` 0 errors, eslint on the owned components 0 errors (`globals.css` is ignored by eslint), `pnpm check-i18n --strict-ui` green, `pnpm check-config` green, `pnpm build` green (40 pages). The glob-loader warning that `src/content/tutorials/` does not exist is pre-existing and did not fail the build. Header and footer link `/unlimited/`, `/rarest-answers/`, and `/trivia/<category>/`, so `pnpm check-links` will 404 those until the routes exist. Do not run `pnpm gen-assets --force`: it replaces the gem `favicon.svg` and the PNG sizes with a letter R. A normal `pnpm gen-assets` sees a matching brand hash and skips them. `public/favicon.ico` is a PNG-in-ICO of the gem at 16 and 32; gen-assets does not write the ico. `hero.webp` prints "Rarest Answer" twice because `site.name` and `game.name` are both that string; the generator is not mine. Checked the built site at 1280 and 375: no horizontal overflow, Fraunces on headings, a solid mobile menu, and the list-page icon sitting on the first line of a wrapping title.

## W1-ANSWERS done

Programmatic answer pages read `src/data/prompts/*.json` at build with `import.meta.glob` in `src/components/answers/prompts.ts` (`index.json` is skipped). A new prompt file is a new page with no route edit. Files are validated (slug, category, question, source, answers). A bad file throws. An `index.json` slug with no file warns and is skipped.

`/rarest-answers/` is the hub. Title: "Rarest Answers — Every Prompt's Rarest Answer". Vanilla JS category chips and a search box honor `?category=` and `?q=` on load. With JavaScript off, every row stays visible. Each card shows that prompt's rarest answer, the answer count, and a tier pill. ItemList JSON-LD. `data-pagefind-body` is on the hub and on each detail article.

`/answers/<slug>/` is one page per prompt. The fixture H1 is "Rarest Species of Great Ape — All 8 Answers Ranked by Rarity". The document title adds " — Rarest Answer" because the heading does not contain the site name. An optional `seoNoun` on the JSON overrides the title noun. It is not a field on `Prompt` in `src/lib/game/types.ts`. Without it, the noun is the object of the question. The page has a quick-answer pair (rarest and most common), the full table rarest to common with `.tier-pill` (`--tier-1` through `--tier-6`), a Monthly Wikipedia views column, an intro built from the stored popularity numbers, three FAQ questions with FAQPage JSON-LD, a breadcrumb JSON-LD, "Play this prompt" linking to `/unlimited/?prompt=<slug>`, a category link to `/trivia/<category>/`, related prompts in the same category, and Wikidata plus English Wikipedia attribution. `source: "fixture"` is described as placeholder popularity, not a live pageview count.

Sitemap: `@astrojs/sitemap` already emits every built Astro route, and these URLs are not in the MDX noindex list, so `astro.config.ts` was left alone. `dist/sitemap-0.xml` contains `https://rarestanswer.com/rarest-answers/` and `https://rarestanswer.com/answers/great-ape-species/`. Pagefind indexed both (23 pages in this build).

`pnpm exec eslint` on `src/components/answers`, `src/pages/rarest-answers.astro`, and `src/pages/answers` passed with `--max-warnings 0`. `pnpm typecheck` exited 0 (0 errors). The unused-import hint in `src/lib/game/browser.ts` is outside these files. `pnpm build` succeeded. The glob-loader warning that `src/content/tutorials/` is missing is outside these files. Browser check at 1280 and 375: chips, search (including a zero-match empty state and `?category=animals&q=human`), ranking order Tapanuli orangutan through Human, the three FAQ questions, and both CTAs. Page scroll width matched the viewport. The table scrolls inside its own region (640px table on a 375px page). Light tier pills are solid fills with white text. Dark Legendary uses the gold token on a 16% tint.

- W1-ANSWERS → W1-DATA: optional `seoNoun` (string, 80 characters or fewer) is read from the prompt JSON and is not on `Prompt` in `src/lib/game/types.ts`. Set it when the H1 noun should differ from the question object (example: `seoNoun` "Stranger Things characters"). The slug must be one URL segment matching `[A-Za-z0-9][A-Za-z0-9_-]{0,119}`. A source string that mentions Wikipedia or pageviews is described as monthly English Wikipedia pageviews. `source: "fixture"` is labeled placeholder popularity.
- W1-ANSWERS → W1-GAME: answer pages link `/unlimited/?prompt=<slug>` and `/trivia/<category>/`. Those routes still 404. The header already highlights Rarest Answers on `/answers/`.
- W1-ANSWERS → W1-UI: tier chips use the existing `.tier-pill` and `--tier-1` through `--tier-6`. Category labels are read from `shared.categories` (screen is "Movies & TV"). No CSS change requested.
- W1-ANSWERS → W2-QA: `/rarest-answers/` and `/answers/great-ape-species/` are built and are in the sitemap. Earlier notes that those two URLs 404 are stale. `pnpm check-links` will still 404 `/unlimited/?prompt=great-ape-species` and `/trivia/animals/` until W1-GAME ships those pages. Answer-page sentences live in `src/components/answers/copy.ts`. Home, Rarest Answers, Quick answer, FAQ, and Breadcrumb are read with `getUi`.

- W1-GAME → W2-QA: `tests/game-engine.test.ts` is a new suite. `tests/agents-consistency.test.ts` is red until the AGENTS.md `pnpm test` line lists `game-engine` and the count is 25 (it is 24 and omits that name). I do not own AGENTS.md.
- W1-GAME → W2-QA: `src/pages/index.astro` no longer imports `RootGateway`. Leave `src/components/RootGateway.astro` on disk; `redirects.test.ts` still pins it as a survive file. The old rationale that `index.astro` statically imports it is stale.
- W1-GAME → W1-UI: `LocaleLayout` still renders `StickyBanner` above `<main>` on `/`, `/unlimited/`, and `/trivia/*`. The slot was empty in this build. If a unit is filled, keep it off those routes or below the play card. Game sentences live in `src/lib/game/copy.ts` and `src/lib/game/category-copy.ts`. The in-game screen label is "Movies & TV" in `src/lib/game/categories.ts`. Tier squares and the meter use `--tier-1` through `--tier-6` as fills with no text on the fill. `fullBleed` is set on the three play pages.
- W1-GAME → W1-ANSWERS: `/unlimited/?prompt=<slug>` starts that prompt when the slug is in the index. An unknown slug is ignored. After a guess, the reveal links `/answers/<slug>/`.
- W1-GAME → W1-DATA: the client reads `/game-data/index.json` and then `/game-data/<slug>.json`. Nothing is hardcoded. `answerCount` below 1 is skipped. A slug must match `/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/`. The client sorts rarest-first and drops `popularity`, `wiki`, and `source`. With only the fixture, a daily round is one prompt. The homepage says seven when the list can fill seven categories.

## W1-GAME done

The playable game is on `/`, `/unlimited/`, and `/trivia/<category>/` (eight category pages). The engine is pure TypeScript in `src/lib/game/` (not `types.ts`) and is covered by `tests/game-engine.test.ts` (22 tests). Matching folds case, accents, punctuation, and a leading a/an/the; aliases count; one typo counts when both strings are at least 6 characters; an ambiguous typo is a miss; a repeated guess is rejected with no extra penalty. Points are the `TIERS` table (5/10/20/40/70/100). Spotlight doubles one scored prompt per round and is not spent on a miss, a pass, or a timeout. The daily round is a pure function of the local date: up to 7 category-balanced prompts, deterministic, and unique across any 30-day window when each played category has at least 30 prompts. A shorter catalog, including the current fixture, never repeats a slug inside the round and does not invent prompts to pad to 7. Unlimited and category rounds are seeded separately and do not move the daily streak. Stats, the in-progress daily, and the timer preference use versioned `localStorage` keys and fall back when the payload is corrupt or the store throws.

`/game-data/index.json` and `/game-data/<slug>.json` are built from `src/data/prompts/`. The browser fetches the index, then the current prompt, and prefetches the next one. The play UI is vanilla TypeScript in `src/components/game/` (no React/Vue/Svelte, no ad slot in the play card): start card with the local date, round number, streak, and a how-to dialog; a 25-second ring with a no-timer switch; wrong-guess shake; Spotlight; an aria-live region; a reveal with the tier meter, the rarest 10, the most common 10, and how many answers were available; an end screen with the score, tier counts, a countdown to the next local midnight, Web Share / clipboard text with colored squares, and a canvas PNG download. Keyboard play works (the input is focused, Enter submits, Escape closes the dialog). `prefers-reduced-motion` disables the shake. Light and dark both render. At 375px the homepage scroll width matched the viewport and the start card sat above the fold. The game script is 9,868 bytes gzipped.

`pnpm exec eslint` on the owned game files passed. `pnpm typecheck` ended at 0 errors. `pnpm build` succeeded, including `/`, `/unlimited/`, the eight trivia pages, and both game-data routes. `dist` sitemap did not list `/game-data/`. Browser check used the built site: daily Human for 5 after a rejected guess, resume after reload with streak 1, Spotlight plus `bonoba` → Bonobo for 40, a duplicate guess with no extra penalty, Tapanuli orangutan for 100, geography empty state, animals with the timer off and Pass for 0, `/unlimited/?prompt=great-ape-species` opening that question, and the reveal link to `/answers/great-ape-species/`. A refresh during an open prompt restarts that prompt's clock; the round is saved when the prompt ends.

## W2-QA done

Cross-agent requests applied on the current tree. `site.contactEmail` stays `''` because `tests/apply-template.test.ts` pins that string; contact, privacy, terms, copyright, FAQ, the legal body, and `llms.txt` now share `contactEmail()` in `src/lib/contact-email.ts`, which uses the configured address when one exists and otherwise `contact@rarestanswer.com`. The homepage, `/unlimited/`, and `/trivia/` skip `StickyBanner`. The sitemap filter drops `/game-data` and `/game-data/*` and keeps `/answers/`, `/trivia/`, `/unlimited/`, and `/rarest-answers/`. `src/data/prompts/**`, `scripts/build-prompts.ts`, and `scripts/data/**` were not edited. `AGENTS.md` lists 25 suites including `game-engine`, and its RootGateway note matches the tree: `index.astro` does not import it, `landingLinkEnabled` is false, `/` is the daily game, and the component stays because the survive pins still name it. The same stale "index statically imports RootGateway" wording was corrected in `tests/redirects.test.ts`, `scripts/apply-template.ts`, `.github/workflows/setup.yml`, `scripts/e2e-apply-template.mjs`, and `docs/apply-template.md`. The `NEVER add src/components/RootGateway.astro` line was left in place.

Tier tokens are the W1-UI set in `src/styles/globals.css` (`--tier-1` through `--tier-6`, plus `--tier-fill` and `--tier-ink`) and `tailwind.config.mjs`. `BaseLayout` already accepts `fullBleed`, and `LocaleLayout` sets `data-layout="full-bleed"` on `/`, `/unlimited/`, and `/trivia/`. Nav keys `play`, `unlimited`, `rarestAnswers`, `games`, and `guides` are in `en.json` and rendered. Answer meta descriptions now lead with the count and the plural (or the Wikidata species label), so "great ape species" and a future "Stranger Things characters" stay inside the 165-character cap. Five article descriptions were extended so the plan's exact phrases are in the title or meta description: "game like Krillion", "Krillon game" / "one in a krillion game", "daily games", "Rarest Answer Party Roblox", and "guess rarest answer". Home, unlimited, the answer hub, each answer page, each trivia page, and the games and guides lists now link across play, answers, trivia, games, and guides (`shared.keepExploring` on the lists and the hub).

Gates on this build, with the one-prompt fixture still in `src/data/prompts/`: `pnpm lint`, `pnpm typecheck` (0 errors; the missing `src/content/tutorials` glob is a warning), `pnpm test` (25 files, 483 passed, 2 skipped), `pnpm check-config`, `pnpm check-content`, `pnpm check-i18n --strict-ui`, `pnpm build` (51 pages), `pnpm check-links` (2,895 links, 0 broken). The game script in `dist/_astro/` is 30,182 bytes, 9,836 bytes gzipped, under the 40KB cap. Preview of that dist at `http://127.0.0.1:4399/` was played with Playwright 1.64.1 (headless Chromium). At 375px and 1280px the daily round is keyboard-only: Tab reaches Play, Enter opens and Escape closes How to play, the input is focused, the timer moves from 25 to 24, a miss says "Not on the list", Human scores 5 Common, Enter reaches the end screen, Share copies the spoiler-free text, and Save image downloads `rarest-answer-2026-11-14.png`. No page errors, no console errors, no failed requests, and document scroll width equals the viewport. The same overflow and console check passed for `/unlimited/`, `/rarest-answers/`, `/answers/great-ape-species/`, `/trivia/animals/`, `/games/`, and `/guides/`, and each of those pages links to the other four families.

### Keyword → URL

Parenthetical "(game)" in the plan is disambiguation. Every other phrase below is a case-insensitive substring of that URL's `<title>`, H1, or meta description in `dist/`.

| Keyword | URL |
| --- | --- |
| rarest answer game; guess the rarest answer; rare answer game; rarest answer wins; finding rare answers; daily games; trivia | `/` |
| krillion unlimited; rarest answer game unlimited | `/unlimited/` |
| geography trivia | `/trivia/geography/` |
| animal trivia | `/trivia/animals/` |
| food trivia | `/trivia/food/` |
| sports trivia | `/trivia/sports/` |
| movie trivia | `/trivia/screen/` |
| music trivia | `/trivia/music/` |
| science trivia | `/trivia/science/` |
| history trivia | `/trivia/history/` |
| rarest species of great ape; great ape species; species of great ape | `/answers/great-ape-species/` |
| rarest answers | `/rarest-answers/` |
| games like krillion; game like krillion | `/games/games-like-krillion/` |
| krillion; krillion game; krillon; krillon game; one in a krillion; noillirk | `/games/krillion/` |
| cosmillion | `/games/cosmillion/` |
| seldom game | `/games/seldom-game/` |
| size it up game | `/games/size-it-up-game/` |
| dartle game | `/games/dartle-game/` |
| jinxed game | `/games/jinxed-game/` |
| farflung game | `/games/farflung-game/` |
| one in a million game | `/games/one-in-a-million-game/` |
| games like wordle; wordle; daily games | `/games/games-like-wordle/` |
| wonderhop | `/games/wonderhop/` |
| majority game | `/games/majority-game/` |
| deep dive game | `/games/deep-dive-game/` |
| ball knowledge game | `/games/ball-knowledge-game/` |
| brainer | `/games/brainer/` |
| finding rare answers; guess rarest answer | `/guides/how-to-find-rare-answers/` |
| rarest answer game; rarest answer wins | `/guides/how-to-play-rarest-answer/` |
| rarest answer party; rarest answer party roblox; roblox | `/guides/rarest-answer-party-roblox/` |
| daily games; trivia games; trivia | `/guides/best-daily-trivia-games/` |
| guess the rarest answer; rare answer game | `/guides/rarest-answer-strategy/` |
| stranger things; stranger things characters | `/guides/stranger-things-characters-trivia/` |

### Remaining

- W1-DATA2 is still running and has not replaced the fixture. `src/data/prompts/` is still `index.json` plus `great-ape-species.json`. `/answers/stranger-things-characters/` and `/answers/english-interjections/` are not in this `dist/`. "interjection" is not on any built page yet. "stranger things characters" is covered by the guide above. After the prompt JSON is written, rebuild: `derivePromptSeo` already puts the plural noun at the start of the description, so those two phrases land without another copy change. If the build hits a half-written JSON file, wait and rebuild. Do not assume the prompt count.
- `contact@rarestanswer.com` is still an unverified placeholder (`docs/rarest-todo.md`). The config field stays empty on purpose.
- `home.faq` in `en.json` is a second FAQ. The homepage does not render it; `/faq/` uses `src/pages/faq.astro`.
- Game and guide covers are absent from `.gen-covers-manifest.json`. They have an `image`, so `pnpm gen-covers` skips them. Do not run `pnpm gen-assets --force` (it would replace the gem favicon).
- `astro.config.ts` still warns that `src/content/tutorials` is missing. The tutorials suite treats a missing directory as an empty collection, so the gate stays green.
- Preview of this build is still up at `http://127.0.0.1:4399/`.

## C3-CONTENT-FACTS done

Fact-checked all 21 English MDX pages against live official pages on 14 November 2026. No page was set to `draft: true`. `src/data/prompts/**` and `scripts/build-prompts.ts` were not touched. `pnpm check-content` is clean (21 MDX).

Corrections that changed a claim:

- Krillion homepage prints "one in a krillion." Noillirk is two products: playdaily.org (common answer scores more, seven prompts, 25 seconds, calls itself the only official site) and the BlueMind App Store app "Noillirk - Reverse Krillion" (same scoring direction, seven prompts). Neither is krillion.io.
- NYT Wordle help: the daily puzzle needs no subscription and releases at midnight local time. Games, All Access, and Home Delivery subscribers get the archive back to 19 June 2021, Wordle Bot, and Create Your Wordle. Archive play changes played count, win rate, and guess distribution, and it does not change the streak. Wikipedia's answer list is 2,309 words, seven removed from an original 2,315. The help page spells the absent-letter tile Gray.
- Farflung homepage FAQ: unlimited mode is "Not yet," themed packs first. The how-to-play German ladder (Luxembourg = Farflung, Belgium = Elusive) is the ranked version; the homepage only names Belgium as the further example.
- Size It Up how-to-play now publishes Scale Streak (eight questions, three hearts, 100 / 250 base points, 2× after two correct, 3× after four, perk options not listed). sizedle.com/size-it-up is five rounds out of 500. sizeitupgame.com is a different daily: six rounds out of 600, orange silhouette. It is not an archive of gamesizeitup.com.
- Wonderhop Perfect is only the best answer on the list: #1 in Sky, rarest or rarer than 97% in Abyss, oldest or newest 3% in Past and Future.
- Brainer archive index listed 256 puzzles (month folders November 2025–November 2026), not 236. Price on the menu is 3.79 euros for lifetime access. Question count is still unpublished.
- Deep Dive arcade: POG credits Zygomatic, added 19 Mar 2021, coins and oxygen. The control-scheme sentence was removed because the listing does not state one.
- Majority homepage claims rechecked. The specific "best thing about being single" prompt was not on the homepage and was removed. majority.wtf returned HTTP 525.
- Rarest Answer Party API reread: playing 8,347, visits 4,821,164, favorites 141,430, votes 2,441 up / 2,243 down. Place id, universe id, maxPlayers 6, created 2026-10-24, updated 2026-11-14T03:17:49.887Z, price null, and `createVipServersAllowed: false` were unchanged. The HTML still said "There are currently no running experiences" in the same session the API reported players.
- Stranger Things character-list lead and the Tapanuli orangutan article ("the rarest great ape," described 2017, South Tapanuli) match the guides. Eddie Munson is Joseph Quinn, also starring, not a rare pick.

Plan §1 phrases for each page are in that page's title, description, opening paragraph, and one H2. Internal links still end in `/`. The only `/answers/` link is `/answers/great-ape-species/`.

- C3-CONTENT-FACTS → W2-QA: Roblox player, visit, favorite, and vote counts are a same-day snapshot and will be stale. Do not treat them as live. `majority.wtf` is still an error page.

## C5-NEW-CONTENT done

Added 9 new English pages (none of the existing 21 MDX files were edited). Each has a 1200×675 cover in `src/assets/covers/`, rendered with `pnpm gen-covers --out /tmp/c5-covers` and only these PNGs copied. Frontmatter elsewhere was not wired, and `src/assets/covers/.gen-covers-manifest.json` was not updated. `src/data/**`, `scripts/build-prompts.ts`, and `scripts/data/**` were not edited. `pnpm build-prompts` was not run.

Guides: `/guides/rarest-answer-game-tips-geography/`, `/guides/rarest-answers-animals/`, `/guides/how-scoring-works-in-rarest-answer-games/`, `/guides/krillion-vs-rarest-answer/`, `/guides/best-unlimited-trivia-games/`, `/guides/rarest-answer-game-for-classrooms/`, `/guides/rarest-answer-party-ideas/`, `/guides/one-in-a-krillion-strategy/`. Games: `/games/trivia-games-like-sporcle/`. Bodies are about 1,000–1,280 whitespace-words, summaries 40–60 words, five FAQs, question-shaped H2s, tags from `daily-games`, `trivia`, `strategy`, `krillion`, `alternatives`. The only `/answers/` link is `/answers/great-ape-species/`.

Scoring, Spotlight, the 25-second clock, and the empty-category sentence are this site's code. The great-ape tiers are the stored fixture tiers; popularity figures are called placeholders. Wikipedia's Hominidae article (eight living species) and the Tapanuli orangutan article (described 2017, "the rarest great ape," fewer than 800) were fetched 14 November 2026. Krillion facts are from krillion.io, the FAQ, the privacy policy (effective 23 September 2026), Puffer Party, `/unlimited/classic` (no rules sheet), and the packs page (beta, free for now; Words and Language 30 chapters, Movies 30 pictures, Sports 30 games, Geography 30 expeditions, Music coming soon). Sporcle, FunTrivia, TriviaPlaza, Mental Floss quizzes, Seterra, World Geography Games, GeoGuessr, TimeGuessr, Worldle, and Kahoot were opened the same day. FunTrivia's own pages disagreed on quiz totals, so no single total is quoted. JetPunk, Britannica, Braingle, and PurposeGames did not return a readable quiz and are omitted. Classroom copy quotes this site's privacy line that the game is not directed at children under 13. No learning-outcome study is claimed.

`pnpm check-content` clean (30 MDX).

- C5-NEW-CONTENT → W2-QA: new covers are not in `.gen-covers-manifest.json`; they already have `image:`, so a later `pnpm gen-covers` should skip them.
- C5-NEW-CONTENT → W2-QA: the geography and classroom pages describe the empty-state string ("No geography prompts are loaded yet") as what the game shows when that list is empty. They do not assign tiers to any place. If geography prompts publish, those pages stay accurate only while that conditional stays.
- C5-NEW-CONTENT → W1-DATA: `/guides/rarest-answers-animals/` ranks only `great-ape-species`, and it says the file is still `source: "fixture"`. Do not treat its popularity numbers as pageviews after the real file lands; the guide should be revised against the published tiers.

## C4-SEO-PERF done

Technical SEO and the answer hub, on the files this agent owns. `src/data/prompts/**` and `scripts/build-prompts.ts` were not edited, and `pnpm build-prompts` was not run. The catalog at build time was still one prompt, `great-ape-species` (`source: "fixture"`).

`/rarest-answers/` is static HTML grouped by category. Each group is a section (`#animals`, and the other category keys when they exist) with a link to `/trivia/<category>/`. A category jump list renders only when two or more categories are present, so the fixture page has no chip row; `#animals` still lands on the Animals heading. The old search box and client filter are gone. Prompt cards are headings inside links, not a second H1. ItemList JSON-LD names each prompt by its question and uses an absolute URL. `content-visibility` was tried and removed: on the fixture page it moved the "Keep exploring" block (CLS 0.095, performance 98).

`/answers/<slug>/` copy is still derived from that prompt's question, answers, rarity, and source. The meta description leads with the count and the plural (or the species label) and then the question, capped at 165 characters. If two prompts would share a document title or a description, the slug is appended. Related links are the next 4–6 prompts in catalog order: same category first, then the following prompts, and fewer than 4 only when fewer than 4 other prompts exist. With one prompt the page says no other Animals prompts yet, and it still links to `/trivia/animals/` and `/rarest-answers/#animals`.

`public/_headers`: `/_astro/*` stays `public, max-age=31536000, immutable`. `/fonts/*` is the same (the preloaded faces are `fraunces-800.woff2` and `source-sans-3-400.woff2`). `/game-data/*` is `public, max-age=300, must-revalidate` plus `X-Robots-Tag: noindex, nofollow`. Sitemap filter drops `/game-data` and `/ja` / `/zh` (including `zh-`). Hreflang entries are limited to locales in `src/i18n/routing.ts` (`en`) and add `x-default` on the default-locale URL. No built page emits `ja` or `zh`.

`pnpm exec astro build --outDir /tmp/c4-dist` (60 HTML pages after other agents added guides and one game; sitemap 59 URLs, `/404.html` omitted). Every HTML title and meta description is unique. Canonical, `og:url`, `og:image`, and `twitter:image` are absolute `https://` URLs. JSON-LD parses: `/` has WebApplication and VideoGame, `/rarest-answers/` has ItemList and BreadcrumbList, `/answers/great-ape-species/` has FAQPage and BreadcrumbList. Sitemap contains `/`, `/unlimited/`, all eight `/trivia/*`, `/rarest-answers/`, `/answers/great-ape-species/`, `/games/*`, and `/guides/*`, and no `/game-data/*`. Font preload tags are on every page. No third-party script URL is in the HTML. This outDir does not include Pagefind; `pnpm build`'s postbuild still indexes `dist`.

Lighthouse 13.6.0 (mobile, `pnpm dlx`; `npx` is not on PATH) against `http://127.0.0.1:4420` serving that directory. After the CLS fix, performance / accessibility / best-practices / SEO were 100 on `/`, `/rarest-answers/`, `/answers/great-ape-species/`, and `/games/krillion/`. The Python server does not apply `_headers`, so those scores are not a cache-header test. At 375px the hub and the great-ape page had document scroll width 375; the answer table scrolls inside its region (640px table, 343px viewport). `pnpm lint` passed. `pnpm typecheck` passed with 0 errors (an earlier run failed only in `src/lib/game/browser.ts` while that file was mid-edit; the rerun was clean).

- C4-SEO-PERF → W1-UI: Lighthouse's render-blocking insight names `/_astro/SearchButton.*.css` (about 68KB, about 430ms on `/rarest-answers/`). The performance score was still 100. That stylesheet is not in these files.
- C4-SEO-PERF → W1-DATA: answer pages will link 4–6 related prompts once more than one prompt exists. Until then `/answers/great-ape-species/` has no sibling links. A `source` that does not mention Wikipedia is described as stored popularity, not pageviews.

## C6-UI-CHROME done

Site chrome outside the game. Brand tokens in `src/styles/globals.css` are unchanged (`--brand*`, `--tier-1`–`--tier-6`, `--gold`, `--caution`). New color uses those variables. No emoji. Icons are lucide. `pnpm lint`, `pnpm typecheck` (0 errors), and `pnpm check-i18n --strict-ui` are green. `src/data/**`, `scripts/build-prompts.ts`, and `scripts/data/**` were not edited. `pnpm build-prompts` was not run. Game files were not edited.

Lists (`/games/`, `/guides/`, recent, tags): a featured pillar leads the page (`games-like-krillion`, `how-to-find-rare-answers`; if that slug is missing, the first entry), then a cover grid. The category title, intro, and `{count} pages` sit above the grid. Cards keep a 16:9 frame so the grid does not jump. Articles show the cover under the title, Fraunces headings with the body tokens in both themes, a sticky contents rail, the FAQ accordion after the body, related cards with covers, and a tinted "Play today's round" box (`home.closingCta`). The same box is on the list, about, FAQ, and 404. The header is a solid bar (the Play link is the filled pill). Below the `lg` breakpoint the menu is a full-height sheet, locks scroll, and closes on Escape. The footer repeats the gold hairline and a Play button.

New `en.json` strings: `shared.pageCount`, `shared.featuredLabel`, `shared.allPages`, `shared.readThis`, `shared.backToTop`.

Built with `pnpm exec astro build --outDir /tmp/c6-dist` (60 pages). Served at `http://127.0.0.1:4436/`. Playwright (headless Chromium) at 375 and 1280, light and dark, on `/guides/`, `/games/`, `/guides/how-to-find-rare-answers/`, `/about/`, `/faq/`, and `/404.html`, plus the open mobile menu. Document scroll width matched the viewport on every shot. No page errors. The menu opened and Escape closed it.

At the moment of that build, nine covers named by the new MDX were not on disk yet (`en-guides-rarest-answer-game-for-classrooms`, `en-guides-krillion-vs-rarest-answer`, `en-guides-rarest-answers-animals`, `en-guides-how-scoring-works-in-rarest-answer-games`, `en-guides-best-unlimited-trivia-games`, `en-guides-rarest-answer-party-ideas`, `en-guides-one-in-a-krillion-strategy`, `en-guides-rarest-answer-game-tips-geography`, `en-games-trivia-games-like-sporcle`). They were rendered with `pnpm gen-covers --out /tmp/c6-covers` and only those missing PNGs were copied. MDX and `.gen-covers-manifest.json` were not touched. C5's handoff describes the same nine files; a later `pnpm gen-covers` should skip them because `image:` is already set.

- C6-UI-CHROME → W2-QA: preview of this chrome build is `http://127.0.0.1:4436/` (`/tmp/c6-dist`). It is not the repo `dist/`.
- C6-UI-CHROME → C5-NEW-CONTENT: if your cover copy landed after this note, yours is the file on disk. The chrome copy only filled a path that was missing.

## C7-PLAY-PAGES-SEO done

Play pages only: `src/pages/index.astro`, `src/pages/unlimited.astro`, `src/pages/trivia/[category].astro`, and `src/lib/game/category-copy.ts`. Game components, `src/lib/game/copy.ts`, and the prompt JSON were not edited. `pnpm build-prompts` was not run.

The game stays first. On `/` the intro sentence moved under the card so Play fits a 375×812 viewport (button bottom 750, the SEO block starts at 887). No horizontal overflow on `/`, `/unlimited/`, `/trivia/animals/`, or `/trivia/geography/` at 375, or on `/` and `/trivia/animals/` at 1280.

Below the fold: what the mode is, how rarity is measured, the tier table, a tips teaser (finding guide, strategy guide, how to play), a comparison teaser (`/games/krillion/` and `/games/games-like-krillion/`), and one FAQ. Each of these URLs emits a single FAQPage JSON-LD. The homepage rarity answer is that same paragraph plus the tier sentence from `TIERS`. It does not call the fixture numbers live pageviews. Krillion unlimited is described as a different game. The Krillion guide's 14 November 2026 note (an Unlimited path exists, no public rules sheet for its limits) is cited, not extended.

Rarity text is built from each prompt's `source`. A source that names Wikipedia, Wiktionary, or pageviews is Wikidata (CC0) plus monthly English Wikipedia pageviews, or Wiktionary pageviews when the source says Wiktionary. Any other source is placeholder popularity. This build's only prompt is `great-ape-species` (`source: "fixture"`), so the pages say the loaded list is labeled "fixture".

Trivia pages have their own lead, intro, list note, empty note, and two questions. The list is `src/data/prompts/index.json` for that category, sorted by question, linking to `/answers/<slug>/`. This build: animals has 1 prompt ("Name a species of great ape", 8 answers); the other seven say none are in the catalog. Clicking that link opened `/answers/great-ape-species/`.

Titles are ≤60 characters and already contain "Rarest Answer", so the layout does not add a suffix. Descriptions are 140–160 characters and contain the primary keyword. Home 44 / 153. Unlimited 28 / 141. Category titles 32–47, descriptions 144–154. `category-copy.ts` throws on import if a category title or description leaves that range.

`pnpm lint` and `pnpm typecheck` (0 errors) passed. `pnpm exec vitest run tests/game-engine.test.ts` passed (24). Built with `pnpm exec astro build --outDir /tmp/c7-dist` (60 pages). The preview server on port 4477 was stopped.

- C7-PLAY-PAGES-SEO → whoever rebuilds after the prompt files land: leave the rarity sentences alone. They follow the `source` strings. If a page still says "fixture", that prompt file still says fixture.
- C7-PLAY-PAGES-SEO → W2-QA: `/tmp/c7-dist` is not the repo `dist/`.

## C2-GAME-UX done

Game feel, rules, reveal, end screen, and stats. Owned files only: `src/components/game/**`, `src/lib/game/**` except `types.ts`, `tests/game-*.test.ts`. `src/data/prompts/**` and `scripts/build-prompts.ts` were not edited. `pnpm build-prompts` was not run. The catalog at build time was still the one-prompt fixture `great-ape-species` (8 answers).

rarest.me was fetched and compared (7 prompts, 25 seconds, a wrong guess costs 1 second, six tiers, a 2× spend, a share postcard, answer lists). Tier names, the 2× name, and the postcard shape were not copied.

What the play card does now:

- First visit opens How to play once (`settings.seenRules`; a missing field stays false). The three rules stay on the start card under Play and the timer switch, so both controls stay on screen at 375×667 and 375×812. Escape closes the dialog and focuses Play.
- A correct guess flashes the input, then the tier title, the point line, and a six-segment meter. `prefers-reduced-motion` skips the wait and the motion. Focusing Next uses `preventScroll`, so the tier title stays in view (Legendary at y=282 on 375×812).
- The reveal list is one ranked list ("Every answer, rarest first") when the prompt has 10 or fewer answers, and the rarest 10 plus the most common 10 otherwise. Each row has a tier chip. The hit is marked "You". The page links to `/answers/<slug>/`.
- The end screen is a share card (score, streak, up to 7 tier squares) plus the spoiler-free text and a canvas image painted from CSS variables. Share text does not include the answer.
- The stats dialog has two SVG charts: guesses by tier, and daily scores in six buckets. Only a finished daily round appends a score (`dailyScores`, oldest first, cap 60). Free rounds do not.
- Loading, error, and empty states keep their height. An empty category says no prompts are loaded and disables Play. The daily round still uses whatever is in the list.

Keyboard play, `aria-live` for the guess result, and colors only through `--brand*` and `--tier-1`–`--tier-6` (plus the existing semantic tokens). No sound. Game script gzipped size is 13,002 bytes (limit 40KB).

`pnpm exec astro build --outDir /tmp/c2-dist` (60 pages). Served at `http://127.0.0.1:4410/`. Playwright (already-installed Chromium, headless) at 375 and 1280: miss, duplicate, Spotlight (Common → 10), reveal, end, both charts, geography empty, unlimited Pass, no horizontal overflow, CLS about 0, no page errors, no failed requests. `pnpm lint` passed. `pnpm typecheck` passed with 0 errors (the tutorials glob warning only). `pnpm test`: 25 files, 485 passed, 2 skipped. `tests/game-engine.test.ts` is 24 tests, including `dailyScores`, the two distributions, `seenRules`, and the short-list split.

- C2-GAME-UX → W2-QA: `/tmp/c2-dist` is not the repo `dist/`. The preview on port 4410 is still up. A short prompt stays one list; a prompt with more than 10 answers splits into rarest and common.
- C2-GAME-UX → W1-DATA: until more than one prompt exists, a daily round is that one prompt. The end card still draws up to 7 squares.

## C1-DATA-AUDIT done

Every playable prompt was checked against the full SPARQL cache (key `full:<slug>:<sha1 12 hex>`) and the in-flight build log. Edits are only in `scripts/data/prompt-defs.ts` and `docs/rarest-data-audit.md`. `scripts/build-prompts.ts` and `src/data/prompts/**` were not touched. `pnpm build-prompts` was not run.

The running build fetched the pre-audit queries. It will write prompts from those queries, including sets this audit then fixed or excluded. The next build has to run `pnpm build-prompts` again before the answer lists match this audit.

`assertPromptDefs()` passes. 286 playable defs: geography 37, animals 51, food 54, sports 21, screen 28, music 32, science 34, history 29.

Fixes that change the answer set: Central America (7 states), European capitals (Ankara, Astana), Commonwealth (United Kingdom), landlocked (7 countries), Mediterranean (seas that are part of it, so Croatia), English official (Eritrea out), NFL (4 proposed teams), NHL (Coyotes), World Series (Brewers), Summer Olympics (3 cancelled and 3 future), FIFA World Cups (2030), planets (IAU 13), SI units (7 base units), SI prefixes (deca-), space stations (launched, including the ISS), UK prime ministers (Burnham and Denbigh), Ottoman sultans (9 pretenders), Declaration signers (John Adams). Species prompts drop hybrids and undescribed names. Euro users, Soviet republics, US vice presidents, and centuries came off the exclusion list: the cached sets are the real ones. Bulgaria has used the euro since 1 January 2026. great-ape-species, stranger-things-characters, and english-interjections were not changed except great-ape aliases (chimp, common chimpanzee, pygmy chimpanzee).

38 prompts stay excluded. The full table is `docs/rarest-data-audit.md`.

- C1-DATA-AUDIT → whoever next runs the data build: re-run `pnpm build-prompts` after this file is what you want fetched. Do not trust the prompts written by the build that was already in flight.
- C1-DATA-AUDIT → W2-QA: a prompt under 15 answers is still dropped by the builder, except great apes (8) and Stranger Things (12).

## F1-TEST-FIX done

Engine tests no longer read `src/data/prompts/`. Matching, rarity order, and the one-prompt daily round use a frozen copy of the W0 placeholder: `tests/fixtures/great-ape-species.json` (`source: "fixture"`, 8 answers, Tapanuli orangutan rarest, Eastern gorilla second, Chimpanzee then Human at the common end, including the `grauer's gorilla` / `chimpanzees` aliases) and `tests/fixtures/prompts-index.json` (that one index row). A one-prompt catalog still deals `great-ape-species` once, on two different dates, and an empty catalog still deals nothing. The game-data route check still requires `readPromptIndex` in `src/pages/game-data/[slug].json.ts` and rejects a slug the loader's regex refuses. It does not assert the live file's question or rarity order.

One new smoke test in `tests/game-engine.test.ts` reads the live catalog at whatever size it is. Every `src/data/prompts/<slug>.json` except `index.json` matches an index row (`id`, `slug`, `category`, `question`, `answerCount`), the filename is that slug, the slug passes `isSlug`, answers are rarest-first (rarity, then tier, then name), and every tier is 1, 2, 3, 4, 5, or 6. The reverse is checked too: every index slug has that file. At this run the catalog was 252 files. The test does not pin that count.

`pnpm test`: 25 files, 486 passed, 2 skipped. `tests/game-engine.test.ts` is 25 tests. `pnpm lint` passed. `pnpm typecheck` passed with 0 errors. The missing `src/content/tutorials/` glob warning is unchanged. No commit.

## F2-DATA-FILL done

`pnpm build-prompts` finished and wrote 276 prompts. Per category: geography 37, animals 51, food 33, sports 31, screen 30, music 31, science 32, history 31. Sports, screen, and history are each at least 30. `pnpm exec astro build --outDir /tmp/f2-dist` completed (335 pages, exit 0). `assertPromptDefs()` passes. Profanity filter and the other EXCLUDED_SLUGS reasons are unchanged. `tour-de-france-winners` left the exclusion list because its query is now the Wikipedia category set. No commit.

Planets: the 13 IAU bodies (optimizer hint + VALUES). The builder query returned those 13, so the answer minimum for that slug is 13. Written names are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Ceres, Pluto, Haumea, Makemake, and Eris.

Stranger Things: 129 names from a MediaWiki parse of "List of Stranger Things characters" (cast tables, character headings, recurring and guest credits). A name with no article counts as 1 pageview. Barb, Dr. Brenner, Papa, Eddie Munson, Erica Sinclair, Murray Bauman, Argyle, Bob Newby, Karen Wheeler, and Demogorgon are accepted. seoNoun is still "Stranger Things characters".

New or fixed sets, written count equals the checked count: Summer Olympics 30 (held games through 2024; 1916, 1940, and 1944 out; 2028 and later out). Formula One World Drivers' Champions 36, including Antonelli. NBA MVPs 37, with Lew Alcindor as an alias of Kareem Abdul-Jabbar. Ballon d'Or 48 men's 1st-place winners through Harry Kane, not the Féminin award. Heisman 90. World Series MVPs 69. Formula One constructors' champions 15. Super Bowl MVPs 50. Super Bowl-winning head coaches 37. Stanley Cup-winning head coaches 56. Tour de France 64. Simpsons characters 63. MCU film characters 36. Doctor Who incarnations 17 (First through Fifteenth, War, Fugitive). Best Actor 87. Best Actress 81 (Sonia Mbele removed; her article does not support the award). Best Supporting Actor 81, including Haing S. Ngor. Best Supporting Actress 88. Emmy Outstanding Comedy Series 40. Lord of the Rings characters 36. Roman deities 209. World wonders 21. Commonwealth members 56, from the current-members table, because the P463 query times out; the United Kingdom and Trinidad and Tobago are in the set.

Details and the returned-versus-expected table are in `docs/rarest-data-audit.md`.

- F2-DATA-FILL → W2-QA: the live catalog is 276 prompts. A prompt under 15 answers is still dropped, except great apes (8) and planets and dwarf planets (13). Stranger Things no longer has a lower minimum.

## F3-FINAL-QA done

Rebuilt `dist/` after the 276-prompt catalog landed and rechecked the plan §1 keyword rows against that HTML. Every phrase is a case-insensitive substring of that URL's `<title>`, H1, or meta description. Parenthetical "(game)" in the plan is disambiguation and is not required as text. "interjection" is on `/answers/english-interjections/` (title "Rarest English Interjections — All 346 Answers Ranked by Rarity — Rarest Answer"). "stranger things characters" is on `/answers/stranger-things-characters/`. The earlier W2 note that those two answer URLs were missing is stale.

`README.md` already stated 276 prompts (geography 37, animals 51, food 33, sports 31, screen 30, music 31, science 32, history 31), great ape species 8, Stranger Things characters 129, and English interjections 346. Those counts match `src/data/prompts/`. Node `>=22.23.4` and pnpm `11.1.1` match `package.json`. No README edit.

The game script in `dist/_astro/` is `GameApp.astro_astro_type_script_index_0_lang.BZ3nhDF2.js`: 40,552 bytes, 12,931 bytes gzipped, under the 40KB cap.

Gates, all green, on this tree:

- `pnpm lint` exit 0
- `pnpm typecheck` 0 errors, 0 warnings, 0 hints. The glob-loader still warns that `src/content/tutorials/` does not exist. That warning does not fail the command.
- `pnpm test` 25 files, 486 passed, 2 skipped
- `pnpm check-config` consistent
- `pnpm check-content` clean (30 MDX)
- `pnpm check-i18n --strict-ui` all locales covered
- `pnpm build` 335 pages. Pagefind indexed 317 pages. IndexNow key file written from `.indexnow-key`.
- `pnpm check-links` 17,883 links across 335 pages, 0 broken

Playwright 1.64.1 with the installed Chromium 1248 (headless) against `pnpm preview --host 127.0.0.1 --port 4430`. The preview process was stopped afterward (port 4430 closed).

Daily round, keyboard only, at 375×812 and 1280×900, light and dark: first visit opens How to play, Escape closes it, Enter starts, the input is focused, the clock moves from 25 to 24, a miss says "Not on the list" and takes one second, Spotlight on a Common answer scores 10 ("points with Spotlight"), seven tier squares, the end score is the sum, the share text has the colored squares and the score and does not contain the typed names, and the countdown to local midnight is on the end card. No page errors, no console errors, no failed requests, and document scroll width matched the viewport on the start, play, reveal, and end views. The same overflow, console, and contrast check passed for `/`, `/unlimited/`, `/trivia/animals/` (51 prompts, not the empty-catalog sentence), `/rarest-answers/`, `/answers/great-ape-species/`, `/answers/stranger-things-characters/`, `/answers/english-interjections/`, `/games/krillion/`, and `/guides/how-to-find-rare-answers/`, in both themes. Lowest measured contrast was 5.17:1 (light, Legendary pill, 12px) and 7.12:1 (dark). Copy, with the button focused and Enter, writes that share text to the clipboard. Save image downloads `rarest-answer-2026-11-14.png` (PNG signature, 57,369 bytes). When `navigator.share` is stubbed to resolve, Share sets the status to Shared and passes the same spoiler-free text.

### Remaining

- Headless Chrome for Testing exposes `navigator.share` and the promise never settles, so the real Share button shows no status in that browser. Copy is the clipboard path and it works. A resolving `share()` is what sets "Shared". No product change.
- `contact@rarestanswer.com` is still the unverified placeholder in `docs/rarest-todo.md`. `site.contactEmail` stays `''` because `tests/apply-template.test.ts` pins that string.
- `home.faq` in `src/locales/en.json` is still a second FAQ. `/faq/` uses `src/pages/faq.astro`. The homepage does not render `home.faq`.
- Game and guide covers are still absent from `.gen-covers-manifest.json`. They have `image:`, so `pnpm gen-covers` skips them. Do not run `pnpm gen-assets --force`.
- `astro.config.ts` still warns that `src/content/tutorials` is missing. The tutorials suite treats a missing directory as an empty collection.
- Roblox player, visit, favorite, and vote counts in the party guide are the 14 November 2026 snapshot from C3-CONTENT-FACTS. `majority.wtf` was an error page that day.
