import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { Notice, PageHead } from '@/components/ui';
import { readExpoConfig } from '@/lib/expo-app-config';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminExpoAppPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).nav;
  const config = await readExpoConfig(ctx.supabase);

  const links = [
    { href: '/admin/expo-app/home', label: t.expoHome, hint: t.expoHomeHint },
    { href: '/admin/expo-app/featured', label: t.expoFeatured, hint: t.expoFeaturedHint },
    { href: '/admin/expo-app/categories', label: t.expoCategories, hint: t.expoCategoriesHint },
    { href: '/admin/expo-app/collections', label: t.expoCollections, hint: t.expoCollectionsHint },
    { href: '/admin/expo-app/controls', label: t.expoControls, hint: t.expoControlsHint },
  ];

  const visibleSections = config.home.sections.filter((section) => section.visible).length;
  const homeCollections = config.collections.items.filter((item) => item.visible).length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.group7}
        title={t.expoApp}
        description={t.expoAppHint}
      />
      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Expo app settings saved.' : null}
      />

      <div className="kpi-grid">
        <div className="kpi">
          <strong>{visibleSections}/{config.home.sections.length}</strong>
          <span>Home sections visible</span>
        </div>
        <div className="kpi">
          <strong>{config.featured.mode}</strong>
          <span>Featured businesses ({config.featured.limit})</span>
        </div>
        <div className="kpi">
          <strong>{config.categories.homeLimit}</strong>
          <span>Categories on home</span>
        </div>
        <div className="kpi">
          <strong>{Math.min(homeCollections, config.collections.homeLimit)}</strong>
          <span>Collections on home</span>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Control the app</h3>
          <span className="small muted">Changes appear within about a minute</span>
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 10 }}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="btn ghost" style={{ justifyContent: 'flex-start' }}>
              <strong>{link.label}</strong>
              <span className="muted" style={{ marginLeft: 12 }}>{link.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Current state</h3></div>
        <div className="split-list">
          <div><span className="k">Maintenance screen</span><span className="v">{config.controls.maintenance.enabled ? 'On' : 'Off'}</span></div>
          <div><span className="k">Home announcement</span><span className="v">{config.controls.announcement.enabled ? 'On' : 'Off'}</span></div>
          <div><span className="k">Featured selection</span><span className="v">{config.featured.businessIds.length} manual picks</span></div>
          <div><span className="k">Trending / recommended</span><span className="v">{config.home.trendingLimit} / {config.home.recommendedLimit}</span></div>
        </div>
      </section>
    </div>
  );
}
