import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileText,
  ImagePlus,
  MapPin,
  Percent,
  Plus,
  Trash2,
} from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { addVendorLocation, removeVendorLocation, saveVendorProfile } from '@/lib/actions/vendor';
import { formatDate, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { VendorImageUpload } from '@/components/VendorImageUpload';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const vendor = ctx.vendor;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).settings;
  const c = pick(common, locale);

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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        logoUrl={vendor.logo_url ?? null}
        actions={
          <Link className="btn sm" href={`/vendors/${vendor.slug ?? vendor.id}`} target="_blank">
            {t.viewPublicPage}
          </Link>
        }
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? t.settingsSaved : null}
      />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.businessProfile}</h3>
            <StatusTag status={vendor.status} />
          </div>
          <div className="panel-body">
            <form action={saveVendorProfile} style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="return_to" value="/vendor/settings" />
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">{t.businessName}</label>
                  <input id="name" name="name" required defaultValue={vendor.name} />
                </div>
                <div className="field">
                  <label htmlFor="name_ar">{t.arabicName}</label>
                  <input id="name_ar" name="name_ar" defaultValue={vendor.name_ar ?? ''} dir="rtl" />
                </div>
                <div className="field">
                  <label htmlFor="category_id">{c.labels.category}</label>
                  <select id="category_id" name="category_id" defaultValue={vendor.category_id ?? ''}>
                    <option value="">{t.noCategory}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="phone">{c.labels.phone}</label>
                  <input id="phone" name="phone" defaultValue={vendor.phone ?? ''} placeholder="+974 …" />
                </div>
                <div className="field">
                  <label htmlFor="email">{c.labels.email}</label>
                  <input id="email" name="email" type="email" defaultValue={vendor.email ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="website">{t.website}</label>
                  <input id="website" name="website" defaultValue={vendor.website ?? ''} placeholder="https://…" />
                </div>
                <div className="field">
                  <label htmlFor="social_handle">{t.social}</label>
                  <input id="social_handle" name="social_handle" defaultValue={vendor.social_handle ?? ''} placeholder="@yourbusiness" />
                </div>
                <div className="field">
                  <label htmlFor="area">{t.area}</label>
                  <input id="area" name="area" defaultValue={vendor.area ?? ''} placeholder={t.westBay} />
                </div>
                <div className="field">
                  <label htmlFor="city">{t.city}</label>
                  <input id="city" name="city" defaultValue={vendor.city ?? ''} placeholder={t.doha} />
                </div>
                <div className="field">
                  <label htmlFor="address">{t.address}</label>
                  <input id="address" name="address" defaultValue={vendor.address ?? ''} />
                </div>
                <div className="field full">
                  <label htmlFor="description">{c.labels.description}</label>
                  <textarea id="description" name="description" defaultValue={vendor.description ?? ''} />
                  <span className="hint">{t.descriptionHint}</span>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn primary" type="submit" disabled={!canManage}>
                  {c.actions.saveChanges} <ArrowRight size={16} />
                </button>
                {!canManage ? (
                  <span className="small muted">{t.onlyOwners}</span>
                ) : null}
              </div>
            </form>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>{t.storefrontImages}</h3>
              <ImagePlus size={16} />
            </div>
            <div className="panel-body">
              <p className="small muted" style={{ marginBottom: 16 }}>
                {t.imagesHint}
              </p>
              <div style={{ display: 'grid', gap: 20 }}>
                <VendorImageUpload
                  kind="logo"
                  currentUrl={vendor.logo_url ?? null}
                  locale={locale}
                />
                <VendorImageUpload
                  kind="banner"
                  currentUrl={vendor.banner_url ?? null}
                  locale={locale}
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.commercialTerms}</h3>
              <Percent size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">{t.platformCommission}</span>
                  <span className="v">{commissionPercent}%</span>
                </div>
                <div>
                  <span className="k">{t.sharePerSale}</span>
                  <span className="v">{(100 - Number(commissionPercent)).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="k">{t.outstandingLimit}</span>
                  <span className="v">{formatMoney(Number(vendor.max_unredeemed_minor ?? 0))}</span>
                </div>
                <div>
                  <span className="k">{t.accountStatus}</span>
                  <span className="v">
                    <StatusTag status={vendor.status} />
                  </span>
                </div>
              </div>
              <div className="callout info" style={{ marginTop: 14 }}>
                <Percent size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                {t.commissionNote}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.account}</h3>
              <BadgeCheck size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">{t.signedInAs}</span>
                  <span className="v small">{ctx.user.email}</span>
                </div>
                <div>
                  <span className="k">{t.yourRole}</span>
                  <span className="v">{titleCase(ctx.role, locale)}</span>
                </div>
                <div>
                  <span className="k">{t.vendorSince}</span>
                  <span className="v">{formatDate(vendor.created_at, locale)}</span>
                </div>
                <div>
                  <span className="k">{t.approved}</span>
                  <span className="v">
                    {vendor.approved_at ? formatDate(vendor.approved_at, locale) : t.notYet}
                  </span>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <Link className="btn sm" href="/vendor/staff">
                  {t.manageTeam}
                </Link>
                <Link className="btn sm ghost" href="/vendor/onboarding">
                  {t.onboarding}
                </Link>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.documents}</h3>
              <FileText size={16} />
            </div>
            <div className="panel-body">
              {documents.length === 0 ? (
                <p className="small muted">
                  {t.noDocuments}{' '}
                  <a href="mailto:hello@giftly.qa" style={{ textDecoration: 'underline' }}>
                    hello@giftly.qa
                  </a>
                  .
                </p>
              ) : (
                <div className="split-list">
                  {documents.map((document) => (
                    <div key={document.id}>
                      <span className="k">{titleCase(document.doc_type, locale)}</span>
                      <span className="v small">
                        <StatusTag status={document.status} />{' '}
                        {formatDate(document.created_at, locale)}
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
          <h3>{t.locations}</h3>
          <span className="tag neutral">
            <MapPin size={12} /> {locations.length}
          </span>
        </div>
        <div className="panel-body">
          {locations.length === 0 ? (
            <div className="callout warn">{t.addLocationHint}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.area}</th>
                    <th>{t.address}</th>
                    <th>{t.hours}</th>
                    <th>{t.primary}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location) => (
                    <tr key={location.id}>
                      <td className="strong">{location.area ?? '—'}</td>
                      <td>{location.address ?? '—'}</td>
                      <td className="small muted">{location.hours ?? '—'}</td>
                      <td>
                        {location.is_primary ? <span className="tag success">{t.primary}</span> : '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <form action={removeVendorLocation}>
                            <input type="hidden" name="location_id" value={location.id} />
                            <button className="btn sm ghost" type="submit" disabled={!canManage}>
                              <Trash2 size={13} /> {c.actions.remove}
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
                <label htmlFor="loc_area">{t.area}</label>
                <input id="loc_area" name="area" placeholder={t.westBay} />
              </div>
              <div className="field">
                <label htmlFor="loc_address">{t.address}</label>
                <input id="loc_address" name="address" placeholder={t.addressPlaceholder} />
              </div>
              <div className="field">
                <label htmlFor="loc_hours">{t.openingHours}</label>
                <input id="loc_hours" name="hours" placeholder={t.hoursPlaceholder} />
              </div>
              <label className="checkbox-row">
                <input type="checkbox" name="is_primary" /> {t.primary}
              </label>
              <button className="btn primary" type="submit">
                <Plus size={15} /> {t.addLocation}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="card lavender">
        <span className="icon-tile">
          <Building2 size={20} />
        </span>
        <h3 style={{ marginTop: 12 }}>{t.needChange}</h3>
        <p className="small" style={{ marginTop: 6 }}>
          {t.needChangeBody}
        </p>
        <Link className="btn sm" href="/contact" style={{ marginTop: 12 }}>
          {t.contactSupport}
        </Link>
      </div>
    </div>
  );
}
