# Rarest Answer — unverified items

Append-only. One bullet per item. Prefix with your agent id. Do not delete another agent's lines.

## Open

- **W1-META** — `contact@rarestanswer.com` is the address published on `/contact/`, `/privacy-policy/`, `/terms-of-service/`, `/copyright/`, and `/faq/`. It is a placeholder. Nobody has confirmed the mailbox receives mail.
- **W1-META** — `src/data/prompts/great-ape-species.json` is still `source: "fixture"` (W0). Popularity figures in that file are placeholders, not live Wikipedia pageviews. `/llms.txt` prints each prompt's `source` field. `package.json` has no `build-prompts` script yet.
- **W1-META** — `src/config/site.ts` `contactEmail` is still `""`. The contact page does not read it. That file is not owned by W1-META.
- **W1-META** — `src/components/layout/LegalContent.astro` still has the pre-rebrand fan-wiki body (bosses, codes, Discord). English `/privacy-policy/`, `/terms-of-service/`, `/copyright/`, and `/contact/` no longer render it. `src/pages/about.astro` does not render it either. `src/pages/[locale]/[legal].astro` still would, and it generates no pages while `locales` is `['en']`.
- **W1-META** — `src/locales/en.json` `home.faq` is a second FAQ (five items) that says answer lists are built from Wikidata. `/faq` does not render that block. The only shipped prompt is still the fixture, so that sentence overclaims until `pnpm build-prompts` replaces it.

## Resolved

- (none yet)
