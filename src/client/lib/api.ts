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

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const res = await fetch(path, { ...options, headers, body });
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
