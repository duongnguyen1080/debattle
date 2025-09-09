import { useState, Devvit } from '@devvit/public-api';
import { Theme } from '../types/index.js';
import { formatTime } from '../utils/gameUtils.js';

interface EditorPageRiddleStepProps {
  theme: Theme;
  timeRemaining: number;
  onSubmit: (riddleText: string, answer: string) => void;
}

export function EditorPageRiddleStep({ theme, timeRemaining, onSubmit }: EditorPageRiddleStepProps) {
  const [riddleText, setRiddleText] = useState('');
  const [answer, setAnswer] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validateInputs = (): boolean => {
    const newErrors: string[] = [];
    
    if (!riddleText.trim() || riddleText.trim().length < 10) {
      newErrors.push('Riddle must be at least 10 characters long');
    }
    
    if (!answer.trim() || answer.trim().length < 2) {
      newErrors.push('Answer must be at least 2 characters long');
    }
    
    if (riddleText.toLowerCase().includes(answer.toLowerCase())) {
      newErrors.push('Answer should not be contained within the riddle text');
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = () => {
    if (validateInputs()) {
      onSubmit(riddleText.trim(), answer.trim());
    }
  };

  const isTimeRunningOut = timeRemaining <= 10;
  const isTimeCritical = timeRemaining <= 5;

  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">✍️ Create Your Riddle</text>
      <text size="large">Theme: {theme.name}</text>
      
      <text 
        size="large" 
        color={isTimeCritical ? 'red' : isTimeRunningOut ? 'orange' : 'default'}
      >
        ⏱️ Time: {formatTime(timeRemaining)}
      </text>

      <vstack gap="medium" width="100%" maxWidth="500px">
        <vstack alignment="start" width="100%">
        <text size="medium" weight="bold">Riddle Text:</text>
        <text size="medium">{riddleText || 'Click to write riddle...'}</text>
        <button onPress={() => setRiddleText('New riddle text')}>Edit Riddle</button>
        <text size="medium" weight="bold">Answer:</text>
        <text size="medium">{answer || 'Click to set answer...'}</text>
        <button onPress={() => setAnswer('New answer')}>Edit Answer</button>
          <text size="small" color="secondary">
            {riddleText.length}/500 characters
          </text>
        </vstack>

        <vstack alignment="start" width="100%">
        <text size="medium" weight="bold">Answer:</text>
        <text size="medium" weight="bold">Answer:</text>
        <text size="medium">{answer || 'Click to set answer...'}</text>
        <button onPress={() => setAnswer('New answer')}>Set Answer</button>
          <text size="small" color="secondary">
            {answer.length}/100 characters
          </text>
        </vstack>

        {errors.length > 0 && (
          <vstack gap="small" width="100%">
            {errors.map((error, index) => (
              <text key={`${index}`} size="small" color="red">
                ❌ {error}
              </text>
            ))}
          </vstack>
        )}

        <button
          appearance="primary"
          onPress={handleSubmit}
          disabled={!riddleText.trim() || !answer.trim() || timeRemaining === 0}
          width="100%"
        >
          Submit Riddle
        </button>
      </vstack>

      {isTimeRunningOut && (
        <text size="medium" color={isTimeCritical ? 'red' : 'orange'}>
          ⚠️ {isTimeCritical ? 'Time is running out!' : 'Time is getting low!'}
        </text>
      )}

      {timeRemaining === 0 && (
        <text size="large" color="red">
          ⏰ Time's up! Please submit your riddle.
        </text>
      )}
    </vstack>
  );
}
