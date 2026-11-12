import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CalendarHeart,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { mapProducts } from '@/lib/data';
import { activeVariants, fulfilmentLabel, priceLabel, productTone } from '@/lib/catalog';
import { formatMoney } from '@/lib/money';
import { initials } from '@/lib/format';
import { site } from '@/lib/i18n/site';
import { common } from '@/lib/i18n/common';
import { pick, fill } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ slug: string }> };

async function getBusiness(slug: string) {
  const supabase = await createClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  let query = supabase.from('marketplace_businesses').select('*');
  query = isUuid ? query.eq('id', slug) : query.eq('slug', slug);
  const { data } = await query.maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const t = pick(site, locale).vendorDetail;
  const business = await getBusiness(slug);
  if (!business) return { title: t.notFound };
  return {
    title: business.name,
    description: fill(t.metaDescription, { name: business.name }),
  };
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();

  const locale = await getLocale();
  const t = pick(site, locale).vendorDetail;
  const c = pick(common, locale);

  const supabase = await createClient();
  const isPartner = business.business_kind === 'partner';

  const [productsResult, locationsResult] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq(isPartner ? 'partner_id' : 'vendor_id', business.id)
      .eq('status', 'published')
      .eq('is_active', true)
      .order('rating', { ascending: false }),
    isPartner
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('vendor_locations')
          .select('*')
          .eq('vendor_id', business.id)
          .order('is_primary', { ascending: false }),
  ]);

  const products = mapProducts(productsResult.data ?? []);
  const locations = locationsResult.data ?? [];

  return (
    <>
      <section className="vendor-hero">
        <div className="container">
          <Link className="back-link" href="/vendors">
            <ArrowLeft size={16} /> {t.allBusinesses}
          </Link>
          <div className="vendor-hero-card">
            <span className="vendor-logo xl">
              {business.logo_url ? <img src={business.logo_url} alt="" /> : initials(business.name)}
            </span>
            <div className="vendor-hero-copy">
              <div className="pill-row">
                {isPartner ? (
                  <span className="tag mint">{t.enterprisePartner}</span>
                ) : (
                  <span className="tag mint">{t.verifiedBusiness}</span>
                )}
                <span className="tag gold">
                  <Star size={12} fill="currentColor" /> {Number(business.rating ?? 0).toFixed(1)}
                </span>
              </div>
              <h1>{business.name}</h1>
              <p className="lede">{business.description ?? t.localFavourite}</p>
              <div className="hero-trust">
                {!isPartner && (
                  <span>
                    <MapPin size={16} />{' '}
                    {[business.area, business.city].filter(Boolean).join(', ') || t.qatar}
                  </span>
                )}
                {business.website ? (
                  <span>
                    <Globe size={16} /> {business.website.replace(/^https?:\/\//, '')}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="vendor-hero-cta">
              <Link className="btn primary" href="/download">
                {t.getTheAppToSend} <ArrowRight size={16} />
              </Link>
              <span className="small muted">{t.sentAndStored}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">{fill(t.giftsFrom, { name: business.name })}</span>
            <h2>{t.title}</h2>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="empty">
            <h3>{t.emptyTitle}</h3>
            <p>{fill(t.emptyBody, { name: business.name })}</p>
          </div>
        ) : (
          <div className="offer-grid">
            {products.map((product) => {
              const variants = activeVariants(product);
              return (
                <article className="offer-card static" key={product.id}>
                  <div className={`offer-art ${productTone(product)}`}>
                    <span className="tag">{fulfilmentLabel(product.fulfilment_type, locale)}</span>
                    {product.fulfilment_type === 'experience' ? (
                      <CalendarHeart size={34} />
                    ) : (
                      <Star size={34} />
                    )}
                  </div>
                  <div className="offer-body">
                    <div>
                      <h3>{product.title}</h3>
                      <p className="small" style={{ marginTop: 6 }}>
                        {product.description ?? t.thoughtfulGift}
                      </p>
                    </div>
                    {product.fulfilment_type === 'experience' && variants.length > 0 ? (
                      <div className="package-list">
                        {variants.slice(0, 3).map((variant) => (
                          <div className="package-row" key={variant.id}>
                            <span>
                              {variant.label}
                              {variant.session_count
                                ? ` · ${variant.session_count} ${
                                    variant.session_count === 1 ? c.time.session : c.time.sessions
                                  }`
                                : ''}
                            </span>
                            <strong>{formatMoney(variant.price_minor, locale)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="offer-meta">
                      <strong>{priceLabel(product, locale)}</strong>
                      <span className="small muted">
                        <Clock size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                        {product.expiry_days
                          ? fill(t.validDays, { days: product.expiry_days })
                          : product.valid_until
                            ? fill(t.validUntil, { date: product.valid_until.slice(0, 10) })
                            : t.noExpiry}
                      </span>
                    </div>
                    <Link className="btn primary block sm" href="/download">
                      {t.sendThisGift}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {locations.length > 0 ? (
        <section className="container section tight">
          <div className="grid-2">
            <div className="card">
              <span className="icon-tile lavender">
                <MapPin size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{t.whereToFind}</h3>
              <div className="split-list" style={{ marginTop: 10 }}>
                {locations.map((location) => (
                  <div key={location.id}>
                    <span className="k">{location.address ?? location.area ?? t.doha}</span>
                    <span className="v small">{location.hours ?? t.seeVendorForHours}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card mint">
              <span className="icon-tile ink">
                <Mail size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>{t.questionsTitle}</h3>
              <p className="small" style={{ marginTop: 8 }}>
                {t.questionsBody}
              </p>
              <Link className="btn sm" href="/contact" style={{ marginTop: 14 }}>
                {t.contactUs} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
