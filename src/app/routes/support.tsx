import { Accordion, useAccordion } from '@/components/Accordion';
import { WhatsAppIcon } from '@/components/BrandIcons';
import { ExternalButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { FAQ } from '@/features/support/faq';
import { config } from '@/lib/config';
import '@/features/account/account.css';
import '@/features/support/support.css';

/** One question: the shared accordion (same height animation, chevron and focus ring as every other expandable row). */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const item = useAccordion();
  return (
    <div className="faq-item">
      <button type="button" className="rowbtn" {...item.triggerProps}>
        <span className="grow">{question}</span>
        <span className="chev">
          <Icon name="chev" />
        </span>
      </button>
      <Accordion {...item.panelProps} padded={false}>
        <p className="muted">{answer}</p>
      </Accordion>
    </div>
  );
}

/** Help centre (docs/05 SupportPage): the questions people ask, with customer service on WhatsApp beside them. A page
 *  of its own, open to everyone: guests have no account to put it in. */
export function Component() {
  return (
    <div className="wrap">
      <title>Support · Avora Bookings</title>
      <h1 className="pagetitle">Support</h1>
      <div className="support">
        <section className="support-faq" aria-label="Frequently asked questions">
          {FAQ.map((g) => (
            <div key={g.title}>
              <h2>{g.title}</h2>
              <div className="faq">
                {g.items.map(([q, a]) => (
                  <FaqItem key={q} question={q} answer={a} />
                ))}
              </div>
            </div>
          ))}
        </section>
        <aside className="card support-help" aria-label="Contact customer service">
          <h2>Still need help?</h2>
          <p className="muted">Chat with customer service on WhatsApp. We usually reply within a few minutes.</p>
          <ExternalButton variant="wa" block href={`https://wa.me/${config.whatsapp}`}>
            <WhatsAppIcon /> Chat on WhatsApp
          </ExternalButton>
        </aside>
      </div>
    </div>
  );
}
