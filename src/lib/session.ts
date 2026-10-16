import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useLocation } from 'react-router';
import { useToast } from '@/components/Toast';
import { clearReviewDrafts } from '@/lib/reviewDrafts';
import { isApiError, SESSION_LOST } from '@/lib/api/client';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { mergeDeviceBasket } from '@/lib/basket';
import { queryClient } from '@/lib/queryClient';
import { safeNext } from '@/lib/safeNext';
import type { Member } from '@/types';

/**
 * The signed-in member is server state (docs/04 §A.5): GET /me, `null` on 401. Signing in or out updates the cache,
 * drops member-scoped data and tells other tabs through a BroadcastChannel, so no tab keeps showing a stale account.
 */
const CHANNEL = 'avora-session';

export async function fetchSession(): Promise<Member | null> {
  try {
    return (await accountApi.me()).member;
  } catch (e) {
    if (isApiError(e) && e.status === 401) return null;
    throw e;
  }
}

/** `retryOnMount: false`: a failed session check must not refetch each time a component subscribes. That flipped the
 *  query back to pending, which remounted its subscribers, which refetched again, in a request storm. */
export const sessionQuery = {
  queryKey: queryKeys.me,
  queryFn: fetchSession,
  staleTime: 5 * 60_000,
  retryOnMount: false,
} as const;

export function useSession() {
  const q = useQuery(sessionQuery);
  // `failed`: the check itself could not be made (offline, a 5xx), which is not the same as being signed out.
  return { member: q.data ?? null, loading: q.isPending, failed: q.isError && q.data === undefined, error: q.error };
}

/** Asks again after a failed check. */
export const retrySession = () => queryClient.refetchQueries({ queryKey: queryKeys.me, exact: true });

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

function resetMemberData(member: Member | null) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'me' && q.queryKey.length > 1 });
  queryClient.removeQueries({ queryKey: ['booking'] });
  queryClient.setQueryData(queryKeys.me, member);
}

/** After any successful sign-in or sign-up: bring the device basket into the account, then switch the UI over. */
export async function completeSignIn(member: Member) {
  await mergeDeviceBasket();
  resetMemberData(member);
  channel?.postMessage('changed');
}

/** Signs out. The session lives in an HttpOnly cookie that only the server can clear, so when the request fails the
 *  member stays signed in (and is told) rather than the screen claiming a sign-out that didn't happen. A session the
 *  server no longer knows (401) is already signed out. Returns whether the sign-out happened. */
export async function signOut() {
  try {
    await accountApi.logout();
  } catch (e) {
    if (!(isApiError(e) && e.status === 401)) return false;
  }
  resetMemberData(null);
  clearReviewDrafts(); // on purpose: unsent reviews don't stay behind on a shared computer (an expired session keeps them)
  channel?.postMessage('changed');
  return true;
}

/** Signs out and says how it went. */
export async function signOutAndSay(say: (message: string) => void) {
  say((await signOut()) ? "You've signed out" : 'We couldn’t sign you out. Check your connection and try again.');
}

/** Member deleted their account, or the server says the session is gone. */
export function forgetSession() {
  resetMemberData(null);
  channel?.postMessage('changed');
}

/** Mounted once in the root layout: reacts to sign-in/out in other tabs. */
export function useSessionSync() {
  const toast = useToast();
  useEffect(() => {
    if (!channel) return;
    const on = () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'me' && q.queryKey.length > 1 });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me, exact: true });
    };
    channel.addEventListener('message', on);
    return () => channel.removeEventListener('message', on);
  }, []);
  // Any other request that finds the session gone signs this tab (and the others) out.
  useEffect(() => {
    const lost = () => {
      if (!queryClient.getQueryData(queryKeys.me)) return;
      forgetSession();
      toast('Your session has ended. Sign in again.');
    };
    window.addEventListener(SESSION_LOST, lost);
    return () => window.removeEventListener(SESSION_LOST, lost);
  }, [toast]);
}

export type AuthMode = 'signin' | 'signup';

/** Link to sign in / create an account that returns here afterwards. On an auth page the existing `next` is kept. */
export function useAuthHref() {
  const loc = useLocation();
  return useCallback(
    (mode: AuthMode = 'signin', next?: string) => {
      const onAuth = /^\/(signin|signup|forgot-password|reset-password)/.test(loc.pathname);
      const target =
        next ?? (onAuth ? safeNext(new URLSearchParams(loc.search).get('next')) : loc.pathname + loc.search);
      return `/${mode}?${new URLSearchParams({ next: target })}`;
    },
    [loc.pathname, loc.search],
  );
}
