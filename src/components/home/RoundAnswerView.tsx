import { Devvit } from '@devvit/public-api';
import { WrappedFontText } from './FontText.js';
import { ParchmentPanel } from './ParchmentPanel.js';
import { RoundNavBar } from './RoundNavBar.js';
import { computeParchmentLayout, LAYOUT, PARCHMENT, RIDDLE_STYLE } from './roundLayout.js';

interface RoundAnswerViewProps {
  riddleText: string;
  viewportHeight: number;
  isSubmitting: boolean;
  onPromptAnswer: () => void;
  onBack: () => void;
}

export function RoundAnswerView({
  riddleText,
  viewportHeight,
  isSubmitting,
  onPromptAnswer,
  onBack,
}: RoundAnswerViewProps) {
  const { color, fontSize, lineGap, letterSpacing } = RIDDLE_STYLE;
  const maxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
  const buttonGap = viewportHeight * LAYOUT.buttonGapFraction;
  const layout = computeParchmentLayout(riddleText);
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const parchmentOffset = Math.max(0, (maxParchmentHeight - clampedHeight) / 3);
  const navContentGap = Math.round(Math.max(8, Math.min(18, viewportHeight * 0.012)));
  const parchmentTopSpacer = Math.round(Math.max(10, Math.min(24, viewportHeight * 0.02)));
  const navContentGapSize = `${navContentGap}px` as Devvit.Blocks.SizeString;
  const parchmentTopSpacerSize = `${parchmentTopSpacer}px` as Devvit.Blocks.SizeString;

  return (
    <zstack width="100%" height="100%">
      <image
        url="background_2.png"
        width="100%"
        height="100%"
        imageWidth={1536}
        imageHeight={1024}
        resizeMode="cover"
        description="Ancient doorway backdrop"
      />

      <vstack width="100%" height="100%" padding="xsmall" alignment="top center" gap="none">
        <RoundNavBar
          viewportHeight={viewportHeight}
          onBack={() => {
            console.log('[RoundAnswerView] back icon pressed');
            onBack();
          }}
        />

        <spacer height={navContentGapSize} />

        <vstack alignment="middle center" gap="none" width="100%" height="100%">
          <spacer height={parchmentTopSpacerSize} />
          <vstack
            width="100%"
            alignment="top center"
            gap="none"
            paddingTop={`${parchmentOffset}px`}
          >
            <ParchmentPanel
              widthPx={layout.width}
              heightPx={clampedHeight}
              innerHeightPx={layout.innerHeight}
              tiles={layout.tiles}
              padTopPx={padTop}
              padBottomPx={padBottom}
              needsScroll={layout.needsScroll}
            >
              <WrappedFontText
                text={riddleText}
                maxWidth={layout.contentWidth}
                color={color}
                fontSize={fontSize}
                letterSpacing={letterSpacing}
                lineGap={lineGap}
                align="center"
              />
            </ParchmentPanel>

            <spacer height={`${buttonGap}px`} />

            <zstack width="203px" height="106px">
              <image
                url="enter_answer_button.png"
                width="100%"
                height="100%"
                imageWidth={203}
                imageHeight={106}
                resizeMode="fit"
                description="Enter answer button"
                onPress={() => {
                  console.log('[RoundAnswerView] enter answer button pressed');
                  onPromptAnswer();
                }}
              />
            </zstack>

            {isSubmitting && (
              <text size="small" color="secondary" alignment="middle center">
                Submitting your answer…
              </text>
            )}
          </vstack>
          <spacer grow />
        </vstack>

        <spacer grow />
      </vstack>
    </zstack>
  );
}
