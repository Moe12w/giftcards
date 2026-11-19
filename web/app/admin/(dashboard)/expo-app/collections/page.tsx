import { requireAdmin } from '@/lib/auth';
import { adminSaveExpoCollections } from '@/lib/actions/expo-app';
import { Notice, PageHead } from '@/components/ui';
import { COLLECTION_TILES, readExpoConfig } from '@/lib/expo-app-config';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminExpoCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).nav;
  const config = await readExpoConfig(ctx.supabase);
  const bySlug = new Map(config.collections.items.map((item) => [item.slug, item]));

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.group7}
        title={t.expoCollections}
        description={t.expoCollectionsHint}
      />
      <Notice error={params.error} success={params.saved === '1' ? 'Collections saved.' : null} />

      <form action={adminSaveExpoCollections} style={{ display: 'grid', gap: 16 }}>
        <section className="panel">
          <div className="panel-head">
            <h3>Collection tiles on home</h3>
            <span className="small muted">Lower order numbers appear first</span>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Collection</th><th>Slug</th><th>Visible</th><th>Order</th></tr>
                </thead>
                <tbody>
                  {COLLECTION_TILES.map((tile, index) => {
                    const setting = bySlug.get(tile.slug);
                    return (
                      <tr key={tile.slug}>
                        <td>
                          <input type="hidden" name="collection_slug" value={tile.slug} />
                          {tile.label}
                        </td>
                        <td className="mono small muted">/{tile.slug}</td>
                        <td>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              name={`visible_${tile.slug}`}
                              defaultChecked={setting?.visible ?? true}
                            />
                            Show
                          </label>
                        </td>
                        <td>
                          <input
                            type="number"
                            name={`order_${tile.slug}`}
                            min={0}
                            max={10000}
                            defaultValue={setting?.order ?? (index + 1) * 10}
                            style={{ width: 90 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Home page</h3></div>
          <div className="panel-body form-grid">
            <div className="field">
              <label htmlFor="home_limit">Collections shown on the home page</label>
              <input
                id="home_limit"
                name="home_limit"
                type="number"
                min={1}
                max={14}
                defaultValue={config.collections.homeLimit}
              />
              <span className="hint">Between 1 and 14.</span>
            </div>
          </div>
        </section>

        <div>
          <button className="btn primary" type="submit">Save collections</button>
        </div>
      </form>
    </div>
  );
}
