import React, { useEffect, useMemo, useState } from 'react';
import {
  context,
  getWebViewMode,
  navigateTo,
  requestExpandedMode,
  showToast,
} from '@devvit/web/client';
import type { RiddleV2, User } from '../types/index.js';
import { LEVEL_TIERS } from '../types/index.js';
import { ANSWER_LENGTH_LIMIT_MESSAGE, MAX_MEANINGFUL_ANSWER_LENGTH, getMeaningfulAnswerLength } from './lib/answer';
import { ApiError, api, type SubmitAnswerResult } from './lib/api';
import { getDevvitAvailable, resolveEntrypointName } from './lib/entrypoint';

type Screen = 'launch' | 'home' | 'answer' | 'result' | 'achievements';
type Decision = 'open' | 'ajar' | 'closed';

const DEFAULT_THEME = 'fate';

const DECISION_META: Record<Decision, { label: string; tone: string; className: string }> = {
  open: {
    label: 'Door swings open',
    tone: 'A confident answer with sharp clarity.',
    className: 'decision decision--open',
  },
  ajar: {
    label: 'Door stands ajar',
    tone: 'Close to the heart of the riddle, keep refining.',
    className: 'decision decision--ajar',
  },
  closed: {
    label: 'Door remains sealed',
    tone: 'Take another pass with focus and intent.',
    className: 'decision decision--closed',
  },
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
  const initialMode = useMemo(() => safeGetWebViewMode(), []);
  const webViewMode = safeGetWebViewMode();
  const [screen, setScreen] = useState<Screen>(() => {
    if (!devvitAvailable) {
      return 'home';
    }
    if (entrypointName === 'game' || initialMode === 'expanded') {
      return 'home';
    }
    return 'launch';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState('anonymous');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [themeInput, setThemeInput] = useState('');
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
  const [isLaunching, setIsLaunching] = useState(false);

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

  const handleLaunch = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isLaunching) {
      return;
    }
    setIsLaunching(true);
    let expanded = false;
    if (devvitAvailable) {
      try {
        await requestExpandedMode(event.nativeEvent, 'game');
        expanded = true;
      } catch (err) {
        console.warn('requestExpandedMode failed', err);
        notify('Unable to expand. Opening inline instead.');
      }
    }
    if (!expanded) {
      setScreen('home');
    }
    setIsLaunching(false);
  };

  const handleStartRound = async () => {
    if (isLoadingRiddle) {
      return;
    }
    const theme = themeInput.trim() || DEFAULT_THEME;
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

  const meaningfulLength = getMeaningfulAnswerLength(answerText);
  const decisionMeta = result ? DECISION_META[result.decision] : null;
  const riddleText = riddle?.meta?.riddleText ?? '';

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
    <div className="app">
      <div className="shell">
        <div className="debug-pill">{debugLabel}</div>
        {screen !== 'launch' && (
          <header className="topbar">
            <div className="brand">
              <span className="brand__title">Debattle</span>
              <span className="brand__meta">{subredditLabel}</span>
            </div>
            <div className="profile">
              <div className="profile__name">{resolvedUsername}</div>
              <div className="profile__meta">
                {currentUser ? `Level ${currentUser.level}` : isLoadingUser ? 'Loading...' : 'Guest'}
              </div>
            </div>
          </header>
        )}

        {screen === 'launch' && (
          <main className="screen screen--launch">
            <div className="hero reveal reveal--1">
              <p className="kicker">Ancient doors. Modern riddles.</p>
              <h1 className="title">Debattle</h1>
              <p className="lead">
                Step into the gatekeeper story, answer a riddle in 200 characters, and earn a verdict.
              </p>
              <div className="hero-actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={handleLaunch}
                  disabled={isLaunching}
                >
                  {isLaunching ? 'Opening...' : 'Start the trial'}
                </button>
                <span className="hint">Opens the expanded web view.</span>
              </div>
            </div>
            <div className="card reveal reveal--2">
              <h2 className="card-title">How it works</h2>
              <ol className="steps">
                <li>Knock and receive a riddle from the archive.</li>
                <li>Answer with clarity and intent.</li>
                <li>Share your take with {subredditLabel}.</li>
              </ol>
            </div>
          </main>
        )}

        {screen === 'home' && (
          <main className="screen screen--home">
            <div className="card reveal reveal--1">
              <p className="kicker">Home</p>
              <h2 className="card-title">Knock the door</h2>
              <p className="card-body">
                Choose a theme or leave it blank. The gatekeeper will draw a riddle from the vault.
              </p>
              <label className="label" htmlFor="theme-input">
                Theme
              </label>
              <input
                id="theme-input"
                className="input"
                type="text"
                placeholder={`Try "${DEFAULT_THEME}" or leave empty`}
                value={themeInput}
                onChange={(event) => setThemeInput(event.target.value)}
              />
              <div className="actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={handleStartRound}
                  disabled={isLoadingRiddle}
                >
                  {isLoadingRiddle ? 'Summoning...' : 'Knock the door'}
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => setScreen('achievements')}
                >
                  View achievements
                </button>
              </div>
            </div>
            <div className="card reveal reveal--2">
              <h3 className="card-title">Your standing</h3>
              {isLoadingUser ? (
                <p className="card-body">Loading your record...</p>
              ) : currentUser ? (
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
              ) : (
                <p className="card-body">Play a round to unlock your profile.</p>
              )}
            </div>
          </main>
        )}

        {screen === 'answer' && (
          <main className="screen screen--answer">
            <div className="riddle-card reveal reveal--1">
              <div className="riddle-meta">
                <span className="tag">Riddle</span>
                <span className="timer">Time {formatDuration(elapsedMs)}</span>
              </div>
              <p className="riddle-text">{riddleText || 'Loading riddle...'}</p>
            </div>
            <div className="card reveal reveal--2">
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
              <div className="answer-meta">
                <span className={`meter ${meaningfulLength > MAX_MEANINGFUL_ANSWER_LENGTH ? 'meter--over' : ''}`}>
                  {meaningfulLength}/{MAX_MEANINGFUL_ANSWER_LENGTH} meaningful characters
                </span>
                <div className="actions">
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit answer'}
                  </button>
                  <button className="btn btn--ghost" type="button" onClick={handleBackHome}>
                    Back
                  </button>
                </div>
              </div>
            </div>
          </main>
        )}

        {screen === 'result' && result && decisionMeta && (
          <main className="screen screen--result">
            <div className="card reveal reveal--1">
              <div className={decisionMeta.className}>
                <span className="decision__label">{decisionMeta.label}</span>
                <span className="decision__tone">{decisionMeta.tone}</span>
              </div>
              <p className="feedback">{result.feedback}</p>
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
              {result.areteEvaluation && (
                <div className="arete">
                  <span className="arete__label">Arete score</span>
                  <span className="arete__value">{result.areteEvaluation.totalPoints}/90</span>
                </div>
              )}
            </div>
            <div className="card reveal reveal--2">
              <h3 className="card-title">Share your verdict</h3>
              <p className="card-body">
                Post the answer to {subredditLabel}. Sharing uses your account and can be revoked at any time.
              </p>
              <div className="actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={handleShare}
                  disabled={isSharing}
                >
                  {shareState?.postId ? 'Open shared post' : isSharing ? 'Sharing...' : 'Share to subreddit'}
                </button>
                <button className="btn btn--ghost" type="button" onClick={handlePlayAgain}>
                  Play again
                </button>
              </div>
            </div>
          </main>
        )}

        {screen === 'achievements' && (
          <main className="screen screen--achievements">
            <div className="card reveal reveal--1">
              <h2 className="card-title">Achievements</h2>
              {isLoadingUser ? (
                <p className="card-body">Loading your record...</p>
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
                <p className="card-body">Play a round to unlock your profile.</p>
              )}
              <div className="actions">
                <button className="btn btn--ghost" type="button" onClick={handleBackHome}>
                  Back to home
                </button>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
