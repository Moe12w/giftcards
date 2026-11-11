import Link from 'next/link';
import { Building2, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function AdminEnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const [partnersResult, productsResult, inventoryResult, membersResult] = await Promise.all([
    ctx.supabase.from('enterprise_partners').select('*').order('created_at', { ascending: false }),
    ctx.supabase.from('enterprise_products').select('id, partner_id, is_active'),
    ctx.supabase
      .from('enterprise_inventory_summary')
      .select('partner_id, enterprise_product_id, status, denomination_minor')
      .limit(10000),
    ctx.supabase.from('enterprise_members').select('partner_id, role, active'),
  ]);

  const error = partnersResult.error ?? productsResult.error ?? null;

  const partners = partnersResult.data ?? [];
  const products = productsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const members = membersResult.data ?? [];

  const productStats = new Map<string, { total: number; active: number }>();
  const productPartner = new Map<string, string>();
  for (const product of products) {
    productPartner.set(product.id, product.partner_id);
    const current = productStats.get(product.partner_id) ?? { total: 0, active: 0 };
    current.total += 1;
    if (product.is_active) current.active += 1;
    productStats.set(product.partner_id, current);
  }

  const inventoryStats = new Map<
    string,
    { available: number; allocated: number; redeemed: number; availableValue: number }
  >();
  for (const item of inventory) {
    const current = inventoryStats.get(item.partner_id) ?? {
      available: 0,
      allocated: 0,
      redeemed: 0,
      availableValue: 0,
    };
    if (item.status === 'available') {
      current.available += 1;
      current.availableValue += Number(item.denomination_minor ?? 0);
    } else if (['reserved', 'sold', 'delivered'].includes(item.status)) {
      current.allocated += 1;
    } else if (item.status === 'redeemed') {
      current.redeemed += 1;
    }
    inventoryStats.set(item.partner_id, current);
  }

  const memberCounts = new Map<string, number>();
  for (const member of members) {
    if (member.active) memberCounts.set(member.partner_id, (memberCounts.get(member.partner_id) ?? 0) + 1);
  }

  const filtered = partners.filter((partner) => {
    if (status && partner.status !== status) return false;
    if (!q) return true;
    return [partner.name, partner.slug, partner.contact_name, partner.contact_email, partner.industry]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const totalAvailable = [...inventoryStats.values()].reduce((sum, item) => sum + item.available, 0);
  const totalAvailableValue = [...inventoryStats.values()].reduce((sum, item) => sum + item.availableValue, 0);
  const totalRedeemed = [...inventoryStats.values()].reduce((sum, item) => sum + item.redeemed, 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Network"
        title="Enterprise partners"
        description="Corporate reward programmes, their catalogue, inventory position and redemption performance."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Partner updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Building2 size={17} />
          </span>
          <strong>{partners.filter((partner) => partner.status === 'active').length}</strong>
          <span>Active partners</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Building2 size={17} />
          </span>
          <strong>{products.length}</strong>
          <span>Reward products</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Building2 size={17} />
          </span>
          <strong>{totalAvailable}</strong>
          <span>{formatMoney(totalAvailableValue)} available</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Building2 size={17} />
          </span>
          <strong>{totalRedeemed}</strong>
          <span>Confirmed redeemed</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/enterprise" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Company, contact or industry…" aria-label="Search partners" />
        </div>
        <select name="status" defaultValue={status} aria-label="Partner status">
          <option value="">All partners</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/enterprise">
            Clear
          </Link>
        ) : null}
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          title={q || status ? 'No partners match' : 'No enterprise partners yet'}
          body={
            q || status
              ? 'Try a different search or clear the filters.'
              : 'Corporate enquiries from the website and partner accounts appear here.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {filtered.length} {filtered.length === 1 ? 'partner' : 'partners'}
            </h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Contact</th>
                    <th>Industry</th>
                    <th className="num">Products</th>
                    <th className="num">Available</th>
                    <th className="num">Allocated</th>
                    <th className="num">Redeemed</th>
                    <th className="num">Team</th>
                    <th>Status</th>
                    <th>Since</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((partner) => {
                    const productStat = productStats.get(partner.id) ?? { total: 0, active: 0 };
                    const stock = inventoryStats.get(partner.id) ?? {
                      available: 0,
                      allocated: 0,
                      redeemed: 0,
                      availableValue: 0,
                    };
                    return (
                      <tr key={partner.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                              {initials(partner.name)}
                            </span>
                            <div>
                              <Link href={`/admin/enterprise/${partner.id}`} className="strong">
                                {partner.name}
                              </Link>
                              <br />
                              <span className="sub">{partner.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="small">{partner.contact_name ?? '—'}</span>
                          <br />
                          <span className="sub">{partner.contact_email ?? '—'}</span>
                        </td>
                        <td className="small">{partner.industry ?? '—'}</td>
                        <td className="num">
                          {productStat.active}
                          <span className="sub"> / {productStat.total}</span>
                        </td>
                        <td className="num">{stock.available}</td>
                        <td className="num">{stock.allocated}</td>
                        <td className="num">{stock.redeemed}</td>
                        <td className="num">{memberCounts.get(partner.id) ?? 0}</td>
                        <td>
                          <StatusTag status={partner.status} />
                        </td>
                        <td className="small muted">{formatDate(partner.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/enterprise/${partner.id}`}>
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
          </div>
        </section>
      )}
    </div>
  );
}
