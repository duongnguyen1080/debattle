import { Devvit } from '@devvit/public-api';

interface SplashScreenProps {
  onContinue?: () => void;
}

export function SplashScreen({ onContinue }: SplashScreenProps) {
  console.log('title: showing');
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
        onPress={onContinue}
      />
      <vstack width="100%" height="100%" alignment="middle center">
        <image
          url="game_title.png"
          width="60%"
          imageWidth={2112}
          imageHeight={1408}
          resizeMode="fit"
          description="Arete game title"
          onPress={onContinue}
        />
      </vstack>
    </zstack>
  );
}
