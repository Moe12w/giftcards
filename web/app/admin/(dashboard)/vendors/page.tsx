import Link from 'next/link';
import { Search, Store } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials } from '@/lib/format';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const { data, error } = await ctx.supabase
    .from('vendors')
    .select('id, name, slug, status, email, phone, city, area, rating, commission_bps, is_featured, created_at, approved_at, products(id), vendor_applications(status)')
    .order('created_at', { ascending: false })
    .limit(500);

  const vendors = (data ?? []).filter((vendor) => {
    if (status === 'pending') {
      const applications = Array.isArray(vendor.vendor_applications) ? vendor.vendor_applications : [];
      if (vendor.status !== 'pending' && !applications.some((application) => application.status === 'pending_review')) {
        return false;
      }
    } else if (status && vendor.status !== status) {
      return false;
    }
    if (!q) return true;
    return [vendor.name, vendor.email, vendor.city, vendor.area, vendor.slug]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Network"
        title="Vendors"
        description="Review applications, manage commercial terms and see how each business is performing."
      />

      <Notice
        error={params.error ?? error?.message}
        success={params.saved === '1' ? 'Vendor updated.' : null}
      />

      <form className="toolbar" action="/admin/vendors" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Business, email or area…" aria-label="Search vendors" />
        </div>
        <select name="status" defaultValue={status} aria-label="Vendor status">
          <option value="">All vendors</option>
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/vendors">
            Clear
          </Link>
        ) : null}
      </form>

      {vendors.length === 0 ? (
        <EmptyState
          title={q || status ? 'No vendors match' : 'No vendors yet'}
          body={
            q || status
              ? 'Try a different search or clear the filters.'
              : 'Vendor applications will appear here as businesses sign up.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'}
            </h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th className="num">Commission</th>
                    <th className="num">Products</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => {
                    const products = Array.isArray(vendor.products) ? vendor.products : [];
                    return (
                      <tr key={vendor.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                              {initials(vendor.name)}
                            </span>
                            <div>
                              <Link href={`/admin/vendors/${vendor.id}`} className="strong">
                                {vendor.name}
                              </Link>
                              <br />
                              <span className="sub">
                                {vendor.slug ?? '—'}
                                {vendor.is_featured ? ' · Featured' : ''}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="small">{vendor.email ?? '—'}</span>
                          <br />
                          <span className="sub">{vendor.phone ?? '—'}</span>
                        </td>
                        <td className="small">
                          {[vendor.area, vendor.city].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="num">{(Number(vendor.commission_bps ?? 0) / 100).toFixed(2)}%</td>
                        <td className="num">{products.length}</td>
                        <td>
                          <StatusTag status={vendor.status} />
                        </td>
                        <td className="small muted">{formatDate(vendor.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/vendors/${vendor.id}`}>
                              <Store size={13} /> Open
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
