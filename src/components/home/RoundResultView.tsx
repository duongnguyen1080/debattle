import { Devvit } from '@devvit/public-api';
import type { RoundResult } from './roundTypes.js';
import { WrappedFontText } from './FontText.js';
import { WrappedAnswerFontText } from './AnswerFontText.js';
import { ParchmentPanel } from './ParchmentPanel.js';
import { RoundNavBar } from './RoundNavBar.js';
import {
  computeParchmentLayout,
  LAYOUT,
  PARCHMENT,
  RIDDLE_STYLE,
  type RiddleLayoutStyleOverrides,
} from './roundLayout.js';

const ARETE_RIBBON = {
  widthRatio: 0.44,
  minWidthPx: 280,
  maxWidthPx: 500,
  heightRatio: 0.27,
  gapFraction: 0.02,
  minGapPx: 6,
  maxGapPx: 14,
} as const;

const ARETE_RIBBON_TEXT_STYLE = {
  fontSize: 32,
  letterSpacing: -1.2,
  lineGap: 4,
  color: '#3b1f0c',
} as const;

const ARETE_POINTS_TEXT_STYLE = {
  fontSize: 44,
  letterSpacing: -1.6,
  lineGap: 6,
  color: '#f8e7bb',
} as const;

const ARETE_POINTS_ICON = {
  url: 'Arete_coin.png',
  displaySizePx: 52,
  imageWidth: 250,
  imageHeight: 245,
  description: 'Arete coin reward',
} as const;

const SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES: RiddleLayoutStyleOverrides = {
  fontSize: 34,
  letterSpacing: -1.6,
  lineGap: 8,
};

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
  const maxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
  const showAnswerRiddleStyle = { ...RIDDLE_STYLE, ...SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES };
  const layout = computeParchmentLayout(resultMeasureText, SHOW_ANSWER_RIDDLE_STYLE_OVERRIDES);
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const horizontalPadding = Math.round(Math.max(16, Math.min(36, viewportHeight * 0.02)));
  const approxViewWidthPx = layout.width + horizontalPadding * 2;
  const horizontalInset = `${horizontalPadding}px` as Devvit.Blocks.SizeString;
  const topSafeSpacerPx = Math.round(Math.max(24, Math.min(72, viewportHeight * 0.04)));
  const bottomSafeSpacerPx = Math.round(Math.max(32, Math.min(80, viewportHeight * 0.06)));
  const topSafeSpacer = `${topSafeSpacerPx}px` as Devvit.Blocks.SizeString;
  const bottomSafeSpacer = `${bottomSafeSpacerPx}px` as Devvit.Blocks.SizeString;
  const targetButtonWidthPx = approxViewWidthPx * 0.3;
  const buttonAspectRatio = 181 / 481;
  const maxButtonHeightPx = Math.max(1, viewportHeight * 0.2);
  let debattleButtonWidthPx = Math.max(1, targetButtonWidthPx);
  let debattleButtonHeightPx = debattleButtonWidthPx * buttonAspectRatio;
  if (debattleButtonHeightPx > maxButtonHeightPx) {
    debattleButtonHeightPx = maxButtonHeightPx;
    debattleButtonWidthPx = debattleButtonHeightPx / buttonAspectRatio;
  }
  debattleButtonWidthPx = Math.round(debattleButtonWidthPx);
  debattleButtonHeightPx = Math.round(debattleButtonHeightPx);
  const debattleButtonWidth = `${debattleButtonWidthPx}px` as Devvit.Blocks.SizeString;
  const debattleButtonHeight = `${debattleButtonHeightPx}px` as Devvit.Blocks.SizeString;
  const debattleButtonTopGapPx = Math.round(Math.max(12, Math.min(layout.flyerHeight * 0.085, 36)));
  const ribbonToParchmentGapPx = 2;
  const areteRibbonWidthPx = Math.round(
    Math.max(
      ARETE_RIBBON.minWidthPx,
      Math.min(layout.width * ARETE_RIBBON.widthRatio, ARETE_RIBBON.maxWidthPx),
    ),
  );
  const areteRibbonWidth = `${areteRibbonWidthPx}px` as Devvit.Blocks.SizeString;
  const areteRibbonHeightPx = Math.round(areteRibbonWidthPx * ARETE_RIBBON.heightRatio);
  const areteRibbonHeight = `${areteRibbonHeightPx}px` as Devvit.Blocks.SizeString;
  const ribbonTextMaxWidth = Math.max(120, Math.round(areteRibbonWidthPx * 0.78));
  const pointsTextMaxWidth = Math.max(140, Math.round(layout.width * 0.45));
  const pointsIconSize = `${ARETE_POINTS_ICON.displaySizePx}px` as Devvit.Blocks.SizeString;
  return (
    <zstack width="100%" height="100%">
      <image
        url="background_3.png"
        width="100%"
        height="100%"
        imageWidth={1536}
        imageHeight={1024}
        resizeMode="cover"
        description="Sunlit courtyard backdrop"
      />

      <vstack width="100%" height="100%" alignment="middle center" gap="none">
        <spacer height={topSafeSpacer} />
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
              <vstack width="100%" alignment="middle center" padding={{ top: 'small', bottom: 'small' }}>
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
        <spacer height={bottomSafeSpacer} />
      </vstack>

      <vstack width="100%" height="100%" alignment="top center" gap="none">
        <RoundNavBar
          viewportHeight={viewportHeight}
          onBack={() => {
            console.log('[RoundResultView] back icon pressed');
            onExit();
          }}
          rightIcons={[
            {
              icon: 'profile',
              onPress: () => {
                console.log('[RoundResultView] profile icon pressed');
              },
            },
            {
              icon: 'info',
              onPress: () => {
                console.log('[RoundResultView] info icon pressed');
              },
            },
          ]}
        />
      </vstack>
    </zstack>
  );
}
