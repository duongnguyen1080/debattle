import { Devvit } from '@devvit/public-api';
import { User } from '../../types/index.js';
import { NavIconButton } from './NavIconButton.js';
import { CTA_BOTTOM_INSET_PX, CTA_BUTTON_HEIGHT_PX, CTA_BUTTON_WIDTH_PX } from './uiConstants.js';

interface HomeScreenProps {
  currentUser: User | null;
  onStart: () => void;
  onLeaderboard: () => void;
  onProgress: () => void;
}

export function HomeScreen({ currentUser, onStart, onLeaderboard, onProgress }: HomeScreenProps) {
  console.log('HomeScreen render');
  console.log('[HomeScreen] render', { hasUser: !!currentUser, level: currentUser?.level, flair: currentUser?.flair });
  const ctaButtonWidth = `${CTA_BUTTON_WIDTH_PX}px` as Devvit.Blocks.SizeString;
  const ctaButtonHeight = `${CTA_BUTTON_HEIGHT_PX}px` as Devvit.Blocks.SizeString;
  const ctaBottomInset = `${CTA_BOTTOM_INSET_PX}px` as Devvit.Blocks.SizeString;

  return (
    <zstack width="100%" height="100%">
      <image
        url="background_1.png"
        width="100%"
        height="100%"
        imageWidth={1536}
        imageHeight={1024}
        resizeMode="cover"
        description="Ancient door background"
      />

      <vstack width="100%" height="100%" padding="large" gap="medium">
        <vstack alignment="middle center" gap="medium" width="100%" grow>
          <spacer grow />
          <zstack width={ctaButtonWidth} height={ctaButtonHeight}>
            <image
              url="knock button.gif"
              width="100%"
              height="100%"
              imageWidth={203}
              imageHeight={106}
              resizeMode="fit"
              description="Animated Knock The Door button"
              onPress={() => {
                console.log('[HomeScreen] Knock The Door pressed');
                onStart();
              }}
            />
          </zstack>
        </vstack>
        <spacer height={ctaBottomInset} />
      </vstack>

      <hstack width="100%" padding="large" gap="small">
        <spacer grow />
        <NavIconButton
          icon="profile"
          onPress={() => {
            console.log('[HomeScreen] profile icon pressed');
            onProgress();
          }}
        />
      </hstack>
    </zstack>
  );
}
