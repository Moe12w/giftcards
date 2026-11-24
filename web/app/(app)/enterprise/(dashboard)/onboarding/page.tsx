import Link from 'next/link';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, CreditCard, LayoutDashboard, Users } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { saveEnterpriseOnboardingStep } from '@/lib/actions/enterprise';
import { Notice, PageHead } from '@/components/ui';
import { WizardRail, type WizardStep } from '@/components/WizardRail';
import { getLocale } from '@/lib/i18n/server';
import { titleCase } from '@/lib/format';

const STEPS: WizardStep[] = [
  { key: 'organisation', label: 'Organisation', href: '/enterprise/onboarding?step=organisation' },
  { key: 'contact', label: 'Main contact', href: '/enterprise/onboarding?step=contact' },
  { key: 'structure', label: 'Structure', href: '/enterprise/onboarding?step=structure' },
  { key: 'done', label: 'Ready' },
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

export default async function EnterpriseOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; welcome?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const partner = ctx.partner;
  const locale = await getLocale();

  const current = STEPS.some((step) => step.key === params.step) ? (params.step as string) : 'organisation';

  const notice =
    params.welcome === '1'
      ? 'Welcome to Tazilla. Your organisation account is ready — finish this short setup whenever you like.'
      : params.saved === '1'
        ? 'Saved. You can leave at any time and continue from your dashboard.'
        : null;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Set up your organisation"
        title={current === 'done' ? 'Your organisation is ready!' : 'Let’s set up your organisation'}
        description={
          current === 'done'
            ? 'Welcome aboard. Your dashboard is ready. Invite branches and team members, then apply for online payments when you are ready.'
            : 'Three short steps. Your dashboard stays available the whole time, and payment verification comes later.'
        }
        actions={
          current === 'done' ? (
            <Link className="btn primary" href="/enterprise">
              <LayoutDashboard size={15} /> Go to Dashboard
            </Link>
          ) : (
            <Link className="btn sm ghost" href="/enterprise">
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
              <p style={{ margin: 0 }}>Your organisation record is created. Here is what you can do next:</p>
              <div className="split-list">
                <div>
                  <span className="k">Add your team</span>
                  <span className="v small">
                    <Link href="/enterprise/settings" style={{ textDecoration: 'underline' }}>
                      Company settings
                    </Link>
                  </span>
                </div>
                <div>
                  <span className="k">Apply for online payments</span>
                  <span className="v small">
                    <Link href="/enterprise/payments" style={{ textDecoration: 'underline' }}>
                      Open Online Payments
                    </Link>
                  </span>
                </div>
                <div>
                  <span className="k">Define your reward</span>
                  <span className="v small">
                    <Link href="/enterprise/products/new" style={{ textDecoration: 'underline' }}>
                      Create a product
                    </Link>
                  </span>
                </div>
              </div>
              <div className="btn-row">
                <Link className="btn primary" href="/enterprise">
                  <LayoutDashboard size={15} /> Go to Dashboard
                </Link>
                <Link className="btn ghost" href="/enterprise/payments">
                  <CreditCard size={15} /> Online Payments
                </Link>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Organisation summary</h3>
              <Building2 size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">Organisation</span>
                  <span className="v">{partner.name}</span>
                </div>
                <div>
                  <span className="k">Legal name</span>
                  <span className="v">{partner.legal_name ?? 'Not set'}</span>
                </div>
                <div>
                  <span className="k">Industry</span>
                  <span className="v">{partner.industry ?? 'Not set'}</span>
                </div>
                <div>
                  <span className="k">Branches</span>
                  <span className="v">{partner.branches_count ?? 'Not set'}</span>
                </div>
                <div>
                  <span className="k">Country</span>
                  <span className="v">{partner.country ?? 'Qatar'}</span>
                </div>
                <div>
                  <span className="k">Status</span>
                  <span className="v">{titleCase(partner.status, locale)}</span>
                </div>
              </div>
              <div className="callout info" style={{ marginTop: 14 }}>
                <Users size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> The primary administrator
                submits the payment documentation once for the whole organisation. Branches do not repeat it.
              </div>
            </div>
          </section>
        </div>
      ) : (
        <>
          <WizardRail steps={STEPS} current={current} tone="lavender" />

          {current === 'organisation' ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Organisation details</h3>
                <span className="tag neutral">Step 1 of 3</span>
              </div>
              <div className="panel-body">
                <form action={saveEnterpriseOnboardingStep} className="form" style={{ display: 'grid', gap: 16 }}>
                  <input type="hidden" name="step" value="organisation" />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="name">Organisation name</label>
                      <input id="name" name="name" required defaultValue={partner.name} />
                    </div>
                    <div className="field">
                      <label htmlFor="legal_name">Legal business name</label>
                      <input id="legal_name" name="legal_name" defaultValue={partner.legal_name ?? ''} />
                    </div>
                    <div className="field">
                      <label htmlFor="website">Company website</label>
                      <input id="website" name="website" defaultValue={partner.website ?? ''} placeholder="https://" />
                    </div>
                    <div className="field">
                      <label htmlFor="industry">Industry</label>
                      <input
                        id="industry"
                        name="industry"
                        defaultValue={partner.industry ?? ''}
                        placeholder="Retail, hospitality, finance…"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="country">Country of registration</label>
                      <input id="country" name="country" defaultValue={partner.country ?? 'Qatar'} />
                    </div>
                  </div>
                  <div className="btn-row">
                    <button className="btn lavender" type="submit">
                      Save and continue <ArrowRight size={16} />
                    </button>
                    <span className="small muted">Everything is saved before moving on.</span>
                  </div>
                </form>
              </div>
            </section>
          ) : null}

          {current === 'contact' ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Main contact person</h3>
                <span className="tag neutral">Step 2 of 3</span>
              </div>
              <div className="panel-body">
                <form action={saveEnterpriseOnboardingStep} className="form" style={{ display: 'grid', gap: 16 }}>
                  <input type="hidden" name="step" value="contact" />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="contact_name">Contact name</label>
                      <input id="contact_name" name="contact_name" defaultValue={partner.contact_name ?? ''} />
                    </div>
                    <div className="field">
                      <label htmlFor="contact_role">Contact role</label>
                      <input
                        id="contact_role"
                        name="contact_role"
                        defaultValue={partner.contact_role ?? ''}
                        placeholder="Finance director, operations lead…"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="contact_email">Company email</label>
                      <input
                        id="contact_email"
                        name="contact_email"
                        type="email"
                        defaultValue={partner.contact_email ?? ctx.user.email ?? ''}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="contact_phone">Mobile number</label>
                      <input
                        id="contact_phone"
                        name="contact_phone"
                        type="tel"
                        defaultValue={partner.contact_phone ?? ''}
                        placeholder="+974 5555 5555"
                      />
                    </div>
                  </div>
                  <div className="btn-row">
                    <Link className="btn ghost" href="/enterprise/onboarding?step=organisation">
                      <ArrowLeft size={15} /> Back
                    </Link>
                    <button className="btn lavender" type="submit">
                      Save and continue <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </div>
            </section>
          ) : null}

          {current === 'structure' ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Company structure</h3>
                <span className="tag neutral">Step 3 of 3</span>
              </div>
              <div className="panel-body">
                <form action={saveEnterpriseOnboardingStep} className="form" style={{ display: 'grid', gap: 16 }}>
                  <input type="hidden" name="step" value="structure" />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="company_size">Company size</label>
                      <select id="company_size" name="company_size" defaultValue={partner.company_size ?? ''}>
                        <option value="">Optional</option>
                        {COMPANY_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size} employees
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="branches_count">Number of branches</label>
                      <input
                        id="branches_count"
                        name="branches_count"
                        type="number"
                        min={0}
                        defaultValue={partner.branches_count ?? ''}
                      />
                    </div>
                    <div className="field full">
                      <label htmlFor="notes">Anything we should know?</label>
                      <textarea
                        id="notes"
                        name="notes"
                        defaultValue={partner.notes ?? ''}
                        placeholder="Branches, systems, timelines — optional."
                      />
                    </div>
                  </div>
                  <div className="btn-row">
                    <Link className="btn ghost" href="/enterprise/onboarding?step=contact">
                      <ArrowLeft size={15} /> Back
                    </Link>
                    <button className="btn lavender" type="submit">
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
