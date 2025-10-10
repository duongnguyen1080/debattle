import { Devvit } from '@devvit/public-api';
import { User } from '../../types/index.js';

interface HomeScreenProps {
  currentUser: User | null;
  onStart: () => void;
  onLeaderboard: () => void;
  onHowToPlay: () => void;
  onProgress: () => void;
}

export function HomeScreen({ currentUser, onStart, onLeaderboard, onHowToPlay, onProgress }: HomeScreenProps) {
  console.log('HomeScreen render');
  console.log('[HomeScreen] render', { hasUser: !!currentUser, level: currentUser?.level, flair: currentUser?.flair });

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
        <spacer grow />

        <vstack alignment="middle center" gap="medium">
          <zstack width="203px" height="106px">
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
      </vstack>

      <hstack width="100%" padding="large" gap="small">
        <spacer grow />
        <image
          url="info_icon.png"
          imageWidth={1080}
          imageHeight={1080}
          width="40px"
          height="40px"
          resizeMode="fit"
          description="How to play"
          onPress={() => { console.log('[HomeScreen] info icon pressed'); onHowToPlay(); }}
        />
        <image
          url="profile_icon.png"
          imageWidth={1080}
          imageHeight={1080}
          width="40px"
          height="40px"
          resizeMode="fit"
          description="View profile"
          onPress={() => { console.log('[HomeScreen] profile icon pressed'); onProgress(); }}
        />
      </hstack>
    </zstack>
  );
}
