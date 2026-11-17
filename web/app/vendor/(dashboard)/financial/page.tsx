import Link from 'next/link';
import { requireVendor } from '@/lib/auth';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export const dynamic = 'force-dynamic';

/**
 * Vendor financial overview. Provider-managed commission means platform
 * commission is recorded as zero on these sales; provider values returned by
 * MyFatoorah are shown where available.
 */
export default async function VendorFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; error?: string }>;
}) {
  const ctx = await requireVendor();
  const query = await searchParams;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale);

  let itemsQuery = ctx.supabase
    .from('order_items')
    .select('id, total_minor, commission_minor, vendor_share_minor, currency, created_at, orders(id, order_ref, status, payment_status, created_at), products(title)')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false })
    .limit(300);
  if (query.from) itemsQuery = itemsQuery.gte('created_at', `${query.from}T00:00:00Z`);
  if (query.to) itemsQuery = itemsQuery.lte('created_at', `${query.to}T23:59:59Z`);

  const [itemsResult, paymentsResult, refundsResult, balanceResult, ledgerResult, settlementsResult] = await Promise.all([
    itemsQuery,
    ctx.supabase
      .from('myfatoorah_payments')
      .select('id, order_id, invoice_id, payment_id, amount_minor, payment_status, created_at, paid_at')
      .eq('vendor_id', ctx.vendor.id)
      .order('created_at', { ascending: false })
      .limit(300),
    ctx.supabase
      .from('myfatoorah_refunds')
      .select('id, order_id, amount_minor, status, refund_reference, created_at')
      .eq('vendor_id', ctx.vendor.id)
      .order('created_at', { ascending: false })
      .limit(100),
    ctx.supabase.from('vendor_financial_balances').select('balance_minor, credits_minor, debits_minor').eq('vendor_id', ctx.vendor.id).maybeSingle(),
    ctx.supabase
      .from('financial_ledger')
      .select('id, entry_type, amount_minor, reference, created_at')
      .eq('vendor_id', ctx.vendor.id)
      .order('created_at', { ascending: false })
      .limit(100),
    ctx.supabase
      .from('vendor_settlements')
      .select('id, settlement_reference, amount_minor, status, settlement_date, notes')
      .eq('vendor_id', ctx.vendor.id)
      .order('settlement_date', { ascending: false })
      .limit(100),
  ]);

  const items = itemsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const refunds = refundsResult.data ?? [];
  const ledger = ledgerResult.data ?? [];
  const settlements = settlementsResult.data ?? [];
  const balance = (balanceResult.data as any) ?? null;

  const paidItems = items.filter((item: any) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid' || order?.payment_status === 'paid';
  });
  const gross = paidItems.reduce((sum: number, item: any) => sum + Number(item.total_minor ?? 0), 0);
  const commission = paidItems.reduce((sum: number, item: any) => sum + Number(item.commission_minor ?? 0), 0);
  const vendorShare = paidItems.reduce((sum: number, item: any) => sum + Number(item.vendor_share_minor ?? 0), 0);
  const refunded = refunds
    .filter((refund: any) => refund.status === 'completed')
    .reduce((sum: number, refund: any) => sum + Number(refund.amount_minor ?? 0), 0);
  const pending = payments
    .filter((payment: any) => payment.payment_status === 'pending')
    .reduce((sum: number, payment: any) => sum + Number(payment.amount_minor ?? 0), 0);
  const settled = settlements
    .filter((settlement: any) => settlement.status === 'completed')
    .reduce((sum: number, settlement: any) => sum + Number(settlement.amount_minor ?? 0), 0);

  const search = (query.q ?? '').toLowerCase().trim();
  const filteredItems = search
    ? items.filter((item: any) => {
        const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        return `${order?.order_ref ?? ''} ${item.id}`.toLowerCase().includes(search);
      })
    : items;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.nav.group5}
        title="Financials"
        description="Every sale, commission, balance and refund from your Giftly gift cards."
      />
      <Notice error={query.error} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Gross sales</span>
          <strong>{formatMoney(gross)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Platform commission</span>
          <strong>{formatMoney(commission)}</strong>
          <span className="small muted">Provider-managed</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Net vendor earnings</span>
          <strong>{formatMoney(vendorShare)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Available balance</span>
          <strong>{formatMoney(Number(balance?.balance_minor ?? 0))}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Pending settlements</span>
          <strong>{formatMoney(pending)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Settled volume</span>
          <strong>{formatMoney(settled)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Refunded</span>
          <strong>{formatMoney(refunded)}</strong>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Filters</h3>
          <Link className="small" href="/vendor/financial">
            Clear
          </Link>
        </div>
        <div className="panel-body">
          <form method="get" className="toolbar">
            <input name="q" defaultValue={query.q ?? ''} placeholder="Search order reference" />
            <input type="date" name="from" defaultValue={query.from ?? ''} />
            <input type="date" name="to" defaultValue={query.to ?? ''} />
            <button className="btn sm" type="submit">
              Apply
            </button>
          </form>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Transactions</h3>
          <span className="tag neutral">{filteredItems.length}</span>
        </div>
        <div className="panel-body">
          {filteredItems.length === 0 ? (
            <p className="small muted">No transactions in this range.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Gift</th>
                    <th>Date</th>
                    <th>Gross</th>
                    <th>Commission</th>
                    <th>Your share</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item: any) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    const product = Array.isArray(item.products) ? item.products[0] : item.products;
                    return (
                      <tr key={item.id}>
                        <td>{order?.order_ref ?? item.id}</td>
                        <td>{product?.title ?? 'Gift card'}</td>
                        <td>{formatDate(item.created_at, locale)}</td>
                        <td>{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td>{formatMoney(Number(item.commission_minor ?? 0))}</td>
                        <td>{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order?.payment_status ?? order?.status ?? 'pending'} />
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

      <div className="dash-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="panel-head">
            <h3>Payment history</h3>
            <span className="tag neutral">{payments.length}</span>
          </div>
          <div className="panel-body">
            {payments.length === 0 ? (
              <p className="small muted">No MyFatoorah payments yet.</p>
            ) : (
              <div className="split-list">
                {payments.slice(0, 20).map((payment: any) => (
                  <div key={payment.id}>
                    <span className="k mono">{payment.invoice_id}</span>
                    <span className="v small">
                      {formatMoney(Number(payment.amount_minor ?? 0))} · {payment.payment_status} ·{' '}
                      {payment.paid_at ? formatDateTime(payment.paid_at, locale) : formatDateTime(payment.created_at, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Ledger &amp; refunds</h3>
            <span className="tag neutral">{ledger.length + refunds.length}</span>
          </div>
          <div className="panel-body">
            {ledger.length === 0 && refunds.length === 0 ? (
              <p className="small muted">Nothing recorded yet.</p>
            ) : (
              <div className="split-list">
                {refunds.map((refund: any) => (
                  <div key={refund.id}>
                    <span className="k">Refund {refund.refund_reference ?? refund.id}</span>
                    <span className="v small">
                      -{formatMoney(Number(refund.amount_minor ?? 0))} · {refund.status}
                    </span>
                  </div>
                ))}
                {ledger.slice(0, 20).map((entry: any) => (
                  <div key={entry.id}>
                    <span className="k">{entry.entry_type}</span>
                    <span className="v small">
                      {formatMoney(Number(entry.amount_minor ?? 0))} · {formatDate(entry.created_at, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="small muted" style={{ marginTop: 12 }}>
              Settlement frequency is configured in MyFatoorah for your supplier. Giftly records provider statuses;
              it does not promise that funds have reached your bank.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Settlements</h3>
            <span className="tag neutral">{settlements.length}</span>
          </div>
          <div className="panel-body">
            {settlements.length === 0 ? (
              <p className="small muted">No settlements recorded yet.</p>
            ) : (
              <div className="split-list">
                {settlements.map((settlement: any) => (
                  <div key={settlement.id}>
                    <span className="k mono">{settlement.settlement_reference}</span>
                    <span className="v small">
                      {formatMoney(Number(settlement.amount_minor ?? 0))} · {settlement.status} ·{' '}
                      {settlement.settlement_date ? formatDate(settlement.settlement_date, locale) : 'Pending date'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
