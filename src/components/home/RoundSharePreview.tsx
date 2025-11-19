import { Devvit } from '@devvit/public-api';
import { WrappedFontText } from './FontText.js';
import { WrappedAnswerFontText } from './AnswerFontText.js';
import { ParchmentPanel } from './ParchmentPanel.js';
import { NavIconButton } from './NavIconButton.js';
import {
  computeParchmentLayout,
  PARCHMENT,
  RIDDLE_STYLE,
  type RiddleLayoutStyleOverrides,
} from './roundLayout.js';
import { CTA_BUTTON_HEIGHT_PX, CTA_BUTTON_WIDTH_PX, NAV_ICON_SIZE_PX } from './uiConstants.js';

interface RoundSharePreviewProps {
  question: string;
  answer: string;
  viewportHeight: number;
  background: {
    url: string;
    description: string;
  };
  onShare: () => void;
  onClose: () => void;
  isSharing: boolean;
  hasShared: boolean;
}

const SHARE_BUTTON_META = {
  url: 'post_button.png',
  imageWidth: 481,
  imageHeight: 181,
  description: 'Share your response to the subreddit',
} as const;

const SHARE_PREVIEW_RIDDLE_STYLE_OVERRIDES: RiddleLayoutStyleOverrides = {
  fontSize: 34,
  letterSpacing: -1.4,
  lineGap: 8,
  targetLinesMax: 6,
};

const SHARE_PREVIEW_LAYOUT = {
  horizontalPaddingFraction: 0.06,
  minHorizontalPaddingPx: 20,
  maxHorizontalPaddingPx: 60,
  topInsetFraction: 0.08,
  minTopInsetPx: 32,
  maxTopInsetPx: 110,
  shareButtonGapFraction: 0.045,
  minShareButtonGapPx: 20,
  maxShareButtonGapPx: 60,
  bottomInsetFraction: 0.06,
  minBottomInsetPx: 32,
  maxBottomInsetPx: 96,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function RoundSharePreview({
  question,
  answer,
  viewportHeight,
  background,
  onShare,
  onClose,
  isSharing,
  hasShared,
}: RoundSharePreviewProps) {
  const shareButtonWidth = `${CTA_BUTTON_WIDTH_PX}px` as Devvit.Blocks.SizeString;
  const shareButtonHeight = `${CTA_BUTTON_HEIGHT_PX}px` as Devvit.Blocks.SizeString;
  const navIconSize = `${NAV_ICON_SIZE_PX}px` as Devvit.Blocks.SizeString;
  const topInsetPx = Math.round(
    clamp(
      viewportHeight * SHARE_PREVIEW_LAYOUT.topInsetFraction,
      SHARE_PREVIEW_LAYOUT.minTopInsetPx,
      SHARE_PREVIEW_LAYOUT.maxTopInsetPx,
    ),
  );
  const horizontalInsetPx = Math.round(
    clamp(
      viewportHeight * SHARE_PREVIEW_LAYOUT.horizontalPaddingFraction,
      SHARE_PREVIEW_LAYOUT.minHorizontalPaddingPx,
      SHARE_PREVIEW_LAYOUT.maxHorizontalPaddingPx,
    ),
  );
  const shareButtonGapPx = Math.round(
    clamp(
      viewportHeight * SHARE_PREVIEW_LAYOUT.shareButtonGapFraction,
      SHARE_PREVIEW_LAYOUT.minShareButtonGapPx,
      SHARE_PREVIEW_LAYOUT.maxShareButtonGapPx,
    ),
  );
  const bottomInsetPx = Math.round(
    clamp(
      viewportHeight * SHARE_PREVIEW_LAYOUT.bottomInsetFraction,
      SHARE_PREVIEW_LAYOUT.minBottomInsetPx,
      SHARE_PREVIEW_LAYOUT.maxBottomInsetPx,
    ),
  );

  const questionStyle = { ...RIDDLE_STYLE, ...SHARE_PREVIEW_RIDDLE_STYLE_OVERRIDES };
  const layout = computeParchmentLayout(`${question}\n${answer}`, SHARE_PREVIEW_RIDDLE_STYLE_OVERRIDES);
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const contentWidth = Math.max(1, layout.width - PARCHMENT.padX * 2);
  const shareDisabled = isSharing || hasShared;

  const handleSharePress = () => {
    if (shareDisabled) {
      return;
    }
    console.log('[RoundSharePreview] share button pressed');
    onShare();
  };

  return (
    <zstack width="100%" height="100%">
      <image
        url={background.url}
        width="100%"
        height="100%"
        imageWidth={1536}
        imageHeight={1024}
        resizeMode="cover"
        description={background.description}
      />

      <vstack width="100%" height="100%" alignment="top center" gap="none">
        <spacer height={`${topInsetPx}px`} />
        <hstack width="100%" alignment="middle center" gap="none">
          <spacer width={`${horizontalInsetPx}px`} />
          <ParchmentPanel
            widthPx={layout.width}
            heightPx={layout.flyerHeight}
            innerHeightPx={layout.innerHeight}
            tiles={layout.tiles}
            padTopPx={padTop}
            padBottomPx={padBottom}
            contentGap="medium"
            needsScroll={layout.needsScroll}
          >
            <WrappedFontText
              text={question}
              maxWidth={contentWidth}
              color={questionStyle.color}
              fontSize={questionStyle.fontSize}
              letterSpacing={questionStyle.letterSpacing}
              lineGap={questionStyle.lineGap}
              align="center"
            />
            <WrappedAnswerFontText
              text={`“${answer}”`}
              maxWidth={contentWidth}
              fontSize={22}
              letterSpacing={-1}
              lineGap={26}
              color="#2b1e12"
              align="center"
            />
          </ParchmentPanel>
          <spacer width={`${horizontalInsetPx}px`} />
        </hstack>
        <spacer height={`${shareButtonGapPx}px`} />
        <zstack width={shareButtonWidth} height={shareButtonHeight}>
          <image
            url={SHARE_BUTTON_META.url}
            width="100%"
            height="100%"
            imageWidth={SHARE_BUTTON_META.imageWidth}
            imageHeight={SHARE_BUTTON_META.imageHeight}
            resizeMode="fit"
            description={SHARE_BUTTON_META.description}
            onPress={handleSharePress}
          />
          {shareDisabled && (
            <vstack
              width="100%"
              height="100%"
              alignment="middle center"
              backgroundColor="rgba(0,0,0,0.35)"
              padding="medium"
              gap="none"
            >
              <text size="medium" color="white">
                {isSharing ? 'Sharing…' : 'Shared'}
              </text>
            </vstack>
          )}
        </zstack>
        <spacer height={`${bottomInsetPx}px`} />
      </vstack>

      <hstack width="100%" padding="large" alignment="top end">
        <NavIconButton
          icon="close"
          size={navIconSize}
          onPress={() => {
            console.log('[RoundSharePreview] close icon pressed');
            onClose();
          }}
          description="Close preview and return home"
        />
      </hstack>
    </zstack>
  );
}
