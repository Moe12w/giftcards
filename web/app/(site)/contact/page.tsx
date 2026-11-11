import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { submitContact } from '@/lib/actions/public';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Contact' };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow coral">Say hello</span>
          <h1>We are real people, in Doha.</h1>
          <p className="lede">
            Questions about a gift, a balance, a booking or a partnership — send us a note and we
            will help.
          </p>
        </div>
      </section>

      <section className="container section tight">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3>Send us a message</h3>
            <Notice
              error={params.error}
              success={params.sent === '1' ? 'Thank you — your message is with our team.' : null}
            />
            <form action={submitContact} className="form" style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Your name</label>
                  <input id="name" name="name" required placeholder="Full name" />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <div className="field full">
                  <label htmlFor="subject">Subject</label>
                  <select id="subject" name="subject" defaultValue="Gift support">
                    <option>Gift support</option>
                    <option>Vendor question</option>
                    <option>Corporate gifting</option>
                    <option>Press or partnership</option>
                    <option>Something else</option>
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="message">Message</label>
                  <textarea id="message" name="message" required placeholder="How can we help?" />
                </div>
              </div>
              <button className="btn primary block" type="submit">
                Send message <Send size={16} />
              </button>
              <p className="small muted">
                We usually reply within one working day. See our <Link href="/privacy">privacy policy</Link>{' '}
                for how we handle your details.
              </p>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div className="card mint">
              <span className="icon-tile ink">
                <Mail size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>Email</h3>
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
              <h3 style={{ marginTop: 14 }}>Phone</h3>
              <p className="small" style={{ marginTop: 6 }}>
                +974 4000 0000
                <br />
                Sunday to Thursday, 9am–6pm
              </p>
            </div>
            <div className="card">
              <span className="icon-tile coral">
                <MapPin size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>Office</h3>
              <p className="small" style={{ marginTop: 6 }}>
                Doha, Qatar
                <br />
                Visits by appointment.
              </p>
            </div>
            <div className="card gold">
              <span className="icon-tile ink">
                <Clock size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>For vendors</h3>
              <p className="small" style={{ marginTop: 6 }}>
                Already selling on Giftly? Sign in to your dashboard for order and redemption
                support.
              </p>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <Link className="btn sm" href="/vendor/login">
                  Vendor sign in
                </Link>
                <Link className="btn sm ghost" href="/faq">
                  Vendor FAQ
                </Link>
              </div>
            </div>
            <div className="callout info">
              <MessageCircle size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> Looking
              for a corporate quote? Use the{' '}
              <Link href="/corporate#enquiry" style={{ fontWeight: 800 }}>
                enterprise enquiry form
              </Link>{' '}
              so it reaches the right team.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
