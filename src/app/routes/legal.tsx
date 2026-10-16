import { useParams } from 'react-router';
import { NotFound } from '../NotFound';
import { LEGAL } from '@/features/legal/content';
import '@/features/legal/legal.css';

const DOCS = { terms: 'Terms', privacy: 'Privacy' } as const;

/** Terms and Privacy (docs/01 §8): a short summary, the contents, then numbered sections. Plain text from
 *  `features/legal/content.ts`, rendered as text. */
export function Component() {
  const { doc = '' } = useParams();
  if (!(doc in DOCS)) return <NotFound />;
  const key = doc as keyof typeof DOCS;
  const d = LEGAL[key];
  return (
    <div className="wrap">
      <title>{`${DOCS[key]} · Avora Bookings`}</title>
      <h1 className="pagetitle">{d.title}</h1>
      <article className="legal">
        <p className="muted small">Last updated: {d.updated}</p>
        <section className="card legal-short" aria-labelledby="legal-short">
          <h2 id="legal-short">In short</h2>
          {d.inShort.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
        <nav className="card legal-toc" aria-labelledby="legal-toc">
          <h2 id="legal-toc">On this page</h2>
          <ol>
            {d.sections.map((s, i) => (
              <li key={s.title}>
                <a href={`#s${i + 1}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        {d.sections.map((s, i) => (
          <section key={s.title} id={`s${i + 1}`} className="legal-sec" aria-labelledby={`s${i + 1}-h`}>
            <h2 id={`s${i + 1}-h`}>
              {i + 1}. {s.title}
            </h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
