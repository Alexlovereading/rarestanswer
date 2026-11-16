import en from '~/locales/en.json';

/** First-party, static creative. Network IDs belong in env, never here. */
export type HouseAdPlacement = 'rail-left' | 'rail-right' | 'anchor';

export interface HouseAdImage {
  src: `/images/promos/${string}`;
  srcSet?: string;
  avifSrcSet?: string;
  width: number;
  height: number;
}

export interface HouseAd {
  href: `https://${string}`;
  images: { desktop: HouseAdImage; mobile?: HouseAdImage };
  headline: string;
  subline: string;
  ctaLabel: string;
  /** Empty for decorative art repeated by the adjacent HTML. */
  alt: string;
  sponsored: true;
}

export type HouseAds = Readonly<Partial<Record<HouseAdPlacement, HouseAd>>>;

function creative(stem: string, width: number, height: number): HouseAdImage {
  const base = `/images/promos/${stem}`;
  return {
    src: `/images/promos/${stem}-${width}x${height}.webp`,
    srcSet: `${base}-${width}x${height}.webp 1x, ${base}-${width * 2}x${height * 2}.webp 2x`,
    avifSrcSet: `${base}-${width}x${height}.avif 1x, ${base}-${width * 2}x${height * 2}.avif 2x`,
    width,
    height,
  };
}

/** Comment out a placement entry to disable its house-ad fallback. */
export const HOUSE_ADS: HouseAds = {
  'rail-left': {
    href: 'https://fivoraco.com/house/20-christmas-gift-ideas/',
    images: {
      desktop: creative('christmas-gifts', 160, 600),
    },
    ...en.houseAds.christmas,
    sponsored: true,
  },
  'rail-right': {
    href: 'https://join.trendndailyofficial.com/aff_c?offer_id=16783&aff_id=2130',
    images: {
      desktop: creative('gift-card', 160, 600),
    },
    ...en.houseAds.giftCard,
    sponsored: true,
  },
  anchor: {
    href: 'https://synthpulseai.com/',
    images: {
      desktop: creative('ai-music', 728, 90),
      mobile: creative('ai-music', 320, 50),
    },
    ...en.houseAds.synthpulse,
    sponsored: true,
  },
};
