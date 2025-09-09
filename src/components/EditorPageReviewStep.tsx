import { Theme } from '../types/index.js';
import { Devvit } from '@devvit/public-api';

interface EditorPageReviewStepProps {
  theme: Theme;
  riddleText: string;
  answer: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EditorPageReviewStep({ 
  theme, 
  riddleText, 
  answer, 
  onConfirm, 
  onCancel 
}: EditorPageReviewStepProps) {
  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">👀 Review Your Riddle</text>
      <text size="large">Preview before posting to the community</text>

      <vstack gap="large" width="100%" maxWidth="500px">
        <vstack gap="medium" width="100%" padding="medium" backgroundColor="neutral">
          <text size="large" weight="bold">Theme: {theme.name}</text>
          
          <vstack gap="small" width="100%">
            <text size="medium" weight="bold">Riddle:</text>
            <text size="medium">{riddleText}</text>
            <text size="medium" weight="bold">{answer}</text>
          </vstack>
          
          <vstack gap="small" width="100%">
            <text size="medium" weight="bold">Answer:</text>
            <text size="medium" weight="bold">{answer}</text>
          </vstack>
        </vstack>

        <vstack gap="small" width="100%">
          <text size="medium" weight="bold">What happens next?</text>
          <text size="small">• Your riddle will be posted to the community</text>
          <text size="small">• Other players can guess the answer</text>
          <text size="small">• You'll earn points for creating the riddle</text>
          <text size="small">• First correct guesser gets bonus points</text>
        </vstack>

        <hstack gap="medium" width="100%">
          <button
            appearance="secondary"
            onPress={onCancel}
            width="50%"
          >
            ← Go Back
          </button>
          
          <button
            appearance="primary"
            onPress={onConfirm}
            width="50%"
          >
            🚀 Post to Community
          </button>
        </hstack>
      </vstack>

      <text size="small" color="secondary" alignment="center">
        💡 Tip: Make sure your riddle is clear and the answer is correct!
      </text>
    </vstack>
  );
}
