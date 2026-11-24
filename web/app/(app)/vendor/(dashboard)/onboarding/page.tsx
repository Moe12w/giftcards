import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
} from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { saveVendorOnboardingStep } from '@/lib/actions/vendor';
import { Notice, PageHead } from '@/components/ui';
import { VendorImageUpload } from '@/components/VendorImageUpload';
import { WizardRail, type WizardStep } from '@/components/WizardRail';
import { getLocale } from '@/lib/i18n/server';
import { titleCase } from '@/lib/format';

const STEPS: WizardStep[] = [
  { key: 'business', label: 'Business information', href: '/vendor/onboarding?step=business' },
  { key: 'profile', label: 'Business profile', href: '/vendor/onboarding?step=profile' },
  { key: 'preferences', label: 'What you sell', href: '/vendor/onboarding?step=preferences' },
  { key: 'done', label: 'Ready' },
];

const BUSINESS_TYPES = [
  {
    key: 'home',
    title: 'Home business / independent',
    body: 'You run the business yourself or from home. No corporate paperwork is required.',
  },
  {
    key: 'company',
    title: 'Company / corporate',
    body: 'A registered company. You will add commercial registration documents later.',
  },
];

const INTENTS = [
  { key: 'gift_cards', title: 'Gift cards', body: 'A fixed amount the customer can spend with you.' },
  { key: 'experiences', title: 'Experiences', body: 'A set package such as a treatment, class or meal.' },
  { key: 'services', title: 'Services', body: 'A booked service paid in advance.' },
  { key: 'products', title: 'Products', body: 'Physical or digital items sold in advance.' },
  { key: 'packages', title: 'Packages', body: 'A bundle of sessions or items.' },
];

