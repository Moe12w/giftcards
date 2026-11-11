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

export default async function VendorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; submitted?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const vendor = ctx.vendor;
  const locale = ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en';

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
    { label: 'Account created', done: true, detail: formatDate(vendor.created_at) },
    {
      label: 'Application submitted',
      done: Boolean(application?.submitted_at),
      detail: application?.submitted_at ? formatDate(application.submitted_at) : 'Not yet',
    },
    {
      label: 'Under review',
      done: application?.status === 'pending_review',
      detail:
        application?.status === 'pending_review'
          ? 'Our team is checking your details'
          : application?.status === 'approved'
            ? 'Reviewed'
            : 'Waiting',
    },
    {
      label: 'Approved and live',
      done: vendor.status === 'approved',
      detail: vendor.approved_at ? formatDate(vendor.approved_at) : 'Not yet',
    },
  ];

  const checklist = [
    { label: 'Business description', done: Boolean(vendor.description), href: '#details' },
    { label: 'Logo', done: Boolean(vendor.logo_url), href: '#details' },
    { label: 'Location', done: (locationsCount.count ?? 0) > 0, href: '/vendor/settings#locations' },
    { label: 'First published gift', done: (productsCount.count ?? 0) > 0, href: '/vendor/products/new' },
  ];

  const canSubmit = ['started', 'incomplete', 'rejected'].includes(application?.status ?? 'started');

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Onboarding"
        title={vendor.status === 'approved' ? 'You are live.' : 'Let’s get you live.'}
        description="Keep your business details accurate. Our team reviews every application before your gifts appear in the app."
        actions={
          <Link className="btn sm" href="/vendor/settings">
            Full settings
          </Link>
        }
      />

      <Notice
        error={params.error}
        success={
          params.welcome === '1'
            ? 'Application received. We will review it and email you when it is approved.'
            : params.submitted === '1'
              ? 'Application submitted for review.'
              : params.saved === '1'
                ? 'Details saved.'
                : null
        }
      />

      {vendor.status === 'approved' ? (
        <div className="callout" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <CheckCircle2 size={18} />
          <span>
            <strong>Approved.</strong> Your storefront is live. Publish a gift to start selling.
          </span>
        </div>
      ) : vendor.status === 'rejected' ? (
        <div className="callout error" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            <strong>Application not approved.</strong>{' '}
            {application?.decision_note ?? 'Contact us if you would like to discuss the decision.'}
          </span>
        </div>
      ) : (
        <div className="callout warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Clock size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            <strong>Under review.</strong> You can prepare your gifts now. They become visible to
            customers after approval.
          </span>
        </div>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Application progress</h3>
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
                  <Send size={15} /> Submit for review
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Before you go live</h3>
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
                      'Done'
                    ) : (
                      <Link href={item.href} style={{ textDecoration: 'underline' }}>
                        Add
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="callout info" style={{ marginTop: 14 }}>
              <FileText size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Applications
              are usually reviewed within two working days.
            </div>
          </div>
        </section>
      </div>

      <section className="panel" id="details">
        <div className="panel-head">
          <h3>Business details</h3>
          <span className="small muted">Shown on your public storefront</span>
        </div>
        <div className="panel-body">
          <form action={saveVendorProfile} style={{ display: 'grid', gap: 16 }}>
            <input type="hidden" name="return_to" value="/vendor/onboarding" />
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
                <input id="phone" name="phone" defaultValue={vendor.phone ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" defaultValue={vendor.email ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" defaultValue={vendor.website ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="area">Area</label>
                <input id="area" name="area" defaultValue={vendor.area ?? ''} placeholder="West Bay" />
              </div>
              <div className="field">
                <label htmlFor="city">City</label>
                <input id="city" name="city" defaultValue={vendor.city ?? ''} placeholder="Doha" />
              </div>
              <div className="field full">
                <label htmlFor="address">Address</label>
                <input id="address" name="address" defaultValue={vendor.address ?? ''} />
              </div>
              <div className="field full">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" defaultValue={vendor.description ?? ''} />
              </div>
            </div>
            <div className="btn-row">
              <button className="btn primary" type="submit">
                Save details <ArrowRight size={16} />
              </button>
              <span className="small muted">Current status: {titleCase(vendor.status)}</span>
            </div>
          </form>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <h3>Your images</h3>
          <ImagePlus size={16} />
        </div>
        <div className="panel-body">
          <p className="small muted" style={{ marginBottom: 16 }}>
            A logo and a banner make your card recognisable. Upload them here and they are used
            everywhere the gift appears.
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
