import { Devvit } from '@devvit/public-api';
import type { RoundResult } from './roundTypes.js';
import { WrappedFontText } from './FontText.js';
import { WrappedAnswerFontText } from './AnswerFontText.js';
import { ParchmentPanel } from './ParchmentPanel.js';
import { RoundNavBar } from './RoundNavBar.js';
import { computeParchmentLayout, LAYOUT, PARCHMENT, RIDDLE_STYLE } from './roundLayout.js';

interface RoundResultViewProps {
  result: RoundResult;
  fallbackQuestionText: string;
  viewportHeight: number;
  onExit: () => void;
}

export function RoundResultView({
  result,
  fallbackQuestionText,
  viewportHeight,
  onExit,
}: RoundResultViewProps) {
  const resultQuestion = result.questionText || fallbackQuestionText;
  const resultAnswer = result.answerText || 'No answer submitted.';
  const resultMeasureText = `${resultQuestion}\n${resultAnswer}`;
  const maxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
  const layout = computeParchmentLayout(resultMeasureText);
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const parchmentOffset = Math.max(0, (maxParchmentHeight - clampedHeight) / 3);
  const horizontalPadding = Math.round(Math.max(16, Math.min(36, viewportHeight * 0.02)));
  const bottomPadding = Math.round(Math.max(20, Math.min(48, viewportHeight * 0.05)));
  const horizontalInset = `${horizontalPadding}px` as Devvit.Blocks.SizeString;
  const bottomInset = `${bottomPadding}px` as Devvit.Blocks.SizeString;

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

      <vstack width="100%" height="100%" alignment="top center" gap="none">
        <hstack width="100%" alignment="top center" gap="none">
          <spacer width={horizontalInset} />
          <vstack alignment="top center" gap="small" grow height="100%">
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

            <vstack width="100%" alignment="top center" gap="none" paddingTop={`${parchmentOffset}px`}>
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
                <text size="large" color="#4b2d15">
                  Nice expression!
                </text>
                <WrappedFontText
                  text={resultQuestion}
                  maxWidth={layout.contentWidth}
                  color={RIDDLE_STYLE.color}
                  fontSize={RIDDLE_STYLE.fontSize}
                  letterSpacing={RIDDLE_STYLE.letterSpacing}
                  lineGap={RIDDLE_STYLE.lineGap}
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
            </vstack>

            <vstack alignment="middle center" gap="xsmall">
              <text size="large">Score: {result.score.total}/15</text>
              <text size="medium" color="secondary">Decision: {result.decision}</text>
              <text size="small" color="secondary">Arete: “{result.feedback}”</text>
            </vstack>

            <spacer grow />

            <button appearance="primary" width="60%" onPress={onExit}>
              🏠 Back to Home
            </button>
            <spacer height={bottomInset} />
          </vstack>
          <spacer width={horizontalInset} />
        </hstack>
      </vstack>
    </zstack>
  );
}
