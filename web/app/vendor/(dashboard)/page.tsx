import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Package,
  Plus,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead, StatusTag } from '@/components/ui';
import { HelpButton } from '@/components/HelpButton';
import { fulfilmentLabel } from '@/lib/catalog';

export default async function VendorOverviewPage() {
  const ctx = await requireVendor();
  const supabase = ctx.supabase;
  const vendor = ctx.vendor;

  const [itemsResult, vouchersResult, redemptionsResult, redemptionCount, productsResult, locationsCount, outstandingResult] =
    await Promise.all([
      supabase
        .from('order_items')
        .select(
          'id, total_minor, vendor_share_minor, commission_minor, created_at, product_id, orders(order_ref, status, created_at, sender_name, recipient_name), products(title)',
        )
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('vouchers')
        .select('id, status, initial_value_minor, remaining_value_minor, fulfilment_type, total_sessions, remaining_sessions, created_at')
        .eq('vendor_id', vendor.id)
        .limit(1000),
      supabase
        .from('redemptions')
        .select('id, reference, kind, amount_minor, sessions, occurred_at, vouchers(voucher_code, recipient_name)')
        .eq('vendor_id', vendor.id)
        .order('occurred_at', { ascending: false })
        .limit(6),
      supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendor.id),
      supabase.from('products').select('id, title, status, fulfilment_type').eq('vendor_id', vendor.id),
      supabase
        .from('vendor_locations')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendor.id),
      supabase.rpc('vendor_outstanding_minor', { p_vendor_id: vendor.id }),
    ]);

  const items = itemsResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const redemptions = redemptionsResult.data ?? [];
  const products = productsResult.data ?? [];

  const paidItems = items.filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });

  const gross = paidItems.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);
  const share = paidItems.reduce((sum, item) => sum + Number(item.vendor_share_minor ?? 0), 0);
  const orderRefs = new Set(
    paidItems.map((item) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      return order?.order_ref;
    }),
  );
  const activeVouchers = vouchers.filter((voucher) =>
    ['issued', 'claimed', 'active', 'partially_redeemed'].includes(voucher.status),
  ).length;

  const outstandingRaw = outstandingResult.data as unknown;
  const outstandingValue = Array.isArray(outstandingRaw)
    ? (outstandingRaw[0] as { vendor_outstanding_minor?: number })?.vendor_outstanding_minor
    : (outstandingRaw as number | null);
  const outstanding = Number(outstandingValue ?? 0);

  const topProducts = new Map<string, number>();
  for (const item of paidItems) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const name = product?.title ?? 'Gift';
    topProducts.set(name, (topProducts.get(name) ?? 0) + Number(item.total_minor ?? 0));
  }
  const top = [...topProducts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = top[0]?.[1] ?? 1;

  const publishedCount = products.filter((product) => product.status === 'published').length;
  const checklist = [
    { label: 'Add a description', done: Boolean(vendor.description) },
    { label: 'Add a logo', done: Boolean(vendor.logo_url) },
    { label: 'Add a location', done: (locationsCount.count ?? 0) > 0 },
    { label: 'Publish your first gift', done: publishedCount > 0 },
  ];
  const remainingChecks = checklist.filter((item) => !item.done).length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Overview"
        title={`Good to see you, ${ctx.profile?.full_name?.split(' ')[0] ?? 'there'}.`}
        description={`Here is how ${vendor.name} is doing on Giftly. Sales and redemptions update as they happen.`}
        actions={
          <>
            <HelpButton step="lifecycle" />
            <Link className="btn sm" href="/vendor/products/new">
              <Plus size={15} /> New gift
            </Link>
            <Link className="btn sm primary" href="/vendor/redeem">
              <ScanLine size={15} /> Redeem a code
            </Link>
          </>
        }
      />

      {vendor.status !== 'approved' ? (
        <div className="callout warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            Your vendor account is <strong>{vendor.status}</strong>. You can prepare gifts now; they
            go live once our team approves the application.{' '}
            <Link href="/vendor/onboarding" style={{ textDecoration: 'underline' }}>
              See application status
            </Link>
            .
          </span>
        </div>
      ) : null}

      <div className="kpi-grid">
        <Kpi
          label="Gross sales"
          value={formatMoney(gross)}
          hint={`${orderRefs.size} paid ${orderRefs.size === 1 ? 'order' : 'orders'}`}
          icon={<Banknote size={17} />}
          tone="mint"
        />
        <Kpi
          label="Your share"
          value={formatMoney(share)}
          hint={`Commission ${formatMoney(gross - share)}`}
          icon={<TrendingUp size={17} />}
          tone="lavender"
        />
        <Kpi
          label="Active vouchers"
          value={String(activeVouchers)}
          hint={`${vouchers.length} issued in total`}
          icon={<Ticket size={17} />}
          tone="gold"
        />
        <Kpi
          label="Outstanding liability"
          value={formatMoney(outstanding)}
          hint={`${redemptionCount.count ?? 0} redemptions recorded`}
          icon={<ScanLine size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Recent orders</h3>
            <Link className="small" href="/vendor/orders" style={{ fontWeight: 800 }}>
              See all <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
            </Link>
          </div>
          <div className="panel-body flush">
            {paidItems.length === 0 ? (
              <div className="table-empty">
                No paid orders yet. Share your public vendor page to get the first one.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Gift</th>
                      <th>Recipient</th>
                      <th className="num">Total</th>
                      <th className="num">Your share</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidItems.slice(0, 8).map((item) => {
                      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                      const product = Array.isArray(item.products) ? item.products[0] : item.products;
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="strong">{order?.order_ref ?? '—'}</span>
                          </td>
                          <td>{product?.title ?? 'Gift'}</td>
                          <td>{order?.recipient_name ?? '—'}</td>
                          <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                          <td className="num strong">{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                          <td className="small muted">{formatDate(item.created_at)}</td>
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
            <h3>Top gifts</h3>
            <Link className="small" href="/vendor/analytics" style={{ fontWeight: 800 }}>
              Analytics
            </Link>
          </div>
          <div className="panel-body">
            {top.length === 0 ? (
              <p className="small muted">No sales yet. Your first order will show up here.</p>
            ) : (
              <div className="split-list">
                {top.map(([name, value]) => (
                  <div key={name} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span className="strong">{name}</span>
                      <span>{formatMoney(value)}</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${Math.max(6, (value / topMax) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Latest redemptions</h3>
            <Link className="small" href="/vendor/vouchers" style={{ fontWeight: 800 }}>
              Vouchers
            </Link>
          </div>
          <div className="panel-body">
            {redemptions.length === 0 ? (
              <p className="small muted">No redemptions yet. Open Redeem when a customer visits.</p>
            ) : (
              <div className="timeline">
                {redemptions.map((redemption) => {
                  const voucher = Array.isArray(redemption.vouchers)
                    ? redemption.vouchers[0]
                    : redemption.vouchers;
                  return (
                    <div className="timeline-item" key={redemption.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>
                          {redemption.kind === 'session'
                            ? `${redemption.sessions ?? 1} session${(redemption.sessions ?? 1) === 1 ? '' : 's'} redeemed`
                            : redemption.kind === 'monetary'
                              ? `${formatMoney(Number(redemption.amount_minor ?? 0))} redeemed`
                              : 'Code redeemed'}
                        </strong>
                        <span>
                          {voucher?.voucher_code ?? redemption.reference} ·{' '}
                          {voucher?.recipient_name ?? 'Customer'} · {formatDateTime(redemption.occurred_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Get set up</h3>
            <span className="tag neutral">{4 - remainingChecks}/4</span>
          </div>
          <div className="panel-body">
            {remainingChecks === 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <span className="tag success">
                  <CheckCircle2 size={13} /> Profile complete
                </span>
                <p className="small muted">
                  Your storefront is ready. Keep your offers fresh and respond to bookings quickly.
                </p>
              </div>
            ) : (
              <div className="split-list">
                {checklist.map((item) => (
                  <div key={item.label}>
                    <span className="k">
                      {item.done ? <CheckCircle2 size={15} color="var(--success)" /> : <AlertCircle size={15} />}{' '}
                      {item.label}
                    </span>
                    <span className="v small">{item.done ? 'Done' : 'To do'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 16 }}>
              <Link className="btn sm" href="/vendor/onboarding">
                Onboarding
              </Link>
              <Link className="btn sm" href="/vendor/settings">
                Settings
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Your gifts</h3>
            <Link className="small" href="/vendor/products" style={{ fontWeight: 800 }}>
              Manage
            </Link>
          </div>
          <div className="panel-body">
            {products.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <span className="icon-tile mint">
                  <Package size={20} />
                </span>
                <h3>No gifts yet</h3>
                <p>Create a gift card or an experience package to start selling.</p>
                <Link className="btn sm primary" href="/vendor/products/new">
                  <Plus size={14} /> Create a gift
                </Link>
              </div>
            ) : (
              <div className="split-list">
                {products.slice(0, 6).map((product) => (
                  <div key={product.id}>
                    <span className="k">
                      <strong style={{ color: 'var(--ink)' }}>{product.title}</strong>
                      <br />
                      <span className="small muted">{fulfilmentLabel(product.fulfilment_type)}</span>
                    </span>
                    <span className="v">
                      <StatusTag status={product.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Quick actions</h3>
          </div>
          <div className="panel-body">
            <div className="quick-grid">
              <Link className="quick-link" href="/vendor/products/new">
                <span className="icon-tile mint">
                  <Plus size={18} />
                </span>
                New gift
              </Link>
              <Link className="quick-link" href="/vendor/redeem">
                <span className="icon-tile gold">
                  <ScanLine size={18} />
                </span>
                Scan a gift
              </Link>
              <Link className="quick-link" href="/vendor/orders">
                <span className="icon-tile lavender">
                  <ShoppingBag size={18} />
                </span>
                Orders
              </Link>
              <Link className="quick-link" href="/vendor/staff">
                <span className="icon-tile coral">
                  <Users size={18} />
                </span>
                Team
              </Link>
            </div>
            <div className="callout info" style={{ marginTop: 16 }}>
              <Sparkles size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Experience
              gifts use vendor-set packages. Customers choose a package, not an amount.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
