import Link from 'next/link';
import { Building2, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials } from '@/lib/format';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminSetBusinessAccountStatus } from '@/lib/actions/admin';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

const statuses = ['pending_approval', 'approved', 'rejected', 'suspended'] as const;

export default async function AdminBusinessAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const statusFilter = params.status ?? '';

  const { data: accounts, error } = await ctx.supabase
    .from('business_accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  const userIds = (accounts ?? []).map((a) => a.user_id);
  const { data: profiles } = userIds.length
    ? await ctx.supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] as any[] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows = (accounts ?? []).filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (!q) return true;
    const p = profileMap.get(a.user_id);
    return [a.company_name, a.contact_name, a.business_email, a.phone, a.country, a.business_type, p?.full_name, p?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const pending = (accounts ?? []).filter((a) => a.status === 'pending_approval').length;
  const approved = (accounts ?? []).filter((a) => a.status === 'approved').length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Network"
        title="Business / bulk buyer accounts"
        description="Review business registrations for bulk purchasing. Only approved accounts can access and buy restricted bulk offers."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Account status updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon"><Building2 size={17} /></span>
          <strong>{(accounts ?? []).length}</strong>
          <span>Total business accounts</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}><Building2 size={17} /></span>
          <strong>{pending}</strong>
          <span>Pending approval</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}><Building2 size={17} /></span>
          <strong>{approved}</strong>
          <span>Approved</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/business-accounts" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Company, contact, email…" aria-label="Search business accounts" />
        </div>
        <select name="status" defaultValue={statusFilter} aria-label="Status">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button className="btn sm" type="submit">{c.actions.filter}</button>
        {q || statusFilter ? <Link className="btn sm ghost" href="/admin/business-accounts">{c.actions.clear}</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={q || statusFilter ? 'No accounts match' : 'No business accounts yet'}
          body={q || statusFilter ? 'Try a different search or clear the filters.' : 'When businesses register for bulk buying, their applications will appear here for approval.'}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{rows.length} {rows.length === 1 ? 'account' : 'accounts'}</h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const p = profileMap.get(a.user_id);
                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>{initials(a.company_name || '?')}</span>
                            <div>
                              <span className="strong">{a.company_name}</span>
                              <br />
                              <span className="sub">{a.business_type || '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="small">{a.contact_name}</span><br />
                          <span className="sub">{a.business_email}</span><br />
                          <span className="sub">{a.phone || p?.email || '—'}</span>
                        </td>
                        <td>
                          <span className="small">{a.country}</span><br />
                          <span className="sub">CR: {a.company_registration_number || '—'}</span>
                          {a.decision_note ? (<><br /><span className="sub">Note: {a.decision_note}</span></>) : null}
                        </td>
                        <td><StatusTag status={a.status} /></td>
                        <td className="small muted">{formatDate(a.created_at, locale)}</td>
                        <td>
                          <div className="row-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
                            {a.status !== 'approved' ? (
                              <form action={adminSetBusinessAccountStatus}>
                                <input type="hidden" name="account_id" value={a.id} />
                                <input type="hidden" name="status" value="approved" />
                                <input type="hidden" name="return_to" value="/admin/business-accounts" />
                                <button className="btn sm primary" type="submit">Approve</button>
                              </form>
                            ) : (
                              <form action={adminSetBusinessAccountStatus}>
                                <input type="hidden" name="account_id" value={a.id} />
                                <input type="hidden" name="status" value="suspended" />
                                <input type="hidden" name="return_to" value="/admin/business-accounts" />
                                <button className="btn sm" type="submit">Suspend</button>
                              </form>
                            )}
                            {a.status === 'pending_approval' ? (
                              <form action={adminSetBusinessAccountStatus}>
                                <input type="hidden" name="account_id" value={a.id} />
                                <input type="hidden" name="status" value="rejected" />
                                <input type="hidden" name="return_to" value="/admin/business-accounts" />
                                <button className="btn sm ghost" type="submit">Reject</button>
                              </form>
                            ) : null}
                            {a.status === 'rejected' || a.status === 'suspended' ? (
                              <form action={adminSetBusinessAccountStatus}>
                                <input type="hidden" name="account_id" value={a.id} />
                                <input type="hidden" name="status" value="pending_approval" />
                                <input type="hidden" name="return_to" value="/admin/business-accounts" />
                                <button className="btn sm ghost" type="submit">Set pending</button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
