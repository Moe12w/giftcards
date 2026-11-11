import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  FileSpreadsheet,
  Gift,
  HeartHandshake,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { submitEnterpriseEnquiry } from '@/lib/actions/public';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Corporate gifting' };

export default async function EnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <section className="page-hero split">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow coral">Giftly for business</span>
            <h1>Reward the people who make the work happen.</h1>
            <p className="lede">
              Curated gift codes from Qatar&apos;s best independent businesses, bought in bulk and
              tracked in one place. For teams, clients and the moments that deserve more than a
              generic hamper.
            </p>
            <div className="btn-row">
              <a className="btn primary lg" href="#enquiry">
                Talk to our team <ArrowRight size={18} />
              </a>
              <Link className="btn ghost lg" href="/enterprise/login">
                Partner sign in
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={16} /> One invoice
              </span>
              <span>
                <FileSpreadsheet size={16} /> Redemption reporting
              </span>
              <span>
                <HeartHandshake size={16} /> Local businesses
              </span>
            </div>
          </div>
          <div className="enterprise-art" aria-hidden="true">
            <div className="card mint enterprise-tile one">
              <Users size={22} />
              <strong>120 team members</strong>
              <span className="small">One reward, sent in minutes</span>
            </div>
            <div className="card lavender enterprise-tile two">
              <Gift size={22} />
              <strong>QAR 250 each</strong>
              <span className="small">Spend across any partner</span>
            </div>
            <div className="card coral enterprise-tile three">
              <BadgeCheck size={22} />
              <strong>78% redeemed</strong>
              <span className="small">Live in your dashboard</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">Why Giftly</span>
            <h2>Gifting that finance and people teams both like.</h2>
          </div>
        </div>
        <div className="grid-3">
          <article className="card">
            <span className="icon-tile">
              <Building2 size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Local, not generic</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Coffee, spa days, dinners and adventures from independent Qatari businesses. The kind
              of reward people actually talk about.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile lavender">
              <FileSpreadsheet size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Numbers that add up</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Import codes, allocate them to orders and see exactly what has been delivered and
              redeemed. Export the detail whenever you need it.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile coral">
              <ShieldCheck size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Safe by default</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Codes are stored encrypted, revealed only when allocated, and every status change is
              recorded. No spreadsheets full of plain-text codes.
            </p>
          </article>
        </div>
      </section>

      <section className="container section">
        <div className="grid-2">
          <div>
            <span className="eyebrow lavender">How it works</span>
            <h2 style={{ marginTop: 14 }}>From brief to delivered in four steps.</h2>
            <p style={{ marginTop: 12 }}>
              Tell us the occasion, the headcount and the budget. We handle the catalogue and the
              codes; you keep control of who gets what.
            </p>
            <ul className="check-list">
              <li>
                <Check size={16} /> Choose from live vendor offers or build a custom package
              </li>
              <li>
                <Check size={16} /> Buy codes in bulk at an agreed corporate rate
              </li>
              <li>
                <Check size={16} /> Import and allocate codes from your dashboard
              </li>
              <li>
                <Check size={16} /> Track delivery, redemption and remaining liability
              </li>
            </ul>
          </div>
          <div className="timeline-card">
            {[
              ['Brief', 'Occasion, headcount, budget and any branding.'],
              ['Catalogue', 'We shortlist vendors and agree the reward value.'],
              ['Codes', 'Your inventory is imported and ready to allocate.'],
              ['Report', 'Monthly redemption and liability reporting.'],
            ].map(([title, body], index) => (
              <div className="timeline-item" key={title}>
                <span className="timeline-dot" />
                <div>
                  <strong>
                    {index + 1}. {title}
                  </strong>
                  <span>{body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="card ink">
          <div className="grid-2" style={{ alignItems: 'center' }}>
            <div>
              <span className="eyebrow gold">Use cases</span>
              <h2 style={{ color: '#fff', marginTop: 14 }}>For the moments that matter.</h2>
              <p style={{ marginTop: 12 }}>
                Onboarding kits, Ramadan and National Day gifts, sales incentives, client
                thank-yous, wellness weeks and long-service awards.
              </p>
            </div>
            <div className="pill-row">
              {[
                'Employee rewards',
                'Client gifting',
                'Onboarding',
                'Sales incentives',
                'Wellness',
                'Ramadan',
                'National Day',
                'Long service',
              ].map((item) => (
                <span className="tag" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container section" id="enquiry">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div>
            <span className="eyebrow coral">Let&apos;s talk</span>
            <h2 style={{ marginTop: 14 }}>Tell us about your team.</h2>
            <p style={{ marginTop: 12 }}>
              Send a few details and our corporate team will come back with a catalogue and a
              quote. No commitment, no automated sales sequence.
            </p>
            <div className="split-list" style={{ marginTop: 20 }}>
              <div>
                <span className="k">Email</span>
                <span className="v">corporate@giftly.qa</span>
              </div>
              <div>
                <span className="k">Phone</span>
                <span className="v">+974 4000 0000</span>
              </div>
              <div>
                <span className="k">Office</span>
                <span className="v">Doha, Qatar</span>
              </div>
            </div>
            <div className="callout info" style={{ marginTop: 20 }}>
              Already a partner? <Link href="/enterprise/login">Sign in to your dashboard</Link> to
              manage products, inventory and reports.
            </div>
          </div>
          <div className="card">
            <h3>Corporate enquiry</h3>
            <Notice
              error={params.error}
              success={params.sent === '1' ? 'Thank you — your enquiry is with our team.' : null}
            />
            <form action={submitEnterpriseEnquiry} className="form" style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="company">Company</label>
                  <input id="company" name="company" required placeholder="Company name" />
                </div>
                <div className="field">
                  <label htmlFor="name">Your name</label>
                  <input id="name" name="name" required placeholder="Full name" />
                </div>
                <div className="field">
                  <label htmlFor="email">Work email</label>
                  <input id="email" name="email" type="email" required placeholder="you@company.com" />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" placeholder="+974 …" />
                </div>
                <div className="field">
                  <label htmlFor="team_size">Team size</label>
                  <select id="team_size" name="team_size" defaultValue="">
                    <option value="">Select</option>
                    <option>1–20</option>
                    <option>21–100</option>
                    <option>101–500</option>
                    <option>500+</option>
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="message">What are you planning?</label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Occasion, budget per person, timeline…"
                  />
                </div>
              </div>
              <button className="btn primary block" type="submit">
                Send enquiry <Send size={16} />
              </button>
              <p className="small muted">
                By sending this form you agree to our <Link href="/privacy">privacy policy</Link>.
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <span className="eyebrow gold">
            <Sparkles size={14} /> Corporate gifting, minus the admin
          </span>
          <h2>One dashboard for every code, team and report.</h2>
          <p>
            Our enterprise partners manage their own catalogue, inventory and redemptions. You can
            too.
          </p>
          <div className="btn-row">
            <a className="btn primary" href="#enquiry">
              Request a demo <ArrowRight size={16} />
            </a>
            <Link className="btn ghost" href="/enterprise/login" style={{ color: '#fff', borderColor: '#fff' }}>
              Partner sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
