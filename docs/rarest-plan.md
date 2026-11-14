# Rarest Answer — 建站方案 / Build Plan

> 单一真相源。所有子代理开工前必读本文件 + `AGENTS.md`。
> Single source of truth. Every sub-agent MUST read this file and `AGENTS.md` before editing.

## 0. 定位 / Positioning

- **Product**: "Rarest Answer" — a free daily trivia game where the *rarest correct answer wins*, plus an SEO content layer (rarest-answer lists, how-to guides, alternatives to Krillion & other daily games).
- **Benchmark**: https://rarest.me/ . Goal = better UX + better UI + more search coverage. **Do not copy** its text, tier names (Flicker…Inferno), "Thermal" naming, or visuals. Own identity.
- **Language**: English only (`en`, no locale prefix). Remove `ja` and every `zh` landing page.
- **Domain**: placeholder `rarestanswer.com` via `SITE_URL` env (never hardcode).
- **Stack**: this AnvilWiki template (Astro 7 static, Cloudflare Pages). **No React/Vue/Svelte** — game UI is Astro + vanilla TypeScript (`<script>` modules), `<dialog>`, CSS. All colors via CSS variables. Icons = lucide via astro-icon. No emoji in UI chrome (share text may use colored squares — that is output text, not UI).

## 1. 关键词 → 页面映射 / Keyword → Page map (MUST all be covered)

Sources: user screenshot (finding rare answers 1.59K, **rarest answer game 10.67K**, guess rarest answer 500) + Google Trends rising CSV (`krillion*` breakout).

| URL | Primary keywords | Owner |
|---|---|---|
| `/` (play daily) | rarest answer game, guess the rarest answer (game), rare answer game, rarest answer wins, finding rare answers, daily games, trivia | W1-GAME (page) |
| `/unlimited/` | krillion unlimited, rarest answer game unlimited | W1-GAME |
| `/trivia/<cat>/` ×8 | geography trivia, animal trivia… | W1-GAME |
| `/rarest-answers/` hub + `/answers/<prompt-slug>/` | rarest species of great ape, great ape species, species of great ape, stranger things characters, interjection, rarest answers | W1-ANSWERS |
| `/games/games-like-krillion/` | games like krillion, game like krillion | W1-CONTENT-A |
| `/games/krillion/` | krillion, krillion game, krillon, krillon game, one in a krillion (game), noillirk | W1-CONTENT-A |
| `/games/cosmillion/` | cosmillion, cosmillion game | W1-CONTENT-A |
| `/games/seldom-game/` | seldom, seldom game | W1-CONTENT-A |
| `/games/size-it-up-game/` | size it up, size it up game | W1-CONTENT-A |
| `/games/dartle-game/` | dartle, dartle game | W1-CONTENT-A |
| `/games/jinxed-game/` | jinxed, jinxed game | W1-CONTENT-A |
| `/games/farflung-game/` | farflung, farflung game | W1-CONTENT-A |
| `/games/one-in-a-million-game/` | one in a million game, one in a million | W1-CONTENT-A |
| `/games/games-like-wordle/` | games like wordle, wordle, daily games | W1-CONTENT-A |
| `/games/wonderhop/`, `/games/majority-game/`, `/games/deep-dive-game/`, `/games/ball-knowledge-game/`, `/games/brainer/` | each name | W1-CONTENT-A |
| `/guides/how-to-find-rare-answers/` | finding rare answers, guess rarest answer | W1-CONTENT-B |
| `/guides/how-to-play-rarest-answer/` | rarest answer game, rarest answer wins | W1-CONTENT-B |
| `/guides/rarest-answer-party-roblox/` | rarest answer party, rarest answer party roblox, roblox | W1-CONTENT-B |
| `/guides/best-daily-trivia-games/` | daily games, trivia games, trivia, games | W1-CONTENT-B |
| `/guides/rarest-answer-strategy/` | guess the rarest answer, rare answer game | W1-CONTENT-B |
| `/guides/stranger-things-characters-trivia/` | stranger things, stranger things characters | W1-CONTENT-B |

Content categories (navigation.ts): `games` (alternatives & reviews), `guides`. Answers + trivia pages are Astro routes fed by data, not MDX.

**Fact rule (hard)**: pages about other games (Krillion, Cosmillion, …) must be researched live (fetch the real site / search). Never invent rules, scores, creators, URLs, or release dates. Anything unverifiable → omit it, or set `draft: true` and list it in `docs/rarest-todo.md`.

## 2. 数据契约 / Data contract (`src/lib/game/types.ts`, owned by W0)

