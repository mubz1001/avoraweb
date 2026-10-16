import { QueryClient } from '@tanstack/react-query';
import { retryDelay, shouldRetry } from '@/lib/api/client';

/** One client for the app and for route loaders. Retries follow docs/06 §1: network/5xx only, twice; mutations never. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, retryDelay, staleTime: 60_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

/** Waits briefly for data so a fast answer renders complete (no skeleton flash); a slow one shows the skeleton. The
 *  budget stays under the ~100ms a tap still feels instant within; intent prefetch (lib/prefetch) usually has the
 *  data cached before the click. Errors are left to the component, which shows the inline retry UI. */
export async function warm(promise: Promise<unknown>, ms = 100): Promise<null> {
  await Promise.race([promise.catch(() => undefined), new Promise((r) => setTimeout(r, ms))]);
  return null;
}
