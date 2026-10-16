import { ButtonLink } from '@/components/Button';
import './not-found.css';
import { t } from '@/lib/i18n';
import { useSeo } from '@/lib/seo';

export function NotFound({ title = 'Page not found', body }: { title?: string; body?: string }) {
  useSeo({ noindex: true });
  return (
    <div className="wrap nf">
      <title>{`${t('Page not found')} · Avora Bookings`}</title>
      <h1 className="nf-title">{t(title)}</h1>
      {body ? <p className="muted nf-body">{body}</p> : null}
      <div className="nf-actions">
        <ButtonLink to="/">{t('Back to home')}</ButtonLink>
      </div>
    </div>
  );
}

export const Component = NotFound;
