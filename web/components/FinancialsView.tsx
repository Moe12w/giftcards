import { Notice, PageHead } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import type { Locale } from '@/lib/i18n';

interface FinancialsSearch {
  from?: string;
  to?: string;
  q?: string;
}

/** Shared financial overview for vendors and enterprise partners. */
export async function FinancialsView({
  supabase,
  ownerType,
  ownerId,
  locale,
  search,
}: {
  supabase: any;
  ownerType: 'vendor' | 'partner';
  ownerId: string;
  locale: Locale;
  search: FinancialsSearch;
}) {
  const ownerColumn = ownerType === 'vendor' ? 'vendor_id' : 'partner_id';
  const balanceTable = ownerType === 'vendor' ? 'vendor_financial_balances' : 'partner_financial_balances';

  const { data: products } = await supabase
    .from('products')
    .select('id, title')
    .eq(ownerColumn, ownerId)
    .limit(300);
  const productIds = (products ?? []).map((product: any) => product.id);

  let itemsQuery = supabase
    .from('order_items')
    .select(
      'id, total_minor, commission_minor, vendor_share_minor, created_at, product_id, orders(id, order_ref, status, payment_status, created_at)',
    );
  if (ownerType === 'vendor') itemsQuery = itemsQuery.eq('vendor_id', ownerId);
  else if (productIds.length) itemsQuery = itemsQuery.in('product_id', productIds);
  else itemsQuery = itemsQuery.eq('product_id', '00000000-0000-0000-0000-000000000000');
  if (search.from) itemsQuery = itemsQuery.gte('created_at', `${search.from}T00:00:00Z`);
  if (search.to) itemsQuery = itemsQuery.lte('created_at', `${search.to}T23:59:59Z`);
  const { data: itemsData } = await itemsQuery.order('created_at', { ascending: false }).limit(300);

  const [balanceResult, ledgerResult, settlementsResult] = await Promise.all([
    supabase.from(balanceTable).select('balance_minor, credits_minor, debits_minor').eq(ownerColumn, ownerId).maybeSingle(),
    supabase
      .from('financial_ledger')
      .select('id, entry_type, amount_minor, reference, created_at')
      .eq(ownerColumn, ownerId)
      .order('created_at', { ascending: false })
      .limit(100),
    ownerType === 'vendor'
      ? supabase
          .from('vendor_settlements')
          .select('id, settlement_reference, amount_minor, status, settlement_date, notes')
          .eq('vendor_id', ownerId)
          .order('settlement_date', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);

  const items = itemsData ?? [];
  const ledger = ledgerResult.data ?? [];
  const settlements = settlementsResult.data ?? [];
  const balance = (balanceResult.data as any) ?? null;

  const paidItems = items.filter((item: any) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid' || order?.payment_status === 'paid';
  });
  const gross = paidItems.reduce((sum: number, item: any) => sum + Number(item.total_minor ?? 0), 0);
  const commission = paidItems.reduce((sum: number, item: any) => sum + Number(item.commission_minor ?? 0), 0);
  const share = paidItems.reduce((sum: number, item: any) => sum + Number(item.vendor_share_minor ?? 0), 0);
  const settled = settlements
    .filter((settlement: any) => settlement.status === 'completed')
    .reduce((sum: number, settlement: any) => sum + Number(settlement.amount_minor ?? 0), 0);
  const pending = settlements
    .filter((settlement: any) => settlement.status === 'pending')
    .reduce((sum: number, settlement: any) => sum + Number(settlement.amount_minor ?? 0), 0);

  const needle = (search.q ?? '').toLowerCase().trim();
  const filteredItems = needle
    ? items.filter((item: any) => {
        const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        return `${order?.order_ref ?? ''} ${item.id}`.toLowerCase().includes(needle);
      })
    : items;

  const title = ownerType === 'vendor' ? 'Vendor financials' : 'Partner financials';

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={ownerType === 'vendor' ? 'Vendor' : 'Enterprise partner'}
        title={title}
        description="Every sale, commission, balance, settlement and refund for the gift cards you sell."
      />
      <Notice />

      <div className="kpi-grid">
        <div className="kpi"><span className="kpi-label">Gross sales</span><strong>{formatMoney(gross)}</strong></div>
        <div className="kpi">
          <span className="kpi-label">Platform commission</span>
          <strong>{formatMoney(commission)}</strong>
          <span className="small muted">Provider-managed</span>
        </div>
        <div className="kpi"><span className="kpi-label">Net earnings</span><strong>{formatMoney(share)}</strong></div>
        <div className="kpi"><span className="kpi-label">Available balance</span><strong>{formatMoney(Number(balance?.balance_minor ?? 0))}</strong></div>
        <div className="kpi"><span className="kpi-label">Pending settlements</span><strong>{formatMoney(pending)}</strong></div>
        <div className="kpi"><span className="kpi-label">Settled volume</span><strong>{formatMoney(settled)}</strong></div>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><h3>Filters</h3></div>
        <div className="panel-body">
          <form method="get" className="toolbar">
            <input name="q" defaultValue={search.q ?? ''} placeholder="Search order reference" />
            <input type="date" name="from" defaultValue={search.from ?? ''} />
            <input type="date" name="to" defaultValue={search.to ?? ''} />
            <button className="btn sm" type="submit">Apply</button>
          </form>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><h3>Transactions</h3><span className="tag neutral">{filteredItems.length}</span></div>
        <div className="panel-body">
          {filteredItems.length === 0 ? (
            <p className="small muted">No transactions in this range.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th><th>Date</th><th>Gross</th><th>Commission</th><th>Your share</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item: any) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    return (
                      <tr key={item.id}>
                        <td>{order?.order_ref ?? item.id}</td>
                        <td>{formatDate(item.created_at, locale)}</td>
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

      <div className="dash-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="panel-head"><h3>Ledger</h3><span className="tag neutral">{ledger.length}</span></div>
          <div className="panel-body">
            {ledger.length === 0 ? (
              <p className="small muted">Nothing recorded yet.</p>
            ) : (
              <div className="split-list">
                {ledger.map((entry: any) => (
                  <div key={entry.id}>
                    <span className="k">{entry.entry_type}</span>
                    <span className="v small">{formatMoney(Number(entry.amount_minor ?? 0))} · {formatDate(entry.created_at, locale)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Settlements</h3><span className="tag neutral">{settlements.length}</span></div>
          <div className="panel-body">
            {settlements.length === 0 ? (
              <p className="small muted">No settlements recorded yet.</p>
            ) : (
              <div className="split-list">
                {settlements.map((settlement: any) => (
                  <div key={settlement.id}>
                    <span className="k mono">{settlement.settlement_reference}</span>
                    <span className="v small">
                      {formatMoney(Number(settlement.amount_minor ?? 0))} · {settlement.status}
                      {settlement.settlement_date ? ` · ${formatDate(settlement.settlement_date, locale)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="small muted" style={{ marginTop: 12 }}>
              Settlement terms are configured in MyFatoorah. Tazella records provider statuses; it does not promise funds have reached your bank.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
