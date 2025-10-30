import { Devvit } from '@devvit/public-api';
import { PARCHMENT, SLICE_PIXEL_DIMENSIONS } from './roundLayout.js';

interface ParchmentPanelProps {
  widthPx: number;
  heightPx: number;
  innerHeightPx: number;
  tiles: number;
  padTopPx: number;
  padBottomPx: number;
  needsScroll?: boolean;
  contentAlignment?: Devvit.Blocks.Alignment;
  contentGap?: Devvit.Blocks.Gap;
  children: JSX.Element | JSX.Element[];
}

export function ParchmentPanel({
  widthPx,
  heightPx,
  innerHeightPx,
  tiles,
  padTopPx,
  padBottomPx,
  needsScroll,
  contentAlignment = 'middle center',
  contentGap = 'none',
  children,
}: ParchmentPanelProps) {
  return (
    <zstack width={`${widthPx}px`} height={`${heightPx}px`} alignment="top center">
      <vstack width="100%" height="100%" alignment="top center" gap="none">
        <image
          url="riddle_top.png"
          width="100%"
          height={`${PARCHMENT.capTop}px`}
          imageWidth={SLICE_PIXEL_DIMENSIONS.top.width}
          imageHeight={SLICE_PIXEL_DIMENSIONS.top.height}
          resizeMode="fill"
          description="Top parchment edge"
        />
        {Array.from({ length: tiles }).map((_, index) => (
          <image
            key={`parchment-mid-${index}`}
            url="riddle_mid.png"
            width="100%"
            height={`${PARCHMENT.midTile}px`}
            imageWidth={SLICE_PIXEL_DIMENSIONS.mid.width}
            imageHeight={SLICE_PIXEL_DIMENSIONS.mid.height}
            resizeMode="fill"
            description="Parchment middle texture"
          />
        ))}
        <image
          url="riddle_bottom.png"
          width="100%"
          height={`${PARCHMENT.capBottom}px`}
          imageWidth={SLICE_PIXEL_DIMENSIONS.bottom.width}
          imageHeight={SLICE_PIXEL_DIMENSIONS.bottom.height}
          resizeMode="fill"
          description="Bottom parchment edge"
        />
      </vstack>

      <vstack
        width="100%"
        height={`${innerHeightPx}px`}
        padding={{
          top: `${padTopPx}px`,
          bottom: `${padBottomPx}px`,
          left: `${PARCHMENT.padX}px`,
          right: `${PARCHMENT.padX}px`,
        }}
        alignment={contentAlignment}
        scroll={needsScroll ? 'vertical' : undefined}
        gap={contentGap}
      >
        {children}
      </vstack>
    </zstack>
  );
}
