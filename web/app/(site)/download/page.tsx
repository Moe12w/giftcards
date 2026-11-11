import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Apple,
  ArrowRight,
  Bell,
  Gift,
  Languages,
  QrCode,
  Send,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { joinLaunchList } from '@/lib/actions/public';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Get the app' };

export default async function DownloadPage({
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
            <span className="eyebrow mint">The Giftly app</span>
            <h1>Every gift, in one pocket.</h1>
            <p className="lede">
              Buy, send and keep gift cards and experiences from Qatar&apos;s best independent
              businesses. Balances update as you spend, and every card has a QR code ready for the
              counter.
            </p>
            <div className="store-row">
              <span className="store-badge" aria-disabled="true">
                <Apple size={22} />
                <span>
                  <small>Coming soon on the</small>
                  <strong>App Store</strong>
                </span>
              </span>
              <span className="store-badge" aria-disabled="true">
                <Smartphone size={22} />
                <span>
                  <small>Coming soon on</small>
                  <strong>Google Play</strong>
                </span>
              </span>
            </div>
            <p className="small muted">
              The app is in final testing. Join the launch list and we will send one email when it
              is ready.
            </p>
          </div>
          <div className="phone-art" aria-hidden="true">
            <div className="phone">
              <div className="phone-notch" />
              <div className="phone-screen">
                <span className="small muted">My gifts</span>
                <div className="mini-card mint">
                  <span>The Coffee House</span>
                  <strong>QAR 90.00</strong>
                  <small>Balance remaining</small>
                </div>
                <div className="mini-card lavender">
                  <span>Dune Spa</span>
                  <strong>2 of 3 sessions</strong>
                  <small>Book your next visit</small>
                </div>
                <div className="mini-row">
                  <span className="tag success">Ready to use</span>
                  <QrCode size={28} />
                </div>
              </div>
            </div>
            <span className="float-chip one">
              <Send size={14} /> Sent in seconds
            </span>
            <span className="float-chip two">
              <Wallet size={14} /> Wallet ready
            </span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow lavender">Inside the app</span>
            <h2>Small app, thoughtful details.</h2>
          </div>
        </div>
        <div className="grid-3">
          <article className="card">
            <span className="icon-tile">
              <Gift size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Gift cards and experiences</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Send a flexible amount or a vendor-made package. Both live in the same place, with
              clear balances and expiry dates.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile lavender">
              <QrCode size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>One scan to redeem</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Show the QR code at the counter. Vendors enter the amount or sessions used and the
              balance updates immediately.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile coral">
              <Wallet size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Apple and Google Wallet</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Add a claimed gift to your phone&apos;s wallet so it is always with you, even when
              the app is closed.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile gold">
              <Send size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Send it your way</h3>
            <p className="small" style={{ marginTop: 8 }}>
              Email, SMS, a link or WhatsApp. Schedule it for a birthday morning and add a note in
              your own words.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile sky">
              <Languages size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>English and Arabic</h3>
            <p className="small" style={{ marginTop: 8 }}>
              The whole experience works in both languages, with a proper right-to-left layout when
              Arabic is selected.
            </p>
          </article>
          <article className="card">
            <span className="icon-tile">
              <Bell size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>Gentle reminders</h3>
            <p className="small" style={{ marginTop: 8 }}>
              A nudge before a gift expires, and a note when someone claims what you sent. No noise.
            </p>
          </article>
        </div>
      </section>

      <section className="container section">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div>
            <span className="eyebrow gold">Be first</span>
            <h2 style={{ marginTop: 14 }}>Join the launch list.</h2>
            <p style={{ marginTop: 12 }}>
              One email when the app goes live on iPhone and Android. No newsletter, no offers, no
              sharing your address.
            </p>
            <Notice
              error={params.error}
              success={params.sent === '1' ? 'You are on the list. We will be in touch.' : null}
            />
            <form action={joinLaunchList} className="launch-form">
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                aria-label="Email address"
              />
              <button className="btn primary" type="submit">
                Notify me <ArrowRight size={16} />
              </button>
            </form>
            <p className="small muted">
              Prefer to browse first? <Link href="/vendors">See the vendors already on Giftly</Link>.
            </p>
          </div>
          <div className="card lavender">
            <h3>Already have a gift?</h3>
            <p className="small" style={{ marginTop: 8 }}>
              If someone sent you a Giftly link, open it on this phone. You can claim the gift in
              the browser now; the app will pick it up when you install it.
            </p>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <Link className="btn primary sm" href="/faq">
                How claiming works
              </Link>
              <Link className="btn sm" href="/contact">
                Get help
              </Link>
            </div>
            <hr className="divider" style={{ margin: '20px 0' }} />
            <p className="small muted">
              Wallet buttons are visible in the app today. The live Apple and Google Wallet passes
              will be switched on with the public launch.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
