import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  ImagePlus,
  Send,
} from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { saveVendorProfile, submitVendorApplication } from '@/lib/actions/vendor';
import { formatDate, titleCase } from '@/lib/format';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { VendorImageUpload } from '@/components/VendorImageUpload';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; submitted?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const vendor = ctx.vendor;
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).onboarding;
  const c = pick(common, locale);

  const [applicationResult, categoriesResult, locationsCount, productsCount] = await Promise.all([
    ctx.supabase
      .from('vendor_applications')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.supabase.from('categories').select('id, name').eq('active', true).order('sort_order'),
    ctx.supabase
      .from('vendor_locations')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id),
    ctx.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id)
      .eq('status', 'published'),
  ]);

  const application = applicationResult.data;
  const categories = categoriesResult.data ?? [];

  const steps = [
    { label: t.stepAccount, done: true, detail: formatDate(vendor.created_at, locale) },
    {
      label: t.stepSubmitted,
      done: Boolean(application?.submitted_at),
      detail: application?.submitted_at ? formatDate(application.submitted_at, locale) : t.notYet,
    },
    {
      label: t.stepReview,
      done: application?.status === 'pending_review',
      detail:
        application?.status === 'pending_review'
          ? t.checkingDetails
          : application?.status === 'approved'
            ? t.reviewed
            : t.waiting,
    },
    {
      label: t.stepLive,
      done: vendor.status === 'approved',
      detail: vendor.approved_at ? formatDate(vendor.approved_at, locale) : t.notYet,
    },
  ];

  const checklist = [
    { label: t.businessDescription, done: Boolean(vendor.description), href: '#details' },
    { label: t.logo, done: Boolean(vendor.logo_url), href: '#details' },
    { label: t.location, done: (locationsCount.count ?? 0) > 0, href: '/vendor/settings#locations' },
    { label: t.firstPublishedGift, done: (productsCount.count ?? 0) > 0, href: '/vendor/products/new' },
  ];

  const canSubmit = ['started', 'incomplete', 'rejected'].includes(application?.status ?? 'started');

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={vendor.status === 'approved' ? t.liveTitle : t.getLiveTitle}
        description={t.description}
        actions={
          <Link className="btn sm" href="/vendor/settings">
            {t.fullSettings}
          </Link>
        }
      />

      <Notice
        error={params.error}
        success={
          params.welcome === '1'
            ? t.successReceived
            : params.submitted === '1'
              ? t.successSubmitted
              : params.saved === '1'
                ? t.successSaved
                : null
        }
      />

      {vendor.status === 'approved' ? (
        <div className="callout" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <CheckCircle2 size={18} />
          <span>
            <strong>{t.approvedTitle}</strong> {t.approvedBody}
          </span>
        </div>
      ) : vendor.status === 'rejected' ? (
        <div className="callout error" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            <strong>{t.rejectedTitle}</strong>{' '}
            {application?.decision_note ?? t.rejectedDefault}
          </span>
        </div>
      ) : (
        <div className="callout warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Clock size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            <strong>{t.reviewTitle}</strong> {t.reviewBody}
          </span>
        </div>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.applicationProgress}</h3>
            <StatusTag status={application?.status ?? vendor.status} />
          </div>
          <div className="panel-body">
            <div className="timeline">
              {steps.map((step) => (
                <div className="timeline-item" key={step.label}>
                  <span
                    className="timeline-dot"
                    style={{ background: step.done ? 'var(--mint)' : 'var(--surface)' }}
                  />
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            {canSubmit ? (
              <form action={submitVendorApplication} style={{ marginTop: 8 }}>
                <button className="btn primary" type="submit">
                  <Send size={15} /> {t.submitForReview}
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.beforeLive}</h3>
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
                        {c.actions.add}
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="callout info" style={{ marginTop: 14 }}>
              <FileText size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
              {t.reviewDays}
            </div>
          </div>
        </section>
      </div>

      <section className="panel" id="details">
        <div className="panel-head">
          <h3>{t.businessDetails}</h3>
          <span className="small muted">{t.shownOnStorefront}</span>
        </div>
        <div className="panel-body">
          <form action={saveVendorProfile} style={{ display: 'grid', gap: 16 }}>
            <input type="hidden" name="return_to" value="/vendor/onboarding" />
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
                <input id="phone" name="phone" defaultValue={vendor.phone ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="email">{c.labels.email}</label>
                <input id="email" name="email" type="email" defaultValue={vendor.email ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="website">{t.website}</label>
                <input id="website" name="website" defaultValue={vendor.website ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="area">{t.area}</label>
                <input id="area" name="area" defaultValue={vendor.area ?? ''} placeholder={t.westBay} />
              </div>
              <div className="field">
                <label htmlFor="city">{t.city}</label>
                <input id="city" name="city" defaultValue={vendor.city ?? ''} placeholder={t.doha} />
              </div>
              <div className="field full">
                <label htmlFor="address">{t.address}</label>
                <input id="address" name="address" defaultValue={vendor.address ?? ''} />
              </div>
              <div className="field full">
                <label htmlFor="description">{c.labels.description}</label>
                <textarea id="description" name="description" defaultValue={vendor.description ?? ''} />
              </div>
            </div>
            <div className="btn-row">
              <button className="btn primary" type="submit">
                {t.saveDetails} <ArrowRight size={16} />
              </button>
              <span className="small muted">
                {fill(t.currentStatus, { status: titleCase(vendor.status, locale) })}
              </span>
            </div>
          </form>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <h3>{t.yourImages}</h3>
          <ImagePlus size={16} />
        </div>
        <div className="panel-body">
          <p className="small muted" style={{ marginBottom: 16 }}>
            {t.imagesHint}
          </p>
          <div className="dash-grid">
            <VendorImageUpload kind="logo" currentUrl={vendor.logo_url ?? null} locale={locale} />
            <VendorImageUpload kind="banner" currentUrl={vendor.banner_url ?? null} locale={locale} />
          </div>
        </div>
      </section>
    </div>
  );
}
