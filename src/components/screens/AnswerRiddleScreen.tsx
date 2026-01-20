import { Devvit } from '@devvit/public-api';
import { WrappedFontText } from '../typography/FontText.js';
import { ParchmentPanel } from '../ui/ParchmentPanel.js';
import { NavIconButton } from '../ui/NavIconButton.js';
import {
  computeParchmentLayout,
  CTA_BOTTOM_INSET_PX,
  CTA_BUTTON_HEIGHT_PX,
  CTA_BUTTON_WIDTH_PX,
  LAYOUT,
  PARCHMENT,
  RIDDLE_STYLE,
} from '../play/playLayout.js';

interface AnswerRiddleScreenProps {
  riddleText: string;
  viewportHeight: number;
  isSubmitting: boolean;
  onPromptAnswer: () => void;
  onBack: () => void;
}

export function AnswerRiddleScreen({
  riddleText,
  viewportHeight,
  isSubmitting,
  onPromptAnswer,
  onBack,
}: AnswerRiddleScreenProps) {
  const { color, fontSize, lineGap, letterSpacing } = RIDDLE_STYLE;
  const maxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
  const buttonGap = viewportHeight * LAYOUT.buttonGapFraction;
  const layout = computeParchmentLayout(riddleText);
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const parchmentTopSpacer = Math.round(Math.max(10, Math.min(24, viewportHeight * 0.02)));
  const parchmentTopSpacerSize = `${parchmentTopSpacer}px` as Devvit.Blocks.SizeString;
  const ctaButtonWidth = `${CTA_BUTTON_WIDTH_PX}px` as Devvit.Blocks.SizeString;
  const ctaButtonHeight = `${CTA_BUTTON_HEIGHT_PX}px` as Devvit.Blocks.SizeString;
  const ctaBottomInset = `${CTA_BOTTOM_INSET_PX}px` as Devvit.Blocks.SizeString;
  const topSafeSpacer = '32px' as Devvit.Blocks.SizeString;

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
        <spacer height={topSafeSpacer} />
        <vstack alignment="middle center" gap="none" width="100%" grow>
          <spacer grow />
          <vstack width="100%" alignment="middle center" gap="none">
            <spacer height={parchmentTopSpacerSize} />
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

            <zstack width={ctaButtonWidth} height={ctaButtonHeight}>
              <image
                url="enter_answer_button.png"
                width="100%"
                height="100%"
                imageWidth={203}
                imageHeight={106}
                resizeMode="fit"
                description="Enter answer button"
                onPress={() => {
                  console.log('[AnswerRiddleScreen] enter answer button pressed');
                  onPromptAnswer();
                }}
              />
              {isSubmitting && (
                <vstack
                  width="100%"
                  height="100%"
                  alignment="middle center"
                  backgroundColor="rgba(0,0,0,0.35)"
                >
                  <text size="small" color="white">
                    Submitting your answer…
                  </text>
                </vstack>
              )}
            </zstack>
          </vstack>
          <spacer grow />
        </vstack>

        <spacer height={ctaBottomInset} />
      </vstack>

      <hstack width="100%" padding="large" gap="small" alignment="middle center">
        <spacer grow />
        <NavIconButton
          icon="close"
          onPress={() => {
            console.log('[AnswerRiddleScreen] close icon pressed');
            onBack();
          }}
          description="Close and return home"
        />
      </hstack>
    </zstack>
  );
}
