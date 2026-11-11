import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  LifeBuoy,
  Mail,
  Phone,
  Store,
  Ticket,
  UserRound,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminUpdateCustomer } from '@/lib/actions/admin';
import { formatDate, formatDateTime, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { Notice, PageHead, StatusTag } from '@/components/ui';

const ACTIVE_VOUCHER = ['issued', 'claimed', 'active', 'partially_redeemed'];

export default async function AdminCustomerDetailPage({
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!profile) notFound();

  const [
    ordersResult,
    vouchersResult,
    supportResult,
    roleResult,
    vendorMembersResult,
    enterpriseMembersResult,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_ref, status, payment_status, total_minor, recipient_name, delivery_method, created_at')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('vouchers')
      .select('id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, recipient_name, expires_at, created_at, products(title)')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('support_requests')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('user_roles').select('role').eq('user_id', id).maybeSingle(),
    supabase
      .from('vendor_members')
      .select('vendor_id, role, active, created_at, vendors(id, name, slug, status)')
      .eq('user_id', id),
    supabase
      .from('enterprise_members')
      .select('partner_id, role, active, created_at, enterprise_partners(id, name, status)')
      .eq('user_id', id),
  ]);

  const error = profileError ?? ordersResult.error ?? null;

  const orders = ordersResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const support = supportResult.data ?? [];
  const vendorMemberships = vendorMembersResult.data ?? [];
  const enterpriseMemberships = enterpriseMembersResult.data ?? [];

  const paid = orders.filter((order) => order.status === 'paid');
  const lifetime = paid.reduce((sum, order) => sum + Number(order.total_minor ?? 0), 0);
  const activeVouchers = vouchers.filter((voucher) => ACTIVE_VOUCHER.includes(voucher.status));
  const outstanding = activeVouchers
    .filter((voucher) => voucher.fulfilment_type === 'monetary')
    .reduce((sum, voucher) => sum + Number(voucher.remaining_value_minor ?? 0), 0);
  const openSupport = support.filter((request) => request.status === 'open').length;
  const isAdmin = roleResult.data?.role === 'admin' || profile.is_admin;

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/customers">
        <ArrowLeft size={15} /> Back to customers
      </Link>

      <PageHead
        eyebrow="Customer"
        title={profile.full_name ?? 'Unnamed customer'}
        description={[profile.email, profile.phone].filter(Boolean).join(' · ') || 'No contact details.'}
        actions={
          <>
            <StatusTag status={profile.status} />
            <span className={`tag ${isAdmin ? 'coral' : 'neutral'}`}>
              {isAdmin ? 'Admin' : 'Customer'}
            </span>
            {profile.email ? (
              <a className="btn sm" href={`mailto:${profile.email}`}>
                <Mail size={14} /> Email
              </a>
            ) : null}
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? 'Customer updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <CreditCard size={17} />
          </span>
          <strong>{paid.length}</strong>
          <span>Paid orders</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <CreditCard size={17} />
          </span>
          <strong>{formatMoney(lifetime)}</strong>
          <span>Lifetime value</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{vouchers.length}</strong>
          <span>{activeVouchers.length} still active</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <LifeBuoy size={17} />
          </span>
          <strong>{openSupport}</strong>
          <span>Open support requests</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Account</h3>
            <UserRound size={16} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">Full name</span>
                <span className="v">{profile.full_name ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Mail size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Email
                </span>
                <span className="v small">{profile.email ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Phone
                </span>
                <span className="v small">{profile.phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">Language</span>
                <span className="v">{titleCase(profile.preferred_language ?? 'en')}</span>
              </div>
              <div>
                <span className="k">Joined</span>
                <span className="v small">{formatDateTime(profile.created_at)}</span>
              </div>
              <div>
                <span className="k">Account ID</span>
                <span className="v mono small">{profile.id}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Account status</h3>
            <StatusTag status={profile.status} />
          </div>
          <div className="panel-body">
            <form action={adminUpdateCustomer} style={{ display: 'grid', gap: 14 }}>
              <input type="hidden" name="user_id" value={profile.id} />
              <input type="hidden" name="return_to" value={`/admin/customers/${profile.id}`} />
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={profile.status}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <button className="btn primary" type="submit">
                Save status
              </button>
              <p className="small muted">
                A suspended account keeps its history but cannot sign in or use vouchers. Use this only
                for abuse or fraud.
              </p>
            </form>

            <div className="divider" style={{ margin: '16px 0' }} />

            <div className="split-list">
              <div>
                <span className="k">Outstanding gift value</span>
                <span className="v">{formatMoney(outstanding)}</span>
              </div>
              <div>
                <span className="k">Support requests</span>
                <span className="v">{support.length}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {vendorMemberships.length > 0 || enterpriseMemberships.length > 0 ? (
        <div className="dash-grid">
          {vendorMemberships.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Vendor access</h3>
                <Store size={16} />
              </div>
              <div className="panel-body flush">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorMemberships.map((membership) => {
                        const vendor = Array.isArray(membership.vendors)
                          ? membership.vendors[0]
                          : membership.vendors;
                        return (
                          <tr key={membership.vendor_id}>
                            <td>
                              {vendor ? (
                                <Link href={`/admin/vendors/${vendor.id}`} className="strong">
                                  {vendor.name}
                                </Link>
                              ) : (
                                'Vendor'
                              )}
                            </td>
                            <td>{titleCase(membership.role)}</td>
                            <td>
                              <StatusTag status={membership.active ? 'active' : 'suspended'} />
                            </td>
                            <td className="small muted">{formatDate(membership.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {enterpriseMemberships.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Enterprise access</h3>
                <Building2 size={16} />
              </div>
              <div className="panel-body flush">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enterpriseMemberships.map((membership) => {
                        const partner = Array.isArray(membership.enterprise_partners)
                          ? membership.enterprise_partners[0]
                          : membership.enterprise_partners;
                        return (
                          <tr key={membership.partner_id}>
                            <td>
                              {partner ? (
                                <Link href={`/admin/enterprise/${partner.id}`} className="strong">
                                  {partner.name}
                                </Link>
                              ) : (
                                'Partner'
                              )}
                            </td>
                            <td>{titleCase(membership.role)}</td>
                            <td>
                              <StatusTag status={membership.active ? 'active' : 'suspended'} />
                            </td>
                            <td className="small muted">{formatDate(membership.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Orders</h3>
          <span className="small muted">{orders.length} total</span>
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
                    <th>Recipient</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th>Delivery</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/admin/orders/${order.id}`} className="strong">
                          {order.order_ref}
                        </Link>
                      </td>
                      <td>{order.recipient_name ?? '—'}</td>
                      <td className="num">{formatMoney(Number(order.total_minor ?? 0))}</td>
                      <td>
                        <StatusTag status={order.status} />
                      </td>
                      <td className="small muted">{titleCase(order.delivery_method ?? '—')}</td>
                      <td className="small muted">{formatDate(order.created_at)}</td>
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
          <h3>Vouchers</h3>
          <span className="small muted">{activeVouchers.length} active</span>
        </div>
        <div className="panel-body flush">
          {vouchers.length === 0 ? (
            <div className="table-empty">No vouchers yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Gift</th>
                    <th>Type</th>
                    <th>Recipient</th>
                    <th className="num">Value</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
                    return (
                      <tr key={voucher.id}>
                        <td className="mono small strong">{voucher.voucher_code}</td>
                        <td>{product?.title ?? 'Gift'}</td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type)}</span>
                        </td>
                        <td>{voucher.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(voucher.initial_value_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small muted">{voucher.expires_at ? formatDate(voucher.expires_at) : 'No expiry'}</td>
                        <td className="small muted">{formatDate(voucher.created_at)}</td>
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
          <h3>Support requests</h3>
          <Link className="small" href="/admin/support" style={{ fontWeight: 800 }}>
            Support queue
          </Link>
        </div>
        <div className="panel-body flush">
          {support.length === 0 ? (
            <div className="table-empty">No support requests from this customer.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Kind</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {support.map((request) => (
                    <tr key={request.id}>
                      <td className="strong">{request.subject ?? 'Support request'}</td>
                      <td className="small">{titleCase(request.kind)}</td>
                      <td className="small mono">{request.reference ?? '—'}</td>
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
  );
}
