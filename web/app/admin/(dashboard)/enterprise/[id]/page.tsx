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
        <ArrowLeft size={15} /> Back to enterprise partners
      </Link>

      <PageHead
        eyebrow="Enterprise partner"
        title={partner.name}
        description={[partner.industry, partner.contact_name].filter(Boolean).join(' · ') || 'Corporate rewards partner.'}
        actions={
          <>
            <StatusTag status={partner.status} />
            {partner.contact_email ? (
              <a className="btn sm" href={`mailto:${partner.contact_email}`}>
                <Mail size={14} /> Contact
              </a>
            ) : null}
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? 'Partner updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Package size={17} />
          </span>
          <strong>{products.filter((product) => product.is_active).length}</strong>
          <span>{products.length} products total</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Upload size={17} />
          </span>
          <strong>{available.length}</strong>
          <span>{formatMoney(availableValue)} available face value</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{allocated.length}</strong>
          <span>Allocated or delivered</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <CheckCircle2 size={17} />
          </span>
          <strong>{redeemed.length}</strong>
          <span>Confirmed redeemed</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Company details</h3>
            <Building2 size={16} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">Company name</span>
                <span className="v">{partner.name}</span>
              </div>
              <div>
                <span className="k">Partner slug</span>
                <span className="v small mono">{partner.slug}</span>
              </div>
              <div>
                <span className="k">
                  <Globe size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Website
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
                <span className="k">Industry</span>
                <span className="v small">{partner.industry ?? '—'}</span>
              </div>
              <div>
                <span className="k">Expected volume</span>
                <span className="v small">{partner.expected_volume ?? '—'}</span>
              </div>
              <div>
                <span className="k">Primary contact</span>
                <span className="v small">{partner.contact_name ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Mail size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Contact email
                </span>
                <span className="v small">{partner.contact_email ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Contact phone
                </span>
                <span className="v small">{partner.contact_phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">Partner since</span>
                <span className="v small">{formatDateTime(partner.created_at)}</span>
              </div>
              <div>
                <span className="k">Paid order value</span>
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
              <h3>Partner status</h3>
              <StatusTag status={partner.status} />
            </div>
            <div className="panel-body">
              <form action={adminUpdatePartner} style={{ display: 'grid', gap: 14 }}>
                <input type="hidden" name="partner_id" value={partner.id} />
                <input type="hidden" name="return_to" value={`/admin/enterprise/${partner.id}`} />
                <div className="field">
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" defaultValue={partner.status}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <button className="btn primary" type="submit">
                  Save status
                </button>
                <p className="small muted">
                  Active partners can sign in and allocate codes. Suspending blocks portal access without
                  deleting inventory.
                </p>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Inventory position</h3>
              <Upload size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">Available codes</span>
                  <span className="v">{available.length}</span>
                </div>
                <div>
                  <span className="k">Available face value</span>
                  <span className="v">{formatMoney(availableValue)}</span>
                </div>
                <div>
                  <span className="k">Allocated</span>
                  <span className="v">{allocated.length}</span>
                </div>
                <div>
                  <span className="k">Redeemed</span>
                  <span className="v">{redeemed.length}</span>
                </div>
                <div>
                  <span className="k">Import batches</span>
                  <span className="v">{batches.length}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Reward products</h3>
          <span className="small muted">{products.length} products</span>
        </div>
        <div className="panel-body flush">
          {products.length === 0 ? (
            <div className="table-empty">No products yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Reference</th>
                    <th className="num">Face value</th>
                    <th className="num">Selling price</th>
                    <th className="num">Commission</th>
                    <th className="num">Available</th>
                    <th className="num">Allocated</th>
                    <th className="num">Redeemed</th>
                    <th>Status</th>
                    <th>Created</th>
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
                        <td className="small muted">{formatDate(product.created_at)}</td>
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
            <h3>Recent imports</h3>
            <span className="small muted">Latest 10 batches</span>
          </div>
          <div className="panel-body flush">
            {batches.length === 0 ? (
              <div className="table-empty">No import batches.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Status</th>
                      <th className="num">Rows</th>
                      <th className="num">Inserted</th>
                      <th className="num">Duplicates</th>
                      <th className="num">Invalid</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="strong">{batch.filename ?? 'Manual import'}</td>
                        <td>
                          <StatusTag status={batch.status} />
                        </td>
                        <td className="num">{batch.total_rows}</td>
                        <td className="num">{batch.inserted_rows}</td>
                        <td className="num">{batch.duplicate_rows}</td>
                        <td className="num">{batch.invalid_rows}</td>
                        <td className="small muted">{formatDate(batch.created_at)}</td>
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
            <h3>Team</h3>
            <Users size={16} />
          </div>
          <div className="panel-body flush">
            {members.length === 0 ? (
              <div className="table-empty">No team members.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Since</th>
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
                                <span className="strong">{profile?.full_name ?? 'Team member'}</span>
                                <br />
                                <span className="sub">{profile?.email ?? '—'}</span>
                              </span>
                            </span>
                          </td>
                          <td>{titleCase(member.role)}</td>
                          <td>
                            <StatusTag status={member.active ? 'active' : 'suspended'} />
                          </td>
                          <td className="small muted">{formatDate(member.created_at)}</td>
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
          <h3>Paid orders</h3>
          <span className="small muted">{items.length} items</span>
        </div>
        <div className="panel-body flush">
          {items.length === 0 ? (
            <div className="table-empty">No paid orders for this partner yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Recipient</th>
                    <th className="num">Value</th>
                    <th>Status</th>
                    <th>Date</th>
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
                        <td>{product?.name ?? 'Product'}</td>
                        <td>{order?.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order?.status ?? 'pending'} />
                        </td>
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
    </div>
  );
}
