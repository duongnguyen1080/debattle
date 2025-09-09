import { useState, useInterval, Devvit } from '@devvit/public-api';
import { Theme } from '../types/index.js';

interface EditorPageWordStepProps {
  themes: Theme[];
  onThemeSelect: (theme: Theme) => void;
  onRefresh: () => void;
}

export function EditorPageWordStep({ themes, onThemeSelect, onRefresh }: EditorPageWordStepProps) {
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  useInterval(() => {
    setTimeRemaining((t) => {
      if (t <= 1) {
        if (!selectedTheme) onThemeSelect(themes[0]);
        return 0;
      }
      return t - 1;
    });
  }, 1000);

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
    onThemeSelect(theme);
  };

  const handleRefresh = () => {
    setTimeRemaining(10);
    setSelectedTheme(null);
    onRefresh();
  };

  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">🎯 Choose Your Theme</text>
      <text size="large">Select a theme for your riddle</text>
      
      <text size="medium" color={timeRemaining <= 3 ? 'red' : 'default'}>
        Time remaining: {timeRemaining}s
      </text>

      <vstack gap="medium" width="100%" maxWidth="400px">
        {themes.map((theme, index) => (
          <button
          key={theme.id}
          appearance={selectedTheme?.id === theme.id ? 'primary' : 'secondary'}
          onPress={() => handleThemeSelect(theme)}
          disabled={selectedTheme !== null}
          width="100%"
        >
          {`${theme.name} — ${theme.description} (Difficulty: ${'⭐'.repeat(theme.difficulty)})`}
        </button>
        ))}
      </vstack>

      <button
        appearance="secondary"
        onPress={handleRefresh}
        disabled={selectedTheme !== null}
      >
        🔄 Refresh Themes
      </button>

      {timeRemaining <= 3 && (
        <text size="medium" color="red">
          ⚠️ Auto-selecting first theme in {timeRemaining} seconds...
        </text>
      )}
    </vstack>
  );
}