export default async function VendorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; welcome?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const vendor = ctx.vendor;
  const locale = await getLocale();

  const current = STEPS.some((step) => step.key === params.step) ? (params.step as string) : 'business';

  const { data: categories } = await ctx.supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)
    .order('sort_order');

  const intents = Array.isArray(vendor.intents) ? vendor.intents : [];
  const businessType = vendor.business_type ?? '';

  const notice =
    params.welcome === '1'
      ? 'Welcome to Tazilla. Your dashboard is ready — finish this short setup whenever you like.'
      : params.saved === '1'
        ? 'Saved. You can leave at any time and continue from your dashboard.'
        : null;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Set up your business"
        title={current === 'done' ? 'Your business account is ready!' : 'Let’s set up your business'}
        description={
          current === 'done'
            ? 'Welcome aboard. Your dashboard is ready. You can now prepare your gifts and start accepting online payments.'
            : 'Three short steps. Everything saves as you go, and your dashboard stays available the whole time.'
        }
        actions={
          current === 'done' ? (
            <Link className="btn primary" href="/vendor">
              <LayoutDashboard size={15} /> Go to Dashboard
            </Link>
          ) : (
            <Link className="btn sm ghost" href="/vendor">
              Skip for now
            </Link>
          )
        }
      />

      <Notice error={params.error} success={notice} />

      {current === 'done' ? (
        <div className="dash-grid">
          <section className="panel">
            <div className="panel-head">
              <h3>You are ready to go</h3>
              <CheckCircle2 size={18} color="var(--success)" />
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
              <p style={{ margin: 0 }}>
                Your account and business record are created. Here is what you can do next:
              </p>
              <div className="split-list">
                <div>
                  <span className="k">Add your gifts</span>
                  <span className="v small">
                    <Link href="/vendor/products/new" style={{ textDecoration: 'underline' }}>
                      Create a gift
                    </Link>
                  </span>
                </div>
                <div>
                  <span className="k">Apply for online payments</span>
                  <span className="v small">
                    <Link href="/vendor/payments" style={{ textDecoration: 'underline' }}>
                      Open Online Payments
                    </Link>
                  </span>
                </div>
                <div>
                  <span className="k">Complete business details</span>
                  <span className="v small">
                    <Link href="/vendor/settings" style={{ textDecoration: 'underline' }}>
                      Business settings
                    </Link>
                  </span>
                </div>
              </div>
              <div className="btn-row">
                <Link className="btn primary" href="/vendor">
                  <LayoutDashboard size={15} /> Go to Dashboard
                </Link>
                <Link className="btn ghost" href="/vendor/payments">
                  <CreditCard size={15} /> Online Payments
                </Link>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Your setup so far</h3>
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">Business name</span>
                  <span className="v">{vendor.name}</span>
                </div>
                <div>
                  <span className="k">Business type</span>
                  <span className="v">{businessType ? titleCase(businessType, locale) : 'Not set'}</span>
                </div>
                <div>
                  <span className="k">Category</span>
                  <span className="v">
                    {categories?.find((category) => category.id === vendor.category_id)?.name ?? 'Not set'}
                  </span>
                </div>
                <div>
                  <span className="k">What you sell</span>
                  <span className="v small">
                    {intents.length > 0
                      ? intents.map((intent) => intent.replace(/_/g, ' ')).join(', ')
                      : 'Not set'}
                  </span>
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 14 }}>
                Payment verification is separate. You can use your dashboard now and complete the payment
                application whenever you are ready.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <>
          <WizardRail steps={STEPS} current={current} />

          {current === 'business' ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Business information</h3>
                <span className="tag neutral">Step 1 of 3</span>
              </div>
              <div className="panel-body">
                <form action={saveVendorOnboardingStep} className="form" style={{ display: 'grid', gap: 16 }}>
                  <input type="hidden" name="step" value="business" />
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="name">Business name</label>
                      <input id="name" name="name" required defaultValue={vendor.name} />
                    </div>

                    <div className="field full">
                      <span className="field-label">Business type</span>
                      <div className="choice-grid">
                        {BUSINESS_TYPES.map((type) => (
                          <label key={type.key} className="card choice-card choice-card-description">
                            <span className="choice-card-main">
                              <input
                                type="radio"
                                name="business_type"
                                value={type.key}
                                defaultChecked={businessType === type.key}
                              />
                              <strong>{type.title}</strong>
                            </span>
                            <span className="small muted">{type.body}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="category_id">Business category</label>
                      <select id="category_id" name="category_id" defaultValue={vendor.category_id ?? ''}>
                        <option value="">Choose a category</option>
                        {(categories ?? []).map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="phone">Business contact number</label>
                      <input id="phone" name="phone" type="tel" defaultValue={vendor.phone ?? ''} />
                    </div>

                    <div className="field">
                      <label htmlFor="email">Business email</label>
                      <input id="email" name="email" type="email" defaultValue={vendor.email ?? ctx.user.email ?? ''} />
                    </div>

                    <div className="field">
                      <label htmlFor="city">City</label>
                      <input id="city" name="city" defaultValue={vendor.city ?? 'Doha'} />
                    </div>

                    <div className="field">
                      <label htmlFor="area">Area</label>
                      <input id="area" name="area" defaultValue={vendor.area ?? ''} placeholder="West Bay" />
                    </div>

                    <div className="field full">
                      <label htmlFor="description">Business description</label>
                      <textarea
                        id="description"
                        name="description"
                        defaultValue={vendor.description ?? ''}
                        placeholder="Tell customers what you do in a sentence or two."
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor="country">Country</label>
                      <input id="country" value="Qatar" readOnly disabled />
                      <span className="hint">Tazilla currently operates in Qatar.</span>
                    </div>
                  </div>

                  <div className="btn-row">
                    <button className="btn primary" type="submit">
                      Save and continue <ArrowRight size={16} />
                    </button>
                    <span className="small muted">Everything is saved before moving on.</span>
                  </div>
                </form>
              </div>
            </section>
          ) : null}

          {current === 'profile' ? (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h3>Logo and cover image</h3>
                  <span className="tag neutral">Step 2 of 3</span>
                </div>
                <div className="panel-body">
                  <p className="small muted" style={{ marginBottom: 16 }}>
                    These appear on your storefront, on gift cards and in the app.
                  </p>
                  <div className="dash-grid">
                    <VendorImageUpload kind="logo" currentUrl={vendor.logo_url ?? null} locale={locale} />
                    <VendorImageUpload kind="banner" currentUrl={vendor.banner_url ?? null} locale={locale} />
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h3>Business profile</h3>
                </div>
                <div className="panel-body">
                  <form action={saveVendorOnboardingStep} className="form" style={{ display: 'grid', gap: 16 }}>
                    <input type="hidden" name="step" value="profile" />
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="name_profile">Business name</label>
                        <input id="name_profile" name="name" defaultValue={vendor.name} />
                      </div>
                      <div className="field">
                        <label htmlFor="name_ar">Arabic name</label>
                        <input id="name_ar" name="name_ar" dir="rtl" defaultValue={vendor.name_ar ?? ''} />
                      </div>
                      <div className="field">
                        <label htmlFor="website">Website</label>
                        <input id="website" name="website" defaultValue={vendor.website ?? ''} placeholder="https://" />
                      </div>
                      <div className="field">
                        <label htmlFor="social_handle">Instagram or social handle</label>
                        <input
                          id="social_handle"
                          name="social_handle"
                          defaultValue={vendor.social_handle ?? ''}
                          placeholder="@yourbusiness"
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor="description_profile">Description</label>
                        <textarea id="description_profile" name="description" defaultValue={vendor.description ?? ''} />
                      </div>
                    </div>

                    <div>
                      <h4 style={{ marginBottom: 8 }}>Business location</h4>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor="city_profile">City</label>
                          <input id="city_profile" name="city" defaultValue={vendor.city ?? ''} />
                        </div>
                        <div className="field">
                          <label htmlFor="area_profile">Area</label>
                          <input id="area_profile" name="area" defaultValue={vendor.area ?? ''} />
                        </div>
                        <div className="field full">
                          <label htmlFor="address">Address</label>
                          <input id="address" name="address" defaultValue={vendor.address ?? ''} />
                        </div>
                      </div>
                      <p className="small muted" style={{ marginTop: 8 }}>
                        Add more branches later from{' '}
                        <Link href="/vendor/settings#locations" style={{ textDecoration: 'underline' }}>
                          Business settings
                        </Link>
                        .
                      </p>
                    </div>

                    <div className="btn-row">
                      <Link className="btn ghost" href="/vendor/onboarding?step=business">
                        <ArrowLeft size={15} /> Back
                      </Link>
                      <button className="btn primary" type="submit">
                        Save and continue <ArrowRight size={16} />
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </>
          ) : null}

          {current === 'preferences' ? (
            <section className="panel">
              <div className="panel-head">
                <h3>What would you like to sell?</h3>
                <span className="tag neutral">Step 3 of 3</span>
              </div>
              <div className="panel-body">
                <form action={saveVendorOnboardingStep} className="form" style={{ display: 'grid', gap: 16 }}>
                  <input type="hidden" name="step" value="preferences" />
                  <p className="small muted" style={{ margin: 0 }}>
                    Choose everything that applies. We use this to set up your dashboard and suggest the right
                    gift types.
                  </p>
                  <div className="choice-grid">
                    {INTENTS.map((intent) => (
                      <label key={intent.key} className="card choice-card choice-card-description">
                        <span className="choice-card-main">
                          <input
                            type="checkbox"
                            name="intents"
                            value={intent.key}
                            defaultChecked={intents.includes(intent.key)}
                          />
                          <strong>{intent.title}</strong>
                        </span>
                        <span className="small muted">{intent.body}</span>
                      </label>
                    ))}
                  </div>

                  <div className="btn-row">
                    <Link className="btn ghost" href="/vendor/onboarding?step=profile">
                      <ArrowLeft size={15} /> Back
                    </Link>
                    <button className="btn primary" type="submit">
                      Finish setup <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
