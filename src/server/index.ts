import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, getServerPort, context, reddit, redis, settings } from '@devvit/web/server';
import { Service } from '../services/Service.js';
import { hydrateCurrentUser } from '../utils/user.js';

const MAX_BODY_BYTES = 1024 * 1024;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const sendJson = (res: ServerResponse, statusCode: number, payload: JsonValue): void => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
};

const sendError = (res: ServerResponse, statusCode: number, message: string, code?: string): void => {
  const payload: Record<string, JsonValue> = { error: message };
  if (code) payload.code = code;
  sendJson(res, statusCode, payload);
};

const readJson = async <T>(req: IncomingMessage): Promise<T> => {
  const contentLengthHeader = req.headers['content-length'];
  const rawLength = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
  const contentLength = rawLength ? Number(rawLength) : 0;
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error('Payload too large');
  }

  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.length;
      if (received > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        reject(new Error('Missing JSON body'));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', (err) => reject(err));
  });
};

const resolveUsername = (bodyValue: unknown): string => {
  const contextUsername = typeof context.username === 'string' ? context.username.trim() : '';
  if (contextUsername) {
    return contextUsername;
  }
  const bodyUsername = typeof bodyValue === 'string' ? bodyValue.trim() : '';
  return bodyUsername || 'anonymous';
};

const isUserActionError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return (
    message.includes('Scope.SUBMIT_POST') ||
    message.includes('userActions') ||
    message.includes('runAs') ||
    message.includes('permission')
  );
};

const getService = (): Service => {
  const getSetting = settings?.get?.bind(settings);
  return new Service(redis, reddit, { getSetting });
};

const server = createServer(async (req, res) => {
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  if (!url) {
    sendError(res, 400, 'Invalid request');
    return;
  }

  if (!url.pathname.startsWith('/api/')) {
    sendError(res, 404, 'Not Found');
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/user/current') {
      const service = getService();
      const { currentUser, username } = await hydrateCurrentUser(
        { ...context, reddit, redis },
        service
      );
      sendJson(res, 200, { currentUser, username });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/riddle/create') {
      const body = await readJson<{
        theme?: string;
        playerUsername?: string;
        question?: unknown;
      }>(req);
      const theme = typeof body.theme === 'string' ? body.theme.trim() : '';
      if (!theme) {
        sendError(res, 400, 'Missing theme');
        return;
      }
      const service = getService();
      const riddle = await service.createRiddleFromTheme({
        theme,
        playerUsername: resolveUsername(body.playerUsername),
        question: body.question as any,
      });
      if (!riddle) {
        sendError(res, 500, 'Failed to create riddle');
        return;
      }
      sendJson(res, 200, { riddle });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/riddle/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/riddle/', '').trim());
      if (!id) {
        sendError(res, 400, 'Missing riddle id');
        return;
      }
      const service = getService();
      const riddle = await service.getRiddle(id);
      if (!riddle) {
        sendError(res, 404, 'Riddle not found');
        return;
      }
      sendJson(res, 200, { riddle });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/answer/submit') {
      const body = await readJson<{
        riddleId?: string;
        playerUsername?: string;
        answerText?: string;
        elapsed?: number;
      }>(req);
      const riddleId = typeof body.riddleId === 'string' ? body.riddleId.trim() : '';
      const answerText = typeof body.answerText === 'string' ? body.answerText : '';
      const elapsedValue = Number(body.elapsed);
      const elapsed = Number.isFinite(elapsedValue) ? elapsedValue : 0;
      if (!riddleId || !answerText) {
        sendError(res, 400, 'Missing riddleId or answerText');
        return;
      }
      const service = getService();
      const result = await service.submitAnswer({
        riddleId,
        playerUsername: resolveUsername(body.playerUsername),
        answerText,
        elapsed,
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/share') {
      const body = await readJson<{
        riddleId?: string;
        responseId?: string;
        questionText?: string;
        answerText?: string;
        playerUsername?: string;
        totalScore?: number;
        decision?: 'open' | 'ajar' | 'closed';
        feedback?: string;
        subredditName?: string;
      }>(req);
      const riddleId = typeof body.riddleId === 'string' ? body.riddleId.trim() : '';
      const responseId = typeof body.responseId === 'string' ? body.responseId.trim() : '';
      const questionText = typeof body.questionText === 'string' ? body.questionText : '';
      const answerText = typeof body.answerText === 'string' ? body.answerText : '';
      const decision = body.decision;
      const totalScoreValue = Number(body.totalScore);
      if (!riddleId || !responseId || !questionText || !answerText || !decision) {
        sendError(res, 400, 'Missing share payload fields');
        return;
      }
      if (decision !== 'open' && decision !== 'ajar' && decision !== 'closed') {
        sendError(res, 400, 'Invalid decision');
        return;
      }
      if (!context.userId) {
        sendError(res, 401, 'User is not logged in', 'user_actions_required');
        return;
      }
      const service = getService();
      try {
        const result = await service.shareResponseToSubreddit({
          riddleId,
          responseId,
          questionText,
          answerText,
          playerUsername: resolveUsername(body.playerUsername),
          totalScore: Number.isFinite(totalScoreValue) ? totalScoreValue : 0,
          decision,
          feedback: typeof body.feedback === 'string' ? body.feedback : '',
          subredditName: context.subredditName || body.subredditName,
        });
        sendJson(res, 200, result);
        return;
      } catch (err) {
        if (isUserActionError(err)) {
          sendError(res, 403, 'User action permission required', 'user_actions_required');
          return;
        }
        throw err;
      }
    }

    sendError(res, 404, 'Not Found');
  } catch (err) {
    console.error('web server error', err);
    sendError(res, 500, 'Internal Server Error');
  }
});

server.on('error', (error) => {
  console.error('server error;', error);
});

server.listen(getServerPort());

export default server;
