import { isRouteErrorResponse, useRouteError } from 'react-router';
import { NotFound } from './NotFound';
import { Button } from '@/components/Button';
import { useSeo } from '@/lib/seo';
import { t } from '@/lib/i18n';

/** Per-route error boundary. A failed lazy chunk (usually a deploy while the tab was open) gets a reload; anything else
 *  gets a calm message instead of a blank screen. */
export function RouteError() {
  useSeo({ noindex: true });
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  const chunk =
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|error loading/i.test(error.message);
  return (
    <div className="wrap" style={{ marginTop: 20 }}>
      <title>{t('Something went wrong · Avora Bookings')}</title>
      <div className="card empty" role="alert">
        <h2>{chunk ? t('A new version of AVORA is available') : t('Something went wrong')}</h2>
        <p className="muted">
          {chunk
            ? t('Reload to continue where you left off.')
            : t('Please try again. If it keeps happening, contact us on WhatsApp.')}
        </p>
        <Button onClick={() => window.location.reload()}>{t('Reload')}</Button>
      </div>
    </div>
  );
}
