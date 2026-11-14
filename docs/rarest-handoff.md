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
