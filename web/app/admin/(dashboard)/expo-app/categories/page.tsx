import { requireAdmin } from '@/lib/auth';
import { adminSaveExpoCategories } from '@/lib/actions/expo-app';
import { Notice, PageHead } from '@/components/ui';
import { readExpoConfig } from '@/lib/expo-app-config';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

const TONES = ['teal', 'pink', 'lavender', 'gold', 'sky'];

export default async function AdminExpoCategoriesPage({
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
    .from('categories')
    .select('id, slug, name, name_ar, icon, tone, sort_order, active, show_on_home')
    .order('sort_order', { ascending: true });
  const categories = (data ?? []) as {
    id: string;
    slug: string;
    name: string;
    name_ar: string | null;
    icon: string | null;
    tone: string | null;
    sort_order: number;
    active: boolean;
    show_on_home: boolean;
  }[];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.group7}
        title={t.expoCategories}
        description={t.expoCategoriesHint}
      />
      <Notice error={params.error} success={params.saved === '1' ? 'Categories saved.' : null} />

      <form action={adminSaveExpoCategories} style={{ display: 'grid', gap: 16 }}>
        <section className="panel">
          <div className="panel-head">
            <h3>Categories in the app</h3>
            <span className="small muted">Turning off “In app” also hides it from the public site</span>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name (EN)</th>
                    <th>Name (AR)</th>
                    <th>Icon</th>
                    <th>Colour</th>
                    <th>Order</th>
                    <th>In app</th>
                    <th>On home</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <input type="hidden" name="category_id" value={category.id} />
                        <input
                          name={`name_${category.id}`}
                          defaultValue={category.name}
                          aria-label={`English name for ${category.slug}`}
                        />
                      </td>
                      <td>
                        <input
                          name={`name_ar_${category.id}`}
                          defaultValue={category.name_ar ?? ''}
                          aria-label={`Arabic name for ${category.slug}`}
                        />
                      </td>
                      <td>
                        <input
                          name={`icon_${category.id}`}
                          defaultValue={category.icon ?? 'gift'}
                          aria-label={`Icon for ${category.slug}`}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <select
                          name={`tone_${category.id}`}
                          defaultValue={category.tone ?? 'lavender'}
                          aria-label={`Colour for ${category.slug}`}
                        >
                          {TONES.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          name={`sort_${category.id}`}
                          type="number"
                          min={0}
                          max={10000}
                          defaultValue={category.sort_order}
                          style={{ width: 80 }}
                        />
                      </td>
                      <td>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            name={`active_${category.id}`}
                            defaultChecked={category.active}
                          />
                        </label>
                      </td>
                      <td>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            name={`show_home_${category.id}`}
                            defaultChecked={category.show_on_home}
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Home page</h3></div>
          <div className="panel-body form-grid">
            <div className="field">
              <label htmlFor="home_limit">Categories shown on the home page</label>
              <input
                id="home_limit"
                name="home_limit"
                type="number"
                min={1}
                max={24}
                defaultValue={config.categories.homeLimit}
              />
              <span className="hint">Only “On home” categories count towards this limit.</span>
            </div>
          </div>
        </section>

        <div>
          <button className="btn primary" type="submit">Save categories</button>
        </div>
      </form>
    </div>
  );
}
