import Link from 'next/link';
import { ArrowRight, BadgeCheck, Building2, FileText, MapPin, Percent, Plus, Trash2 } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { addVendorLocation, removeVendorLocation, saveVendorProfile } from '@/lib/actions/vendor';
import { formatDate, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';

export default async function VendorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const vendor = ctx.vendor;

  const [categoriesResult, locationsResult, documentsResult] = await Promise.all([
    ctx.supabase.from('categories').select('id, name').eq('active', true).order('sort_order'),
    ctx.supabase
      .from('vendor_locations')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    ctx.supabase
      .from('vendor_documents')
      .select('id, doc_type, file_url, status, created_at')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false }),
  ]);

  const categories = categoriesResult.data ?? [];
  const locations = locationsResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const canManage = ctx.role === 'owner' || ctx.role === 'manager';
  const commissionPercent = (Number(vendor.commission_bps ?? 0) / 100).toFixed(2);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Settings"
        title="Your business, on your terms."
        description="Keep your storefront details accurate. Commission and account status are managed by the Giftly team."
        actions={
          <Link className="btn sm" href={`/vendors/${vendor.slug ?? vendor.id}`} target="_blank">
            View public page
          </Link>
        }
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Settings saved.' : null}
      />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Business profile</h3>
            <StatusTag status={vendor.status} />
          </div>
          <div className="panel-body">
            <form action={saveVendorProfile} style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="return_to" value="/vendor/settings" />
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Business name</label>
                  <input id="name" name="name" required defaultValue={vendor.name} />
                </div>
                <div className="field">
                  <label htmlFor="name_ar">Arabic name</label>
                  <input id="name_ar" name="name_ar" defaultValue={vendor.name_ar ?? ''} dir="rtl" />
                </div>
                <div className="field">
                  <label htmlFor="category_id">Category</label>
                  <select id="category_id" name="category_id" defaultValue={vendor.category_id ?? ''}>
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" defaultValue={vendor.phone ?? ''} placeholder="+974 …" />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" defaultValue={vendor.email ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" defaultValue={vendor.website ?? ''} placeholder="https://…" />
                </div>
                <div className="field">
                  <label htmlFor="social_handle">Instagram / social</label>
                  <input id="social_handle" name="social_handle" defaultValue={vendor.social_handle ?? ''} placeholder="@yourbusiness" />
                </div>
                <div className="field">
                  <label htmlFor="area">Area</label>
                  <input id="area" name="area" defaultValue={vendor.area ?? ''} placeholder="West Bay" />
                </div>
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input id="city" name="city" defaultValue={vendor.city ?? ''} placeholder="Doha" />
                </div>
                <div className="field">
                  <label htmlFor="address">Address</label>
                  <input id="address" name="address" defaultValue={vendor.address ?? ''} />
                </div>
                <div className="field full">
                  <label htmlFor="description">Description</label>
                  <textarea id="description" name="description" defaultValue={vendor.description ?? ''} />
                  <span className="hint">Shown on your public storefront and vendor card.</span>
                </div>
                <div className="field">
                  <label htmlFor="logo_url">Logo URL</label>
                  <input id="logo_url" name="logo_url" defaultValue={vendor.logo_url ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="banner_url">Banner URL</label>
                  <input id="banner_url" name="banner_url" defaultValue={vendor.banner_url ?? ''} />
                </div>
              </div>
              <div className="btn-row">
                <button className="btn primary" type="submit" disabled={!canManage}>
                  Save changes <ArrowRight size={16} />
                </button>
                {!canManage ? (
                  <span className="small muted">Only owners and managers can edit the profile.</span>
                ) : null}
              </div>
            </form>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>Commercial terms</h3>
              <Percent size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">Platform commission</span>
                  <span className="v">{commissionPercent}%</span>
                </div>
                <div>
                  <span className="k">Your share per sale</span>
                  <span className="v">{(100 - Number(commissionPercent)).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="k">Outstanding exposure limit</span>
                  <span className="v">{formatMoney(Number(vendor.max_unredeemed_minor ?? 0))}</span>
                </div>
                <div>
                  <span className="k">Account status</span>
                  <span className="v">
                    <StatusTag status={vendor.status} />
                  </span>
                </div>
              </div>
              <div className="callout info" style={{ marginTop: 14 }}>
                <Percent size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Commission is
                agreed with Giftly and can only be changed by our team. Sales, commission and your share
                are shown per order.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Account</h3>
              <BadgeCheck size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">Signed in as</span>
                  <span className="v small">{ctx.user.email}</span>
                </div>
                <div>
                  <span className="k">Your role</span>
                  <span className="v">{titleCase(ctx.role)}</span>
                </div>
                <div>
                  <span className="k">Vendor since</span>
                  <span className="v">{formatDate(vendor.created_at)}</span>
                </div>
                <div>
                  <span className="k">Approved</span>
                  <span className="v">{vendor.approved_at ? formatDate(vendor.approved_at) : 'Not yet'}</span>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <Link className="btn sm" href="/vendor/staff">
                  Manage team
                </Link>
                <Link className="btn sm ghost" href="/vendor/onboarding">
                  Onboarding
                </Link>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Documents</h3>
              <FileText size={16} />
            </div>
            <div className="panel-body">
              {documents.length === 0 ? (
                <p className="small muted">
                  No documents on file. If our team asks for a trade licence or similar, send it to{' '}
                  <a href="mailto:hello@giftly.qa" style={{ textDecoration: 'underline' }}>
                    hello@giftly.qa
                  </a>
                  .
                </p>
              ) : (
                <div className="split-list">
                  {documents.map((document) => (
                    <div key={document.id}>
                      <span className="k">{titleCase(document.doc_type)}</span>
                      <span className="v small">
                        <StatusTag status={document.status} /> {formatDate(document.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="panel" id="locations">
        <div className="panel-head">
          <h3>Locations</h3>
          <span className="tag neutral">
            <MapPin size={12} /> {locations.length}
          </span>
        </div>
        <div className="panel-body">
          {locations.length === 0 ? (
            <div className="callout warn">
              Add at least one location so customers know where to redeem their gift.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Address</th>
                    <th>Hours</th>
                    <th>Primary</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location) => (
                    <tr key={location.id}>
                      <td className="strong">{location.area ?? '—'}</td>
                      <td>{location.address ?? '—'}</td>
                      <td className="small muted">{location.hours ?? '—'}</td>
                      <td>{location.is_primary ? <span className="tag success">Primary</span> : '—'}</td>
                      <td>
                        <div className="row-actions">
                          <form action={removeVendorLocation}>
                            <input type="hidden" name="location_id" value={location.id} />
                            <button className="btn sm ghost" type="submit" disabled={!canManage}>
                              <Trash2 size={13} /> Remove
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage ? (
            <form action={addVendorLocation} className="inline-form" style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="loc_area">Area</label>
                <input id="loc_area" name="area" placeholder="West Bay" />
              </div>
              <div className="field">
                <label htmlFor="loc_address">Address</label>
                <input id="loc_address" name="address" placeholder="Street, building, floor" />
              </div>
              <div className="field">
                <label htmlFor="loc_hours">Opening hours</label>
                <input id="loc_hours" name="hours" placeholder="Daily 8am–10pm" />
              </div>
              <label className="checkbox-row">
                <input type="checkbox" name="is_primary" /> Primary
              </label>
              <button className="btn primary" type="submit">
                <Plus size={15} /> Add location
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="card lavender">
        <span className="icon-tile">
          <Building2 size={20} />
        </span>
        <h3 style={{ marginTop: 12 }}>Need to change something else?</h3>
        <p className="small" style={{ marginTop: 6 }}>
          Ownership, payout details and commission changes are handled by the Giftly team. Send us a
          note and we will help.
        </p>
        <Link className="btn sm" href="/contact" style={{ marginTop: 12 }}>
          Contact support
        </Link>
      </div>
    </div>
  );
}
