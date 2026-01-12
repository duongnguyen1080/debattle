import { Devvit } from '@devvit/public-api';
import { WrappedFontText } from './FontText.js';

const LIMIT_TEXT = 'Limit reached. Return tomorrow.';

const BACKGROUND = {
  url: 'background_1.png',
  imageWidth: 1536,
  imageHeight: 1024,
  description: 'Ancient door background',
} as const;

const FLYER = {
  url: 'riddle_flyer (2).png',
  imageWidth: 840,
  imageHeight: 231,
  description: 'Parchment notice',
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

interface DailyLimitScreenProps {
  viewportHeight: number;
}

export function DailyLimitScreen({ viewportHeight }: DailyLimitScreenProps) {
  const flyerWidthPx = clamp(Math.round(viewportHeight * 0.6), 260, 640);
  const flyerHeightPx = Math.round((flyerWidthPx * FLYER.imageHeight) / FLYER.imageWidth);
  const flyerWidth = `${flyerWidthPx}px` as Devvit.Blocks.SizeString;
  const flyerHeight = `${flyerHeightPx}px` as Devvit.Blocks.SizeString;
  const textMaxWidth = Math.round(flyerWidthPx * 0.78);
  const fontSize = Math.round(clamp(flyerWidthPx * 0.045, 40, 46));
  const lineGap = Math.round(clamp(fontSize * 0.25, 6, 10));

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
      <vstack width="100%" height="100%" alignment="middle center">
        <zstack width={flyerWidth} height={flyerHeight} alignment="middle center">
          <image
            url={FLYER.url}
            width="100%"
            height="100%"
            imageWidth={FLYER.imageWidth}
            imageHeight={FLYER.imageHeight}
            resizeMode="fit"
            description={FLYER.description}
          />
          <vstack width="86%" alignment="middle center">
            <WrappedFontText
              text={LIMIT_TEXT}
              maxWidth={textMaxWidth}
              color="#3b1f0c"
              fontSize={fontSize}
              letterSpacing={-1}
              lineGap={lineGap}
              align="center"
            />
          </vstack>
        </zstack>
      </vstack>
    </zstack>
  );
}
