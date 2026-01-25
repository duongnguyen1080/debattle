import React, { useEffect, useMemo, useState } from 'react';
import {
  context,
  getWebViewMode,
  navigateTo,
  showToast,
} from '@devvit/web/client';
import type { RiddleV2, User } from '../types/index.js';
import type { UiAssetMap, UiAssetPath } from '../types/uiAssets.js';
import { LEVEL_TIERS } from '../types/index.js';
import { ANSWER_LENGTH_LIMIT_MESSAGE, MAX_MEANINGFUL_ANSWER_LENGTH, getMeaningfulAnswerLength } from './lib/answer';
import { ApiError, api, type SubmitAnswerResult } from './lib/api';
import { consumeEntryAction } from './lib/entryAction';
import { getDevvitAvailable, resolveEntrypointName } from './lib/entrypoint';
import backgroundOneFallback from './assets/images/background_1.png';
import backgroundTwoFallback from './assets/images/background_2.png';
import backgroundThreeFallback from './assets/images/background_3.png';
import backgroundFourFallback from './assets/images/background_4.png';
import knockButton from './assets/images/knock_button.png';
import profileIcon from './assets/images/profile_icon.png';
import closeIcon from './assets/images/close_button.png';
import backIcon from './assets/images/back_icon.png';
import enterAnswerButton from './assets/images/enter_answer_button.png';
import debattleButton from './assets/images/debattle_button.png';
import tryAgainButton from './assets/images/try_again_button.png';
import parchmentRibbon from './assets/images/parchment_2.png';
import eagleIcon from './assets/images/eagle_icon.png';
import areteCoin from './assets/images/Arete_coin.png';
import riddleTop from './assets/images/riddle_top.png';
import riddleMid from './assets/images/riddle_mid.png';
import riddleBottom from './assets/images/riddle_bottom.png';

type Screen = 'home' | 'answer' | 'result' | 'achievements';
type Decision = 'open' | 'ajar' | 'closed';

const DEFAULT_THEME = 'fate';

const DECISION_META: Record<Decision, { label: string; tone: string; shareable: boolean }> = {
  open: {
    label: 'Door swings open',
    tone: 'A confident answer with sharp clarity.',
    shareable: true,
  },
  ajar: {
    label: 'Door stands ajar',
    tone: 'Close to the heart of the riddle, keep refining.',
    shareable: true,
  },
  closed: {
    label: 'Door remains sealed',
    tone: 'Take another pass with focus and intent.',
    shareable: false,
  },
};

const PRELOAD_STATIC_IMAGES = [
  knockButton,
  profileIcon,
  closeIcon,
  backIcon,
  enterAnswerButton,
  debattleButton,
  tryAgainButton,
  parchmentRibbon,
  eagleIcon,
  areteCoin,
  riddleTop,
  riddleMid,
  riddleBottom,
];

const resolveUiAsset = (assets: UiAssetMap | null, path: UiAssetPath, fallback: string): string => {
  const url = assets?.[path];
  if (typeof url === 'string' && url.trim()) {
    return url;
  }
  return fallback;
};

