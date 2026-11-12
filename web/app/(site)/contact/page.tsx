import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { submitContact } from '@/lib/actions/public';
import { Notice } from '@/components/ui';
import { site } from '@/lib/i18n/site';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(site, locale).nav.contact };
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const copy = pick(site, locale);
  const t = copy.contact;
  const c = pick(common, locale);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow coral">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lede">{t.lede}</p>
        </div>
      </section>

      <section className="container section tight">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3>{t.formTitle}</h3>
            <Notice error={params.error} success={params.sent === '1' ? t.formSuccess : null} />
            <form action={submitContact} className="form" style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">{t.labelYourName}</label>
                  <input id="name" name="name" required placeholder={t.placeholderFullName} />
                </div>
                <div className="field">
                  <label htmlFor="email">{c.labels.email}</label>
                  <input id="email" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <div className="field full">
                  <label htmlFor="subject">{t.labelSubject}</label>
                  <select id="subject" name="subject" defaultValue="Gift support">
                    <option value="Gift support">{t.subjectGiftSupport}</option>
                    <option value="Vendor question">{t.subjectVendorQuestion}</option>
                    <option value="Corporate gifting">{t.subjectCorporateGifting}</option>
                    <option value="Press or partnership">{t.subjectPress}</option>
                    <option value="Something else">{t.subjectOther}</option>
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="message">{t.labelMessage}</label>
                  <textarea id="message" name="message" required placeholder={t.placeholderHowCanWeHelp} />
                </div>
              </div>
              <button className="btn primary block" type="submit">
                {t.sendMessage} <Send size={16} />
              </button>
              <p className="small muted">
                {t.replyNoteBefore} <Link href="/privacy">{t.privacyPolicy}</Link>{' '}
                {t.replyNoteAfter}
              </p>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div className="card mint">
              <span className="icon-tile ink">
                <Mail size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{c.labels.email}</h3>
              <p className="small" style={{ marginTop: 6 }}>
                hello@giftly.qa
                <br />
                corporate@giftly.qa
              </p>
            </div>
            <div className="card lavender">
              <span className="icon-tile">
                <Phone size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{c.labels.phone}</h3>
              <p className="small" style={{ marginTop: 6 }}>
                +974 4000 0000
                <br />
                {t.phoneHours}
              </p>
            </div>
            <div className="card">
              <span className="icon-tile coral">
                <MapPin size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{t.officeTitle}</h3>
              <p className="small" style={{ marginTop: 6 }}>
                {t.dohaQatar}
                <br />
                {t.visitsByAppointment}
              </p>
            </div>
            <div className="card gold">
              <span className="icon-tile ink">
                <Clock size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{t.forVendorsTitle}</h3>
              <p className="small" style={{ marginTop: 6 }}>
                {t.forVendorsBody}
              </p>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <Link className="btn sm" href="/vendor/login">
                  {copy.nav.vendorSignIn}
                </Link>
                <Link className="btn sm ghost" href="/faq">
                  {t.vendorFaq}
                </Link>
              </div>
            </div>
            <div className="callout info">
              <MessageCircle size={16} style={{ display: 'inline', verticalAlign: '-3px' }} />{' '}
              {t.corporateQuoteBefore}{' '}
              <Link href="/corporate#enquiry" style={{ fontWeight: 800 }}>
                {t.enterpriseEnquiryForm}
              </Link>{' '}
              {t.corporateQuoteAfter}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
