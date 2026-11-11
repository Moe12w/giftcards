import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Percent,
  Phone,
  ShoppingBag,
  Star,
  Ticket,
  Users,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSaveVendor, adminSetVendorStatus } from '@/lib/actions/admin';
import { formatDate, formatDateTime, initials, titleCase } from '@/lib/format';
import { formatMoney, minorToInput } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { Notice, PageHead, StatusTag } from '@/components/ui';

const ACTIVE_VOUCHER = ['issued', 'claimed', 'active', 'partially_redeemed'];

export default async function AdminVendorDetailPage({
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

  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*, categories(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (!vendor) notFound();

  const [
    applicationsResult,
    membersResult,
    locationsResult,
    documentsResult,
    productsResult,
    itemsResult,
    vouchersResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from('vendor_applications')
      .select('*')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vendor_members')
      .select('user_id, role, active, created_at, profiles(full_name, email, phone)')
      .eq('vendor_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('vendor_locations')
      .select('*')
      .eq('vendor_id', id)
      .order('is_primary', { ascending: false }),
    supabase
      .from('vendor_documents')
      .select('*')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, title, slug, fulfilment_type, status, is_active, min_amount_minor, max_amount_minor, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('order_items')
      .select('id, total_minor, commission_minor, vendor_share_minor, created_at, products(title), orders(id, order_ref, status, created_at)')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('vouchers')
      .select('id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, recipient_name, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('categories').select('id, name').order('sort_order'),
  ]);

  const error = vendorError ?? applicationsResult.error ?? null;

  const applications = applicationsResult.data ?? [];
  const members = membersResult.data ?? [];
  const locations = locationsResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const products = productsResult.data ?? [];
  const items = itemsResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  const pendingApplication = applications.find((application) => application.status === 'pending_review');
  const paidItems = items.filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });
  const gross = paidItems.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);
  const share = paidItems.reduce((sum, item) => sum + Number(item.vendor_share_minor ?? 0), 0);
  const activeVouchers = vouchers.filter((voucher) => ACTIVE_VOUCHER.includes(voucher.status));
  const outstanding = activeVouchers
    .filter((voucher) => voucher.fulfilment_type === 'monetary')
    .reduce((sum, voucher) => sum + Number(voucher.remaining_value_minor ?? 0), 0);
  const publishedProducts = products.filter((product) => product.status === 'published').length;
  const category = Array.isArray(vendor.categories) ? vendor.categories[0] : vendor.categories;

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/vendors">
        <ArrowLeft size={15} /> Back to vendors
      </Link>

      <PageHead
        eyebrow="Vendor"
        title={vendor.name}
        description={
          [category?.name, vendor.area, vendor.city].filter(Boolean).join(' · ') ||
          'Vendor on the Giftly marketplace.'
        }
        actions={
          <>
            <StatusTag status={vendor.status} />
            {vendor.slug ? (
              <Link className="btn sm ghost" href={`/vendors/${vendor.slug}`} target="_blank">
                <ExternalLink size={14} /> Public page
              </Link>
            ) : null}
            <a className="btn sm" href={`mailto:${vendor.email ?? ''}`}>
              <Mail size={14} /> Contact
            </a>
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? 'Vendor updated.' : null} />

      {pendingApplication ? (
        <div className="callout warn" style={{ display: 'grid', gap: 6 }}>
          <strong>
            <FileText size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> Application waiting
            for review
          </strong>
          <span className="small">
            {pendingApplication.business_name ?? vendor.name} submitted{' '}
            {formatDate(pendingApplication.submitted_at ?? pendingApplication.created_at)}. Review the
            details below, then approve or reject.
          </span>
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <ShoppingBag size={17} />
          </span>
          <strong>{publishedProducts}</strong>
          <span>Published products</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <BadgeCheck size={17} />
          </span>
          <strong>{formatMoney(gross)}</strong>
          <span>Gross sales (recent)</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Percent size={17} />
          </span>
          <strong>{(Number(vendor.commission_bps ?? 0) / 100).toFixed(2)}%</strong>
          <span>Commission · {formatMoney(share)} vendor share</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{formatMoney(outstanding)}</strong>
          <span>{activeVouchers.length} active vouchers</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Business details</h3>
            <span className="tag neutral">{titleCase(vendor.status)}</span>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">
                  <Building2 size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Legal name
                </span>
                <span className="v">{vendor.name}</span>
              </div>
              <div>
                <span className="k">Arabic name</span>
                <span className="v" dir="rtl">
                  {vendor.name_ar ?? '—'}
                </span>
              </div>
              <div>
                <span className="k">
                  <Mail size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Email
                </span>
                <span className="v small">{vendor.email ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Phone
                </span>
                <span className="v small">{vendor.phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">Website</span>
                <span className="v small">
                  {vendor.website ? (
                    <a href={vendor.website} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      {vendor.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="k">Social</span>
                <span className="v small">{vendor.social_handle ?? '—'}</span>
              </div>
              <div>
                <span className="k">
                  <MapPin size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Location
                </span>
                <span className="v small">
                  {[vendor.address, vendor.area, vendor.city].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
              <div>
                <span className="k">
                  <Star size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Rating
                </span>
                <span className="v">{Number(vendor.rating ?? 0).toFixed(1)}</span>
              </div>
              <div>
                <span className="k">Joined</span>
                <span className="v small">{formatDate(vendor.created_at)}</span>
              </div>
              <div>
                <span className="k">Approved</span>
                <span className="v small">{vendor.approved_at ? formatDateTime(vendor.approved_at) : 'Not yet'}</span>
              </div>
            </div>
            {vendor.description ? (
              <p className="small muted" style={{ marginTop: 16 }}>
                {vendor.description}
              </p>
            ) : null}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>Account status</h3>
              {vendor.status === 'approved' ? <CheckCircle2 size={16} /> : <Ban size={16} />}
            </div>
            <div className="panel-body">
              <form action={adminSetVendorStatus} style={{ display: 'grid', gap: 14 }}>
                <input type="hidden" name="vendor_id" value={vendor.id} />
                <input type="hidden" name="return_to" value={`/admin/vendors/${vendor.id}`} />
                <div className="field">
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" defaultValue={vendor.status}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="note">Decision note</label>
                  <textarea
                    id="note"
                    name="note"
                    placeholder="Shown to the vendor and saved with the decision."
                    defaultValue={pendingApplication?.decision_note ?? ''}
                  />
                </div>
                <button className="btn primary" type="submit">
                  Save status
                </button>
                <p className="small muted">
                  Approving publishes the vendor storefront and products. Suspending hides them from
                  customers but keeps the records.
                </p>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Commercial terms</h3>
              <Percent size={16} />
            </div>
            <div className="panel-body">
              <form action={adminSaveVendor} style={{ display: 'grid', gap: 14 }}>
                <input type="hidden" name="vendor_id" value={vendor.id} />
                <input type="hidden" name="return_to" value={`/admin/vendors/${vendor.id}`} />
                <div className="field">
                  <label htmlFor="commission_percent">Commission (%)</label>
                  <input
                    id="commission_percent"
                    name="commission_percent"
                    inputMode="decimal"
                    defaultValue={(Number(vendor.commission_bps ?? 0) / 100).toFixed(2)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="max_unredeemed">Exposure limit (QAR)</label>
                  <input
                    id="max_unredeemed"
                    name="max_unredeemed"
                    inputMode="decimal"
                    defaultValue={minorToInput(vendor.max_unredeemed_minor)}
                  />
                  <span className="hint">The maximum unredeemed balance allowed for this vendor.</span>
                </div>
                <div className="field">
                  <label htmlFor="category_id">Category</label>
                  <select id="category_id" name="category_id" defaultValue={vendor.category_id ?? ''}>
                    <option value="">No category</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" name="is_featured" defaultChecked={vendor.is_featured} /> Feature on
                  the marketplace
                </label>
                <button className="btn" type="submit">
                  Save commercial terms
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Application</h3>
          <span className="small muted">{applications.length} on record</span>
        </div>
        <div className="panel-body flush">
          {applications.length === 0 ? (
            <div className="table-empty">No application submitted yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Decided</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <span className="strong">{application.business_name ?? vendor.name}</span>
                        <br />
                        <span className="sub">{application.business_category ?? 'No category'}</span>
                      </td>
                      <td className="small">
                        {application.business_email ?? '—'}
                        <br />
                        <span className="sub">{application.business_phone ?? '—'}</span>
                      </td>
                      <td className="small">{application.business_location ?? '—'}</td>
                      <td>
                        <StatusTag status={application.status} />
                      </td>
                      <td className="small muted">{formatDate(application.submitted_at ?? application.created_at)}</td>
                      <td className="small muted">{formatDate(application.decided_at)}</td>
                      <td className="small muted">{application.decision_note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Team</h3>
            <span className="tag neutral">
              <Users size={12} /> {members.filter((member) => member.active).length}
            </span>
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
                      <th>Joined</th>
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
                                <span className="sub">{profile?.email ?? member.user_id}</span>
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

        <section className="panel">
          <div className="panel-head">
            <h3>Locations & documents</h3>
          </div>
          <div className="panel-body">
            <div className="split-list">
              {locations.length === 0 ? (
                <p className="small muted">No locations on file.</p>
              ) : (
                locations.map((location) => (
                  <div key={location.id}>
                    <span className="k">
                      {location.is_primary ? <strong style={{ color: 'var(--ink)' }}>Primary · </strong> : null}
                      {location.area ?? 'Location'}
                    </span>
                    <span className="v small">{location.address ?? location.hours ?? '—'}</span>
                  </div>
                ))
              )}
            </div>
            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="split-list">
              {documents.length === 0 ? (
                <p className="small muted">No documents uploaded.</p>
              ) : (
                documents.map((document) => (
                  <div key={document.id}>
                    <span className="k">
                      <FileText size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                      {titleCase(document.doc_type)}
                    </span>
                    <span className="v small">
                      <StatusTag status={document.status} /> {formatDate(document.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Products</h3>
          <Link className="small" href={`/admin/products?vendor=${vendor.id}`} style={{ fontWeight: 800 }}>
            Manage products
          </Link>
        </div>
        <div className="panel-body flush">
          {products.length === 0 ? (
            <div className="table-empty">No products yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Gift</th>
                    <th>Type</th>
                    <th className="num">From</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="strong">{product.title}</td>
                      <td>
                        <span className="tag">{fulfilmentLabel(product.fulfilment_type)}</span>
                      </td>
                      <td className="num">{formatMoney(Number(product.min_amount_minor ?? 0))}</td>
                      <td>
                        <StatusTag status={product.status} />
                      </td>
                      <td className="small muted">{formatDate(product.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Recent orders</h3>
            <span className="small muted">Latest 12 items</span>
          </div>
          <div className="panel-body flush">
            {items.length === 0 ? (
              <div className="table-empty">No orders yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Gift</th>
                      <th className="num">Total</th>
                      <th className="num">Share</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                      const product = Array.isArray(item.products) ? item.products[0] : item.products;
                      return (
                        <tr key={item.id}>
                          <td>
                            {order?.order_ref ? (
                              <Link href={`/admin/orders/${order.id}`} className="strong">
                                {order.order_ref}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{product?.title ?? 'Gift'}</td>
                          <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                          <td className="num">{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
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

        <section className="panel">
          <div className="panel-head">
            <h3>Recent vouchers</h3>
            <Ticket size={16} />
          </div>
          <div className="panel-body flush">
            {vouchers.length === 0 ? (
              <div className="table-empty">No vouchers issued yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((voucher) => (
                      <tr key={voucher.id}>
                        <td className="mono small strong">{voucher.voucher_code}</td>
                        <td className="small">{voucher.recipient_name ?? '—'}</td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small muted">{formatDate(voucher.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