```ts
export type CategoryKey = 'geography'|'animals'|'food'|'sports'|'screen'|'music'|'science'|'history';
export interface Answer {
  name: string;          // display name
  aliases: string[];     // accepted alternate spellings (normalized matching is done in engine)
  popularity: number;    // raw signal, e.g. Wikipedia monthly pageviews
  rarity: number;        // 0..1, 1 = rarest (percentile within the prompt)
  tier: 1|2|3|4|5|6;     // 6 = rarest
  wiki?: string;         // en.wikipedia title
}
export interface Prompt {
  id: string; slug: string; category: CategoryKey;
  question: string;      // "Name a species of great ape"
  answers: Answer[];     // sorted rarest-first
  source: string;        // e.g. "Wikidata + Wikipedia pageviews (2026-10)"
}
export interface PromptIndexEntry { id: string; slug: string; category: CategoryKey; question: string; answerCount: number; }
```
Files: `src/data/prompts/index.json` (PromptIndexEntry[]) + `src/data/prompts/<slug>.json` (Prompt). Fixture `great-ape-species` ships in W0 so other agents can build before W1-DATA finishes.

Tier names (own brand, not rarest.me's): 1 Common · 2 Familiar · 3 Uncommon · 4 Rare · 5 Epic · 6 Legendary — points 5/10/20/40/70/100.

## 3. 波次与文件所有权 / Waves & file ownership

Agents run in the same working tree **in parallel** — touch ONLY files you own. Need a change elsewhere? Write it to `docs/rarest-handoff.md` (append-only, one line per request, prefixed by your agent id).

**W0-FOUNDATION (alone, first)**: rebrand via the template's own mechanisms (`pnpm apply-template --answers` or manual equivalent per `docs/apply-template.md`): site.ts identity, English only (delete ja), delete demo wiki content/covers, remove landing storefront (`landingLinkEnabled=false`, LANDING_PATHS removal), categories `games`+`guides` (navigation.ts, en.json nav/overview), placeholder MDX so build passes, `src/lib/game/types.ts` + fixture, wrangler `SITE_URL`. Gates green.

**W1 (parallel, 6 agents)**
| id | Owns |
|---|---|
| W1-DATA | `scripts/build-prompts.ts`, `src/data/prompts/**`, `package.json` script `build-prompts` only. ≥240 prompts (≥30/category) incl. great ape species, Stranger Things characters, English interjections. Wikidata SPARQL + Wikipedia pageviews API, cached to `.cache/`, polite UA, rate-limited. |
| W1-GAME | `src/lib/game/**` (except types.ts), `src/components/game/**`, `src/pages/index.astro`, `src/pages/unlimited.astro`, `src/pages/trivia/**`, `src/pages/game-data/**`, `src/components/home/**`, `tests/game-*.test.ts` |
| W1-UI | `src/styles/**`, `tailwind.config.mjs`, `src/components/layout/**`, `header/**`, `footer/**`, `sidebar/**`, `article/**`, `src/locales/en.json`, `public/` brand assets (`pnpm gen-assets`) |
| W1-ANSWERS | `src/pages/rarest-answers.astro`, `src/pages/answers/**`, `src/components/answers/**` |
| W1-CONTENT-A | `src/content/wiki/en/games/**`, their covers in `src/assets/covers/games-*` |
| W1-CONTENT-B | `src/content/wiki/en/guides/**`, covers `src/assets/covers/guides-*`, `src/pages/about.astro` copy |

**W2-QA (alone, last)**: apply `docs/rarest-handoff.md` requests, integrate, run all gates, fix, mobile 375px check, Lighthouse-minded pass, sitemap/internal links between game ↔ answers ↔ content.

## 4. 体验目标(超越 rarest.me)/ UX bar

- Instant input with fuzzy matching (case/diacritics/punctuation/articles-insensitive, alias + Levenshtein ≤1 for len≥6), autocomplete off, mobile keyboard friendly.
- Daily round: 7 prompts, same for everyone, resets local midnight; countdown to next; streak + stats (localStorage); unlimited mode; per-category mode; optional no-timer; a once-per-round 2× boost (own name: "Spotlight").
- Reveal screen per prompt: your answer's tier, top-10 rarest + most-common answers, how many you could have named; animated tier meter.
- End screen: score, tier breakdown, share (Web Share API + clipboard; text grid), downloadable share image (canvas), "play another".
- Accessibility: keyboard-only playable, `aria-live` for timer/score, reduced-motion respected, 4.5:1 contrast, dark/light.
- Performance: game JS < 40KB gz, data per prompt fetched lazily, zero CLS, Lighthouse ≥95 mobile.
- Ads: keep template env-gated slots; never inside the active play area.

## 5. 完成定义 / Definition of done

`pnpm lint && pnpm typecheck && pnpm check-config && pnpm check-content && pnpm build && pnpm check-links` all green. Unit tests for engine (matching, scoring, daily seed). Every keyword in §1 maps to a live page with it in title/H1/description.
