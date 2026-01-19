import { Devvit } from '@devvit/public-api';
import type { RoundResult } from './roundTypes.js';
import { WrappedFontText, measureWrappedText } from './FontText.js';
import { WrappedAnswerFontText, measureAnswerWrappedText } from './AnswerFontText.js';
import { ParchmentPanel } from './ParchmentPanel.js';
import { NavIconButton } from './NavIconButton.js';
import {
  chooseResponsiveWidth,
  PARCHMENT,
  RIDDLE_STYLE,
  type RiddleLayoutStyleOverrides,
} from './roundLayout.js';
import {
  CTA_BOTTOM_INSET_PX,
  CTA_BUTTON_HEIGHT_PX,
  CTA_BUTTON_WIDTH_PX,
  NAV_ICON_SIZE_PX,
} from './uiConstants.js';

const ARETE_RIBBON = {
  widthRatio: 0.48,
  minWidthPx: 300,
  maxWidthPx: 600,
  heightRatio: 0.23,
  gapFraction: 0.015,
  minGapPx: 5,
  maxGapPx: 10,
} as const;

const ARETE_RIBBON_TEXT_STYLE = {
  fontSize: 26,
  letterSpacing: 0,
  lineGap: 3,
  color: '#3b1f0c',
} as const;

const ARETE_POINTS_TEXT_STYLE = {
  fontSize: 32,
  letterSpacing: 0,
  lineGap: 4,
  color: '#f8e7bb',
} as const;

const ARETE_POINTS_ICON = {
  url: 'Arete_coin.png',
  displaySizePx: 44,
  imageWidth: 250,
  imageHeight: 245,
  description: 'Arete coin reward',
} as const;
const SHOW_ANSWER_ANSWER_TEXT_STYLE = {
  fontSize: 20,
  letterSpacing: 0,
  lineGap: 28,
  color: '#2b1e12',
} as const;

const CTA_IMAGES = {
  debattle: {
    url: 'debattle_button.png',
    imageWidth: 481,
    imageHeight: 181,
    description: 'Review and share your answer',
  },
  tryAgain: {
    url: 'try_again_button.png',
    imageWidth: 1181,
    imageHeight: 442,
    description: 'Try another riddle',
  },
} as const;

const DECISION_DETAILS: Record<
  RoundResult['decision'],
  { label: string; shareable: boolean; background: { url: string; description: string } }
> = {
  open: {
    label: 'Door swings open',
    shareable: true,
    background: {
      url: 'background_3.png',
      description: 'Sunlit courtyard backdrop',
    },
  },
  ajar: {
    label: 'Door stands ajar',
    shareable: true,
    background: {
      url: 'background_4.png',
      description: 'Door standing slightly open',
    },
  },
  closed: {
    label: 'Door remains sealed',
    shareable: false,
    background: {
      url: 'background_2.png',
      description: 'Sealed door bathed in moonlight',
    },
  },
};

const SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES: RiddleLayoutStyleOverrides = {
  fontSize: 32,
  letterSpacing: -1.6,
  lineGap: 6,
};

const SHOW_ANSWER_LAYOUT = {
  maxAvailableParchmentFraction: 0.55,
  horizontalPaddingFraction: 0.03,
  maxHorizontalPaddingPx: 48,
  minHorizontalPaddingPx: 20,
  topSafeFraction: 0.06,
  maxTopSafePx: 96,
};

const SHOW_ANSWER_CTA_SCALE = 0.8;
const SHOW_ANSWER_CLOSE_SCALE = 0.8;
const SHOW_ANSWER_RIBBON_OVERLAP_PX = 0;
const RESULT_CONTENT_GAP_PX = 12;
const CTA_OVERLAY_TOP_PADDING_PX = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

interface RoundResultViewProps {
  result: RoundResult;
  fallbackQuestionText: string;
  viewportHeight: number;
  onExit: () => void;
  onShare: () => Promise<void>;
}

