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
  onShare: () => void;
  isSharing: boolean;
  hasShared: boolean;
  sharePermalink?: string;
}

export function RoundResultView({
  result,
  fallbackQuestionText,
  viewportHeight,
  onExit,
  onShare,
  isSharing,
  hasShared,
  sharePermalink,
}: RoundResultViewProps) {
  const resultQuestion = result.questionText || fallbackQuestionText;
  const resultAnswer = result.answerText || 'No answer submitted.';
  const resultMeasureText = `${resultQuestion}\n${resultAnswer}`;
  const maxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
  const layout = computeParchmentLayout(resultMeasureText);
  const padTop = PARCHMENT.padY + layout.extraPadY;
  const padBottom = PARCHMENT.padY + layout.extraPadY;
  const clampedHeight = Math.min(layout.flyerHeight, maxParchmentHeight);
  const parchmentOffset = Math.max(0, Math.min(10, (maxParchmentHeight - clampedHeight) / 5));
  const horizontalPadding = Math.round(Math.max(16, Math.min(36, viewportHeight * 0.02)));
  const bottomPadding = Math.round(Math.max(20, Math.min(48, viewportHeight * 0.05)));
  const horizontalInset = `${horizontalPadding}px` as Devvit.Blocks.SizeString;
  const bottomInset = `${bottomPadding}px` as Devvit.Blocks.SizeString;
  const debattleButtonWidthPx = Math.round(Math.max(200, Math.min(layout.width * 0.7, viewportHeight * 0.24, 330)));
  const debattleButtonHeightPx = Math.round(debattleButtonWidthPx * (181 / 481));
  const debattleButtonWidth = `${debattleButtonWidthPx}px` as Devvit.Blocks.SizeString;
  const debattleButtonHeight = `${debattleButtonHeightPx}px` as Devvit.Blocks.SizeString;
  const areteRibbonWidthPx = Math.round(layout.width * 0.68);
  const areteRibbonWidth = `${areteRibbonWidthPx}px` as Devvit.Blocks.SizeString;
  const areteRibbonHeightPx = Math.round(debattleButtonHeightPx * 0.42);
  const areteRibbonHeight = `${areteRibbonHeightPx}px` as Devvit.Blocks.SizeString;
  const overlayClearancePx = debattleButtonHeightPx + bottomPadding;
  const overlayClearance = `${overlayClearancePx}px` as Devvit.Blocks.SizeString;
  const shareStatusText = isSharing
    ? 'Sharing to the subreddit…'
    : hasShared
      ? 'Shared with the community!'
      : 'Invite the community to weigh in.';
  const shareLinkText = hasShared && sharePermalink ? `reddit.com${sharePermalink}` : null;

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
          <vstack
            alignment="top center"
            gap="small"
            grow
            height="100%"
            scroll="vertical"
            padding={{ bottom: overlayClearance }}
          >
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

            {/* Ribbon-on-top + parchment */}
            <zstack width="100%" alignment="top center">
              {/* Parchment sits a bit lower so ribbon can overlap */}
              <vstack
                width="100%"
                alignment="top center"
                paddingTop={`${parchmentOffset + areteRibbonHeightPx * 0.55}px`}
              >
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

              {/* Ribbon pinned to the top-center of the section */}
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
            </zstack>
          </vstack>
          <spacer width={horizontalInset} />
        </hstack>
      </vstack>

      <vstack
        width="100%"
        height="100%"
        alignment="bottom center"
        gap="xsmall"
        padding={{
          bottom: bottomInset,
          left: horizontalInset,
          right: horizontalInset,
        }}
      >
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
    </zstack>
  );
}
