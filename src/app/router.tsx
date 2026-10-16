import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { BootShell, RootLayout } from './RootLayout';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';
import { preloadChunks, registerRoutes } from '@/lib/prefetch';
import { queryClient } from '@/lib/queryClient';
import { sessionQuery } from '@/lib/session';

/** Route table (docs/02 §1). Every page is its own chunk; route modules export `Component`, and optionally `loader`
 *  and `handle`. The root loader resolves the session first so the header never flashes the wrong account state.
 *  The router is created on demand: a data router starts loading as soon as it exists, so it must come after the mock
 *  API is up. The same table drives intent prefetch (lib/prefetch). */
const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: BootShell,
    ErrorBoundary: RouteError,
    loader: () => queryClient.ensureQueryData(sessionQuery).catch(() => null),
    // The session is query state after the first load; navigations don't need to re-check it.
    shouldRevalidate: () => false,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          { index: true, lazy: () => import('./routes/home') },
          { path: 'search', lazy: () => import('./routes/search') },
          { path: 'stays/:id', lazy: () => import('./routes/property') },
          { path: 'stays/:id/reviews', lazy: () => import('./routes/reviews') },
          { path: 'checkout', lazy: () => import('./routes/checkout') },
          { path: 'orders/:id', lazy: () => import('./routes/order') },
          { path: 'bookings/:ref', lazy: () => import('./routes/booking') },
          { path: 'support', lazy: () => import('./routes/support') },
          { path: 'account/support', element: <Navigate to="/support" replace /> },
          { path: 'account', lazy: () => import('./routes/account') },
          { path: 'account/:tab', lazy: () => import('./routes/account') },
          { path: 'signin', lazy: () => import('./routes/auth') },
          { path: 'signup', lazy: () => import('./routes/auth') },
          { path: 'signup/complete', lazy: () => import('./routes/auth') },
          { path: 'forgot-password', lazy: () => import('./routes/auth') },
          { path: 'reset-password', lazy: () => import('./routes/auth') },
          { path: 'legal/:doc', lazy: () => import('./routes/legal') },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
];

/** Starts downloading the first page's code at start-up, so it overlaps the mock API starting. */
export function preloadRoute(href: string) {
  registerRoutes(routes);
  void preloadChunks(href);
}

export function createAppRouter() {
  registerRoutes(routes);
  return createBrowserRouter(routes);
}
