import { Devvit } from '@devvit/public-api';
import { NavIconButton } from './NavIconButton.js';
import { NAV_ICON_SIZE_PX } from './uiConstants.js';

type RightIconType = 'profile' | 'info';

interface RoundNavBarProps {
  viewportHeight: number;
  onBack: () => void;
  rightIcons?: Array<{
    icon: RightIconType;
    onPress?: () => void;
    size?: Devvit.Blocks.SizeString;
    description?: string;
  }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function RoundNavBar({ onBack, rightIcons = [], viewportHeight }: RoundNavBarProps) {
  const navIconSize = `${NAV_ICON_SIZE_PX}px` as Devvit.Blocks.SizeString;
  const verticalPadding = Math.round(clamp(viewportHeight * 0.015, 8, 24));
  const horizontalPadding = Math.round(clamp(viewportHeight * 0.02, 12, 32));
  const sideInset = `${horizontalPadding}px` as Devvit.Blocks.SizeString;
  const topInset = `${verticalPadding}px` as Devvit.Blocks.SizeString;

  return (
    <vstack width="100%" gap="none">
      <spacer height={topInset} />
      <hstack width="100%" alignment="middle start" gap="none">
        <spacer width={sideInset} />
        <hstack alignment="middle start" gap="none" grow>
          <NavIconButton
            icon="back"
            onPress={onBack}
            size={navIconSize}
          />
          <spacer grow />
          {rightIcons.length > 0 && (
            <hstack alignment="middle end" gap="small">
              {rightIcons.map((cfg) => (
                <NavIconButton
                  icon={cfg.icon}
                  onPress={cfg.onPress}
                  size={cfg.size ?? navIconSize}
                  description={cfg.description}
                />
              ))}
            </hstack>
          )}
        </hstack>
        <spacer width={sideInset} />
      </hstack>
    </vstack>
  );
}
