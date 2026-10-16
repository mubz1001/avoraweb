import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, isApiError } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('api timeout', () => {
  it('turns a request that never answers into a retryable TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: unknown, init: RequestInit) =>
        new Promise((_res, rej) =>
          init.signal!.addEventListener('abort', () => rej(new DOMException('x', 'TimeoutError'))),
        ),
    );
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const c = new AbortController();
      queueMicrotask(() => c.abort());
      return c.signal;
    });
    const e = await api('GET', '/search').catch((x: unknown) => x);
    expect(isApiError(e) && e.code === 'TIMEOUT' && e.retryable).toBe(true);
  });

  it('still lets a caller cancel its own request without calling it a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: unknown, init: RequestInit) =>
        new Promise((_res, rej) =>
          init.signal!.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))),
        ),
    );
    const c = new AbortController();
    const p = api('GET', '/search', { signal: c.signal });
    c.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
