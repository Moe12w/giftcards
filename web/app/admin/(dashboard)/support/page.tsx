import Link from 'next/link';
import { LifeBuoy, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminUpdateSupport } from '@/lib/actions/admin';
import { formatDate, formatDateTime, initials, titleCase } from '@/lib/format';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; kind?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const kind = params.kind ?? '';

  const { data, error } = await ctx.supabase
    .from('support_requests')
    .select('*, profiles(full_name, email, phone)')
    .order('created_at', { ascending: false })
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
        eyebrow="Operations"
        title="Support queue"
        description="Customer and visitor messages, from contact form enquiries to account help. Newest first."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Request updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <LifeBuoy size={17} />
          </span>
          <strong>{allRequests.length}</strong>
          <span>All requests</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{open}</strong>
          <span>Open</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{inProgress}</strong>
          <span>In progress</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{resolved}</strong>
          <span>Resolved</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/support" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Subject, body, reference or customer…" aria-label="Search support requests" />
        </div>
        <select name="kind" defaultValue={kind} aria-label="Request kind">
          <option value="">All kinds</option>
          {kinds.map((value) => (
            <option key={value} value={value}>
              {titleCase(value)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Request status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status || kind ? (
          <Link className="btn sm ghost" href="/admin/support">
            Clear
          </Link>
        ) : null}
      </form>

      {requests.length === 0 ? (
        <EmptyState
          title={q || status || kind ? 'No requests match' : 'No support requests yet'}
          body={
            q || status || kind
              ? 'Try a different search or clear the filters.'
              : 'Messages from the contact form and customer app will appear here.'
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
                      <h3>{request.subject ?? 'Support request'}</h3>
                      <span className="small muted">
                        {titleCase(request.kind)} · {formatDateTime(request.created_at)}
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
                      <span className="k">From</span>
                      <span className="v small">
                        {profile ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="avatar" style={{ width: 26, height: 26, fontSize: '0.62rem' }}>
                              {initials(profile.full_name ?? profile.email ?? '?')}
                            </span>
                            {profile.full_name ?? profile.email}
                            {request.customer_id ? (
                              <Link href={`/admin/customers/${request.customer_id}`} style={{ textDecoration: 'underline' }}>
                                Profile
                              </Link>
                            ) : null}
                          </span>
                        ) : (
                          'Website visitor'
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="k">Reference</span>
                      <span className="v small mono">{request.reference ?? '—'}</span>
                    </div>
                    <div>
                      <span className="k">Received</span>
                      <span className="v small">{formatDate(request.created_at)}</span>
                    </div>
                  </div>

                  <form action={adminUpdateSupport} className="inline-form" style={{ marginTop: 16 }}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <div className="field">
                      <label htmlFor={`status-${request.id}`}>Update status</label>
                      <select id={`status-${request.id}`} name="status" defaultValue={request.status}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <button className="btn sm primary" type="submit">
                      Save
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
