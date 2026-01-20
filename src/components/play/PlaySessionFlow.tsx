import { Devvit } from '@devvit/public-api';
import type { User } from '../../types/index.js';
import { AnswerRiddleScreen } from '../screens/AnswerRiddleScreen.js';
import { ResultReviewScreen } from '../screens/ResultReviewScreen.js';
import { usePlaySession } from './usePlaySession.js';

interface PlaySessionFlowProps {
  context: any;
  currentUser: User | null;
  onExit: () => void;
}

export function PlaySessionFlow({ context, currentUser, onExit }: PlaySessionFlowProps) {
  const {
    step,
    riddleText,
    result,
    isSubmitting,
    viewportHeight,
    promptForAnswer,
    elapsed,
    startedAt,
    roundNonce,
    riddleId,
    initialQuestionId,
    shareToSubreddit,
  } = usePlaySession({ context, currentUser });

  console.log('[PlaySessionFlow] render', {
    step,
    hasUser: !!currentUser,
    roundNonce,
    questionId: initialQuestionId,
    riddleId,
    startedAt,
    elapsed,
    riddleTextLen: riddleText?.length ?? 0,
  });

  if (step === 'answer') {
    console.log('[PlaySessionFlow] rendering answer step', { elapsed, startedAt });
    return (
      <AnswerRiddleScreen
        riddleText={riddleText}
        viewportHeight={viewportHeight}
        isSubmitting={isSubmitting}
        onPromptAnswer={promptForAnswer}
        onBack={onExit}
      />
    );
  }

  console.log('[PlaySessionFlow] rendering result step', { result });
  if (!result) {
    return (
      <zstack width="100%" height="100%">
        <image
          url="background_3.png"
          width="100%"
          height="100%"
          imageWidth={1536}
          imageHeight={1024}
          resizeMode="cover"
          description="Sunlit courtyard backdrop"
        />
        <vstack width="100%" height="100%" alignment="middle center" gap="medium">
          <text size="large">Gathering your results…</text>
          <button appearance="secondary" onPress={onExit}>🏠 Back to Home</button>
        </vstack>
      </zstack>
    );
  }

  return (
    <ResultReviewScreen
      result={result}
      fallbackQuestionText={riddleText}
      viewportHeight={viewportHeight}
      onExit={onExit}
      onShare={shareToSubreddit}
    />
  );
}
