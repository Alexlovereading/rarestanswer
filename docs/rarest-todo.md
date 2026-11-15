# Rarest Answer — unverified items

Append-only. One bullet per item. Prefix with your agent id. Do not delete another agent's lines.

## Open

- **W1-META** — `contact@rarestanswer.xyz` is the address published on `/contact/`, `/privacy-policy/`, `/terms-of-service/`, `/copyright/`, and `/faq/`. It is a placeholder. Nobody has confirmed the mailbox receives mail.
- **W1-META** — `src/data/prompts/great-ape-species.json` is still `source: "fixture"` (W0). Popularity figures in that file are placeholders, not live Wikipedia pageviews. `/llms.txt` prints each prompt's `source` field. `package.json` has no `build-prompts` script yet.
- **W1-META** — `src/config/site.ts` `contactEmail` is still `""`. The contact page does not read it. That file is not owned by W1-META.
- **W1-META** — `src/components/layout/LegalContent.astro` still has the pre-rebrand fan-wiki body (bosses, codes, Discord). English `/privacy-policy/`, `/terms-of-service/`, `/copyright/`, and `/contact/` no longer render it. `src/pages/about.astro` does not render it either. `src/pages/[locale]/[legal].astro` still would, and it generates no pages while `locales` is `['en']`.
- **W1-META** — `src/locales/en.json` `home.faq` is a second FAQ (five items) that says answer lists are built from Wikidata. `/faq` does not render that block. The only shipped prompt is still the fixture, so that sentence overclaims until `pnpm build-prompts` replaces it.
- **C3-CONTENT-FACTS** — No wiki page was set to `draft: true`. Every games and guides page had a live source. These items stayed off the pages because they could not be verified: `majority.wtf` returned HTTP 525 on 14 November 2026 (rules not described); Brainer's archive index (`id` + `label` only, 256 puzzles that day) does not publish a question count; the POG and Y8 Deep Dive listings do not publish a control scheme; Roblox `createVipServersAllowed` was false while the Rarest Answer Party description still advertises free private servers; playdaily.org/noillirk and the BlueMind App Store app both present themselves as Noillirk and disagree about which one is the only official site.
- **Y6-WHO-HOW** — No individual byline was provided. Articles use the organization name "Rarest Answer editorial team" (`site.defaultAuthor`, linked to `/about/`). If you want a real person or pen name on that byline, send the name to publish. A photo or credentials should be added only if you send them too. Until then the about page does not name a person.

## Resolved

- **F3-FINAL-QA** — The fixture prompt item is closed. `great-ape-species.json` source is `Wikidata + Wikipedia pageviews (2026-10)`. `package.json` defines `build-prompts`. The catalog is 276 prompts. Guides, about, FAQ, privacy, terms, copyright, and `llms.txt` no longer say that file is a fixture.
- **F3-FINAL-QA** — `home.faq` no longer says the sample prompt is a fixture. `/faq` still does not render `home.faq`.
