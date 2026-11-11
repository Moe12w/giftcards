import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, Search, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/format';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Vendors' };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const categorySlug = params.category ?? '';
  const supabase = await createClient();

  const categoriesResult = await supabase
    .from('categories')
    .select('id, name, slug, icon')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const categories = categoriesResult.data ?? [];
  const category = categories.find((item) => item.slug === categorySlug) ?? null;

  let query = supabase
    .from('vendors')
    .select('id, name, slug, logo_url, city, area, rating, description, category_id, products(id)')
    .eq('status', 'approved')
    .order('is_featured', { ascending: false })
    .order('rating', { ascending: false });

  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,area.ilike.%${q}%`);
  if (category) query = query.eq('category_id', category.id);

  const { data: vendors } = await query;
  const rows = vendors ?? [];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow lavender">The directory</span>
          <h1>Find a gift worth leaving the house for.</h1>
          <p className="lede">
            {rows.length} independent {rows.length === 1 ? 'business' : 'businesses'} across Qatar,
            reviewed and ready to welcome you. Every gift can be spent in parts.
          </p>
          <form className="search-bar" action="/vendors" method="get">
            <Search size={18} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search cafés, spas, adventures…"
              aria-label="Search vendors"
            />
            {category ? <input type="hidden" name="category" value={category.slug} /> : null}
            <button className="btn sm primary" type="submit">
              Search
            </button>
          </form>
          <div className="filter-row" style={{ marginTop: 16 }}>
            <Link className={`filter-chip${!category ? ' active' : ''}`} href="/vendors">
              All categories
            </Link>
            {categories.map((item) => (
              <Link
                key={item.id}
                className={`filter-chip${category?.id === item.id ? ' active' : ''}`}
                href={`/vendors?category=${item.slug}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
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
            {rows.map((vendor) => {
              const productCount = Array.isArray(vendor.products) ? vendor.products.length : 0;
              return (
                <Link
                  className="card vendor-card"
                  key={vendor.id}
                  href={`/vendors/${vendor.slug ?? vendor.id}`}
                >
                  <div className="vendor-top">
                    <span className="vendor-logo">
                      {vendor.logo_url ? <img src={vendor.logo_url} alt="" /> : initials(vendor.name)}
                    </span>
                    <div>
                      <h3 style={{ fontSize: '1.15rem' }}>{vendor.name}</h3>
                      <span className="small muted">
                        <MapPin size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                        {[vendor.area, vendor.city].filter(Boolean).join(' · ') || 'Qatar'}
                      </span>
                    </div>
                    <span className="tag gold" style={{ marginLeft: 'auto' }}>
                      <Star size={12} fill="currentColor" /> {Number(vendor.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="small">{vendor.description ?? 'A local favourite on Giftly.'}</p>
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
