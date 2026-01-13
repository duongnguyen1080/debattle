import { Devvit } from '@devvit/public-api';
import type { User } from '../../types/index.js';
import { RoundAnswerView } from './RoundAnswerView.js';
import { RoundResultView } from './RoundResultView.js';
import { useRoundFlow } from './useRoundFlow.js';

interface RoundV2FlowProps {
  context: any;
  currentUser: User | null;
  onExit: () => void;
}

export function RoundV2Flow({ context, currentUser, onExit }: RoundV2FlowProps) {
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
  } = useRoundFlow({ context, currentUser });

  console.log('[RoundV2Flow] render', {
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
    console.log('[RoundV2Flow] rendering answer step', { elapsed, startedAt });
    return (
      <RoundAnswerView
        riddleText={riddleText}
        viewportHeight={viewportHeight}
        isSubmitting={isSubmitting}
        onPromptAnswer={promptForAnswer}
        onBack={onExit}
      />
    );
  }

  console.log('[RoundV2Flow] rendering result step', { result });
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
    <RoundResultView
      result={result}
      fallbackQuestionText={riddleText}
      viewportHeight={viewportHeight}
      onExit={onExit}
      onShare={shareToSubreddit}
    />
  );
}
