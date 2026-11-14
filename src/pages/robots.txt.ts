import type { APIRoute } from 'astro';
import { siteUrl } from '~/config/site';

// Every crawler is allowed, including Googlebot, AdsBot-Google,
// and Mediapartners-Google. Do not add a Disallow for those agents.
const robotsTxt = `
# Rarest Answer — ${siteUrl}
User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap-index.xml
`.trim();

export const GET: APIRoute = () =>
  new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
