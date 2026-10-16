import type { RouteObject } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefetch, registerRoutes } from './prefetch';

const setup = (loader = vi.fn(() => null)) => {
  const lazy = vi.fn(async () => ({ loader }));
  const rootLoader = vi.fn(() => null);
  registerRoutes([
    {
      path: '/',
      loader: rootLoader,
      children: [
        { path: 'stays/:id', lazy },
        { path: 'search', lazy: async () => ({}) },
      ],
    },
  ] as RouteObject[]);
  return { lazy, loader, rootLoader };
};

describe('prefetch', () => {
  afterEach(() => registerRoutes([]));

  it('imports the matched route and runs every matched loader with params and the full URL', async () => {
    const { lazy, loader, rootLoader } = setup();
    await prefetch('/stays/h1?in=2026-11-01');
    expect(lazy).toHaveBeenCalledOnce();
    expect(rootLoader).toHaveBeenCalledOnce();
    const args = (loader.mock.calls[0] as unknown as [{ params: unknown; request: Request }])[0];
    expect(args.params).toEqual({ id: 'h1' });
    expect(new URL(args.request.url).search).toBe('?in=2026-11-01');
  });

  it('de-duplicates presses on the same link while one is in flight', async () => {
    const { lazy } = setup();
    await Promise.all([prefetch('/stays/h1'), prefetch('/stays/h1'), prefetch('/stays/h1')]);
    expect(lazy).toHaveBeenCalledOnce();
  });

  it('swallows loader failures (the real navigation shows the error UI)', async () => {
    setup(
      vi.fn(() => {
        throw new Error('offline');
      }),
    );
    await expect(prefetch('/stays/h1')).resolves.toBeUndefined();
  });

  it('ignores other origins and unknown paths', async () => {
    const { lazy, rootLoader } = setup();
    await prefetch('https://example.com/stays/h1');
    expect(lazy).not.toHaveBeenCalled();
    expect(rootLoader).not.toHaveBeenCalled();
    await expect(prefetch('/nowhere/at/all')).resolves.toBeUndefined();
  });
});
