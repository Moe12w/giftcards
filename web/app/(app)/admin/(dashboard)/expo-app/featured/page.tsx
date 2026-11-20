import { requireAdmin } from '@/lib/auth';
import { adminSaveExpoFeatured } from '@/lib/actions/expo-app';
import { ExpoFeaturedPicker, type FeaturedBusinessOption } from '@/components/ExpoFeaturedPicker';
import { Notice, PageHead } from '@/components/ui';
import { readExpoConfig } from '@/lib/expo-app-config';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminExpoFeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).nav;
  const config = await readExpoConfig(ctx.supabase);

  const { data } = await ctx.supabase
    .from('marketplace_businesses')
    .select('id, name, business_kind, status, gift_count')
    .order('name', { ascending: true });
  const options = (data ?? []) as FeaturedBusinessOption[];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.group7}
        title={t.expoFeatured}
        description={t.expoFeaturedHint}
      />
      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Featured businesses saved.' : null}
      />

      <form action={adminSaveExpoFeatured} style={{ display: 'grid', gap: 16 }}>
        <section className="panel">
          <div className="panel-head"><h3>How the shelf is filled</h3></div>
          <div className="panel-body form-grid">
            <div className="field">
              <label htmlFor="mode">Source</label>
              <select id="mode" name="mode" defaultValue={config.featured.mode}>
                <option value="auto">Automatic ranking</option>
                <option value="manual">Manual selection only</option>
                <option value="mixed">Manual picks first, then automatic</option>
              </select>
              <span className="hint">Manual picks keep the order shown below.</span>
            </div>
            <div className="field">
              <label htmlFor="limit">Maximum businesses</label>
              <input
                id="limit"
                name="limit"
                type="number"
                min={1}
                max={24}
                defaultValue={config.featured.limit}
              />
            </div>
            <div className="field">
              <label htmlFor="sort">Automatic sort</label>
              <select id="sort" name="sort" defaultValue={config.featured.sort}>
                <option value="gift_count">Number of gift cards</option>
                <option value="rating">Rating</option>
              </select>
            </div>
            <div className="field">
              <label className="checkbox-row">
                <input type="checkbox" name="partner_first" defaultChecked={config.featured.partnerFirst} />
                Show enterprise partners before vendors
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="prioritize_featured"
                  defaultChecked={config.featured.prioritizeFeatured}
                />
                Prioritise businesses marked “Feature on marketplace”
              </label>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Manual selection</h3>
            <span className="small muted">Used by manual and mixed modes</span>
          </div>
          <div className="panel-body">
            <ExpoFeaturedPicker options={options} initialIds={config.featured.businessIds} />
          </div>
        </section>

        <div>
          <button className="btn primary" type="submit">Save featured businesses</button>
        </div>
      </form>
    </div>
  );
}