export function RoundResultView({
  result,
  fallbackQuestionText,
  viewportHeight,
  onExit,
  onShare,
}: RoundResultViewProps) {
  const decisionMeta = DECISION_DETAILS[result.decision];
  const isShareable = decisionMeta.shareable;
  const resultQuestion = result.questionText || fallbackQuestionText;
  const resultAnswer = result.answerText || 'No answer submitted.';

  const questionStyle = { ...RIDDLE_STYLE, ...SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES };
  const answerStyle = SHOW_ANSWER_ANSWER_TEXT_STYLE;
  const answerQuote = `“${resultAnswer}”`;
  const layoutMeasureText = `${resultQuestion}\n${resultAnswer}`;
  const displayParchmentWidth = chooseResponsiveWidth(layoutMeasureText, questionStyle);
  const displayContentWidth = Math.max(1, displayParchmentWidth - PARCHMENT.padX * 2);
  const questionMetrics = measureWrappedText({
    text: resultQuestion,
    maxWidth: displayContentWidth,
    fontSize: questionStyle.fontSize,
    letterSpacing: questionStyle.letterSpacing,
    lineGap: questionStyle.lineGap,
  });
  const answerMetrics = measureAnswerWrappedText({
    text: answerQuote,
    maxWidth: displayContentWidth,
    fontSize: answerStyle.fontSize,
    letterSpacing: answerStyle.letterSpacing,
    lineGap: answerStyle.lineGap,
  });
  const combinedContentHeight =
    questionMetrics.totalHeight + answerMetrics.totalHeight + RESULT_CONTENT_GAP_PX;
  const neededInner = combinedContentHeight + PARCHMENT.padY * 2;
  const minInner = Math.max(PARCHMENT.minHeight, PARCHMENT.capTop + PARCHMENT.capBottom);
  const maxInner = Math.max(minInner, PARCHMENT.maxHeight);
  const clampedInner = clamp(neededInner, minInner, maxInner);
  const middleBand = Math.max(0, clampedInner - PARCHMENT.capTop - PARCHMENT.capBottom);
  const tiles = middleBand > 0 ? Math.ceil(middleBand / PARCHMENT.midTile) : 0;
  const flyerHeight = PARCHMENT.capTop + tiles * PARCHMENT.midTile + PARCHMENT.capBottom;
  const extraPadY = Math.max(0, (flyerHeight - neededInner) / 2);
  const needsScroll = neededInner > flyerHeight;
  const layout = {
    width: displayParchmentWidth,
    contentWidth: displayContentWidth,
    innerHeight: flyerHeight,
    flyerHeight,
    tiles,
    extraPadY,
    needsScroll,
  };
  const aretePoints =
    typeof result.areteEvaluation?.totalPoints === 'number'
      ? result.areteEvaluation.totalPoints
      : null;
  const showPoints = aretePoints !== null;
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const horizontalPadding = Math.round(
    clamp(
      viewportHeight * SHOW_ANSWER_LAYOUT.horizontalPaddingFraction,
      SHOW_ANSWER_LAYOUT.minHorizontalPaddingPx,
      SHOW_ANSWER_LAYOUT.maxHorizontalPaddingPx,
    ),
  );
  const horizontalInset = `${horizontalPadding}px` as Devvit.Blocks.SizeString;
  const topSafeSpacerPx = Math.round(
    clamp(
      viewportHeight * SHOW_ANSWER_LAYOUT.topSafeFraction,
      32,
      SHOW_ANSWER_LAYOUT.maxTopSafePx,
    ),
  );
  const topSafeSpacer = `${topSafeSpacerPx}px` as Devvit.Blocks.SizeString;
  const ctaButtonWidthPx = Math.round(CTA_BUTTON_WIDTH_PX * SHOW_ANSWER_CTA_SCALE);
  const ctaButtonHeightPx = Math.round(CTA_BUTTON_HEIGHT_PX * SHOW_ANSWER_CTA_SCALE);
  const ctaButtonWidth = `${ctaButtonWidthPx}px` as Devvit.Blocks.SizeString;
  const ctaButtonHeight = `${ctaButtonHeightPx}px` as Devvit.Blocks.SizeString;
  const ctaButtonTopGapPx = Math.round(
    clamp(
      viewportHeight * ARETE_RIBBON.gapFraction,
      ARETE_RIBBON.minGapPx,
      ARETE_RIBBON.maxGapPx,
    ),
  );
  const pointsRowHeightPx = showPoints
    ? Math.max(ARETE_POINTS_ICON.displaySizePx, ARETE_POINTS_TEXT_STYLE.fontSize)
    : 0;
  const overlayTopPadding = `${CTA_OVERLAY_TOP_PADDING_PX}px` as Devvit.Blocks.SizeString;
  const ctaOverlayHeightPx =
    CTA_OVERLAY_TOP_PADDING_PX +
    (showPoints ? pointsRowHeightPx + ctaButtonTopGapPx : 0) +
    ctaButtonHeightPx +
    CTA_BOTTOM_INSET_PX;
  const ctaOverlayHeight = `${ctaOverlayHeightPx}px` as Devvit.Blocks.SizeString;
  const areteRibbonWidthPx = Math.round(
    Math.max(
      ARETE_RIBBON.minWidthPx,
      Math.min(layout.width * ARETE_RIBBON.widthRatio, ARETE_RIBBON.maxWidthPx),
    ),
  );
  const areteRibbonWidth = `${areteRibbonWidthPx}px` as Devvit.Blocks.SizeString;
  const areteRibbonHeightPx = Math.round(areteRibbonWidthPx * ARETE_RIBBON.heightRatio);
  const areteRibbonHeight = `${areteRibbonHeightPx}px` as Devvit.Blocks.SizeString;
  const availableHeightPx = Math.max(1, viewportHeight - topSafeSpacerPx - ctaOverlayHeightPx);
  const maxParchmentHeightByFraction =
    availableHeightPx * SHOW_ANSWER_LAYOUT.maxAvailableParchmentFraction;
  const maxParchmentHeightByRibbon = Math.max(1, availableHeightPx - areteRibbonHeightPx);
  const maxParchmentHeight = Math.min(maxParchmentHeightByFraction, maxParchmentHeightByRibbon);
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const ctaBottomInset = `${CTA_BOTTOM_INSET_PX}px` as Devvit.Blocks.SizeString;
  const ribbonParchmentOffsetPx = Math.max(
    0,
    areteRibbonHeightPx - SHOW_ANSWER_RIBBON_OVERLAP_PX,
  );
  const ribbonParchmentHeightPx = Math.max(
    areteRibbonHeightPx,
    ribbonParchmentOffsetPx + clampedHeight,
  );
  const ribbonParchmentHeight = `${ribbonParchmentHeightPx}px` as Devvit.Blocks.SizeString;
  const parchmentOffset = `${ribbonParchmentOffsetPx}px` as Devvit.Blocks.SizeString;
  const ribbonTextMaxWidth = Math.max(120, Math.round(areteRibbonWidthPx * 0.76));
  const pointsTextMaxWidth = Math.max(140, Math.round(displayParchmentWidth * 0.38));
  const pointsIconSize = `${ARETE_POINTS_ICON.displaySizePx}px` as Devvit.Blocks.SizeString;
  const ribbonText = decisionMeta.label;
  const background = decisionMeta.background;
  const closeButtonSize =
    `${Math.round(NAV_ICON_SIZE_PX * SHOW_ANSWER_CLOSE_SCALE)}px` as Devvit.Blocks.SizeString;
  const ctaImageMeta = isShareable ? CTA_IMAGES.debattle : CTA_IMAGES.tryAgain;
  const primaryButtonDescription = isShareable
    ? 'Review your answer before sharing'
    : 'Try another riddle';
  const shouldShowCloseButton = isShareable;

  const handlePrimaryButtonPress = async () => {
    if (!isShareable) {
      console.log('[RoundResultView] try again button pressed');
      onExit();
      return;
    }
    console.log('[RoundResultView] debattle button pressed - sharing');
    try {
      await onShare();
    } catch (err) {
      console.error('[RoundResultView] debattle share failed', err);
    }
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
        <spacer height={topSafeSpacer} />
        <vstack width="100%" alignment="top center" gap="none" grow>
          <spacer grow />
          <hstack width="100%" alignment="middle center" gap="none">
            <spacer width={horizontalInset} />
            <vstack width="100%" alignment="top center" gap="none">
              <zstack width="100%" height={ribbonParchmentHeight} alignment="top center">
                <vstack width="100%" alignment="top center" gap="none">
                  <zstack width={areteRibbonWidth} height={areteRibbonHeight} alignment="middle center">
                    <image
                      url="parchment_2.png"
                      width="100%"
                      height="100%"
                      imageWidth={1181}
                      imageHeight={1181}
                      resizeMode="fit"
                      description="Scroll ribbon backdrop"
                    />
                    <vstack width="80%" alignment="middle center" gap="none">
                      <WrappedFontText
                        text={ribbonText}
                        maxWidth={ribbonTextMaxWidth}
                        color={ARETE_RIBBON_TEXT_STYLE.color}
                        fontSize={ARETE_RIBBON_TEXT_STYLE.fontSize}
                        letterSpacing={ARETE_RIBBON_TEXT_STYLE.letterSpacing}
                        lineGap={ARETE_RIBBON_TEXT_STYLE.lineGap}
                        align="center"
                      />
                    </vstack>
                  </zstack>
                </vstack>

                <vstack width="100%" alignment="top center" gap="none">
                  <spacer width="100%" height={parchmentOffset} />
                  <ParchmentPanel
                    widthPx={displayParchmentWidth}
                    heightPx={clampedHeight}
                    innerHeightPx={layout.innerHeight}
                    tiles={layout.tiles}
                    padTopPx={padTop}
                    padBottomPx={padBottom}
                    needsScroll={layout.needsScroll}
                    contentGap="small"
                  >
                    <WrappedFontText
                      text={resultQuestion}
                      maxWidth={displayContentWidth}
                      color={questionStyle.color}
                      fontSize={questionStyle.fontSize}
                      letterSpacing={questionStyle.letterSpacing}
                      lineGap={questionStyle.lineGap}
                      align="center"
                    />
                    <WrappedAnswerFontText
                      text={answerQuote}
                      maxWidth={displayContentWidth}
                      color={SHOW_ANSWER_ANSWER_TEXT_STYLE.color}
                      fontSize={SHOW_ANSWER_ANSWER_TEXT_STYLE.fontSize}
                      letterSpacing={SHOW_ANSWER_ANSWER_TEXT_STYLE.letterSpacing}
                      lineGap={SHOW_ANSWER_ANSWER_TEXT_STYLE.lineGap}
                      align="center"
                    />
                  </ParchmentPanel>
                </vstack>
              </zstack>

            </vstack>
            <spacer width={horizontalInset} />
          </hstack>
          <spacer grow />
        </vstack>
        <spacer height={ctaOverlayHeight} />
      </vstack>

      <vstack width="100%" height="100%" alignment="bottom center" gap="none">
        <spacer grow />
        <vstack
          width="100%"
          alignment="middle center"
          gap="none"
          padding={{ top: overlayTopPadding, bottom: ctaBottomInset }}
        >
          {showPoints && (
            <vstack width="100%" alignment="middle center">
              <hstack alignment="middle center" gap="small">
                <WrappedFontText
                  text={`+ ${aretePoints}`}
                  maxWidth={pointsTextMaxWidth}
                  color={ARETE_POINTS_TEXT_STYLE.color}
                  fontSize={ARETE_POINTS_TEXT_STYLE.fontSize}
                  letterSpacing={ARETE_POINTS_TEXT_STYLE.letterSpacing}
                  lineGap={ARETE_POINTS_TEXT_STYLE.lineGap}
                  align="center"
                />
                <image
                  url={ARETE_POINTS_ICON.url}
                  width={pointsIconSize}
                  height={pointsIconSize}
                  imageWidth={ARETE_POINTS_ICON.imageWidth}
                  imageHeight={ARETE_POINTS_ICON.imageHeight}
                  resizeMode="fit"
                  description={ARETE_POINTS_ICON.description}
                />
              </hstack>
            </vstack>
          )}
          {showPoints && <spacer height={`${ctaButtonTopGapPx}px`} />}
          <zstack width={ctaButtonWidth} height={ctaButtonHeight}>
            <image
              url={ctaImageMeta.url}
              width="100%"
              height="100%"
              imageWidth={ctaImageMeta.imageWidth}
              imageHeight={ctaImageMeta.imageHeight}
              resizeMode="fit"
              description={primaryButtonDescription}
              onPress={handlePrimaryButtonPress}
            />
          </zstack>
        </vstack>
      </vstack>

      {shouldShowCloseButton && (
        <hstack width="100%" padding="large" gap="small" alignment="middle center">
          <spacer grow />
          <NavIconButton
            icon="close"
            size={closeButtonSize}
            onPress={() => {
              console.log('[RoundResultView] close icon pressed');
              onExit();
            }}
            description="Close results and return home"
          />
        </hstack>
      )}
    </zstack>
  );
}
