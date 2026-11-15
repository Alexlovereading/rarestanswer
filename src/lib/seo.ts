/**
 * SEO utilities — JSON-LD builders and meta tag helpers.
 *
 * All builders return plain objects; the <JsonLd> component stringifies them.
 * Absolute URLs are produced via siteUrl + lib/url helpers.
 */

import { siteUrl } from '~/config/site';
import { site } from '~/config/site';
import { defaultLocale, type Locale } from '~/i18n/routing';
import { detailPath, homeUrl, listPath } from './url';

/** Organization JSON-LD — injected globally in BaseLayout. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: siteUrl,
    logo: `${siteUrl}/android-chrome-512x512.png`,
    image: `${siteUrl}/images/hero.webp`,
    description: site.description,
    // Entity association: link the wiki to the game's canonical pages
    // (Steam / official site / Wikipedia) — knowledge-graph signal.
    ...(site.sameAs && site.sameAs.length > 0 ? { sameAs: site.sameAs } : {}),
  };
}

/** WebSite JSON-LD — injected on the homepage only. */
export function websiteJsonLd(locale: Locale = defaultLocale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: siteUrl,
    description: site.description,
    inLanguage: locale,
  };
}

/**
 * UTC calendar day. Article pages print dates with `timeZone: 'UTC'`, so the
 * JSON-LD day is that same day (date-only ISO 8601, no invented time).
 */
function utcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Absolute form of a byline href. A site path resolves to the same page. */
function schemaUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/')) return `${siteUrl}${url}`;
  return url;
}

/** Article JSON-LD — injected on article detail pages. */
export function articleJsonLd(opts: {
  title: string;
  description: string;
  image?: string;
  datePublished: Date;
  /** Only when the page shows a separate "last updated" date. */
  dateModified?: Date;
  category: string;
  slug: string;
  locale: Locale;
  /** Byline exactly as rendered. Omit when the page shows no author. */
  authorName?: string;
  /** Profile link on the byline. Omitted when the name is plain text. */
  authorUrl?: string;
  /**
   * Person for a named individual. Organization for the site byline
   * (the editorial team is not a person).
   */
  authorType?: 'Person' | 'Organization';
}) {
  const {
    title,
    description,
    image,
    datePublished,
    dateModified,
    category,
    slug,
    locale,
    authorName,
    authorUrl,
    authorType = 'Person',
  } = opts;
  const coverUrl = image
    ? image.startsWith('http')
      ? image
      : `${siteUrl}${image}`
    : `${siteUrl}/images/hero.webp`;
  const byline = authorName?.trim();
  const author = byline
    ? {
        '@type': authorType,
        name: byline,
        ...(authorUrl ? { url: schemaUrl(authorUrl) } : {}),
      }
    : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: coverUrl,
    datePublished: utcDateOnly(datePublished),
    ...(dateModified ? { dateModified: utcDateOnly(dateModified) } : {}),
    ...(author ? { author } : {}),
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: { '@type': 'ImageObject', url: `${siteUrl}/android-chrome-512x512.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}${detailPath(category, slug, locale)}`,
    },
  };
}

/** BreadcrumbList JSON-LD — injected on article detail pages. */
export function breadcrumbJsonLd(opts: {
  category: string;
  categoryLabel: string;
  title: string;
  slug: string;
  locale: Locale;
  /** Localized "Home" label (locale JSON nav.home). */
  homeLabel?: string;
}) {
  const { category, categoryLabel, title, slug, locale, homeLabel = 'Home' } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: `${siteUrl}${homeUrl(locale)}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryLabel,
        item: `${siteUrl}${listPath(category, locale)}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `${siteUrl}${detailPath(category, slug, locale)}`,
      },
    ],
  };
}

/**
 * BreadcrumbList JSON-LD (2-level variant) for non-article pages
 * (list pages, FAQ, etc.). Home → pageLabel.
 *
 * Use breadcrumbJsonLd() for article pages (Home → Category → Article).
 */
