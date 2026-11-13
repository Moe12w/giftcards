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
import { site } from '@/lib/i18n/site';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(site, locale).home.corporateGifting };
}

export default async function EnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(site, locale).corporate;
  const c = pick(common, locale);

  return (
    <>
      <section className="page-hero split">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow coral">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p className="lede">{t.lede}</p>
            <div className="btn-row">
              <Link className="btn primary lg" href="/business/register">
                {t.talkToTeam} <ArrowRight size={18} />
              </Link>
              <Link className="btn ghost lg" href="/business/login">
                {t.partnerSignIn}
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={16} /> {t.trustInvoice}
              </span>
              <span>
                <FileSpreadsheet size={16} /> {t.trustReporting}
              </span>
              <span>
                <HeartHandshake size={16} /> {t.trustLocal}
              </span>
            </div>
          </div>
          <div className="enterprise-art" aria-hidden="true">
            <div className="card mint enterprise-tile one">
              <Users size={22} />
              <strong>{t.tileMembers}</strong>
              <span className="small">{t.tileMembersBody}</span>
            </div>
            <div className="card lavender enterprise-tile two">
              <Gift size={22} />
              <strong>{t.tileEach}</strong>
              <span className="small">{t.tileEachBody}</span>
            </div>
            <div className="card coral enterprise-tile three">
              <BadgeCheck size={22} />
              <strong>{t.tileRedeemed}</strong>
              <span className="small">{t.tileRedeemedBody}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">{t.eyebrowWhy}</span>
            <h2>{t.titleWhy}</h2>
          </div>
        </div>
        <div className="grid-2">
          <article className="card">
            <span className="icon-tile">
              <Building2 size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardLocalTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardLocalBody}
            </p>
          </article>
          <article className="card">
            <span className="icon-tile lavender">
              <FileSpreadsheet size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardNumbersTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardNumbersBody}
            </p>
          </article>
          <article className="card">
            <span className="icon-tile coral">
              <ShieldCheck size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardSafeTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardSafeBody}
            </p>
          </article>
          <article className="card">
            <span className="icon-tile gold">
              <Send size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardSendTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardSendBody}
            </p>
          </article>
        </div>
      </section>

      <section className="container section">
        <div className="grid-2">
          <div>
            <span className="eyebrow lavender">{t.eyebrowHow}</span>
            <h2 style={{ marginTop: 14 }}>{t.titleHow}</h2>
            <p style={{ marginTop: 12 }}>{t.bodyHow}</p>
            <ul className="check-list">
              <li>
                <Check size={16} /> {t.check1}
              </li>
              <li>
                <Check size={16} /> {t.check2}
              </li>
              <li>
                <Check size={16} /> {t.check3}
              </li>
              <li>
                <Check size={16} /> {t.check4}
              </li>
            </ul>
          </div>
          <div className="timeline-card">
            {t.timeline.map((step, index) => (
              <div className="timeline-item" key={step.title}>
                <span className="timeline-dot" />
                <div>
                  <strong>
                    {index + 1}. {step.title}
                  </strong>
                  <span>{step.body}</span>
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
              <span className="eyebrow gold">{t.eyebrowUseCases}</span>
              <h2 style={{ color: '#fff', marginTop: 14 }}>{t.titleUseCases}</h2>
              <p style={{ marginTop: 12 }}>{t.bodyUseCases}</p>
            </div>
            <div className="pill-row">
              {t.useCases.map((item) => (
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
            <span className="eyebrow coral">{t.eyebrowLetsTalk}</span>
            <h2 style={{ marginTop: 14 }}>{t.titleLetsTalk}</h2>
            <p style={{ marginTop: 12 }}>{t.bodyLetsTalk}</p>
            <div className="split-list" style={{ marginTop: 20 }}>
              <div>
                <span className="k">{c.labels.email}</span>
                <span className="v">corporate@giftly.qa</span>
              </div>
              <div>
                <span className="k">{c.labels.phone}</span>
                <span className="v">+974 4000 0000</span>
              </div>
              <div>
                <span className="k">{t.officeTitle}</span>
                <span className="v">{t.dohaQatar}</span>
              </div>
            </div>
            <div className="callout info" style={{ marginTop: 20 }}>
              {t.alreadyPartnerBefore}{' '}
              <Link href="/business/login">{t.signInDashboard}</Link> {t.alreadyPartnerAfter}
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Supplier/partner portal? <Link href="/enterprise/login">Enterprise partner sign in</Link>
            </p>
          </div>
          <div className="card">
            <h3>{t.enquiryTitle}</h3>
            <Notice error={params.error} success={params.sent === '1' ? t.enquirySuccess : null} />
            <form action={submitEnterpriseEnquiry} className="form" style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="company">{c.labels.company}</label>
                  <input id="company" name="company" required placeholder={t.placeholderCompanyName} />
                </div>
                <div className="field">
                  <label htmlFor="name">{t.labelYourName}</label>
                  <input id="name" name="name" required placeholder={t.placeholderFullName} />
                </div>
                <div className="field">
                  <label htmlFor="email">{t.labelWorkEmail}</label>
                  <input id="email" name="email" type="email" required placeholder="you@company.com" />
                </div>
                <div className="field">
                  <label htmlFor="phone">{c.labels.phone}</label>
                  <input id="phone" name="phone" placeholder="+974 …" />
                </div>
                <div className="field">
                  <label htmlFor="team_size">{t.labelTeamSize}</label>
                  <select id="team_size" name="team_size" defaultValue="">
                    <option value="">{t.optionSelect}</option>
                    <option>1–20</option>
                    <option>21–100</option>
                    <option>101–500</option>
                    <option>500+</option>
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="message">{t.labelPlanning}</label>
                  <textarea id="message" name="message" placeholder={t.placeholderPlanning} />
                </div>
              </div>
              <button className="btn primary block" type="submit">
                {t.sendEnquiry} <Send size={16} />
              </button>
              <p className="small muted">
                {t.formConsentBefore} <Link href="/privacy">{t.privacyPolicy}</Link>.
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <span className="eyebrow gold">
            <Sparkles size={14} /> {t.eyebrowCta}
          </span>
          <h2>{t.titleCta}</h2>
          <p>{t.bodyCta}</p>
          <div className="btn-row">
            <Link className="btn primary" href="/business/register">
              {t.requestDemo} <ArrowRight size={16} />
            </Link>
            <Link className="btn ghost" href="/business/login" style={{ color: '#fff', borderColor: '#fff' }}>
              {t.partnerSignIn}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
