import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Globe,
  Mail,
  Package,
  Phone,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminUpdatePartner } from '@/lib/actions/admin';
import { formatDate, formatDateTime, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminEnterpriseDetailPage({
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
  const t = pick(adminCopy, locale).enterpriseDetail;
  const c = pick(common, locale);

  const { data: partner, error: partnerError } = await supabase
    .from('enterprise_partners')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!partner) notFound();

  const [productsResult, inventoryResult, membersResult, batchesResult] = await Promise.all([
    supabase
      .from('enterprise_products')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('enterprise_inventory_summary')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('enterprise_members')
      .select('user_id, role, active, created_at, profiles(full_name, email, phone)')
      .eq('partner_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('enterprise_import_batches')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const error = partnerError ?? productsResult.error ?? null;

  const products = productsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const members = membersResult.data ?? [];
  const batches = batchesResult.data ?? [];

  const productIds = products.map((product) => product.id);
  const { data: orderItems } = productIds.length
    ? await supabase
        .from('order_items')
        .select('id, total_minor, created_at, enterprise_product_id, orders(id, order_ref, status, created_at, recipient_name)')
        .in('enterprise_product_id', productIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] };

  const items = (orderItems ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });

  const available = inventory.filter((item) => item.status === 'available');
  const allocated = inventory.filter((item) => ['reserved', 'sold', 'delivered'].includes(item.status));
  const redeemed = inventory.filter((item) => item.status === 'redeemed');
  const availableValue = available.reduce((sum, item) => sum + Number(item.denomination_minor ?? 0), 0);
  const soldValue = items.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);

  const byProduct = new Map<string, { available: number; allocated: number; redeemed: number }>();
  for (const item of inventory) {
    const current = byProduct.get(item.enterprise_product_id) ?? { available: 0, allocated: 0, redeemed: 0 };
    if (item.status === 'available') current.available += 1;
    else if (['reserved', 'sold', 'delivered'].includes(item.status)) current.allocated += 1;
    else if (item.status === 'redeemed') current.redeemed += 1;
    byProduct.set(item.enterprise_product_id, current);
  }

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/enterprise">
        <ArrowLeft size={15} /> {t.backToPartners}
      </Link>

      <PageHead
        eyebrow={t.eyebrow}
        title={partner.name}
        description={
          [partner.industry, partner.contact_name].filter(Boolean).join(' · ') ||
          t.corporateRewardsPartner
        }
        actions={
          <>
            <StatusTag status={partner.status} />
            {partner.contact_email ? (
              <a className="btn sm" href={`mailto:${partner.contact_email}`}>
                <Mail size={14} /> {t.contact}
              </a>
            ) : null}
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Package size={17} />
          </span>
          <strong>{products.filter((product) => product.is_active).length}</strong>
          <span>{fill(t.productsTotal, { count: products.length })}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Upload size={17} />
          </span>
          <strong>{available.length}</strong>
          <span>{fill(t.availableFaceValue, { amount: formatMoney(availableValue) })}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{allocated.length}</strong>
          <span>{t.allocatedOrDelivered}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <CheckCircle2 size={17} />
          </span>
          <strong>{redeemed.length}</strong>
          <span>{t.confirmedRedeemed}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.companyDetails}</h3>
            <Building2 size={16} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">{t.companyName}</span>
                <span className="v">{partner.name}</span>
              </div>
              <div>
                <span className="k">{t.partnerSlug}</span>
                <span className="v small mono">{partner.slug}</span>
              </div>
              <div>
                <span className="k">
                  <Globe size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.website}
                </span>
                <span className="v small">
                  {partner.website ? (
                    <a href={partner.website} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      {partner.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="k">{t.industry}</span>
                <span className="v small">{partner.industry ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.expectedVolume}</span>
                <span className="v small">{partner.expected_volume ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.primaryContact}</span>
                <span className="v small">{partner.contact_name ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Mail size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.contactEmail}
                </span>
                <span className="v small">{partner.contact_email ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.contactPhone}
                </span>
                <span className="v small">{partner.contact_phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.partnerSince}</span>
                <span className="v small">{formatDateTime(partner.created_at, locale)}</span>
              </div>
              <div>
                <span className="k">{t.paidOrderValue}</span>
                <span className="v">{formatMoney(soldValue)}</span>
              </div>
            </div>
            {partner.notes ? (
              <div className="callout info" style={{ marginTop: 16 }}>
                {partner.notes}
              </div>
            ) : null}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>{t.partnerStatus}</h3>
              <StatusTag status={partner.status} />
            </div>
            <div className="panel-body">
              <form action={adminUpdatePartner} style={{ display: 'grid', gap: 14 }}>
                <input type="hidden" name="partner_id" value={partner.id} />
                <input type="hidden" name="return_to" value={`/admin/enterprise/${partner.id}`} />
                <div className="field">
                  <label htmlFor="status">{c.labels.status}</label>
                  <select id="status" name="status" defaultValue={partner.status}>
                    <option value="draft">{c.status.draft}</option>
                    <option value="active">{c.status.active}</option>
                    <option value="suspended">{c.status.suspended}</option>
                  </select>
                </div>
                <button className="btn primary" type="submit">
                  {t.saveStatus}
                </button>
                <p className="small muted">
                  {t.activePartnersNote}
                </p>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.inventoryPosition}</h3>
              <Upload size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">{t.availableCodes}</span>
                  <span className="v">{available.length}</span>
                </div>
                <div>
                  <span className="k">{t.availableFaceValueLabel}</span>
                  <span className="v">{formatMoney(availableValue)}</span>
                </div>
                <div>
                  <span className="k">{t.allocated}</span>
                  <span className="v">{allocated.length}</span>
                </div>
                <div>
                  <span className="k">{t.redeemed}</span>
                  <span className="v">{redeemed.length}</span>
                </div>
                <div>
                  <span className="k">{t.importBatches}</span>
                  <span className="v">{batches.length}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.rewardProducts}</h3>
          <span className="small muted">{fill(t.productsCount, { count: products.length })}</span>
        </div>
        <div className="panel-body flush">
          {products.length === 0 ? (
            <div className="table-empty">{t.noProductsYet}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.product}</th>
                    <th>{c.labels.reference}</th>
                    <th className="num">{t.faceValue}</th>
                    <th className="num">{t.sellingPrice}</th>
                    <th className="num">{t.commission}</th>
                    <th className="num">{t.available}</th>
                    <th className="num">{t.allocated}</th>
                    <th className="num">{t.redeemed}</th>
                    <th>{c.labels.status}</th>
                    <th>{c.labels.created}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const counts = byProduct.get(product.id) ?? { available: 0, allocated: 0, redeemed: 0 };
                    return (
                      <tr key={product.id}>
                        <td className="strong">{product.name}</td>
                        <td className="small mono">{product.external_ref ?? '—'}</td>
                        <td className="num">{formatMoney(Number(product.denomination_minor))}</td>
                        <td className="num">{formatMoney(Number(product.selling_price_minor))}</td>
                        <td className="num">{(Number(product.commission_bps) / 100).toFixed(2)}%</td>
                        <td className="num">{counts.available}</td>
                        <td className="num">{counts.allocated}</td>
                        <td className="num">{counts.redeemed}</td>
                        <td>
                          <StatusTag status={product.is_active ? 'active' : 'draft'} />
                        </td>
                        <td className="small muted">{formatDate(product.created_at, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.recentImports}</h3>
            <span className="small muted">{t.latestBatches}</span>
          </div>
          <div className="panel-body flush">
            {batches.length === 0 ? (
              <div className="table-empty">{t.noImportBatches}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.batch}</th>
                      <th>{c.labels.status}</th>
                      <th className="num">{t.rows}</th>
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
                        <td className="num">{batch.total_rows}</td>
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
            <h3>{t.team}</h3>
            <Users size={16} />
          </div>
          <div className="panel-body flush">
            {members.length === 0 ? (
              <div className="table-empty">{t.noTeamMembers}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.member}</th>
                      <th>{t.role}</th>
                      <th>{c.labels.status}</th>
                      <th>{t.since}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                      return (
                        <tr key={member.user_id}>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                              <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.66rem' }}>
                                {initials(profile?.full_name ?? profile?.email ?? '?')}
                              </span>
                              <span>
                                <span className="strong">{profile?.full_name ?? t.teamMember}</span>
                                <br />
                                <span className="sub">{profile?.email ?? '—'}</span>
                              </span>
                            </span>
                          </td>
                          <td>{titleCase(member.role, locale)}</td>
                          <td>
                            <StatusTag status={member.active ? 'active' : 'suspended'} />
                          </td>
                          <td className="small muted">{formatDate(member.created_at, locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.paidOrders}</h3>
          <span className="small muted">{fill(t.itemsCount, { count: items.length })}</span>
        </div>
        <div className="panel-body flush">
          {items.length === 0 ? (
            <div className="table-empty">{t.noPaidOrders}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.order}</th>
                    <th>{t.product}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{c.labels.value}</th>
                    <th>{c.labels.status}</th>
                    <th>{c.labels.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 30).map((item) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    const product = products.find((entry) => entry.id === item.enterprise_product_id);
                    return (
                      <tr key={item.id}>
                        <td>
                          {order ? (
                            <Link href={`/admin/orders/${order.id}`} className="strong">
                              {order.order_ref}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{product?.name ?? t.product}</td>
                        <td>{order?.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order?.status ?? 'pending'} />
                        </td>
                        <td className="small muted">{formatDate(item.created_at, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