export function simpleBreadcrumbJsonLd(opts: {
  /** Display name of the current page (e.g. category label or "FAQ"). */
  pageLabel: string;
  /** Absolute-or-relative path of the current page for a given locale. */
  path: string;
  locale: Locale;
  /** Localized "Home" label (locale JSON nav.home). */
  homeLabel?: string;
}) {
  const { pageLabel, path, locale, homeLabel = 'Home' } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: `${siteUrl}${homeUrl(locale)}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: pageLabel,
        item: `${siteUrl}${path}`,
      },
    ],
  };
}

/** ItemList JSON-LD — injected on list pages. */
export function itemListJsonLd(opts: {
  category: string;
  categoryLabel: string;
  locale: Locale;
  items: Array<{ title: string; slug: string }>;
}) {
  const { category, categoryLabel, locale, items } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categoryLabel,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.title,
      url: `${siteUrl}${detailPath(category, item.slug, locale)}`,
    })),
  };
}

/**
 * FAQPage JSON-LD. FAQ rich results stopped showing on 2026-05-07, so this
 * stays only for `/answers/` pages (owned elsewhere). Article, FAQ, and play
 * pages keep the visible questions and do not call this.
 */
export function faqPageJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

/**
 * Generic ItemList JSON-LD for cross-category lists (tag pages, recent
 * updates) where itemListJsonLd()'s single-category URL shape doesn't fit.
 * Each item carries its own absolute URL.
 */
export function urlListJsonLd(opts: {
  name: string;
  items: Array<{ title: string; url: string }>;
}) {
  const { name, items } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.title,
      url: item.url,
    })),
  };
}

/** ImageObject JSON-LD — one per gallery image (Google Images eligibility). */
export function imageObjectJsonLd(opts: { url: string; caption?: string; alt?: string }) {
  const { url, caption, alt } = opts;
  // Prefer the author-written alt as the name; caption describes context.
  const name = alt ?? caption;
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: url,
    ...(name ? { name, description: caption ?? name } : {}),
  };
}

/**
 * VideoObject JSON-LD — one per embedded YouTube video on an article page.
 * Eligible for Google Video search results. Google's required fields are
 * name/description/thumbnailUrl/uploadDate — omitting description makes GSC
 * flag the page's video rich result (production report 2026-09-18). The
 * videos frontmatter is a bare ID list with no per-video metadata, so the
 * article's own description/publish date are the best available signals.
 */
export function videoObjectJsonLd(opts: {
  videoId: string;
  title: string;
  description: string;
  uploadDate: Date;
}) {
  const { videoId, title, description, uploadDate } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description,
    thumbnailUrl: [`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`],
    uploadDate: utcDateOnly(uploadDate),
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

/**
 * Build the <title> string with a smart suffix (three-site production
 * lesson: a fixed full-name suffix pushed keywords out of the ~60-char SERP
 * display window on long titles).
 * - title already carries the game name → no suffix (repetition buys nothing);
 * - title > 50 chars → short suffix (site.shortName) to stay in the window;
 * - otherwise → full site name.
 * BaseLayout's own suffix guard also checks all three names, so callers may
 * pass either a raw title or pageTitle() output without double suffixing.
 */
export function pageTitle(title: string): string {
  if (title.includes(site.game.name)) return title;
  const suffix = title.length > 50 ? site.shortName : site.name;
  return `${title} — ${suffix}`;
}

/**
 * VideoGame JSON-LD for a play page. One type per page (not also
 * WebApplication). No Offer: the game has no price on the page.
 * Pass the name, description, and URL that this page actually shows.
 * Genre and platform stay off — the config strings ("Daily trivia game",
 * "Web") are not the words on the page.
 */
export function videoGameJsonLd(opts: {
  name?: string;
  description?: string;
  url?: string;
} = {}) {
  const name = opts.name?.trim() || site.game.name;
  const description = opts.description?.trim() || site.description;
  const url = opts.url?.trim() || `${siteUrl}/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name,
    description,
    url,
    publisher: { '@type': 'Organization', name: site.name },
  };
}

/**
 * Recipe JSON-LD — Google recipe rich-results eligibility for recipe-hub
 * pages. `name` + `image` are Google's required fields; times are emitted
 * only when ISO 8601-shaped (PT30M) — plain display strings stay off the
 * machine-readable layer instead of producing an invalid duration. Recipe
 * instructions live in the visible body prose (Google marks them
 * recommended, not required); add structured steps only if a preset fork
 * later wants the extra rich-result real estate.
 */
export function recipeJsonLd(opts: {
  name: string;
  description: string;
  image: string;
  url: string;
  authorName?: string;
  authorType?: 'Person' | 'Organization';
  datePublished?: Date;
  cuisine?: string;
  servings: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: string[];
  tools: string[];
}) {
  const isIsoDuration = (v: string | undefined) => /^PT[0-9]/.test(v ?? '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: opts.name,
    description: opts.description,
    image: opts.image,
    url: opts.url,
    ...(opts.authorName
      ? { author: { '@type': opts.authorType ?? 'Person', name: opts.authorName } }
      : {}),
    ...(opts.datePublished ? { datePublished: utcDateOnly(opts.datePublished) } : {}),
    ...(opts.cuisine ? { recipeCuisine: opts.cuisine } : {}),
    recipeYield: opts.servings,
    ...(isIsoDuration(opts.prepTime) ? { prepTime: opts.prepTime } : {}),
    ...(isIsoDuration(opts.cookTime) ? { cookTime: opts.cookTime } : {}),
    recipeIngredient: opts.ingredients,
    ...(opts.tools.length > 0
      ? { tool: opts.tools.map((t) => ({ '@type': 'HowToTool', name: t })) }
      : {}),
  };
}
