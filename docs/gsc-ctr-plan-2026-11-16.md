# GSC-driven CTR + internal linking plan — 2026-11-16

Data: Google Search Console fresh data (dataState hourly_all / all), 2026-11-15..17 — `data/gsc/rarestanswer-last24h-summary.json`, `data/gsc/top20-query-page-gaps.json` (query → page pairs ranking in the top 20, with impressions, position and whether the exact phrase is on the page). Spec: `/Users/alex/Desktop/Desktop/SGEO网站规范/GEO-SEO/SEO-GEO.md` (§3 accurate titles, §5 no keyword stuffing, §7 internal HTML links).

## What the data says
- Last 24h: 512 impressions, 11 clicks (CTR 2.1%), average position 7.8.
- `/answers/great-ape-species/`: 181–288 impressions at position ~5–6, **0 clicks**. Queries: "rare species of great ape", "name a (very) rare species of great ape", "rarest species of great ape", "rare great ape species", "krillion name a species of great ape". Searchers met the prompt in a daily rare-answer game and want the answer → the snippet must answer directly.
- Home: 99 impressions, 9 clicks, position ~9.6. Queries: rarest answer game, rarest answer wins, guess the rarest answer, rarest answers only, guessing rarest answers, rare response, rarest answer unlimited.
- Long tail already appearing: /guides/, /games/krillion/, /trivia/animals|food|geography|music/, /guides/how-to-play-rarest-answer/, /guides/rarest-answer-party-ideas/, /games/brainer/, /games/ball-knowledge-game/, /games/deep-dive-game/, /guides/rarest-answers-animals/.
- Ignore noise queries: `site:` operators, reddit, linkedin, ohnepixel.

## 1. Title / meta description / head formulas (CTR)
General: lead with what the searcher typed + the concrete payoff; numbers and named answers beat vague words; title core ≤ 60 chars (suffix " — Rarest Answer" may be dropped when it does not fit); description 140–160 chars, starts with the answer or the benefit, ends with a reason to click; no ALL CAPS, no clickbait, no claims we cannot back.

| Page type | Title formula | Description formula |
|---|---|---|
| /answers/<slug>/ (276) | `Rare <plural noun>: <rarest answer> & All <N> Ranked` (fallback `Rarest <noun>: <answer> (<N> Ranked)`) | `Rarest answer: <A> (<tier>). Also rare: <B>, <C>. All <N> answers to "<question>", ranked by Wikipedia views.` |
| /trivia/<cat>/ | `<Category> Trivia: Name the Rarest Answer (<count> Prompts)` | `Play <count> <category> prompts where the rarest correct answer wins — e.g. <2 real prompt examples>. Free daily and unlimited rounds.` |
| /games/<game>/ | `<Game>: How It Works, Tips & Games Like It` (keep verified one-line hook) | Verified one-line what-it-is + one differentiator + "games like it" |
| /guides/<guide>/ | Question or outcome form: `How to …`, `<N> Ways to …`, `… Explained` | Direct answer in sentence 1, concrete detail in sentence 2 |
| / | keep `Rarest Answer Game — Guess the Rarest Answer` | lead with "Daily rare answer game…" + free/no sign-up + daily + unlimited |
| list pages /games/ /guides/ /rarest-answers/ | descriptive + count | count + what you will find |

Head: og:title / og:description / twitter:* must equal the new title/description; canonical unchanged; no FAQPage or new schema (GEO audit G2).

## 2. Add GSC queries the page lacks (once, naturally)
| Page | Add |
|---|---|
| /answers/great-ape-species/ | rare species of great ape; name a rare species of great ape; rarest species of great ape; rare great ape species; one honest line for people who met the prompt in Krillion or another rare-answer game |
| / | rare answers only / rarest answers only; guessing the rarest answers; rare response; guess the rarest answer game |
| /unlimited/ | guess the rarest answer |
| /guides/rarest-answer-party-ideas/ | rarest answer party answers |
| /guides/rarest-answers-animals/, /trivia/animals/ | link "name a rare species of great ape" → /answers/great-ape-species/ |
| /games/krillion/ | Krillon daily dive (spelling-help box only) |

## 3. Internal link matrix (HTML `<a href>` links, descriptive anchors, ending in "/")
- Home → the 8 trivia pages; top answer pages by impressions (great-ape-species first); /games/games-like-krillion/; /guides/how-to-find-rare-answers/.
- Each /answers/<slug>/ → its /trivia/<category>/ (anchor "more <category> trivia"); 4–6 related answers in the same category (anchor = the question noun, e.g. "rare penguin species"); /guides/how-to-find-rare-answers/; /rarest-answers/.
- Each /trivia/<cat>/ → its top 6 answer pages (anchor "rarest <noun>"); the most relevant guide; /games/krillion/ only on categories with a verified Krillion counterpart.
- Each /games/<game>/ → /games/games-like-krillion/ (hub), / (play), and 1–2 topical answer/trivia pages where the topic truly matches (e.g. ball-knowledge-game → /trivia/sports/ and a football answer page like /answers/premier-league-clubs/ if it exists).
- Each /guides/<guide>/ → 2–4 answer pages or trivia pages that the guide's examples actually discuss + /.
- No more than ~3 links per paragraph; no repeated identical anchors on one page; every target must exist (check-links must stay green).
