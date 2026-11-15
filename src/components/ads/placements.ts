import { HOUSE_ADS, type HouseAds } from '~/config/house-ads';

/** Fixed site-shell placements. All network IDs stay in build-time env. */
export type AdEnv = Record<string, string | boolean | undefined>;
export const PLACEMENTS = {
  left: {
    width: 160,
    height: 600,
    adsense: 'RAIL_LEFT',
    adsterra: 'rail-left-160x600',
    house: 'rail-left',
  },
  right: {
    width: 160,
    height: 600,
    adsense: 'RAIL_RIGHT',
    adsterra: 'rail-right-160x600',
    house: 'rail-right',
  },
  desktop: {
    width: 728,
    height: 90,
    adsense: 'ANCHOR_DESKTOP',
    adsterra: 'anchor-728x90',
    house: 'anchor',
  },
  mobile: {
    width: 320,
    height: 50,
    adsense: 'ANCHOR_MOBILE',
    adsterra: 'sticky-320x50',
    house: 'anchor',
  },
} as const;
export type Placement = keyof typeof PLACEMENTS;
export type AdProvider = 'adsense' | 'adsterra' | 'house' | 'placeholder' | 'none';
export const envValue = (env: AdEnv, key: string): string => String(env[key] ?? '').trim();

export function resolvePlacement(env: AdEnv, placement: Placement, houseAds: HouseAds = HOUSE_ADS) {
  const definition = PLACEMENTS[placement];
  const client = envValue(env, 'PUBLIC_ADSENSE_CLIENT');
  const slot = envValue(env, `PUBLIC_ADSENSE_SLOT_${definition.adsense}`);
  const adsterraKey = `PUBLIC_ADSTERRA_SLOT_${definition.adsterra.replace(/-/g, '_').toUpperCase()}`;
  const houseAd = houseAds[definition.house];
  const provider: AdProvider =
    client && slot
      ? 'adsense'
      : envValue(env, adsterraKey)
        ? 'adsterra'
        : houseAd
          ? 'house'
          : envValue(env, 'PUBLIC_AD_PLACEHOLDERS') === 'true'
            ? 'placeholder'
            : 'none';
  return { ...definition, provider, houseAd };
}

export function resolveSiteAds(env: AdEnv) {
  return {
    left: resolvePlacement(env, 'left'),
    right: resolvePlacement(env, 'right'),
    desktop: resolvePlacement(env, 'desktop'),
    mobile: resolvePlacement(env, 'mobile'),
  };
}

export function configuredAdSenseClient(env: AdEnv): string {
  return Object.keys(env).some(
    (key) => key.startsWith('PUBLIC_ADSENSE_SLOT_') && envValue(env, key),
  )
    ? envValue(env, 'PUBLIC_ADSENSE_CLIENT')
    : '';
}

/** Adsterra-only setups use the same existing consent banner as AdSense. */
export function requiresAdConsent(env: AdEnv): boolean {
  return !!(
    envValue(env, 'PUBLIC_GA_ID') ||
    configuredAdSenseClient(env) ||
    Object.keys(env).some((key) => key.startsWith('PUBLIC_ADSTERRA_SLOT_') && envValue(env, key))
  );
}
