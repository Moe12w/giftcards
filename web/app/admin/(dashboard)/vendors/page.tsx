import Link from 'next/link';
import { Download, Search, Store } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials } from '@/lib/format';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { OptimizedImage } from '@/components/OptimizedImage';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';
import { supplierListStatus } from '@/lib/supplier-status';

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).vendors;
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const { data, error } = await ctx.supabase
    .from('vendors')
    .select('id, name, slug, status, email, phone, city, area, rating, commission_bps, is_featured, created_at, approved_at, logo_url, banner_url, myfatoorah_supplier_code, myfatoorah_supplier_status, myfatoorah_last_error, myfatoorah_creation_claimed_at, payment_eligibility, products(id), vendor_applications(status)')
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <a className="btn sm primary" href="/api/admin/vendors/files">
            <Download size={14} /> Download all files
          </a>
        }
      />

      <Notice
        error={params.error ?? error?.message}
        success={params.saved === '1' ? t.saved : null}
      />

      <form className="toolbar" action="/admin/vendors" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allVendors}</option>
          <option value="pending">{c.status.pending_review}</option>
          <option value="approved">{c.status.approved}</option>
          <option value="rejected">{c.status.rejected}</option>
          <option value="suspended">{c.status.suspended}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/vendors">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {vendors.length === 0 ? (
        <EmptyState
          title={q || status ? t.noVendorsMatch : t.noVendorsYet}
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
              {fill(vendors.length === 1 ? t.vendorCountOne : t.vendorCount, { count: vendors.length })}
            </h3>
            <span className="small muted">{t.newestFirst}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.business}</th>
                    <th>{t.contact}</th>
                    <th>{t.location}</th>
                    <th className="num">{t.commission}</th>
                    <th className="num">{t.products}</th>
                    <th>{c.labels.status}</th>
                    <th>MyFatoorah</th>
                    <th>{t.joined}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => {
                    const products = Array.isArray(vendor.products) ? vendor.products : [];
                    return (
                      <tr key={vendor.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {vendor.logo_url ? (
                              <OptimizedImage
                                className="table-logo"
                                src={vendor.logo_url}
                                alt={vendor.name ?? ''}
                                width={32}
                                height={32}
                                sizes="32px"
                              />
                            ) : (
                              <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                                {initials(vendor.name)}
                              </span>
                            )}
                            <div>
                              <Link href={`/admin/vendors/${vendor.id}`} className="strong">
                                {vendor.name}
                              </Link>
                              <br />
                              <span className="sub">
                                {vendor.slug ?? '—'}
                                {vendor.is_featured ? ` · ${t.featured}` : ''}
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
                        <td>
                          <StatusTag
                            status={supplierListStatus({
                              code: vendor.myfatoorah_supplier_code,
                              status: vendor.myfatoorah_supplier_status,
                              lastError: vendor.myfatoorah_last_error,
                              claimedAt: vendor.myfatoorah_creation_claimed_at,
                            })}
                          />
                          {vendor.payment_eligibility ? (
                            <span className="sub">· Live</span>
                          ) : null}
                        </td>
                        <td className="small muted">{formatDate(vendor.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/vendors/${vendor.id}`}>
                              <Store size={13} /> {c.actions.open}
                            </Link>
                            <a
                              className="btn sm ghost"
                              href={`/api/admin/vendors/files?vendor=${vendor.id}`}
                              title="Download this vendor's files"
                            >
                              <Download size={13} /> Files
                            </a>
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
