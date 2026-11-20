import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  LifeBuoy,
  Mail,
  Phone,
  Store,
  Ticket,
  UserRound,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminUpdateCustomer } from '@/lib/actions/admin';
import { formatDate, formatDateTime, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

const ACTIVE_VOUCHER = ['issued', 'claimed', 'active', 'partially_redeemed'];

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireAdmin();
  const supabase = ctx.supabase;
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).customerDetail;
  const c = pick(common, locale);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!profile) notFound();

  const [
    ordersResult,
    vouchersResult,
    supportResult,
    roleResult,
    vendorMembersResult,
    enterpriseMembersResult,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_ref, status, payment_status, total_minor, recipient_name, delivery_method, created_at')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('vouchers')
      .select('id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, recipient_name, expires_at, created_at, products(title)')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('support_requests')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('user_roles').select('role').eq('user_id', id).maybeSingle(),
    supabase
      .from('vendor_members')
      .select('vendor_id, role, active, created_at, vendors(id, name, slug, status)')
      .eq('user_id', id),
    supabase
      .from('enterprise_members')
      .select('partner_id, role, active, created_at, enterprise_partners(id, name, status)')
      .eq('user_id', id),
  ]);

  const error = profileError ?? ordersResult.error ?? null;

  const orders = ordersResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const support = supportResult.data ?? [];
  const vendorMemberships = vendorMembersResult.data ?? [];
  const enterpriseMemberships = enterpriseMembersResult.data ?? [];

  const paid = orders.filter((order) => order.status === 'paid');
  const lifetime = paid.reduce((sum, order) => sum + Number(order.total_minor ?? 0), 0);
  const activeVouchers = vouchers.filter((voucher) => ACTIVE_VOUCHER.includes(voucher.status));
  const outstanding = activeVouchers
    .filter((voucher) => voucher.fulfilment_type === 'monetary')
    .reduce((sum, voucher) => sum + Number(voucher.remaining_value_minor ?? 0), 0);
  const openSupport = support.filter((request) => request.status === 'open').length;
  const isAdmin = roleResult.data?.role === 'admin' || profile.is_admin;

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/customers">
        <ArrowLeft size={15} /> {t.backToCustomers}
      </Link>

      <PageHead
        eyebrow={t.eyebrow}
        title={profile.full_name ?? t.unnamedCustomer}
        description={[profile.email, profile.phone].filter(Boolean).join(' · ') || t.noContactDetails}
        actions={
          <>
            <StatusTag status={profile.status} />
            <span className={`tag ${isAdmin ? 'coral' : 'neutral'}`}>
              {isAdmin ? c.roles.admin : c.roles.customer}
            </span>
            {profile.email ? (
              <a className="btn sm" href={`mailto:${profile.email}`}>
                <Mail size={14} /> {c.labels.email}
              </a>
            ) : null}
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <CreditCard size={17} />
          </span>
          <strong>{paid.length}</strong>
          <span>{t.paidOrders}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <CreditCard size={17} />
          </span>
          <strong>{formatMoney(lifetime)}</strong>
          <span>{t.lifetimeValue}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{vouchers.length}</strong>
          <span>{fill(t.stillActive, { count: activeVouchers.length })}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{openSupport}</strong>
          <span>{t.openSupportRequests}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.account}</h3>
            <UserRound size={16} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">{t.fullName}</span>
                <span className="v">{profile.full_name ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Mail size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {c.labels.email}
                </span>
                <span className="v small">{profile.email ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {c.labels.phone}
                </span>
                <span className="v small">{profile.phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.language}</span>
                <span className="v">{titleCase(profile.preferred_language ?? 'en', locale)}</span>
              </div>
              <div>
                <span className="k">{t.joined}</span>
                <span className="v small">{formatDateTime(profile.created_at, locale)}</span>
              </div>
              <div>
                <span className="k">{t.accountId}</span>
                <span className="v mono small">{profile.id}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.accountStatus}</h3>
            <StatusTag status={profile.status} />
          </div>
          <div className="panel-body">
            <form action={adminUpdateCustomer} style={{ display: 'grid', gap: 14 }}>
              <input type="hidden" name="user_id" value={profile.id} />
              <input type="hidden" name="return_to" value={`/admin/customers/${profile.id}`} />
              <div className="field">
                <label htmlFor="status">{c.labels.status}</label>
                <select id="status" name="status" defaultValue={profile.status}>
                  <option value="active">{c.status.active}</option>
                  <option value="suspended">{c.status.suspended}</option>
                </select>
              </div>
              <button className="btn primary" type="submit">
                {t.saveStatus}
              </button>
              <p className="small muted">
                {t.suspendNote}
              </p>
            </form>

            <div className="divider" style={{ margin: '16px 0' }} />

            <div className="split-list">
              <div>
                <span className="k">{t.outstandingGiftValue}</span>
                <span className="v">{formatMoney(outstanding)}</span>
              </div>
              <div>
                <span className="k">{t.supportRequests}</span>
                <span className="v">{support.length}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {vendorMemberships.length > 0 || enterpriseMemberships.length > 0 ? (
        <div className="dash-grid">
          {vendorMemberships.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <h3>{t.vendorAccess}</h3>
                <Store size={16} />
              </div>
              <div className="panel-body flush">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t.vendor}</th>
                        <th>{t.role}</th>
                        <th>{c.labels.status}</th>
                        <th>{t.since}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorMemberships.map((membership) => {
                        const vendor = Array.isArray(membership.vendors)
                          ? membership.vendors[0]
                          : membership.vendors;
                        return (
                          <tr key={membership.vendor_id}>
                            <td>
                              {vendor ? (
                                <Link href={`/admin/vendors/${vendor.id}`} className="strong">
                                  {vendor.name}
                                </Link>
                              ) : (
                                t.vendor
                              )}
                            </td>
                            <td>{titleCase(membership.role, locale)}</td>
                            <td>
                              <StatusTag status={membership.active ? 'active' : 'suspended'} />
                            </td>
                            <td className="small muted">{formatDate(membership.created_at, locale)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {enterpriseMemberships.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <h3>{t.enterpriseAccess}</h3>
                <Building2 size={16} />
              </div>
              <div className="panel-body flush">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t.partner}</th>
                        <th>{t.role}</th>
                        <th>{c.labels.status}</th>
                        <th>{t.since}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enterpriseMemberships.map((membership) => {
                        const partner = Array.isArray(membership.enterprise_partners)
                          ? membership.enterprise_partners[0]
                          : membership.enterprise_partners;
                        return (
                          <tr key={membership.partner_id}>
                            <td>
                              {partner ? (
                                <Link href={`/admin/enterprise/${partner.id}`} className="strong">
                                  {partner.name}
                                </Link>
                              ) : (
                                t.partner
                              )}
                            </td>
                            <td>{titleCase(membership.role, locale)}</td>
                            <td>
                              <StatusTag status={membership.active ? 'active' : 'suspended'} />
                            </td>
                            <td className="small muted">{formatDate(membership.created_at, locale)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>{t.orders}</h3>
          <span className="small muted">{fill(t.totalCount, { count: orders.length })}</span>
        </div>
        <div className="panel-body flush">
          {orders.length === 0 ? (
            <div className="table-empty">{t.noOrders}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.order}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{c.labels.total}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.delivery}</th>
                    <th>{c.labels.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/admin/orders/${order.id}`} className="strong">
                          {order.order_ref}
                        </Link>
                      </td>
                      <td>{order.recipient_name ?? '—'}</td>
                      <td className="num">{formatMoney(Number(order.total_minor ?? 0))}</td>
                      <td>
                        <StatusTag status={order.status} />
                      </td>
                      <td className="small muted">{titleCase(order.delivery_method ?? '—', locale)}</td>
                      <td className="small muted">{formatDate(order.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.vouchers}</h3>
          <span className="small muted">{fill(t.activeCount, { count: activeVouchers.length })}</span>
        </div>
        <div className="panel-body flush">
          {vouchers.length === 0 ? (
            <div className="table-empty">{t.noVouchersYet}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.code}</th>
                    <th>{t.gift}</th>
                    <th>{t.type}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{c.labels.value}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.expires}</th>
                    <th>{t.issued}</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
                    return (
                      <tr key={voucher.id}>
                        <td className="mono small strong">{voucher.voucher_code}</td>
                        <td>{product?.title ?? t.gift}</td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type, locale)}</span>
                        </td>
                        <td>{voucher.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(voucher.initial_value_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small muted">
                          {voucher.expires_at ? formatDate(voucher.expires_at, locale) : t.noExpiry}
                        </td>
                        <td className="small muted">{formatDate(voucher.created_at, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.supportRequests}</h3>
          <Link className="small" href="/admin/support" style={{ fontWeight: 800 }}>
            {t.supportQueue}
          </Link>
        </div>
        <div className="panel-body flush">
          {support.length === 0 ? (
            <div className="table-empty">{t.noCustomerSupport}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.subject}</th>
                    <th>{t.kind}</th>
                    <th>{c.labels.reference}</th>
                    <th>{c.labels.status}</th>
                    <th>{c.labels.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {support.map((request) => (
                    <tr key={request.id}>
                      <td className="strong">{request.subject ?? t.supportRequest}</td>
                      <td className="small">{titleCase(request.kind, locale)}</td>
                      <td className="small mono">{request.reference ?? '—'}</td>
                      <td>
                        <StatusTag status={request.status} />
                      </td>
                      <td className="small muted">{formatDate(request.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
