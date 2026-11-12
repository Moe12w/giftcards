import Link from 'next/link';
import { Building2, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminEnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).enterprise;
  const c = pick(common, locale);
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Building2 size={17} />
          </span>
          <strong>{partners.filter((partner) => partner.status === 'active').length}</strong>
          <span>{t.activePartners}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Building2 size={17} />
          </span>
          <strong>{products.length}</strong>
          <span>{t.rewardProducts}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Building2 size={17} />
          </span>
          <strong>{totalAvailable}</strong>
          <span>{fill(t.availableAmount, { amount: formatMoney(totalAvailableValue) })}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Building2 size={17} />
          </span>
          <strong>{totalRedeemed}</strong>
          <span>{t.confirmedRedeemed}</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/enterprise" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allPartners}</option>
          <option value="active">{c.status.active}</option>
          <option value="draft">{c.status.draft}</option>
          <option value="suspended">{c.status.suspended}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/enterprise">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          title={q || status ? t.noPartnersMatch : t.noPartnersYet}
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
              {fill(filtered.length === 1 ? t.partnerCountOne : t.partnerCount, { count: filtered.length })}
            </h3>
            <span className="small muted">{t.newestFirst}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.partner}</th>
                    <th>{t.contact}</th>
                    <th>{t.industry}</th>
                    <th className="num">{t.products}</th>
                    <th className="num">{t.available}</th>
                    <th className="num">{t.allocated}</th>
                    <th className="num">{t.redeemed}</th>
                    <th className="num">{t.team}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.since}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
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
                        <td className="small muted">{formatDate(partner.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/enterprise/${partner.id}`}>
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
