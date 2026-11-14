import Link from 'next/link';
import { LifeBuoy, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminReplySupport, adminUpdateSupport } from '@/lib/actions/admin';
import { formatDate, formatDateTime, initials, titleCase } from '@/lib/format';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; kind?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).support;
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const kind = params.kind ?? '';

  const { data, error } = await ctx.supabase
    .from('support_requests')
    .select(
      '*, profiles(full_name, email, phone), messages:support_ticket_messages(id, author_role, author_name, body, created_at)',
    )
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'support_ticket_messages', ascending: true })
    .limit(500);

  const allRequests = data ?? [];
  const requests = allRequests.filter((request) => {
    if (status && request.status !== status) return false;
    if (kind && request.kind !== kind) return false;
    if (!q) return true;
    const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
    return [request.subject, request.body, request.reference, profile?.full_name, profile?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const open = allRequests.filter((request) => request.status === 'open').length;
  const inProgress = allRequests.filter((request) => request.status === 'in_progress').length;
  const resolved = allRequests.filter((request) => request.status === 'resolved').length;
  const kinds = [...new Set(allRequests.map((request) => request.kind).filter(Boolean))];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <LifeBuoy size={17} />
          </span>
          <strong>{allRequests.length}</strong>
          <span>{t.allRequests}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{open}</strong>
          <span>{t.open}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{inProgress}</strong>
          <span>{t.inProgress}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{resolved}</strong>
          <span>{t.resolved}</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/support" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="kind" defaultValue={kind} aria-label={t.kindLabel}>
          <option value="">{t.allKinds}</option>
          {kinds.map((value) => (
            <option key={value} value={value}>
              {titleCase(value, locale)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allStatuses}</option>
          <option value="open">{t.open}</option>
          <option value="in_progress">{t.inProgress}</option>
          <option value="resolved">{t.resolved}</option>
          <option value="closed">{t.closed}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status || kind ? (
          <Link className="btn sm ghost" href="/admin/support">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {requests.length === 0 ? (
        <EmptyState
          title={q || status || kind ? t.noRequestsMatch : t.noRequestsYet}
          body={
            q || status || kind
              ? t.tryDifferentSearch
              : t.emptyBody
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {requests.map((request) => {
            const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
            return (
              <section className="panel" key={request.id}>
                <div className="panel-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="icon-tile coral" style={{ width: 34, height: 34, borderRadius: 9 }}>
                      <LifeBuoy size={17} />
                    </span>
                    <div>
                      <h3>{request.subject ?? t.supportRequest}</h3>
                      <span className="small muted">
                        {titleCase(request.kind, locale)} ·{' '}
                        {titleCase(request.requester_kind ?? 'customer', locale)} ·{' '}
                        {formatDateTime(request.created_at, locale)}
                      </span>
                    </div>
                  </div>
                  <StatusTag status={request.status} />
                </div>
                <div className="panel-body">
                  <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                    {request.body}
                  </p>

                  <div className="split-list" style={{ marginTop: 14 }}>
                    <div>
                      <span className="k">{t.from}</span>
                      <span className="v small">
                        {profile ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="avatar" style={{ width: 26, height: 26, fontSize: '0.62rem' }}>
                              {initials(profile.full_name ?? profile.email ?? '?')}
                            </span>
                            {profile.full_name ?? profile.email}
                            {request.customer_id ? (
                              <Link href={`/admin/customers/${request.customer_id}`} style={{ textDecoration: 'underline' }}>
                                {t.profile}
                              </Link>
                            ) : null}
                          </span>
                        ) : (
                          t.websiteVisitor
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="k">{c.labels.reference}</span>
                      <span className="v small mono">{request.reference ?? '—'}</span>
                    </div>
                    {request.organization_name ? (
                      <div>
                        <span className="k">{titleCase(request.requester_kind ?? 'customer', locale)}</span>
                        <span className="v small">{request.organization_name}</span>
                      </div>
                    ) : null}
                    <div>
                      <span className="k">{t.received}</span>
                      <span className="v small">{formatDate(request.created_at, locale)}</span>
                    </div>
                  </div>

                  <form action={adminUpdateSupport} className="inline-form" style={{ marginTop: 16 }}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <div className="field">
                      <label htmlFor={`status-${request.id}`}>{t.updateStatus}</label>
                      <select id={`status-${request.id}`} name="status" defaultValue={request.status}>
                        <option value="open">{t.open}</option>
                        <option value="in_progress">{t.inProgress}</option>
                        <option value="resolved">{t.resolved}</option>
                        <option value="closed">{t.closed}</option>
                      </select>
                    </div>
                    <button className="btn sm primary" type="submit">
                      {c.actions.save}
                    </button>
                  </form>

                  <div style={{ marginTop: 18 }}>
                    <span className="k">{t.thread}</span>
                    {(() => {
                      const messages = (request.messages ?? []) as {
                        id: string;
                        author_role: string;
                        author_name: string;
                        body: string;
                        created_at: string;
                      }[];
                      if (messages.length === 0) {
                        return (
                          <p className="small muted" style={{ margin: '6px 0 0' }}>
                            {t.noReplies}
                          </p>
                        );
                      }
                      return (
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              style={{
                                background:
                                  message.author_role === 'admin'
                                    ? 'var(--lavender-soft)'
                                    : 'var(--surface-alt, #f5f6f8)',
                                borderRadius: 10,
                                padding: 10,
                                display: 'grid',
                                gap: 4,
                              }}
                            >
                              <span className="small muted">
                                {message.author_role === 'admin'
                                  ? t.supportTeam
                                  : message.author_name}{' '}
                                · {formatDateTime(message.created_at, locale)}
                              </span>
                              <p className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {message.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <form action={adminReplySupport} className="inline-form" style={{ marginTop: 16 }}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor={`reply-${request.id}`}>{t.reply}</label>
                      <textarea
                        id={`reply-${request.id}`}
                        name="body"
                        rows={3}
                        required
                        placeholder={t.replyPlaceholder}
                      />
                    </div>
                    <button className="btn sm primary" type="submit">
                      {t.sendReply}
                    </button>
                  </form>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
