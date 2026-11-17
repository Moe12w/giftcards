import { requireEnterprise } from '@/lib/auth';
import { Notice, PageHead } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

/** Partner financial overview — same model as the vendor Financials page. */
export default async function EnterpriseFinancialPage() {
  const ctx = await requireEnterprise();

  const { data: products } = await ctx.supabase
    .from('products')
    .select('id, title')
    .eq('partner_id', ctx.partner.id)
    .limit(300);
  const productIds = (products ?? []).map((product: any) => product.id);

  const itemsResult = productIds.length
    ? await ctx.supabase
        .from('order_items')
        .select('id, total_minor, commission_minor, vendor_share_minor, created_at, product_id, orders(id, order_ref, status, payment_status, created_at)')
        .in('product_id', productIds)
        .order('created_at', { ascending: false })
        .limit(300)
    : { data: [] };

  const [balanceResult, ledgerResult] = await Promise.all([
    ctx.supabase
      .from('partner_financial_balances')
      .select('balance_minor, credits_minor, debits_minor')
      .eq('partner_id', ctx.partner.id)
      .maybeSingle(),
    ctx.supabase
      .from('financial_ledger')
      .select('id, entry_type, amount_minor, reference, created_at')
      .eq('partner_id', ctx.partner.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const items = itemsResult.data ?? [];
  const ledger = ledgerResult.data ?? [];
  const balance = (balanceResult.data as any) ?? null;
  const paidItems = items.filter((item: any) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid' || order?.payment_status === 'paid';
  });
  const gross = paidItems.reduce((sum: number, item: any) => sum + Number(item.total_minor ?? 0), 0);
  const commission = paidItems.reduce((sum: number, item: any) => sum + Number(item.commission_minor ?? 0), 0);
  const share = paidItems.reduce((sum: number, item: any) => sum + Number(item.vendor_share_minor ?? 0), 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Enterprise partner"
        title="Financials"
        description="Every sale, allocation, balance and refund for the codes you sell on Giftly."
      />
      <Notice />

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
          <span className="kpi-label">Net earnings</span>
          <strong>{formatMoney(share)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Available balance</span>
          <strong>{formatMoney(Number(balance?.balance_minor ?? 0))}</strong>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Transactions</h3>
          <span className="tag neutral">{items.length}</span>
        </div>
        <div className="panel-body">
          {items.length === 0 ? (
            <p className="small muted">No sales yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Gross</th>
                    <th>Commission</th>
                    <th>Your share</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    return (
                      <tr key={item.id}>
                        <td>{order?.order_ref ?? item.id}</td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td>{formatMoney(Number(item.commission_minor ?? 0))}</td>
                        <td>{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                        <td>{String(order?.payment_status ?? order?.status ?? 'pending')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Ledger</h3>
          <span className="tag neutral">{ledger.length}</span>
        </div>
        <div className="panel-body">
          {ledger.length === 0 ? (
            <p className="small muted">Nothing recorded yet.</p>
          ) : (
            <div className="split-list">
              {ledger.map((entry: any) => (
                <div key={entry.id}>
                  <span className="k">{entry.entry_type}</span>
                  <span className="v small">
                    {formatMoney(Number(entry.amount_minor ?? 0))} · {formatDate(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>
            Settlement frequency is configured in MyFatoorah for your supplier. Giftly records provider statuses; it
            does not promise that funds have reached your bank.
          </p>
        </div>
      </section>
    </div>
  );
}
