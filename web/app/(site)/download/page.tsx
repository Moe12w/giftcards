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
import { site } from '@/lib/i18n/site';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { formatMoney } from '@/lib/money';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(site, locale).nav.getTheApp };
}

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(site, locale).download;

  return (
    <>
      <section className="page-hero split">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow mint">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p className="lede">{t.lede}</p>
            <div className="store-row">
              <span className="store-badge" aria-disabled="true">
                <Apple size={22} />
                <span>
                  <small>{t.comingSoonOnThe}</small>
                  <strong>App Store</strong>
                </span>
              </span>
              <span className="store-badge" aria-disabled="true">
                <Smartphone size={22} />
                <span>
                  <small>{t.comingSoonOn}</small>
                  <strong>Google Play</strong>
                </span>
              </span>
            </div>
            <p className="small muted">{t.testingNote}</p>
          </div>
          <div className="phone-art" aria-hidden="true">
            <div className="phone">
              <div className="phone-notch" />
              <div className="phone-screen">
                <span className="small muted">{t.myGifts}</span>
                <div className="mini-card mint">
                  <span>The Coffee House</span>
                  <strong>{formatMoney(9000, locale)}</strong>
                  <small>{t.balanceRemaining}</small>
                </div>
                <div className="mini-card lavender">
                  <span>Dune Spa</span>
                  <strong>{t.sessionsUsed}</strong>
                  <small>{t.bookNextVisit}</small>
                </div>
                <div className="mini-row">
                  <span className="tag success">{t.readyToUse}</span>
                  <QrCode size={28} />
                </div>
              </div>
            </div>
            <span className="float-chip one">
              <Send size={14} /> {t.sentInSeconds}
            </span>
            <span className="float-chip two">
              <Wallet size={14} /> {t.walletReady}
            </span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow lavender">{t.eyebrowInside}</span>
            <h2>{t.titleInside}</h2>
          </div>
        </div>
        <div className="grid-3">
          <article className="card">
            <span className="icon-tile">
              <Gift size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardGiftsTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardGiftsBody}
            </p>
          </article>
          <article className="card">
            <span className="icon-tile lavender">
              <QrCode size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardScanTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardScanBody}
            </p>
          </article>
          <article className="card">
            <span className="icon-tile coral">
              <Wallet size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardWalletTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardWalletBody}
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
          <article className="card">
            <span className="icon-tile sky">
              <Languages size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardLanguagesTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardLanguagesBody}
            </p>
          </article>
          <article className="card">
            <span className="icon-tile">
              <Bell size={22} />
            </span>
            <h3 style={{ marginTop: 14 }}>{t.cardRemindersTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.cardRemindersBody}
            </p>
          </article>
        </div>
      </section>

      <section className="container section">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div>
            <span className="eyebrow gold">{t.eyebrowBeFirst}</span>
            <h2 style={{ marginTop: 14 }}>{t.titleBeFirst}</h2>
            <p style={{ marginTop: 12 }}>{t.bodyBeFirst}</p>
            <Notice error={params.error} success={params.sent === '1' ? t.beFirstSuccess : null} />
            <form action={joinLaunchList} className="launch-form">
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                aria-label={t.emailAddress}
              />
              <button className="btn primary" type="submit">
                {t.notifyMe} <ArrowRight size={16} />
              </button>
            </form>
            <p className="small muted">
              {t.browseFirstBefore} <Link href="/vendors">{t.seeVendors}</Link>.
            </p>
          </div>
          <div className="card lavender">
            <h3>{t.alreadyGiftTitle}</h3>
            <p className="small" style={{ marginTop: 8 }}>
              {t.alreadyGiftBody}
            </p>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <Link className="btn primary sm" href="/faq">
                {t.howClaimingWorks}
              </Link>
              <Link className="btn sm" href="/contact">
                {t.getHelp}
              </Link>
            </div>
            <hr className="divider" style={{ margin: '20px 0' }} />
            <p className="small muted">{t.walletNote}</p>
          </div>
        </div>
      </section>
    </>
  );
}
