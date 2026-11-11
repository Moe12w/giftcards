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
  const business = await getBusiness(slug);
  if (!business) return { title: 'Business not found' };
  return {
    title: business.name,
    description: business.description ?? `Gifts from ${business.name} on Giftly.`,
  };
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();

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
            <ArrowLeft size={16} /> All businesses
          </Link>
          <div className="vendor-hero-card">
            <span className="vendor-logo xl">
              {business.logo_url ? <img src={business.logo_url} alt="" /> : initials(business.name)}
            </span>
            <div className="vendor-hero-copy">
              <div className="pill-row">
                {isPartner ? (
                  <span className="tag mint">Enterprise partner</span>
                ) : (
                  <span className="tag mint">Verified business</span>
                )}
                <span className="tag gold">
                  <Star size={12} fill="currentColor" /> {Number(business.rating ?? 0).toFixed(1)}
                </span>
              </div>
              <h1>{business.name}</h1>
              <p className="lede">{business.description ?? 'A local favourite on Giftly.'}</p>
              <div className="hero-trust">
                {!isPartner && (
                  <span>
                    <MapPin size={16} />{' '}
                    {[business.area, business.city].filter(Boolean).join(', ') || 'Qatar'}
                  </span>
                )}
                {(!isPartner && business.website) || (isPartner && business.website) ? (
                  <span>
                    <Globe size={16} /> {business.website.replace(/^https?:\/\//, '')}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="vendor-hero-cta">
              <Link className="btn primary" href="/download">
                Get the app to send <ArrowRight size={16} />
              </Link>
              <span className="small muted">Gifts are sent and stored in the Giftly app.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section tight">
        <div className="section-head">
          <div className="copy">
            <span className="eyebrow mint">Gifts from {business.name}</span>
            <h2>Pick something they will remember.</h2>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="empty">
            <h3>Gifts are on the way</h3>
            <p>{business.name} has not published an offer yet. Check back shortly.</p>
          </div>
        ) : (
          <div className="offer-grid">
            {products.map((product) => {
              const variants = activeVariants(product);
              return (
                <article className="offer-card static" key={product.id}>
                  <div className={`offer-art ${productTone(product)}`}>
                    <span className="tag">{fulfilmentLabel(product.fulfilment_type)}</span>
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
                        {product.description ?? 'A thoughtful local gift.'}
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
                                    variant.session_count === 1 ? 'session' : 'sessions'
                                  }`
                                : ''}
                            </span>
                            <strong>{formatMoney(variant.price_minor)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="offer-meta">
                      <strong>{priceLabel(product)}</strong>
                      <span className="small muted">
                        <Clock size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                        {product.expiry_days
                          ? `Valid ${product.expiry_days} days`
                          : product.valid_until
                            ? `Valid until ${product.valid_until.slice(0, 10)}`
                            : 'No expiry'}
                      </span>
                    </div>
                    <Link className="btn primary block sm" href="/download">
                      Send this gift
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
              <h3 style={{ marginTop: 14 }}>Where to find them</h3>
              <div className="split-list" style={{ marginTop: 10 }}>
                {locations.map((location) => (
                  <div key={location.id}>
                    <span className="k">{location.address ?? location.area ?? 'Doha'}</span>
                    <span className="v small">{location.hours ?? 'See vendor for hours'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card mint">
              <span className="icon-tile ink">
                <Mail size={22} />
              </span>
              <h3 style={{ marginTop: 14 }}>Questions about this gift?</h3>
              <p className="small" style={{ marginTop: 8 }}>
                Reach the Giftly team and we will help with delivery, balances or bookings.
              </p>
              <Link className="btn sm" href="/contact" style={{ marginTop: 14 }}>
                Contact us <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
