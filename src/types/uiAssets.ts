export const UI_ASSET_PATHS = [
  'background_1.png',
  'background_2.png',
  'background_3.png',
  'background_4.png',
] as const;

export type UiAssetPath = (typeof UI_ASSET_PATHS)[number];
export type UiAssetMap = Record<UiAssetPath, string>;
