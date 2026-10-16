import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { createAppRouter, preloadRoute } from './app/router';
import { ToastProvider } from './components/Toast';
import { config } from './lib/config';
import { queryClient } from './lib/queryClient';
import { MOCK_LOST } from './lib/api/client';
import { initLang } from './lib/i18n';
import { initTheme } from './lib/theme';
import './styles/tokens.css';
import './styles/base.css';
import './styles/forms.css';
import './styles/surfaces.css';
import './styles/motion.css';

/** The mock backend (MSW) is a service worker. Mobile browsers (iOS Safari especially) drop it after a tab has been left
 *  alone, restore a page from the back-forward cache with nothing behind it, or serve a first visit without a controlling
 *  worker; the requests then hit the host and come back "page not found". Each case reloads once to get a working worker. */
const RELOAD_KEY = 'avora.mock-reload';
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: reloading once more than needed is better than a broken page */
  }
  window.location.reload();
  return true;
}

/** The mock backend (MSW) starts before the first request; it is a separate chunk and never loads when a real API is
 *  configured (VITE_API_MOCK=false). */
async function start() {
  // Somali/Arabic strings (a separate chunk) and the first page's code download while the mock API starts.
  const lang = initLang();
  initTheme();
  preloadRoute(window.location.href);
  if (config.mockApi) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js', options: { updateViaCache: 'none' } },
    });
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller && reloadOnce()) return;
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) reloadOnce();
    });
    window.addEventListener(MOCK_LOST, reloadOnce);
  }
  await lang;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={createAppRouter()} />
        </ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void start();
