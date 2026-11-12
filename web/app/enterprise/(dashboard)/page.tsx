import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Building2,
  Circle,
  CheckCircle2,
  FileBarChart,
  Package,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead, StatusTag } from '@/components/ui';
import { HelpButton } from '@/components/HelpButton';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

export default async function EnterpriseOverviewPage() {
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).overview;
  const c = pick(common, locale);
  const ctx = await requireEnterprise();
  const supabase = ctx.supabase;
  const partner = ctx.partner;

  const [productsResult, inventoryResult, membersResult, batchesResult] = await Promise.all([
    supabase
      .from('enterprise_products')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('enterprise_inventory_summary')
      .select('inventory_id, enterprise_product_id, status, denomination_minor, currency, inventory_ref, code_masked, created_at')
      .eq('partner_id', partner.id)
      .limit(2000),
    supabase
      .from('enterprise_members')
      .select('user_id, role, active, created_at, profiles(full_name, email)')
      .eq('partner_id', partner.id)
      .eq('active', true),
    supabase
      .from('enterprise_import_batches')
      .select('id, filename, status, total_rows, inserted_rows, duplicate_rows, invalid_rows, created_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const products = productsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const members = membersResult.data ?? [];
  const batches = batchesResult.data ?? [];

  const productIds = products.map((product) => product.id);
  const { data: orderItems } = productIds.length
    ? await supabase
        .from('order_items')
        .select('id, total_minor, created_at, enterprise_product_id, orders(order_ref, status, created_at, recipient_name)')
        .in('enterprise_product_id', productIds)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] };

  const items = orderItems ?? [];
  const paidItems = items.filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });

  const available = inventory.filter((item) => item.status === 'available');
  const allocated = inventory.filter((item) =>
    ['reserved', 'sold', 'delivered'].includes(item.status),
  );
  const redeemed = inventory.filter((item) => item.status === 'redeemed');
  const availableValue = available.reduce((sum, item) => sum + Number(item.denomination_minor ?? 0), 0);
  const soldValue = paidItems.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);
  const activeProducts = products.filter((product) => product.is_active).length;

  const checklist = [
    { label: t.checklistProfile, done: Boolean(partner.contact_name && partner.contact_email), href: '/enterprise/settings' },
    { label: t.checklistProduct, done: products.length > 0, href: '/enterprise/products' },
    { label: t.checklistImport, done: inventory.length > 0, href: '/enterprise/import' },
    { label: t.checklistOrder, done: allocated.length > 0, href: '/enterprise/reports' },
  ];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={fill(t.greeting, { name: ctx.profile?.full_name?.split(' ')[0] ?? t.greetingFallback })}
        description={fill(t.description, { company: partner.name })}
        actions={
          <>
            <HelpButton step="lifecycle" />
            <Link className="btn sm" href="/enterprise/products">
              <Package size={15} /> {t.products}
            </Link>
            <Link className="btn sm primary" href="/enterprise/import">
              <Upload size={15} /> {t.importCodes}
            </Link>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label={t.availableCodes}
          value={String(available.length)}
          hint={fill(t.faceValueHint, { amount: formatMoney(availableValue) })}
          icon={<Boxes size={17} />}
          tone="lavender"
        />
        <Kpi
          label={t.allocated}
          value={String(allocated.length)}
          hint={fill(t.confirmedRedeemed, { count: redeemed.length })}
          icon={<Wallet size={17} />}
          tone="mint"
        />
        <Kpi
          label={t.paidOrders}
          value={String(new Set(paidItems.map((item) => (Array.isArray(item.orders) ? item.orders[0] : item.orders)?.order_ref)).size)}
          hint={formatMoney(soldValue)}
          icon={<Building2 size={17} />}
          tone="gold"
        />
        <Kpi
          label={t.activeProducts}
          value={String(activeProducts)}
          hint={fill(t.inCatalogue, { count: products.length })}
          icon={<Package size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.recentAllocations}</h3>
            <Link className="small" href="/enterprise/reports" style={{ fontWeight: 800 }}>
              {t.reports} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
            </Link>
          </div>
          <div className="panel-body flush">
            {paidItems.length === 0 ? (
              <div className="table-empty">
                {t.noOrdersYet}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.order}</th>
                      <th>{t.recipient}</th>
                      <th>{c.labels.date}</th>
                      <th className="num">{c.labels.value}</th>
                      <th>{c.labels.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidItems.slice(0, 8).map((item) => {
                      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                      return (
                        <tr key={item.id}>
                          <td className="strong">{order?.order_ref ?? '—'}</td>
                          <td>{order?.recipient_name ?? '—'}</td>
                          <td className="small muted">{formatDate(item.created_at, locale)}</td>
                          <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                          <td>
                            <StatusTag status={order?.status ?? 'pending'} />
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
            <h3>{t.setupChecklist}</h3>
            <span className="tag neutral">
              {checklist.filter((item) => item.done).length}/{checklist.length}
            </span>
          </div>
          <div className="panel-body">
            <div className="split-list">
              {checklist.map((item) => (
                <div key={item.label}>
                  <span className="k">
                    {item.done ? (
                      <CheckCircle2 size={16} color="var(--success)" />
                    ) : (
                      <Circle size={16} />
                    )}{' '}
                    {item.label}
                  </span>
                  <span className="v small">
                    {item.done ? (
                      t.done
                    ) : (
                      <Link href={item.href} style={{ textDecoration: 'underline' }}>
                        {t.setUp}
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <Link className="btn sm" href="/enterprise/settings">
                {t.companySettings}
              </Link>
              <Link className="btn sm ghost" href="/enterprise/import">
                {t.import}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.recentImports}</h3>
            <Link className="small" href="/enterprise/import" style={{ fontWeight: 800 }}>
              {t.importCodes}
            </Link>
          </div>
          <div className="panel-body flush">
            {batches.length === 0 ? (
              <div className="table-empty">{t.noImportsYet}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.file}</th>
                      <th>{c.labels.status}</th>
                      <th className="num">{t.inserted}</th>
                      <th className="num">{t.duplicates}</th>
                      <th className="num">{t.invalid}</th>
                      <th>{c.labels.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="strong">{batch.filename ?? t.manualImport}</td>
                        <td>
                          <StatusTag status={batch.status} />
                        </td>
                        <td className="num">{batch.inserted_rows}</td>
                        <td className="num">{batch.duplicate_rows}</td>
                        <td className="num">{batch.invalid_rows}</td>
                        <td className="small muted">{formatDate(batch.created_at, locale)}</td>
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
            <h3>{t.yourTeam}</h3>
            <Users size={16} />
          </div>
          <div className="panel-body">
            {members.length === 0 ? (
              <p className="small muted">{t.noTeamMembers}</p>
            ) : (
              <div className="split-list">
                {members.map((member) => {
                  const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                  return (
                    <div key={member.user_id}>
                      <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.68rem' }}>
                          {initials(profile?.full_name ?? profile?.email ?? '?')}
                        </span>
                        <span>
                          <strong style={{ color: 'var(--ink)' }}>
                            {profile?.full_name ?? profile?.email ?? t.teamMember}
                          </strong>
                          <br />
                          <span className="small muted">{profile?.email ?? '—'}</span>
                        </span>
                      </span>
                      <span className="v small">
                        <StatusTag status={member.role === 'owner' ? 'approved' : member.role === 'manager' ? 'active' : 'pending'} />{' '}
                        {titleCase(member.role, locale)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="callout info" style={{ marginTop: 14 }}>
              {t.teamAccessNote}
            </div>
          </div>
        </section>
      </div>

      <div className="quick-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Link className="quick-link" href="/enterprise/products">
          <span className="icon-tile lavender">
            <Package size={18} />
          </span>
          {t.products}
        </Link>
        <Link className="quick-link" href="/enterprise/inventory">
          <span className="icon-tile mint">
            <Boxes size={18} />
          </span>
          {t.inventory}
        </Link>
        <Link className="quick-link" href="/enterprise/import">
          <span className="icon-tile gold">
            <Upload size={18} />
          </span>
          {t.import}
        </Link>
        <Link className="quick-link" href="/enterprise/reports">
          <span className="icon-tile coral">
            <FileBarChart size={18} />
          </span>
          {t.reports}
        </Link>
      </div>
    </div>
  );
}
