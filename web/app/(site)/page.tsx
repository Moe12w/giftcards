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
import { site } from '@/lib/i18n/site';
import { common } from '@/lib/i18n/common';
import { pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export default async function HomePage() {
  const locale = await getLocale();
  const copy = pick(site, locale);
  const t = copy.home;
  const c = pick(common, locale);
  const supabase = await createClient();

  const [businessCount, productCount, categoryResult, featuredResult, offersResult] =
    await Promise.all([
      supabase.from('marketplace_businesses').select('id', { count: 'exact', head: true }),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('is_active', true),
      supabase.from('categories').select('id, name, slug').eq('active', true),
      supabase
        .from('marketplace_businesses')
        .select('id, business_kind, name, slug, logo_url, city, area, rating, description, gift_count')
        .order('business_kind', { ascending: true })
        .order('gift_count', { ascending: false })
        .order('rating', { ascending: false })
        .limit(6),
      supabase
        .from('products')
        .select('*, vendors(id, name, slug, logo_url, status), partner:enterprise_partners(id, name, slug, logo_url), product_variants(*)')
        .eq('status', 'published')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6),
    ]);

  const businesses = featuredResult.data ?? [];
  const offers = mapProducts(offersResult.data);
  const categories = categoryResult.data ?? [];
  const businessTotal = businessCount.count ?? 0;
  const productTotal = productCount.count ?? 0;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>
              {t.heroTitleLine1}
              <br />
              <span className="highlight">{t.heroTitleLine2}</span>.
            </h1>
            <p className="lede">{t.heroLede}</p>
            <div className="btn-row">
              <Link className="btn primary lg" href="/download">
                {copy.nav.getTheApp} <ArrowRight size={18} />
              </Link>
              <Link className="btn ghost lg" href="/vendors">
                {t.browseBusinesses}
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <Wallet size={16} /> {t.walletReady}
              </span>
              <span>
                <ShieldCheck size={16} /> {t.spendInParts}
              </span>
              <span>{t.englishAndArabic}</span>
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
                  <span className="tag">{c.fulfilment.experience}</span>
                </div>
                <div>
                  <div className="gc-amount">{t.artThreeSessions}</div>
                  <div className="gc-meta">{t.artSlowDown}</div>
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
                  <span className="tag">{c.fulfilment.gift_card}</span>
                </div>
                <div>
                  <div className="gc-amount">{formatMoney(10000, locale)}</div>
                  <div className="gc-meta">{t.artTreatYourself}</div>
                </div>
              </div>
              <div className="gift-card-visual gc-3">
                <div className="gc-top">
                  <span className="gc-brand">Sunset Kayak</span>
                </div>
                <div>
                  <div className="gc-amount">{t.artOneAdventure}</div>
                  <div className="gc-meta">{t.artForTwo}</div>
                </div>
              </div>
            </div>
            <span className="float-chip one">
              <Send size={14} /> {t.artSentWhatsApp}
            </span>
            <span className="float-chip two">
              <QrCode size={14} /> {t.artScanCounter}
            </span>
            <span className="float-chip three">
              <Wallet size={14} /> {t.artAddedWallet}
            </span>
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="stat-strip">
          <div>
            <strong>{businessTotal || '—'}</strong>
            <span>{t.statBusinesses}</span>
          </div>
          <div>
            <strong>{productTotal || '—'}</strong>
            <span>{t.statGifts}</span>
          </div>
          <div>
            <strong>{categories.length || '—'}</strong>
            <span>{t.statCategories}</span>
          </div>
          <div>
            <strong>3</strong>
            <span>{t.statWays}</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">{t.eyebrowThreeWays}</span>
            <h2>{t.titleThreeWays}</h2>
            <p>{t.bodyThreeWays}</p>
          </div>
          <Link className="btn sm" href="/faq">
            {copy.nav.howItWorks} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid-3">
          <article className="card card-type">
            <span className="ribbon mint" />
            <span className="icon-tile">
              <Gift size={24} />
            </span>
            <h3>{t.typeGiftCards}</h3>
            <p>{t.typeGiftCardsBody}</p>
            <div className="pill-row">
              <span className="tag">{t.tagAnyAmount}</span>
              <span className="tag">{t.tagNoChangeLost}</span>
            </div>
          </article>
          <article className="card card-type">
            <span className="ribbon lavender" />
            <span className="icon-tile lavender">
              <CalendarHeart size={24} />
            </span>
            <h3>{t.typeExperiences}</h3>
            <p>{t.typeExperiencesBody}</p>
            <div className="pill-row">
              <span className="tag">{t.tagPackages}</span>
              <span className="tag">{t.tagBookATime}</span>
            </div>
          </article>
          <article className="card card-type">
            <span className="ribbon coral" />
            <span className="icon-tile coral">
              <Building2 size={24} />
            </span>
            <h3>{t.typeCorporateRewards}</h3>
            <p>{t.typeCorporateRewardsBody}</p>
            <div className="pill-row">
              <span className="tag">{t.tagBulkCodes}</span>
              <span className="tag">{t.tagReports}</span>
            </div>
          </article>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow lavender">{t.eyebrowLocal}</span>
            <h2>{t.titleLocal}</h2>
            <p>{t.bodyLocal}</p>
          </div>
          <Link className="btn sm" href="/vendors">
            {t.allBusinesses} <ArrowRight size={16} />
          </Link>
        </div>

        {businesses.length === 0 ? (
          <div className="empty">
            <h3>{t.emptyBusinessesTitle}</h3>
            <p>{t.emptyBusinessesBody}</p>
          </div>
        ) : (
          <div className="grid-3">
            {businesses.slice(0, 6).map((business) => (
              <Link
                className="card vendor-card"
                key={business.id}
                href={`/vendors/${business.slug ?? business.id}`}
              >
                <div className="vendor-top">
                  <span className="vendor-logo">
                    {business.logo_url ? (
                      <img src={business.logo_url} alt="" />
                    ) : (
                      initials(business.name)
                    )}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '1.15rem' }}>{business.name}</h3>
                    {business.business_kind === 'partner' ? (
                      <span className="tag gold" style={{ display: 'block', marginTop: 4 }}>
                        {t.enterprisePartner}
                      </span>
                    ) : null}
                    <span className="small muted">
                      {[business.area, business.city].filter(Boolean).join(' · ') || t.qatar}
                    </span>
                  </div>
                  <span className="tag gold" style={{ marginLeft: 'auto' }}>
                    <Star size={12} fill="currentColor" /> {Number(business.rating ?? 0).toFixed(1)}
                  </span>
                </div>
                <p className="small">{business.description ?? t.localFavourite}</p>
                <span className="small" style={{ fontWeight: 800 }}>
                  {t.viewGifts} <ArrowRight size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow coral">{t.eyebrowReady}</span>
            <h2>{t.titleReady}</h2>
          </div>
        </div>
        {offers.length === 0 ? (
          <div className="empty">
            <h3>{t.emptyGiftsTitle}</h3>
            <p>{t.emptyGiftsBody}</p>
          </div>
        ) : (
          <div className="offer-grid">
            {offers.map((offer) => (
              <Link
                className="offer-card"
                key={offer.id}
                href={`/vendors/${offer.partner?.slug ?? offer.vendors?.slug ?? offer.vendor_id ?? offer.partner_id ?? ''}`}
              >
                <div className={`offer-art ${productTone(offer)}`}>
                  <span className="tag">{fulfilmentLabel(offer.fulfilment_type, locale)}</span>
                  <Gift size={34} />
                </div>
                <div className="offer-body">
                  <span className="small muted">
                    {offer.partner?.name ?? offer.vendors?.name ?? t.giftlyPartner}
                  </span>
                  <h3>{offer.title}</h3>
                  <div className="offer-meta">
                    <strong>{priceLabel(offer, locale)}</strong>
                    <span className="small muted">{offer.location ?? t.qatar}</span>
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
            <span className="eyebrow">{t.eyebrowSimple}</span>
            <h2>{t.titleSimple}</h2>
          </div>
        </div>
        <div className="grid-4">
          <div className="card step-card">
            <span className="step-number">1</span>
            <h3>{t.step1Title}</h3>
            <p className="small">{t.step1Body}</p>
          </div>
          <div className="card step-card">
            <span className="step-number">2</span>
            <h3>{t.step2Title}</h3>
            <p className="small">{t.step2Body}</p>
          </div>
          <div className="card step-card">
            <span className="step-number">3</span>
            <h3>{t.step3Title}</h3>
            <p className="small">{t.step3Body}</p>
          </div>
          <div className="card step-card">
            <span className="step-number">4</span>
            <h3>{t.step4Title}</h3>
            <p className="small">{t.step4Body}</p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <span className="eyebrow gold">{t.eyebrowForVendors}</span>
          <h2>{t.titleForVendors}</h2>
          <p>{t.bodyForVendors}</p>
          <div className="btn-row">
            <Link className="btn primary" href="/vendor/register">
              {t.applyAsVendor} <ArrowRight size={16} />
            </Link>
            <Link className="btn ghost" href="/corporate" style={{ color: '#fff', borderColor: '#fff' }}>
              {t.corporateGifting}
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
            <h2 style={{ fontSize: '1.8rem', marginTop: 14 }}>{t.titleVerified}</h2>
            <p style={{ marginTop: 10 }}>{t.bodyVerified}</p>
            <ul className="check-list">
              <li>
                <Check size={16} /> {t.checkPartial}
              </li>
              <li>
                <Check size={16} /> {t.checkExpiry}
              </li>
              <li>
                <Check size={16} /> {t.checkWallet}
              </li>
            </ul>
          </div>
          <div className="card lavender">
            <span className="icon-tile">
              <Ticket size={22} />
            </span>
            <h2 style={{ fontSize: '1.8rem', marginTop: 14 }}>{t.titleOneBalance}</h2>
            <p style={{ marginTop: 10 }}>{t.bodyOneBalance}</p>
            <div className="split-list" style={{ marginTop: 14 }}>
              <div>
                <span className="k">{t.labelBalance}</span>
                <span className="v">{formatMoney(10000, locale)}</span>
              </div>
              <div>
                <span className="k">{t.labelCoffee}</span>
                <span className="v">− {formatMoney(1000, locale)}</span>
              </div>
              <div>
                <span className="k">{t.labelAvailable}</span>
                <span className="v">{formatMoney(9000, locale)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow">{t.eyebrowGoodToKnow}</span>
            <h2>{t.titleGoodToKnow}</h2>
          </div>
          <Link className="btn sm" href="/faq">
            {t.allAnswers} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="faq-list">
          <details className="faq-item" open>
            <summary>{t.faq1Q}</summary>
            <div className="answer">{t.faq1A}</div>
          </details>
          <details className="faq-item">
            <summary>{t.faq2Q}</summary>
            <div className="answer">{t.faq2A}</div>
          </details>
          <details className="faq-item">
            <summary>{t.faq3Q}</summary>
            <div className="answer">{t.faq3A}</div>
          </details>
          <details className="faq-item">
            <summary>{t.faq4Q}</summary>
            <div className="answer">{t.faq4A}</div>
          </details>
        </div>
      </section>
    </>
  );
}
