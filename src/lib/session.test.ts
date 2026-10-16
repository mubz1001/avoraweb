import { act, renderHook, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut, useSessionSync } from './session';
import { ToastProvider } from '@/components/Toast';
import { readReviewDraft, saveReviewDraft } from '@/lib/reviewDrafts';
import { ApiError, SESSION_LOST } from '@/lib/api/client';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { queryClient } from '@/lib/queryClient';

vi.mock('@/lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/endpoints')>()),
  accountApi: { logout: vi.fn() },
}));
const logout = vi.mocked(accountApi.logout);
const member = { id: 'u1' };

beforeEach(() => {
  sessionStorage.clear();
  logout.mockReset();
  queryClient.setQueryData(queryKeys.me, member);
});

describe('signOut', () => {
  it('signs out when the server confirms', async () => {
    logout.mockResolvedValue(undefined);
    expect(await signOut()).toBe(true);
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });

  it('stays signed in, and says so, when the request fails: the cookie is still on the server', async () => {
    logout.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
    expect(await signOut()).toBe(false);
    expect(queryClient.getQueryData(queryKeys.me)).toBe(member);
  });

  it('treats a session the server no longer knows as already signed out', async () => {
    logout.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'gone'));
    expect(await signOut()).toBe(true);
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });
});

describe('review drafts across sign-out and expiry', () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(ToastProvider, null, children);

  it('drops unsent reviews on an explicit sign-out', async () => {
    saveReviewDraft('u1', 'AV-1', { score: 4, text: 'Half a review' });
    logout.mockResolvedValue(undefined);
    await signOut();
    expect(readReviewDraft('u1', 'AV-1')).toBeUndefined();
  });

  it('signs out and says why when the session is lost, keeping unsent reviews', () => {
    saveReviewDraft('u1', 'AV-1', { score: 4, text: 'Half a review' });
    renderHook(() => useSessionSync(), { wrapper });
    act(() => {
      window.dispatchEvent(new Event(SESSION_LOST));
    });
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Your session has ended. Sign in again.');
    expect(readReviewDraft('u1', 'AV-1')).toEqual({ score: 4, text: 'Half a review' });
  });
});
