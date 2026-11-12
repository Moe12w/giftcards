import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).customers;
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const [profilesResult, ordersResult, vouchersResult, rolesResult] = await Promise.all([
    ctx.supabase
      .from('profiles')
      .select('id, full_name, email, phone, preferred_language, is_admin, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    ctx.supabase
      .from('orders')
      .select('id, buyer_id, status, total_minor, created_at')
      .order('created_at', { ascending: false })
      .limit(3000),
    ctx.supabase
      .from('vouchers')
      .select('id, buyer_id, status, initial_value_minor, created_at')
      .order('created_at', { ascending: false })
      .limit(3000),
    ctx.supabase.from('user_roles').select('user_id, role'),
  ]);

  const error = profilesResult.error ?? ordersResult.error ?? null;

  const orders = ordersResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const roleMap = new Map((rolesResult.data ?? []).map((row) => [row.user_id, row.role]));

  const orderStats = new Map<string, { paidCount: number; paidValue: number; lastOrder: string | null }>();
  for (const order of orders) {
    if (!order.buyer_id) continue;
    const current = orderStats.get(order.buyer_id) ?? { paidCount: 0, paidValue: 0, lastOrder: null };
    if (order.status === 'paid') {
      current.paidCount += 1;
      current.paidValue += Number(order.total_minor ?? 0);
    }
    if (!current.lastOrder) current.lastOrder = order.created_at;
    orderStats.set(order.buyer_id, current);
  }

  const voucherStats = new Map<string, number>();
  for (const voucher of vouchers) {
    if (!voucher.buyer_id) continue;
    voucherStats.set(voucher.buyer_id, (voucherStats.get(voucher.buyer_id) ?? 0) + 1);
  }

  const profiles = (profilesResult.data ?? []).filter((profile) => {
    if (status && profile.status !== status) return false;
    if (!q) return true;
    return [profile.full_name, profile.email, profile.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const suspended = (profilesResult.data ?? []).filter((profile) => profile.status === 'suspended').length;
  const withOrders = (profilesResult.data ?? []).filter((profile) => orderStats.has(profile.id)).length;

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
            <UserRound size={17} />
          </span>
          <strong>{(profilesResult.data ?? []).length}</strong>
          <span>{t.accounts}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <UserRound size={17} />
          </span>
          <strong>{withOrders}</strong>
          <span>{t.haveOrdered}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <UserRound size={17} />
          </span>
          <strong>{orders.filter((order) => order.status === 'paid').length}</strong>
          <span>{t.paidOrders}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <UserRound size={17} />
          </span>
          <strong>{suspended}</strong>
          <span>{t.suspendedAccounts}</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/customers" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allAccounts}</option>
          <option value="active">{c.status.active}</option>
          <option value="suspended">{c.status.suspended}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/customers">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {profiles.length === 0 ? (
        <EmptyState
          title={q || status ? t.noCustomersMatch : t.noCustomersYet}
          body={
            q || status
              ? t.tryDifferentSearch
              : t.emptyBody
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {fill(profiles.length === 1 ? t.customerCountOne : t.customerCount, {
                count: profiles.length,
              })}
            </h3>
            <span className="small muted">{t.newestFirst}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.customer}</th>
                    <th>{t.contact}</th>
                    <th>{t.role}</th>
                    <th className="num">{t.paidOrders}</th>
                    <th className="num">{t.lifetimeValue}</th>
                    <th className="num">{t.vouchers}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.joined}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => {
                    const stats = orderStats.get(profile.id);
                    const role = roleMap.get(profile.id);
                    return (
                      <tr key={profile.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                              {initials(profile.full_name ?? profile.email ?? '?')}
                            </span>
                            <div>
                              <Link href={`/admin/customers/${profile.id}`} className="strong">
                                {profile.full_name ?? t.unnamedCustomer}
                              </Link>
                              <br />
                              <span className="sub">{titleCase(profile.preferred_language ?? 'en', locale)}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="small">{profile.email ?? '—'}</span>
                          <br />
                          <span className="sub">{profile.phone ?? '—'}</span>
                        </td>
                        <td>
                          <span className={`tag ${role === 'admin' || profile.is_admin ? 'coral' : 'neutral'}`}>
                            {role === 'admin' || profile.is_admin ? c.roles.admin : c.roles.customer}
                          </span>
                        </td>
                        <td className="num">{stats?.paidCount ?? 0}</td>
                        <td className="num">{formatMoney(stats?.paidValue ?? 0)}</td>
                        <td className="num">{voucherStats.get(profile.id) ?? 0}</td>
                        <td>
                          <StatusTag status={profile.status} />
                        </td>
                        <td className="small muted">{formatDate(profile.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/customers/${profile.id}`}>
                              {c.actions.open}
                            </Link>
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
