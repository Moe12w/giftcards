import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, Search, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/format';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Businesses' };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const categorySlug = params.category ?? '';
  const supabase = await createClient();

  let query = supabase
    .from('marketplace_businesses')
    .select('id, business_kind, name, slug, logo_url, banner_url, city, area, rating, description, gift_count')
    .order('gift_count', { ascending: false })
    .order('rating', { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,area.ilike.%${q}%`);
  }

  const { data: businesses } = await query;
  const rows = businesses ?? [];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow lavender">The directory</span>
          <h1>Find a business worth leaving the house for.</h1>
          <p className="lede">
            {rows.length} business{rows.length === 1 ? '' : 'es'} on Giftly,
            reviewed and ready to welcome you. Every gift can be spent in parts.
          </p>
          <form className="search-bar" action="/vendors" method="get">
            <Search size={18} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search cafés, spas, adventures…"
              aria-label="Search businesses"
            />
            <button className="btn sm primary" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="container section tight">
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing matches that search"
            body="Try a different word, or clear the filters to see everyone on Giftly."
            action={
              <Link className="btn primary sm" href="/vendors">
                Clear filters
              </Link>
            }
          />
        ) : (
          <div className="grid-3">
            {rows.map((business) => {
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
                        <img src={business.logo_url} alt="" />
                      ) : (
                        initials(business.name)
                      )}
                    </span>
                    <div>
                      <h3 style={{ fontSize: '1.15rem' }}>{business.name}</h3>
                      {isPartner ? (
                        <span className="tag gold" style={{ display: 'block', marginTop: 4 }}>
                          Enterprise partner
                        </span>
                      ) : null}
                      <span className="small muted">
                        <MapPin size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                        {[business.area, business.city].filter(Boolean).join(' · ') || 'Qatar'}
                      </span>
                    </div>
                    <span className="tag gold" style={{ marginLeft: 'auto' }}>
                      <Star size={12} fill="currentColor" /> {Number(business.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="small">{business.description ?? 'A local favourite on Giftly.'}</p>
                  <div className="vendor-foot">
                    <span className="tag neutral">
                      {productCount} {productCount === 1 ? 'gift' : 'gifts'}
                    </span>
                    <span className="small" style={{ fontWeight: 800 }}>
                      View gifts <ArrowRight size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
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
