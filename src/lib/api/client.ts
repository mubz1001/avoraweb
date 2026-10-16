import type { ZodType } from 'zod';
import { config } from '@/lib/config';

/** docs/06 §1 error envelope as a throwable. `retryable` drives the query retry policy (network and 5xx only). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;
  readonly retryable: boolean;
  readonly retryAfter: number | null;
  readonly body: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    o: { fieldErrors?: Record<string, string>; retryable?: boolean; retryAfter?: number | null; body?: unknown } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = o.fieldErrors ?? {};
    this.retryable = o.retryable ?? (status === 0 || status >= 500);
    this.retryAfter = o.retryAfter ?? null;
    this.body = o.body;
  }
}

/** Fired on `window` when the server says the member's session is gone (see `useSessionSync`). */
export const SESSION_LOST = 'avora:session-lost';

/** Mock backend only: an answer from the host instead of the mock means the service worker is gone (see main.tsx). */
export const MOCK_LOST = 'avora:mock-lost';

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export interface RequestOptions<T> {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Zod schema for the response. Omit for 204 endpoints. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Guest payment token (docs/06 Authentication, level 2). */
  bearer?: string;
}

/** Double-submit CSRF: the server sets a readable `csrf` cookie next to the HttpOnly session cookie. */
const csrfToken = () =>
  typeof document === 'undefined' ? '' : (/(?:^|;\s*)csrf=([^;]+)/.exec(document.cookie)?.[1] ?? '');

/** Longest a request may wait for an answer. Long enough for a slow mobile network, short enough that a stuck spinner
 *  turns into a message and a retry. */
const REQUEST_TIMEOUT_MS = 20_000;

export async function api<T = void>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  o: RequestOptions<T> = {},
): Promise<T> {
  const url = new URL(config.apiBase + path, window.location.origin);
  for (const [k, v] of Object.entries(o.query ?? {}))
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.idempotencyKey) headers['Idempotency-Key'] = o.idempotencyKey;
  if (o.bearer) headers.Authorization = `Bearer ${o.bearer}`;
  if (method !== 'GET') {
    const csrf = csrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  // A request that never answers must not hold the screen forever: give up after a while (the caller may still ask again).
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      signal: o.signal ? AbortSignal.any([o.signal, timeout]) : timeout,
      ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
    });
  } catch (e) {
    if (timeout.aborted && !o.signal?.aborted)
      throw new ApiError(0, 'TIMEOUT', 'AVORA is taking too long to answer. Please try again.', { retryable: true });
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'We couldn’t reach AVORA. Check your connection and try again.', {
      retryable: true,
    });
  }

  if (!res.ok) {
    let env: {
      error?: { code?: string; message?: string; fieldErrors?: Record<string, string>; retryable?: boolean };
    } & Record<string, unknown> = {};
    try {
      env = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const hostAnswered = config.mockApi && !(res.headers.get('content-type') ?? '').includes('json');
    if (hostAnswered) window.dispatchEvent(new Event(MOCK_LOST));
    // The session ended while someone was signed in. Announced once for the app to sign the UI out; `/me` is how a
    // signed-out visitor is found (not a loss), and `/orders` keeps its form (checkout explains it in place).
    if (res.status === 401 && env.error?.code === 'UNAUTHORIZED' && path !== '/me' && !path.startsWith('/orders'))
      window.dispatchEvent(new Event(SESSION_LOST));
    const retryAfter = Number(res.headers.get('Retry-After'));
    throw new ApiError(
      res.status,
      env.error?.code ?? 'INTERNAL',
      env.error?.message ?? 'Something went wrong. Please try again.',
      {
        ...(env.error?.fieldErrors ? { fieldErrors: env.error.fieldErrors } : {}),
        retryable: hostAnswered || (env.error?.retryable ?? res.status >= 500),
        retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
        body: env,
      },
    );
  }

  if (res.status === 204 || !o.schema) return undefined as T;
  const json: unknown = await res.json();
  const parsed = o.schema.safeParse(json);
  if (!parsed.success)
    throw new ApiError(res.status, 'BAD_RESPONSE', 'We got an unexpected answer from the server.', {
      retryable: false,
      body: parsed.error.issues,
    });
  return parsed.data;
}

/** Retry policy for queries (docs/06 §1): twice with 1 s then 3 s backoff, on network/5xx only, never on 4xx. */
export const shouldRetry = (count: number, error: unknown) => count < 2 && isApiError(error) && error.retryable;
export const retryDelay = (attempt: number) => (attempt === 0 ? 1000 : 3000);
