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
                  <text size="medium" color="#3b1f0c">
                    Nice expression!
                  </text>
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
