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

export default async function AdminOverviewPage() {
  const ctx = await requireAdmin();
  const supabase = ctx.supabase;

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
        eyebrow="Overview"
        title="The marketplace at a glance."
        description="Applications, sales, vouchers and the support queue. Everything that needs a decision is linked below."
        actions={
          <>
            <HelpButton step="lifecycle" />
            <Link className="btn sm" href="/admin/support">
              <LifeBuoy size={15} /> Support
            </Link>
            <Link className="btn sm primary" href="/admin/vendors?status=pending">
              Review vendors
            </Link>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label="Approved vendors"
          value={String(vendorsCount.count ?? 0)}
          hint={`${pendingCount.count ?? 0} applications waiting`}
          icon={<Store size={17} />}
          tone="mint"
        />
        <Kpi
          label="Customers"
          value={String(customersCount.count ?? 0)}
          hint={`${partnersCount.count ?? 0} active enterprise partners`}
          icon={<UserRound size={17} />}
          tone="lavender"
        />
        <Kpi
          label="Paid order value"
          value={formatMoney(gmv)}
          hint={`${paid.length} paid orders`}
          icon={<CreditCard size={17} />}
          tone="gold"
        />
        <Kpi
          label="Outstanding balance"
          value={formatMoney(outstanding)}
          hint={`${activeVouchers.length} active vouchers`}
          icon={<Ticket size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Applications to review</h3>
            <Link className="small" href="/admin/vendors?status=pending" style={{ fontWeight: 800 }}>
              All applications <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
            </Link>
          </div>
          <div className="panel-body flush">
            {applications.length === 0 ? (
              <div className="table-empty">No applications waiting. Nice.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Review</th>
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
                            <span className="strong">{application.business_name ?? vendor?.name ?? 'Vendor'}</span>
                            <br />
                            <span className="sub">{vendor?.slug ?? '—'}</span>
                          </td>
                          <td className="small muted">{formatDate(application.submitted_at)}</td>
                          <td>
                            <StatusTag status={application.status} />
                          </td>
                          <td>
                            <div className="row-actions">
                              <Link className="btn sm" href={`/admin/vendors/${application.vendor_id}`}>
                                Open
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
            <h3>Support queue</h3>
            <span className="tag warning">{openSupport} open</span>
          </div>
          <div className="panel-body flush">
            {support.length === 0 ? (
              <div className="table-empty">No support requests yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Kind</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {support.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <Link href="/admin/support" className="strong">
                            {request.subject ?? request.reference ?? 'Support request'}
                          </Link>
                        </td>
                        <td className="small muted">{titleCase(request.kind)}</td>
                        <td>
                          <StatusTag status={request.status} />
                        </td>
                        <td className="small muted">{formatDate(request.created_at)}</td>
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
          <h3>Recent orders</h3>
          <Link className="small" href="/admin/orders" style={{ fontWeight: 800 }}>
            All orders <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </Link>
        </div>
        <div className="panel-body flush">
          {orders.length === 0 ? (
            <div className="table-empty">No orders yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Buyer</th>
                    <th>Recipient</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th>Date</th>
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
                            {buyer?.full_name ?? order.sender_name ?? 'Guest'}
                          </span>
                        </td>
                        <td>{order.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(order.total_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order.status} />
                        </td>
                        <td className="small muted">{formatDate(order.created_at)}</td>
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
          Vendors
        </Link>
        <Link className="quick-link" href="/admin/enterprise">
          <span className="icon-tile lavender">
            <Building2 size={18} />
          </span>
          Enterprise
        </Link>
        <Link className="quick-link" href="/admin/products">
          <span className="icon-tile gold">
            <ShoppingBag size={18} />
          </span>
          Products
        </Link>
        <Link className="quick-link" href="/admin/vouchers">
          <span className="icon-tile coral">
            <Ticket size={18} />
          </span>
          Vouchers
        </Link>
      </div>
    </div>
  );
}
