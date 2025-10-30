import { Devvit } from '@devvit/public-api';
import { NavIconButton } from './NavIconButton.js';

type RightIconType = 'profile' | 'info';

interface RoundNavBarProps {
  onBack: () => void;
  rightIcons?: Array<{
    icon: RightIconType;
    onPress?: () => void;
    size?: string;
    description?: string;
  }>;
}

export function RoundNavBar({ onBack, rightIcons = [] }: RoundNavBarProps) {
  return (
    <hstack width="100%" alignment="middle start" gap="none">
      <NavIconButton
        icon="back"
        onPress={onBack}
      />
      <spacer grow />
      {rightIcons.length > 0 && (
        <hstack alignment="middle end" gap="small">
          {rightIcons.map((cfg, index) => (
            <NavIconButton
              key={`${cfg.icon}-${index}`}
              icon={cfg.icon}
              onPress={cfg.onPress}
              size={cfg.size}
              description={cfg.description}
            />
          ))}
        </hstack>
      )}
    </hstack>
  );
}
