import { tokenParam } from '@devvit/shared-types/webbit';
import type { AreteEvaluation, RiddleV2, User } from '../../types/index.js';

export type SubmitAnswerResult = {
  score: { wit: number; logic: number; style: number; total: number };
  feedback: string;
  decision: 'open' | 'ajar' | 'closed';
  responseId: string;
  areteEvaluation?: AreteEvaluation;
};

export type ShareResponseResult = {
  postId: string;
  permalink?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

type RequestOptions = RequestInit & { body?: unknown };

const getWebbitToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get(tokenParam);
  if (fromUrl) {
    return fromUrl;
  }
  const devvitGlobal = (globalThis as any).devvit as { token?: unknown } | undefined;
  const token = devvitGlobal?.token;
  return typeof token === 'string' ? token : null;
};

const withRequestToken = (path: string): string => {
  if (typeof window === 'undefined') {
    return path;
  }
  const token = getWebbitToken();
  if (!token) {
    return path;
  }
  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has(tokenParam)) {
    url.searchParams.set(tokenParam, token);
  }
  return url.toString();
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const url = withRequestToken(path);
  const headers = new Headers(options.headers);
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { ...options, headers, body, credentials: options.credentials ?? 'include' });
  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      if (res.ok) {
        throw new ApiError('Invalid JSON response', res.status);
      }
    }
  }

  if (!res.ok) {
    const payload = (data ?? {}) as ApiErrorPayload;
    const message = payload.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload.code);
  }

  return (data ?? {}) as T;
};

export const api = {
  getCurrentUser: () => request<{ currentUser: User | null; username: string }>('/api/user/current'),
  createRiddle: (payload: { theme: string; playerUsername?: string; question?: unknown }) =>
    request<{ riddle: RiddleV2 }>('/api/riddle/create', { method: 'POST', body: payload }),
  getRiddle: (id: string) =>
    request<{ riddle: RiddleV2 }>(`/api/riddle/${encodeURIComponent(id)}`),
  submitAnswer: (payload: {
    riddleId: string;
    playerUsername?: string;
    answerText: string;
    elapsed: number;
  }) => request<SubmitAnswerResult>('/api/answer/submit', { method: 'POST', body: payload }),
  shareResponse: (payload: {
    riddleId: string;
    responseId: string;
    questionText: string;
    answerText: string;
    playerUsername?: string;
    totalScore: number;
    decision: 'open' | 'ajar' | 'closed';
    feedback: string;
    subredditName?: string;
  }) => request<ShareResponseResult>('/api/share', { method: 'POST', body: payload }),
};
