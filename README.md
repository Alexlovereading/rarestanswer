# Rarest Answer

Rarest Answer is a free trivia game you play in the browser. A prompt asks you to name something that fits. Every accepted answer is correct, and a rarer correct answer scores more.

A daily round is seven shared prompts. The set resets at local midnight. Unlimited play and per-category rounds use the same six score tiers (Common 5, Familiar 10, Uncommon 20, Rare 40, Epic 70, Legendary 100). Once per round, Spotlight doubles one prompt. There is no account. Streak and round stats stay in `localStorage` on that device.

The same site publishes an index of prompts, guides, and unofficial pages about other daily games. Those pages are not affiliated with Krillion or with any other game they name.

| Section | URL |
|---|---|
| Daily game | `/` |
| Unlimited | `/unlimited/` |
| One category | `/trivia/<category>/` — geography, animals, food, sports, screen, music, science, history |
| Prompt index | `/rarest-answers/` |
| One prompt | `/answers/<slug>/` |
| Other daily games | `/games/` |
| Guides | `/guides/` |

Domain placeholder: `rarestanswer.xyz`, via the `SITE_URL` environment variable. Do not hardcode the host in page code.

## Local development

Requirements: Node.js `>=22.23.4` (`engines` in `package.json`) and pnpm `11.1.1` (`packageManager` in `package.json`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:4321/ . The dev server reads `SITE_URL` from the environment when it is set, and otherwise the site config uses `https://rarestanswer.xyz`.

```bash
pnpm build    # static output in dist/ ; postbuild indexes on-site search
pnpm preview  # serve dist/ locally
```

`pnpm typecheck` and `pnpm lint` are the checks for this tree.

## Build the prompt dataset

Compiled prompts live in `src/data/prompts/`:

- `index.json` lists every prompt (`id`, `slug`, `category`, `question`, `answerCount`).
- `<slug>.json` is one prompt: accepted answers, aliases, a popularity figure, a rarity percentile, and a tier.

`pnpm build-prompts` (`package.json`, `scripts/build-prompts.ts`) queries the Wikidata SPARQL endpoint and the Wikipedia or Wiktionary pageviews API, caches responses under `.cache/build-prompts/`, and rewrites that folder.

The shipped catalog is **276 prompts**: geography 37, animals 51, food 33, sports 31, screen 30, music 31, science 32, history 31. Each category has at least 30. Great ape species (8 answers), Stranger Things characters (129), and English interjections (346, ranked by Wiktionary pageviews) are included. Sources on the files name Wikidata plus English Wikipedia pageviews for October 2026, except the interjection list, which uses Wiktionary pageviews for the same month.

## Deploy to Cloudflare Pages

`wrangler.toml` is the Pages env source while it exists. The dashboard ignores same-named variables.

- Project `name`: `rarestanswer`
- Build command: `pnpm build`
- Output directory: `dist`
- Set `NODE_VERSION` to `22` on the Pages project (Node 22.23.4 or newer)

`[vars]` already sets `SITE_URL = "https://rarestanswer.xyz"`. Change the domain there, and keep the `https://` scheme. Analytics, ads, and comments stay off while their variables are blank.

Local production preview of the built site:

```bash
pnpm build
npx wrangler pages dev dist
```

Direct upload, when you are not deploying from Git:

```bash
npx wrangler pages deploy dist
```

Connect-to-Git in the Cloudflare dashboard uses the same build command and output directory. Push the commit you want to publish. Pages builds that commit.

## Credits

Built on [AnvilWiki](https://github.com/PNGTRID/AnvilWiki) (MIT). Prompt lists use [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) (CC0) and [Wikipedia pageview counts](https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews). This site does not republish Wikipedia article text.

Product plan: [docs/rarest-plan.md](docs/rarest-plan.md). Template manuals that shipped with AnvilWiki are still under `docs/`.

## License

MIT License. The copyright and permission notice below is the project license. The full file is [LICENSE](LICENSE).

```
MIT License

Copyright (c) 2026 AnvilWiki contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
