import type { RedisClient, TriggerContext } from '@devvit/public-api';
import { UI_ASSET_PATHS, type UiAssetMap } from '../types/uiAssets.js';

const UI_ASSET_CACHE_KEY = 'debattle:ui:assets:v1';

const coerceUiAssetMap = (assetMap: Record<string, string>): UiAssetMap => {
  return UI_ASSET_PATHS.reduce((acc, path) => {
    acc[path] = typeof assetMap[path] === 'string' ? assetMap[path] : '';
    return acc;
  }, {} as UiAssetMap);
};

const isUiAssetMap = (value: unknown): value is UiAssetMap => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return UI_ASSET_PATHS.every((path) => typeof record[path] === 'string');
};

export const refreshUiAssets = async (context: TriggerContext): Promise<UiAssetMap> => {
  const rawMap = context.assets.getURL(UI_ASSET_PATHS, { webView: true }) as Record<string, string>;
  const assets = coerceUiAssetMap(rawMap);
  const missing = UI_ASSET_PATHS.filter((path) => !assets[path]);
  if (missing.length) {
    console.warn('[ui-assets] Missing asset URLs:', missing.join(', '));
  }
  await context.redis.set(UI_ASSET_CACHE_KEY, JSON.stringify(assets));
  return assets;
};

export const getCachedUiAssets = async (redis: RedisClient): Promise<UiAssetMap | null> => {
  const raw = await redis.get(UI_ASSET_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isUiAssetMap(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore parse errors and fall back to local assets.
  }
  return null;
};
