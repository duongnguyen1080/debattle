import { Devvit } from '@devvit/public-api';
import type { User } from '../../types/index.js';
import { LEVEL_TIERS } from '../../types/index.js';
import { WrappedFontText } from '../typography/FontText.js';
import { NavIconButton } from '../ui/NavIconButton.js';
import { CTA_BOTTOM_INSET_PX, NAV_ICON_SIZE_PX } from '../play/playLayout.js';

interface AchievementsScreenProps {
  currentUser: User | null;
  onBack: () => void;
  viewportHeight?: number;
}

const BACKGROUND = {
  url: 'background_2.png',
  imageWidth: 1536,
  imageHeight: 1024,
  description: 'Ancient doorway backdrop',
} as const;

const BADGE_IMAGE = {
  url: 'rectangle_badge.png',
  imageWidth: 1571,
  imageHeight: 504,
  description: 'Level badge',
} as const;

const COIN_ICON = {
  url: 'Arete_coin.png',
  imageWidth: 250,
  imageHeight: 245,
  description: 'Arete coin',
} as const;

const TITLE_COLOR = '#d6b25f';
const CARD_TEXT_COLOR = '#2b1e12';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function sanitizeAscii(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

export function AchievementsScreen({
  currentUser,
  onBack,
  viewportHeight = 1024,
}: AchievementsScreenProps) {
  const safeHeight = viewportHeight || 1024;
  const badgeWidthPx = Math.round(clamp(safeHeight * 0.52, 240, 640));
  const badgeHeightPx = Math.round(
    badgeWidthPx * (BADGE_IMAGE.imageHeight / BADGE_IMAGE.imageWidth)
  );
  const badgeWidth = `${badgeWidthPx}px` as Devvit.Blocks.SizeString;
  const badgeHeight = `${badgeHeightPx}px` as Devvit.Blocks.SizeString;
  const topInset = `${Math.round(clamp(safeHeight * 0.06, 28, 64))}px` as Devvit.Blocks.SizeString;
  const titleGap = `${Math.round(clamp(safeHeight * 0.03, 12, 24))}px` as Devvit.Blocks.SizeString;
  const pointsGap = `${Math.round(clamp(safeHeight * 0.03, 12, 24))}px` as Devvit.Blocks.SizeString;
  const bottomInset = `${CTA_BOTTOM_INSET_PX}px` as Devvit.Blocks.SizeString;
  const coinSizePx = Math.round(clamp(safeHeight * 0.05, 28, 48));
  const coinSize = `${coinSizePx}px` as Devvit.Blocks.SizeString;
  const closeButtonSize = `${Math.round(NAV_ICON_SIZE_PX * 0.8)}px` as Devvit.Blocks.SizeString;

  const titleFontSize = Math.round(clamp(safeHeight * 0.055, 30, 56));
  const levelFontSize = Math.round(clamp(safeHeight * 0.034, 16, 30));
  const flairFontSize = Math.round(clamp(safeHeight * 0.052, 24, 48));
  const pointsFontSize = Math.round(clamp(safeHeight * 0.05, 24, 42));

  const titleMaxWidth = Math.round(badgeWidthPx * 1.05);
  const badgeTextMaxWidth = Math.round(badgeWidthPx * 0.88);
  const pointsTextMaxWidth = Math.round(badgeWidthPx * 0.35);

  const level = currentUser?.level ?? 1;
  const xp = currentUser?.xp ?? 0;
  const tier = LEVEL_TIERS.find(tierEntry => tierEntry.level === level);
  const fallbackFlair = sanitizeAscii(tier?.flair ?? 'Debattler') || 'Debattler';
  const displayFlair = sanitizeAscii(currentUser?.flair ?? '') || fallbackFlair;

  return (
    <zstack width="100%" height="100%">
      <image
        url={BACKGROUND.url}
        width="100%"
        height="100%"
        imageWidth={BACKGROUND.imageWidth}
        imageHeight={BACKGROUND.imageHeight}
        resizeMode="cover"
        description={BACKGROUND.description}
      />

      <vstack width="100%" height="100%" alignment="top center" gap="none">
        <spacer height={topInset} />
        <vstack width="100%" alignment="top center" gap="none" grow>
          <WrappedFontText
            text="My Achievements"
            maxWidth={titleMaxWidth}
            color={TITLE_COLOR}
            fontSize={titleFontSize}
            letterSpacing={-1}
            lineGap={6}
            align="center"
          />
          <spacer height={titleGap} />
          <zstack width={badgeWidth} height={badgeHeight} alignment="middle center">
            <image
              url={BADGE_IMAGE.url}
              width="100%"
              height="100%"
              imageWidth={BADGE_IMAGE.imageWidth}
              imageHeight={BADGE_IMAGE.imageHeight}
              resizeMode="fit"
              description={BADGE_IMAGE.description}
            />
            <vstack width="80%" alignment="middle center" gap="small">
              <WrappedFontText
                text={`Level ${level}`}
                maxWidth={badgeTextMaxWidth}
                color={CARD_TEXT_COLOR}
                fontSize={levelFontSize}
                letterSpacing={-1}
                lineGap={4}
                align="center"
              />
              <WrappedFontText
                text={displayFlair}
                maxWidth={badgeTextMaxWidth}
                color={CARD_TEXT_COLOR}
                fontSize={flairFontSize}
                letterSpacing={-2}
                lineGap={6}
                align="center"
              />
            </vstack>
          </zstack>
          <spacer height={pointsGap} />
          <hstack alignment="middle center" gap="small">
            <WrappedFontText
              text={`${xp}`}
              maxWidth={pointsTextMaxWidth}
              color={TITLE_COLOR}
              fontSize={pointsFontSize}
              letterSpacing={-1}
              lineGap={4}
              align="center"
            />
            <image
              url={COIN_ICON.url}
              width={coinSize}
              height={coinSize}
              imageWidth={COIN_ICON.imageWidth}
              imageHeight={COIN_ICON.imageHeight}
              resizeMode="fit"
              description={COIN_ICON.description}
            />
          </hstack>
          {!currentUser && (
            <vstack width="100%" alignment="middle center" gap="none">
              <spacer height={`${Math.round(clamp(safeHeight * 0.02, 8, 16))}px`} />
              <text size="small" color="secondary">
                Sign in to view your achievements.
              </text>
            </vstack>
          )}
        </vstack>
        <spacer height={bottomInset} />
      </vstack>

      <hstack width="100%" padding="large" gap="small" alignment="middle center">
        <spacer grow />
        <NavIconButton
          icon="close"
          size={closeButtonSize}
          onPress={() => {
            console.log('[AchievementsScreen] close icon pressed');
            onBack();
          }}
          description="Close and return home"
        />
      </hstack>
    </zstack>
  );
}