const safeGetWebViewMode = (): 'inline' | 'expanded' => {
  try {
    return getWebViewMode();
  } catch {
    return 'inline';
  }
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const toPermalinkUrl = (permalink?: string | null): string | null => {
  if (!permalink) {
    return null;
  }
  if (permalink.startsWith('http')) {
    return permalink;
  }
  return `https://www.reddit.com${permalink}`;
};

export function App() {
  const devvitAvailable = useMemo(() => getDevvitAvailable(), []);
  const entrypointName = useMemo(() => resolveEntrypointName(), []);
  const webViewMode = safeGetWebViewMode();
  const [screen, setScreen] = useState<Screen>('home');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState('anonymous');
  const [uiAssets, setUiAssets] = useState<UiAssetMap | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [riddle, setRiddle] = useState<RiddleV2 | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [result, setResult] = useState<SubmitAnswerResult | null>(null);
  const [shareState, setShareState] = useState<{ postId?: string; permalink?: string } | null>(null);
  const [isLoadingRiddle, setIsLoadingRiddle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const notify = (message: string) => {
    try {
      showToast(message);
    } catch {
      console.info(message);
    }
  };

  const resolvedUsername = (() => {
    const contextName = typeof context?.username === 'string' ? context.username.trim() : '';
    return contextName || username || 'anonymous';
  })();

  const subredditLabel = (() => {
    const name = typeof context?.subredditName === 'string' ? context.subredditName.trim() : '';
    return name ? `r/${name}` : 'the community';
  })();

  const debugLabel = devvitAvailable
    ? `Debug: entry=${entrypointName ?? 'unknown'} mode=${webViewMode}`
    : `Debug: devvit=off mode=${webViewMode}`;

  const refreshUser = async (): Promise<void> => {
    try {
      const data = await api.getCurrentUser();
      setCurrentUser(data.currentUser);
      if (data.username) {
        setUsername(data.username);
      }
    } catch {
      // Ignore refresh failures.
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoadingUser(true);
    api
      .getCurrentUser()
      .then((data) => {
        if (!active) return;
        setCurrentUser(data.currentUser);
        setUsername(data.username || 'anonymous');
      })
      .catch(() => {
        if (!active) return;
        notify('Unable to load your profile.');
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingUser(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getUiAssets()
      .then((data) => {
        if (!active) return;
        setUiAssets(data.assets);
      })
      .catch(() => {
        // Fall back to bundled assets.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (screen !== 'answer' || !startedAt) {
      return;
    }
    setElapsedMs(Date.now() - startedAt);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [screen, startedAt]);

  useEffect(() => {
    const action = consumeEntryAction();
    if (!action) {
      return;
    }
    if (action === 'achievements') {
      setScreen('achievements');
      return;
    }
    if (action === 'start') {
      void handleStartRound();
    }
  }, []);


  const handleStartRound = async () => {
    if (isLoadingRiddle) {
      return;
    }
    const theme = DEFAULT_THEME;
    setIsLoadingRiddle(true);
    setResult(null);
    setShareState(null);
    setSubmittedAnswer('');
    try {
      const data = await api.createRiddle({
        theme,
        playerUsername: resolvedUsername,
      });
      setRiddle(data.riddle);
      setAnswerText('');
      const now = Date.now();
      setStartedAt(now);
      setElapsedMs(0);
      setScreen('answer');
    } catch (err) {
      console.error('create riddle failed', err);
      notify('Failed to create a riddle. Please try again.');
    } finally {
      setIsLoadingRiddle(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!riddle || isSubmitting) {
      return;
    }
    const trimmed = answerText.trim();
    if (!trimmed) {
      notify('Answer cannot be empty.');
      return;
    }
    const meaningfulLength = getMeaningfulAnswerLength(trimmed);
    if (meaningfulLength > MAX_MEANINGFUL_ANSWER_LENGTH) {
      notify(ANSWER_LENGTH_LIMIT_MESSAGE);
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await api.submitAnswer({
        riddleId: riddle.id,
        playerUsername: resolvedUsername,
        answerText: trimmed,
        elapsed: elapsedMs,
      });
      setSubmittedAnswer(trimmed);
      setResult(data);
      setScreen('result');
      await refreshUser();
    } catch (err) {
      console.error('submit answer failed', err);
      notify('Failed to submit your answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!riddle || !result || isSharing) {
      return;
    }
    if (shareState?.postId) {
      const url = toPermalinkUrl(shareState.permalink);
      if (url) {
        navigateTo({ url });
      } else {
        notify('Share link is not available yet.');
      }
      return;
    }
    setIsSharing(true);
    try {
      const shareScoreValue = result.areteEvaluation?.totalPoints ?? result.score.total;
      const shareFeedback = result.areteEvaluation?.feedback ?? result.feedback;
      const data = await api.shareResponse({
        riddleId: riddle.id,
        responseId: result.responseId,
        questionText: riddle.meta?.riddleText ?? '',
        answerText: submittedAnswer || answerText,
        playerUsername: resolvedUsername,
        totalScore: shareScoreValue,
        decision: result.decision,
        feedback: shareFeedback,
        subredditName: context?.subredditName,
      });
      setShareState({ postId: data.postId, permalink: data.permalink });
      notify('Shared to the community.');
      const url = toPermalinkUrl(data.permalink);
      if (url) {
        navigateTo({ url });
      }
    } catch (err) {
      console.error('share failed', err);
      if (err instanceof ApiError && err.code === 'user_actions_required') {
        notify('Please allow Debattle to post as you to share.');
      } else {
        notify('Failed to share your response.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleBackHome = () => {
    setScreen('home');
    setRiddle(null);
    setAnswerText('');
    setResult(null);
    setShareState(null);
    setSubmittedAnswer('');
  };

  const handlePlayAgain = () => {
    setScreen('home');
    setRiddle(null);
    setAnswerText('');
    setResult(null);
    setShareState(null);
    setSubmittedAnswer('');
  };

  const backgroundOne = resolveUiAsset(uiAssets, 'background_1.png', backgroundOneFallback);
  const backgroundTwo = resolveUiAsset(uiAssets, 'background_2.png', backgroundTwoFallback);
  const backgroundThree = resolveUiAsset(uiAssets, 'background_3.png', backgroundThreeFallback);
  const backgroundFour = resolveUiAsset(uiAssets, 'background_4.png', backgroundFourFallback);

  const decisionArtMap = useMemo(
    () => ({
      open: {
        background: backgroundThree,
        cta: {
          image: debattleButton,
          label: 'Share your verdict',
        },
      },
      ajar: {
        background: backgroundFour,
        cta: {
          image: debattleButton,
          label: 'Share your verdict',
        },
      },
      closed: {
        background: backgroundTwo,
        cta: {
          image: tryAgainButton,
          label: 'Try another riddle',
        },
      },
    }),
    [backgroundTwo, backgroundThree, backgroundFour]
  );

  const preloadImages = useMemo(
    () => [backgroundOne, backgroundTwo, backgroundThree, backgroundFour, ...PRELOAD_STATIC_IMAGES],
    [backgroundOne, backgroundTwo, backgroundThree, backgroundFour]
  );

  const meaningfulLength = getMeaningfulAnswerLength(answerText);
  const decisionMeta = result ? DECISION_META[result.decision] : null;
  const decisionArt = result ? decisionArtMap[result.decision] : null;
  const riddleText = riddle?.meta?.riddleText ?? '';
  const isDecisionShareable = decisionMeta?.shareable ?? false;
  const shareLabel = shareState?.postId
    ? 'Open shared post'
    : isSharing
      ? 'Sharing...'
      : 'Share your verdict';
  const primaryCtaLabel = isDecisionShareable ? shareLabel : 'Try another riddle';
  const primaryCtaImage = decisionArt?.cta.image ?? debattleButton;
  const backgroundUrl = (() => {
    if (screen === 'home') {
      return backgroundOne;
    }
    if (screen === 'answer') {
      return backgroundTwo;
    }
    if (screen === 'result' && decisionArt) {
      return decisionArt.background;
    }
    if (screen === 'achievements') {
      return backgroundThree;
    }
    return backgroundOne;
  })();

  const levelProgress = (() => {
    if (!currentUser) {
      return null;
    }
    const currentTier =
      LEVEL_TIERS.find((tier) => tier.level === currentUser.level) || LEVEL_TIERS[0];
    const nextTier = LEVEL_TIERS.find((tier) => tier.level === currentUser.level + 1) || null;
    if (!nextTier) {
      return { progress: 1, currentTier, nextTier: null };
    }
    const span = nextTier.minXp - currentTier.minXp;
    const progress = span > 0 ? (currentUser.xp - currentTier.minXp) / span : 0;
    return { progress: Math.min(1, Math.max(0, progress)), currentTier, nextTier };
  })();

  return (
    <div className="app" style={{ backgroundImage: `url(${backgroundUrl})` }}>
      <div className="app__content">
        <div className="debug-pill">{debugLabel}</div>

        {screen === 'home' && (
          <main className="screen screen--home">
            <div className="corner-actions">
              <button
                className="icon-button"
                type="button"
                onClick={() => setScreen('achievements')}
                aria-label="Your progress"
              >
                <img src={profileIcon} alt="" />
              </button>
            </div>
            <div className="home-center">
              <button
                className="image-button image-button--knock"
                type="button"
                onClick={handleStartRound}
                disabled={isLoadingRiddle}
              >
                <img
                  src={knockButton}
                  alt={isLoadingRiddle ? 'Summoning a riddle' : 'Knock the door'}
                />
              </button>
            </div>
          </main>
        )}

        {screen === 'answer' && (
          <main className="screen screen--answer">
            <div className="corner-actions">
              <button
                className="icon-button"
                type="button"
                onClick={handleBackHome}
                aria-label="Close and return home"
              >
                <img src={closeIcon} alt="" />
              </button>
            </div>
            <div className="answer-stack">
              <div className="parchment riddle-panel">
                <div className="riddle-meta">
                  <span className="tag">Riddle</span>
                  <span className="timer">Time {formatDuration(elapsedMs)}</span>
                </div>
                <p className="riddle-text">{riddleText || 'Loading riddle...'}</p>
              </div>
              <div className="parchment answer-panel">
                <label className="label" htmlFor="answer-input">
                  Your answer
                </label>
                <textarea
                  id="answer-input"
                  className="textarea"
                  rows={6}
                  placeholder="Answer with clarity and intent."
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                />
                <div className="answer-actions">
                  <button
                    className="image-button image-button--enter"
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={isSubmitting}
                  >
                    <img
                      src={enterAnswerButton}
                      alt={isSubmitting ? 'Submitting your answer' : 'Enter answer'}
                    />
                  </button>
                  <button className="text-link" type="button" onClick={handleBackHome}>
                    Back
                  </button>
                </div>
                <span
                  className={`meter ${
                    meaningfulLength > MAX_MEANINGFUL_ANSWER_LENGTH ? 'meter--over' : ''
                  }`}
                >
                  {meaningfulLength}/{MAX_MEANINGFUL_ANSWER_LENGTH} meaningful characters
                </span>
              </div>
            </div>
          </main>
        )}

        {screen === 'result' && result && decisionMeta && decisionArt && (
          <main className="screen screen--result">
            {isDecisionShareable && (
              <div className="corner-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={handlePlayAgain}
                  aria-label="Close results"
                >
                  <img src={closeIcon} alt="" />
                </button>
              </div>
            )}
            <div className="result-stack">
              <div className="ribbon" style={{ backgroundImage: `url(${parchmentRibbon})` }}>
                <span>{decisionMeta.label}</span>
              </div>
              <p className="result-tone">{decisionMeta.tone}</p>
              <div className="parchment result-parchment">
                <div className="feedback-block">
                  <img className="feedback-icon" src={eagleIcon} alt="Gatekeeper crest" />
                  <p className="feedback-text">"{result.feedback}"</p>
                </div>
              </div>
              {result.areteEvaluation && (
                <div className="arete-reward">
                  <span className="arete-reward__value">+ {result.areteEvaluation.totalPoints}</span>
                  <img className="arete-reward__icon" src={areteCoin} alt="Arete coin" />
                </div>
              )}
              <div className="score-grid">
                <div className="score-card">
                  <span className="score-card__label">Wit</span>
                  <span className="score-card__value">{result.score.wit}</span>
                </div>
                <div className="score-card">
                  <span className="score-card__label">Logic</span>
                  <span className="score-card__value">{result.score.logic}</span>
                </div>
                <div className="score-card">
                  <span className="score-card__label">Style</span>
                  <span className="score-card__value">{result.score.style}</span>
                </div>
                <div className="score-card score-card--total">
                  <span className="score-card__label">Total</span>
                  <span className="score-card__value">{result.score.total}</span>
                </div>
              </div>
              <div className="result-actions">
                <button
                  className="image-button image-button--cta"
                  type="button"
                  onClick={isDecisionShareable ? handleShare : handlePlayAgain}
                  disabled={isDecisionShareable && isSharing}
                  aria-label={primaryCtaLabel}
                >
                  <img src={primaryCtaImage} alt="" />
                </button>
                <span className="result-actions__hint">{primaryCtaLabel}</span>
                {isDecisionShareable ? (
                  <button
                    className="text-link text-link--light"
                    type="button"
                    onClick={handlePlayAgain}
                  >
                    Play again
                  </button>
                ) : (
                  <button
                    className="text-link text-link--light"
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing}
                  >
                    Share anyway
                  </button>
                )}
              </div>
            </div>
          </main>
        )}

        {screen === 'achievements' && (
          <main className="screen screen--achievements">
            <div className="corner-actions">
              <button
                className="icon-button"
                type="button"
                onClick={handleBackHome}
                aria-label="Back to home"
              >
                <img src={backIcon} alt="" />
              </button>
            </div>
            <div className="parchment achievements-panel">
              <h2 className="panel-title">Achievements</h2>
              <p className="panel-subtitle">{subredditLabel}</p>
              {isLoadingUser ? (
                <p className="panel-body">Loading your record...</p>
              ) : currentUser ? (
                <>
                  <div className="stat-grid">
                    <div className="stat">
                      <span className="stat__label">Level</span>
                      <span className="stat__value">{currentUser.level}</span>
                    </div>
                    <div className="stat">
                      <span className="stat__label">XP</span>
                      <span className="stat__value">{currentUser.xp}</span>
                    </div>
                    <div className="stat">
                      <span className="stat__label">Flair</span>
                      <span className="stat__value">{currentUser.flair}</span>
                    </div>
                  </div>
                  {levelProgress && (
                    <div className="progress">
                      <div className="progress__labels">
                        <span>Level {levelProgress.currentTier.level}</span>
                        <span>
                          {levelProgress.nextTier ? `Next: Level ${levelProgress.nextTier.level}` : 'Max level'}
                        </span>
                      </div>
                      <div className="progress__bar">
                        <div
                          className="progress__fill"
                          style={{ width: `${levelProgress.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="panel-body">Play a round to unlock your profile.</p>
              )}
              <div className="actions">
                <button className="text-link" type="button" onClick={handleBackHome}>
                  Back to home
                </button>
              </div>
            </div>
          </main>
        )}

        <div className="preload" aria-hidden="true">
          {preloadImages.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      </div>
    </div>
  );
}
