import { Devvit } from '@devvit/public-api';

type NavIconType = 'back' | 'profile' | 'info';

interface NavIconButtonProps {
  icon: NavIconType;
  onPress?: () => void;
  size?: string;
  description?: string;
}

const NAV_ICON_META: Record<NavIconType, { url: string; imageWidth: number; imageHeight: number; defaultSize: string; defaultDescription: string }> = {
  back: {
    url: 'back_icon.png',
    imageWidth: 354,
    imageHeight: 354,
    defaultSize: '120px',
    defaultDescription: 'Go back to home',
  },
  profile: {
    url: 'profile_icon.png',
    imageWidth: 1080,
    imageHeight: 1080,
    defaultSize: '80px',
    defaultDescription: 'View profile',
  },
  info: {
    url: 'info_icon.png',
    imageWidth: 1080,
    imageHeight: 1080,
    defaultSize: '80px',
    defaultDescription: 'How to play',
  },
};

export function NavIconButton({ icon, onPress, size, description }: NavIconButtonProps) {
  const meta = NAV_ICON_META[icon];
  const buttonSize = size ?? meta.defaultSize;
  return (
    <image
      url={meta.url}
      width={buttonSize}
      height={buttonSize}
      imageWidth={meta.imageWidth}
      imageHeight={meta.imageHeight}
      resizeMode="fit"
      description={description ?? meta.defaultDescription}
      onPress={onPress}
    />
  );
}
