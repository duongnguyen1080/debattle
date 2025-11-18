import { Devvit } from '@devvit/public-api';
import type { RoundResult } from './roundTypes.js';
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
import { CTA_BOTTOM_INSET_PX, CTA_BUTTON_HEIGHT_PX, CTA_BUTTON_WIDTH_PX } from './uiConstants.js';

const ARETE_RIBBON = {
  widthRatio: 0.38,
  minWidthPx: 250,
  maxWidthPx: 460,
  heightRatio: 0.23,
  gapFraction: 0.015,
  minGapPx: 6,
  maxGapPx: 12,
} as const;

const ARETE_RIBBON_TEXT_STYLE = {
  fontSize: 28,
  letterSpacing: -1.1,
  lineGap: 3,
  color: '#3b1f0c',
} as const;

const ARETE_POINTS_TEXT_STYLE = {
  fontSize: 36,
  letterSpacing: -1.4,
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

const DECISION_BACKGROUNDS: Record<RoundResult['decision'], { url: string; description: string }> = {
  open: {
    url: 'background_3.png',
    description: 'Sunlit courtyard backdrop',
  },
  ajar: {
    url: 'background_4.png',
    description: 'Door standing slightly open',
  },
  closed: {
    url: 'background_2.png',
    description: 'Sealed door bathed in moonlight',
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

interface RoundResultViewProps {
  result: RoundResult;
  fallbackQuestionText: string;
  viewportHeight: number;
  onExit: () => void;
  onShare: () => void;
  isSharing: boolean;
  hasShared: boolean;
}

export function RoundResultView({
  result,
  fallbackQuestionText,
  viewportHeight,
  onExit,
  onShare,
  isSharing,
  hasShared,
}: RoundResultViewProps) {
  const resultQuestion = result.questionText || fallbackQuestionText;
  const resultAnswer = result.answerText || 'No answer submitted.';
  const resultMeasureText = `${resultQuestion}\n${resultAnswer}`;
  const ribbonFeedback = result.areteEvaluation?.feedback || result.feedback || 'Nice expression!';
  const aretePoints =
    typeof result.areteEvaluation?.totalPoints === 'number'
      ? result.areteEvaluation.totalPoints
      : null;
  const showAnswerRiddleStyle = { ...RIDDLE_STYLE, ...SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES };
  const layout = computeParchmentLayout(resultMeasureText, SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES);
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
  const availableHeightPx = Math.max(1, viewportHeight - topSafeSpacerPx - CTA_BOTTOM_INSET_PX);
  const maxParchmentHeight =
    availableHeightPx * SHOW_ANSWER_LAYOUT.maxAvailableParchmentFraction;
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const ctaBottomInset = `${CTA_BOTTOM_INSET_PX}px` as Devvit.Blocks.SizeString;
  const debattleButtonWidth = `${CTA_BUTTON_WIDTH_PX}px` as Devvit.Blocks.SizeString;
  const debattleButtonHeight = `${CTA_BUTTON_HEIGHT_PX}px` as Devvit.Blocks.SizeString;
  const ribbonToParchmentGapPx = Math.round(
    clamp(
      viewportHeight * ARETE_RIBBON.gapFraction,
      ARETE_RIBBON.minGapPx,
      ARETE_RIBBON.maxGapPx,
    ),
  );
  const debattleButtonTopGapPx = ribbonToParchmentGapPx;
  const areteRibbonWidthPx = Math.round(
    Math.max(
      ARETE_RIBBON.minWidthPx,
      Math.min(layout.width * ARETE_RIBBON.widthRatio, ARETE_RIBBON.maxWidthPx),
    ),
  );
  const areteRibbonWidth = `${areteRibbonWidthPx}px` as Devvit.Blocks.SizeString;
  const areteRibbonHeightPx = Math.round(areteRibbonWidthPx * ARETE_RIBBON.heightRatio);
  const areteRibbonHeight = `${areteRibbonHeightPx}px` as Devvit.Blocks.SizeString;
  const ribbonTextMaxWidth = Math.max(120, Math.round(areteRibbonWidthPx * 0.76));
  const pointsTextMaxWidth = Math.max(140, Math.round(layout.width * 0.38));
  const pointsIconSize = `${ARETE_POINTS_ICON.displaySizePx}px` as Devvit.Blocks.SizeString;
  const background = DECISION_BACKGROUNDS[result.decision];
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
              <vstack width="100%" alignment="top center" gap="none">
                <zstack width={areteRibbonWidth} height={areteRibbonHeight} alignment="middle center">
                  <image
                    url="parchment_2.png"
                    width="100%"
                    height="100%"
                    imageWidth={1181}
                    imageHeight={1181}
                    resizeMode="fit"
                    description="Arete feedback scroll"
                  />
                  <vstack width="80%" alignment="middle center" gap="none">
                    <WrappedFontText
                      text={ribbonFeedback}
                      maxWidth={ribbonTextMaxWidth}
                      color={ARETE_RIBBON_TEXT_STYLE.color}
                      fontSize={ARETE_RIBBON_TEXT_STYLE.fontSize}
                      letterSpacing={ARETE_RIBBON_TEXT_STYLE.letterSpacing}
                      lineGap={ARETE_RIBBON_TEXT_STYLE.lineGap}
                      align="center"
                    />
                  </vstack>
                </zstack>
                <spacer width="100%" height={`${ribbonToParchmentGapPx}px`} />
              </vstack>

              <ParchmentPanel
                widthPx={layout.width}
                heightPx={clampedHeight}
                innerHeightPx={layout.innerHeight}
                tiles={layout.tiles}
                padTopPx={padTop}
                padBottomPx={padBottom}
                needsScroll={layout.needsScroll}
                contentGap="medium"
              >
                <WrappedFontText
                  text={resultQuestion}
                  maxWidth={layout.contentWidth}
                  color={showAnswerRiddleStyle.color}
                  fontSize={showAnswerRiddleStyle.fontSize}
                  letterSpacing={showAnswerRiddleStyle.letterSpacing}
                  lineGap={showAnswerRiddleStyle.lineGap}
                  align="center"
                />
                <WrappedAnswerFontText
                  text={`“${resultAnswer}”`}
                  maxWidth={layout.contentWidth}
                  fontSize={20}
                  letterSpacing={-1.2}
                  lineGap={30}
                  color="#2b1e12"
                  align="center"
                />
              </ParchmentPanel>

              {aretePoints !== null && (
                <vstack
                  width="100%"
                  alignment="middle center"
                  padding={{ top: 'xsmall', bottom: 'xsmall' }}
                >
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

              <spacer width="100%" height={`${debattleButtonTopGapPx}px`} />

              <zstack width={debattleButtonWidth} height={debattleButtonHeight}>
                <image
                  url="debattle_button.png"
                  width="100%"
                  height="100%"
                  imageWidth={481}
                  imageHeight={181}
                  resizeMode="fit"
                  description="Share to subreddit button"
                  onPress={() => {
                    if (isSharing || hasShared) {
                      console.log('[RoundResultView] debattle button pressed but action is disabled', { isSharing, hasShared });
                      return;
                    }
                    console.log('[RoundResultView] debattle button pressed');
                    onShare();
                  }}
                />
                {(isSharing || hasShared) && (
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
            </vstack>
            <spacer width={horizontalInset} />
          </hstack>
          <spacer grow />
        </vstack>
        <spacer height={ctaBottomInset} />
      </vstack>

      <hstack width="100%" padding="large" gap="small" alignment="middle center">
        <spacer grow />
        <NavIconButton
          icon="close"
          onPress={() => {
            console.log('[RoundResultView] close icon pressed');
            onExit();
          }}
          description="Close results and return home"
        />
      </hstack>
    </zstack>
  );
}
