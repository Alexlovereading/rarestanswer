import type { APIRoute } from 'astro';
import { siteUrl } from '~/config/site';

// Every crawler may crawl all pages, including Googlebot, AdsBot-Google,
// and Mediapartners-Google. Do not add a Disallow for those agents.
// The one Disallow skips /unlimited/?prompt=<slug> play links: 276 copies
// of /unlimited/ whose canonical is /unlimited/. AdsBot and Mediapartners
// ignore `User-agent: *`, so the rule does not reach them.
const robotsTxt = `
# Rarest Answer — ${siteUrl}
User-agent: *
Allow: /
Disallow: /unlimited/?prompt=

Sitemap: ${siteUrl}/sitemap-index.xml
`.trim();

export const GET: APIRoute = () =>
  new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
