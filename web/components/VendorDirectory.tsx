'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, MapPin, Search, Star } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import { initials } from '@/lib/format';
import { searchBusinesses } from '@/lib/search';
import { fill } from '@/lib/i18n';
import type { SiteCopyShape } from '@/lib/i18n/site';
import type { PublicBusinessRow } from '@/lib/public-cache';

type VendorsCopy = SiteCopyShape['vendors'];

function Directory({
  rows,
  t,
  searchLabel,
}: {
  rows: PublicBusinessRow[];
  t: VendorsCopy;
  searchLabel: string;
}) {
  // The query string is read on the client so the page itself is static.
  const params = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const results = useMemo(
    () => (q ? (searchBusinesses(rows, q) as PublicBusinessRow[]) : rows),
    [rows, q],
  );

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow lavender">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lede">
            {fill(results.length === 1 ? t.ledeOne : t.ledeMany, { count: results.length })}
          </p>
          <form className="search-bar" action="/vendors" method="get">
            <Search size={18} />
            <input
              name="q"
              defaultValue={q}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
            />
            <button className="btn sm primary" type="submit">
              {searchLabel}
            </button>
          </form>
        </div>
      </section>

      <section className="container section tight">
        {results.length === 0 ? (
          <div className="empty">
            <h3>{t.emptyTitle}</h3>
            <p>{t.emptyBody}</p>
            <Link className="btn primary sm" href="/vendors">
              {t.clearFilters}
            </Link>
          </div>
        ) : (
          <div className="grid-3">
            {results.map((business) => {
              const productCount = Number(business.gift_count ?? 0);
              const isPartner = business.business_kind === 'partner';
              return (
                <Link
                  className="card vendor-card"
                  key={business.id}
                  href={`/vendors/${business.slug ?? business.id}`}
                >
                  <div className="vendor-top">
                    <span className="vendor-logo">
                      {business.logo_url ? (
                        <OptimizedImage
                          src={business.logo_url}
                          alt={business.name}
                          width={52}
                          height={52}
                          sizes="52px"
                        />
                      ) : (
                        initials(business.name)
                      )}
                    </span>
                    <div>
                      <h3 style={{ fontSize: '1.15rem' }}>{business.name}</h3>
                      {isPartner ? (
                        <span className="tag gold" style={{ display: 'block', marginTop: 4 }}>
                          {t.enterprisePartner}
                        </span>
                      ) : null}
                      <span className="small muted">
                        <MapPin size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                        {[business.area, business.city].filter(Boolean).join(' · ') || t.qatar}
                      </span>
                    </div>
                    <span className="tag gold" style={{ marginLeft: 'auto' }}>
                      <Star size={12} fill="currentColor" /> {Number(business.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="small">{business.description ?? t.localFavourite}</p>
                  <div className="vendor-foot">
                    <span className="tag neutral">
                      {productCount} {productCount === 1 ? t.giftCountOne : t.giftCountMany}
                    </span>
                    <span className="small" style={{ fontWeight: 800 }}>
                      {t.viewGifts}{' '}
                      <ArrowRight size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/** Wrapped so `useSearchParams()` has a boundary and the page stays static. */
export function VendorDirectory(props: {
  rows: PublicBusinessRow[];
  t: VendorsCopy;
  searchLabel: string;
}) {
  return (
    <Suspense fallback={null}>
      <Directory {...props} />
    </Suspense>
  );
}
