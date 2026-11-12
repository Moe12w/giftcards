import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CreditCard,
  LifeBuoy,
  ShoppingBag,
  Store,
  Ticket,
  UserRound,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead, StatusTag } from '@/components/ui';
import { HelpButton } from '@/components/HelpButton';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminOverviewPage() {
  const ctx = await requireAdmin();
  const supabase = ctx.supabase;
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).overview;
  const c = pick(common, locale);
  const nav = pick(adminCopy, locale).nav;

  const [
    vendorsCount,
    pendingCount,
    customersCount,
    partnersCount,
    productsCount,
    ordersResult,
    vouchersResult,
    supportResult,
    applicationsResult,
  ] = await Promise.all([
    supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase
      .from('vendor_applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('enterprise_partners')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('orders')
      .select('id, order_ref, status, total_minor, created_at, sender_name, recipient_name, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('vouchers')
      .select('id, status, fulfilment_type, remaining_value_minor, initial_value_minor')
      .limit(2000),
    supabase
      .from('support_requests')
      .select('id, kind, subject, status, reference, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('vendor_applications')
      .select('id, vendor_id, business_name, status, submitted_at, vendors(name, slug, status)')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true })
      .limit(6),
  ]);

  const orders = ordersResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const support = supportResult.data ?? [];
  const applications = applicationsResult.data ?? [];

  const paid = orders.filter((order) => order.status === 'paid');
  const gmv = paid.reduce((sum, order) => sum + Number(order.total_minor ?? 0), 0);
  const activeVouchers = vouchers.filter((voucher) =>
    ['issued', 'claimed', 'active', 'partially_redeemed'].includes(voucher.status),
  );
  const outstanding = activeVouchers
    .filter((voucher) => voucher.fulfilment_type === 'monetary')
    .reduce((sum, voucher) => sum + Number(voucher.remaining_value_minor ?? 0), 0);
  const openSupport = support.filter((request) => request.status === 'open').length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <>
            <HelpButton step="lifecycle" />
            <Link className="btn sm" href="/admin/support">
              <LifeBuoy size={15} /> {t.support}
            </Link>
            <Link className="btn sm primary" href="/admin/vendors?status=pending">
              {t.reviewVendors}
            </Link>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label={t.approvedVendors}
          value={String(vendorsCount.count ?? 0)}
          hint={fill(t.applicationsWaiting, { count: pendingCount.count ?? 0 })}
          icon={<Store size={17} />}
          tone="mint"
        />
        <Kpi
          label={t.customers}
          value={String(customersCount.count ?? 0)}
          hint={fill(t.activePartners, { count: partnersCount.count ?? 0 })}
          icon={<UserRound size={17} />}
          tone="lavender"
        />
        <Kpi
          label={t.paidOrderValue}
          value={formatMoney(gmv)}
          hint={fill(t.paidOrders, { count: paid.length })}
          icon={<CreditCard size={17} />}
          tone="gold"
        />
        <Kpi
          label={t.outstanding}
          value={formatMoney(outstanding)}
          hint={fill(t.activeVouchers, { count: activeVouchers.length })}
          icon={<Ticket size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.applicationsToReview}</h3>
            <Link className="small" href="/admin/vendors?status=pending" style={{ fontWeight: 800 }}>
              {t.allApplications} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
            </Link>
          </div>
          <div className="panel-body flush">
            {applications.length === 0 ? (
              <div className="table-empty">{t.noApplications}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.business}</th>
                      <th>{t.submitted}</th>
                      <th>{c.labels.status}</th>
                      <th style={{ textAlign: 'right' }}>{t.review}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => {
                      const vendor = Array.isArray(application.vendors)
                        ? application.vendors[0]
                        : application.vendors;
                      return (
                        <tr key={application.id}>
                          <td>
                            <span className="strong">
                              {application.business_name ?? vendor?.name ?? t.vendorFallback}
                            </span>
                            <br />
                            <span className="sub">{vendor?.slug ?? '—'}</span>
                          </td>
                          <td className="small muted">{formatDate(application.submitted_at, locale)}</td>
                          <td>
                            <StatusTag status={application.status} />
                          </td>
                          <td>
                            <div className="row-actions">
                              <Link className="btn sm" href={`/admin/vendors/${application.vendor_id}`}>
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
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.supportQueue}</h3>
            <span className="tag warning">{fill(t.openTickets, { count: openSupport })}</span>
          </div>
          <div className="panel-body flush">
            {support.length === 0 ? (
              <div className="table-empty">{t.noSupport}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.request}</th>
                      <th>{t.kind}</th>
                      <th>{c.labels.status}</th>
                      <th>{c.labels.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {support.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <Link href="/admin/support" className="strong">
                            {request.subject ?? request.reference ?? t.supportRequest}
                          </Link>
                        </td>
                        <td className="small muted">{titleCase(request.kind, locale)}</td>
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

      <section className="panel">
        <div className="panel-head">
          <h3>{t.recentOrders}</h3>
          <Link className="small" href="/admin/orders" style={{ fontWeight: 800 }}>
            {t.allOrders} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </Link>
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
                    <th>{t.buyer}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{t.total}</th>
                    <th>{c.labels.status}</th>
                    <th>{c.labels.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((order) => {
                    const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="strong">
                            {order.order_ref}
                          </Link>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="avatar" style={{ width: 28, height: 28, fontSize: '0.64rem' }}>
                              {initials(buyer?.full_name ?? buyer?.email ?? order.sender_name ?? '?')}
                            </span>
                            {buyer?.full_name ?? order.sender_name ?? t.guest}
                          </span>
                        </td>
                        <td>{order.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(order.total_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order.status} />
                        </td>
                        <td className="small muted">{formatDate(order.created_at, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="quick-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Link className="quick-link" href="/admin/vendors">
          <span className="icon-tile mint">
            <Store size={18} />
          </span>
          {nav.vendors}
        </Link>
        <Link className="quick-link" href="/admin/enterprise">
          <span className="icon-tile lavender">
            <Building2 size={18} />
          </span>
          {nav.enterprise}
        </Link>
        <Link className="quick-link" href="/admin/products">
          <span className="icon-tile gold">
            <ShoppingBag size={18} />
          </span>
          {nav.products}
        </Link>
        <Link className="quick-link" href="/admin/vouchers">
          <span className="icon-tile coral">
            <Ticket size={18} />
          </span>
          {nav.vouchers}
        </Link>
      </div>
    </div>
  );
}
