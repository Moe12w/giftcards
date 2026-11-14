import { LifeBuoy, Send } from 'lucide-react';
import { Notice, EmptyState, StatusTag } from '@/components/ui';
import { submitSupportTicket, type SupportAudience } from '@/lib/actions/support';
import { formatDateTime } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import type { SupportCopyShape } from '@/lib/i18n/support';

export interface SupportTicketRow {
  id: string;
  kind: string;
  requester_kind: string | null;
  organization_name: string | null;
  subject: string | null;
  body: string;
  reference: string | null;
  status: string;
  created_at: string;
}

/**
 * The ticket form and history shared by the vendor, enterprise and business
 * dashboards. It posts to one server action, which re-checks the caller's
 * membership before writing the ticket, so the admin inbox receives tickets
 * from every surface in the same shape.
 */
export function SupportTickets({
  audience,
  returnTo,
  tickets,
  copy: t,
  locale,
  sent,
  error,
}: {
  audience: SupportAudience;
  returnTo: string;
  tickets: SupportTicketRow[];
  copy: SupportCopyShape;
  locale: Locale;
  sent?: boolean;
  error?: string | null;
}) {
  return (
    <>
      <Notice error={error} success={sent ? t.sent : null} />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <LifeBuoy size={17} style={{ display: 'inline', verticalAlign: '-3px' }} />{' '}
              {t.newTicket}
            </h3>
          </div>
          <div className="panel-body">
            <form action={submitSupportTicket} style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="audience" value={audience} />
              <input type="hidden" name="return_to" value={returnTo} />

              <div className="field">
                <label htmlFor="support-subject">{t.subject}</label>
                <input
                  id="support-subject"
                  name="subject"
                  required
                  maxLength={140}
                  placeholder={t.subjectPlaceholder}
                />
              </div>

              <div className="field">
                <label htmlFor="support-message">{t.message}</label>
                <textarea
                  id="support-message"
                  name="body"
                  required
                  rows={6}
                  placeholder={t.messagePlaceholder}
                />
              </div>

              <div className="field">
                <label htmlFor="support-reference">{t.reference}</label>
                <input id="support-reference" name="reference" maxLength={120} />
              </div>

              <div className="btn-row">
                <button className="btn primary" type="submit">
                  <Send size={15} /> {t.send}
                </button>
                <span className="small muted">{t.replyNote}</span>
              </div>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.history}</h3>
            <span className="small muted">{t.historyHint}</span>
          </div>
          <div className="panel-body">
            {tickets.length === 0 ? (
              <EmptyState title={t.empty} body={t.emptyBody} />
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: 14,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ flex: 1 }}>{ticket.subject ?? ticket.kind}</strong>
                      <StatusTag status={ticket.status} />
                    </div>
                    <p className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                      {ticket.body}
                    </p>
                    <span className="small muted">
                      {t.sentOn} {formatDateTime(ticket.created_at, locale)}
                      {ticket.reference ? ` · ${ticket.reference}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
