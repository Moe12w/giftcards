import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarHeart,
  Check,
  Gift,
  Heart,
  MapPin,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Ticket,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { mapProducts } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import { initials } from '@/lib/format';
import { fulfilmentLabel, priceLabel, productTone } from '@/lib/catalog';

export default async function HomePage() {
  const supabase = await createClient();

  const [vendorCount, productCount, categoryResult, featuredResult, offersResult] =
    await Promise.all([
      supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('is_active', true),
      supabase.from('categories').select('id, name, slug').eq('active', true),
      supabase
        .from('vendors')
        .select('id, name, slug, logo_url, city, area, rating, description, is_featured')
        .eq('status', 'approved')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(6),
      supabase
        .from('products')
        .select('*, vendors(id, name, slug, logo_url, status), product_variants(*)')
        .eq('status', 'published')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6),
    ]);

  const vendors = featuredResult.data ?? [];
  const offers = mapProducts(offersResult.data);
  const categories = categoryResult.data ?? [];
  const vendorTotal = vendorCount.count ?? 0;
  const productTotal = productCount.count ?? 0;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Qatar&apos;s gift card marketplace</span>
            <h1>
              Give a gift they&apos;ll <span className="highlight">actually use</span>.
            </h1>
            <p className="lede">
              The best independent cafés, salons, spas and adventures in Qatar — wrapped into one
              thoughtful gift. Send it in seconds, spend it in parts, keep it in your wallet.
            </p>
            <div className="btn-row">
              <Link className="btn primary lg" href="/download">
                Get the app <ArrowRight size={18} />
              </Link>
              <Link className="btn ghost lg" href="/vendors">
                Browse vendors
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <Wallet size={16} /> Apple &amp; Google Wallet ready
              </span>
              <span>
                <ShieldCheck size={16} /> Spend in parts
              </span>
              <span>
                <Sparkles size={16} /> English &amp; Arabic
              </span>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="gift-stack">
              <div className="gift-card-visual gc-2">
                <div className="gc-top">
                  <span className="gc-brand">
                    <span className="gc-icon">
                      <Heart size={18} />
                    </span>
                    Dune Spa
                  </span>
                  <span className="tag">Experience</span>
                </div>
                <div>
                  <div className="gc-amount">3 sessions</div>
                  <div className="gc-meta">Slow down · valid 12 months</div>
                </div>
              </div>
              <div className="gift-card-visual gc-1">
                <div className="gc-top">
                  <span className="gc-brand">
                    <span className="gc-icon">
                      <Store size={18} />
                    </span>
                    The Coffee House
                  </span>
                  <span className="tag">Gift card</span>
                </div>
                <div>
                  <div className="gc-amount">{formatMoney(10000)}</div>
                  <div className="gc-meta">Treat yourself · no expiry</div>
                </div>
              </div>
              <div className="gift-card-visual gc-3">
                <div className="gc-top">
                  <span className="gc-brand">
                    <span className="gc-icon">
                      <Sparkles size={18} />
                    </span>
                    Sunset Kayak
                  </span>
                </div>
                <div>
                  <div className="gc-amount">One adventure</div>
                  <div className="gc-meta">For two · Doha Corniche</div>
                </div>
              </div>
            </div>
            <span className="float-chip one">
              <Send size={14} /> Sent on WhatsApp
            </span>
            <span className="float-chip two">
              <QrCode size={14} /> Scan at the counter
            </span>
            <span className="float-chip three">
              <Wallet size={14} /> Added to Wallet
            </span>
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="stat-strip">
          <div>
            <strong>{vendorTotal || '—'}</strong>
            <span>Independent vendors</span>
          </div>
          <div>
            <strong>{productTotal || '—'}</strong>
            <span>Gifts ready to send</span>
          </div>
          <div>
            <strong>{categories.length || '—'}</strong>
            <span>Categories to explore</span>
          </div>
          <div>
            <strong>3</strong>
            <span>Ways to give</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">One app, three ways to give</span>
            <h2>Whatever the moment, there is a Giftly for it.</h2>
            <p>
              A coffee on us, a proper spa afternoon, or a thank-you for the whole team. Every
              gift is stored digitally and can be spent in parts.
            </p>
          </div>
          <Link className="btn sm" href="/faq">
            How it works <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid-3">
          <article className="card card-type">
            <span className="ribbon mint" />
            <span className="icon-tile">
              <Gift size={24} />
            </span>
            <h3>Gift cards</h3>
            <p>
              Pick a vendor and an amount. They spend what they need, when they need it — the
              balance stays on the card until it reaches zero.
            </p>
            <div className="pill-row">
              <span className="tag">Any amount</span>
              <span className="tag">No change lost</span>
            </div>
          </article>
          <article className="card card-type">
            <span className="ribbon lavender" />
            <span className="icon-tile lavender">
              <CalendarHeart size={24} />
            </span>
            <h3>Experiences</h3>
            <p>
              Vendor-set packages with real sessions: a massage, a kayak trip, a cooking class.
              One gift, one lovely afternoon.
            </p>
            <div className="pill-row">
              <span className="tag">Packages</span>
              <span className="tag">Book a time</span>
            </div>
          </article>
          <article className="card card-type">
            <span className="ribbon coral" />
            <span className="icon-tile coral">
              <Building2 size={24} />
            </span>
            <h3>Corporate rewards</h3>
            <p>
              Buy codes in bulk, distribute them to your team, and see exactly what has been
              redeemed. Built for HR and finance.
            </p>
            <div className="pill-row">
              <span className="tag">Bulk codes</span>
              <span className="tag">Reports</span>
            </div>
          </article>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow lavender">Local favourites</span>
            <h2>Independent businesses doing lovely things.</h2>
            <p>
              Every vendor is reviewed before they go live. No chains, no filler — just places
              worth leaving the house for.
            </p>
          </div>
          <Link className="btn sm" href="/vendors">
            All vendors <ArrowRight size={16} />
          </Link>
        </div>

        {vendors.length === 0 ? (
          <div className="empty">
            <h3>Vendors are moving in</h3>
            <p>We are onboarding our first Doha partners right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid-3">
            {vendors.slice(0, 6).map((vendor) => (
              <Link
                className="card vendor-card"
                key={vendor.id}
                href={`/vendors/${vendor.slug ?? vendor.id}`}
              >
                <div className="vendor-top">
                  <span className="vendor-logo">
                    {vendor.logo_url ? (
                      <img src={vendor.logo_url} alt="" />
                    ) : (
                      initials(vendor.name)
                    )}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '1.15rem' }}>{vendor.name}</h3>
                    <span className="small muted">
                      {[vendor.area, vendor.city].filter(Boolean).join(' · ') || 'Qatar'}
                    </span>
                  </div>
                  <span className="tag gold" style={{ marginLeft: 'auto' }}>
                    <Star size={12} fill="currentColor" /> {Number(vendor.rating ?? 0).toFixed(1)}
                  </span>
                </div>
                <p className="small">{vendor.description ?? 'A local favourite on Giftly.'}</p>
                <span className="small" style={{ fontWeight: 800 }}>
                  View gifts <ArrowRight size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">Ready to send</span>
            <h2>Gifts people are sending this week.</h2>
          </div>
        </div>
        {offers.length === 0 ? (
          <div className="empty">
            <h3>No live gifts yet</h3>
            <p>Once our vendors publish their offers, they will appear right here.</p>
          </div>
        ) : (
          <div className="offer-grid">
            {offers.map((offer) => (
              <Link
                className="offer-card"
                key={offer.id}
                href={`/vendors/${offer.vendors?.slug ?? offer.vendor_id ?? ''}`}
              >
                <div className={`offer-art ${productTone(offer)}`}>
                  <span className="tag">{fulfilmentLabel(offer.fulfilment_type)}</span>
                  <Gift size={34} />
                </div>
                <div className="offer-body">
                  <span className="small muted">{offer.vendors?.name ?? 'Giftly partner'}</span>
                  <h3>{offer.title}</h3>
                  <div className="offer-meta">
                    <strong>{priceLabel(offer)}</strong>
                    <span className="small muted">{offer.location ?? 'Qatar'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow">Simple by design</span>
            <h2>From “thinking of you” to sent, in under a minute.</h2>
          </div>
        </div>
        <div className="grid-4">
          <div className="card step-card">
            <span className="step-number">1</span>
            <h3>Choose a gift</h3>
            <p className="small">Pick a vendor, an amount or a ready-made experience package.</p>
          </div>
          <div className="card step-card">
            <span className="step-number">2</span>
            <h3>Make it theirs</h3>
            <p className="small">Add a note, pick a design and choose when it arrives.</p>
          </div>
          <div className="card step-card">
            <span className="step-number">3</span>
            <h3>Send it anywhere</h3>
            <p className="small">Email, SMS, a link — or straight to their WhatsApp.</p>
          </div>
          <div className="card step-card">
            <span className="step-number">4</span>
            <h3>Spend it slowly</h3>
            <p className="small">They scan at the counter. Whatever is left stays on the card.</p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <span className="eyebrow gold">For vendors</span>
          <h2>Put your business on the gift list.</h2>
          <p>
            Join Qatar&apos;s marketplace for thoughtful gifts. Set your own offers and packages,
            redeem with a QR scan, and get paid through one dashboard.
          </p>
          <div className="btn-row">
            <Link className="btn primary" href="/vendor/register">
              Apply as a vendor <ArrowRight size={16} />
            </Link>
            <Link className="btn ghost" href="/corporate" style={{ color: '#fff', borderColor: '#fff' }}>
              Corporate gifting
            </Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="grid-2">
          <div className="card mint">
            <span className="icon-tile ink">
              <BadgeCheck size={22} />
            </span>
            <h2 style={{ fontSize: '1.8rem', marginTop: 14 }}>Every card is verified.</h2>
            <p style={{ marginTop: 10 }}>
              Balances live on our ledger, not on a screenshot. Vendors redeem with a scan and the
              remaining value is updated instantly.
            </p>
            <ul className="check-list">
              <li>
                <Check size={16} /> Partial spending, always
              </li>
              <li>
                <Check size={16} /> Expiry set by the vendor
              </li>
              <li>
                <Check size={16} /> Wallet passes with a QR code
              </li>
            </ul>
          </div>
          <div className="card lavender">
            <span className="icon-tile">
              <Ticket size={22} />
            </span>
            <h2 style={{ fontSize: '1.8rem', marginTop: 14 }}>One balance. No awkward maths.</h2>
            <p style={{ marginTop: 10 }}>
              Spend QAR 10 of a QAR 100 card and QAR 90 stays available. No vouchers lost in a
              drawer, no “use it or lose it” pressure.
            </p>
            <div className="split-list" style={{ marginTop: 14 }}>
              <div>
                <span className="k">Gift card balance</span>
                <span className="v">{formatMoney(10000)}</span>
              </div>
              <div>
                <span className="k">Coffee and cake</span>
                <span className="v">− {formatMoney(1000)}</span>
              </div>
              <div>
                <span className="k">Still available</span>
                <span className="v">{formatMoney(9000)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow">Good to know</span>
            <h2>Questions people ask before their first gift.</h2>
          </div>
          <Link className="btn sm" href="/faq">
            All answers <ArrowRight size={16} />
          </Link>
        </div>
        <div className="faq-list">
          <details className="faq-item" open>
            <summary>Can the recipient spend only part of the card?</summary>
            <div className="answer">
              Yes. Every monetary gift card keeps a running balance. If they spend QAR 10 from a
              QAR 100 card, QAR 90 remains for next time.
            </div>
          </details>
          <details className="faq-item">
            <summary>How does the recipient actually receive the gift?</summary>
            <div className="answer">
              You can send it by email, SMS, a shareable link or WhatsApp. They open the link, add
              the card to their Giftly account and show the QR code at the vendor.
            </div>
          </details>
          <details className="faq-item">
            <summary>What is an experience gift?</summary>
            <div className="answer">
              Instead of a cash balance, experience gifts come as a package with a set number of
              sessions — for example three spa visits or a two-person kayak tour. The vendor sets
              the package and the price.
            </div>
          </details>
          <details className="faq-item">
            <summary>Do gift cards work in Apple and Google Wallet?</summary>
            <div className="answer">
              Wallet passes are part of the Giftly app experience. Once you claim a gift, you can
              add it to your phone&apos;s wallet and show the QR code at the counter.
            </div>
          </details>
        </div>
      </section>
    </>
  );
}
