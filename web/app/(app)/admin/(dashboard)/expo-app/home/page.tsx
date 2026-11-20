import { requireAdmin } from '@/lib/auth';
import { adminSaveExpoHome } from '@/lib/actions/expo-app';
import { Notice, PageHead } from '@/components/ui';
import { HOME_SECTION_LABELS, readExpoConfig } from '@/lib/expo-app-config';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminExpoHomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).nav;
  const config = await readExpoConfig(ctx.supabase);
  const sections = [...config.home.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.group7}
        title={t.expoHome}
        description={t.expoHomeHint}
      />
      <Notice error={params.error} success={params.saved === '1' ? 'Home settings saved.' : null} />

      <form action={adminSaveExpoHome} style={{ display: 'grid', gap: 16 }}>
        <section className="panel">
          <div className="panel-head">
            <h3>Home sections</h3>
            <span className="small muted">Lower order numbers appear first</span>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Section</th><th>Visible</th><th>Order</th></tr>
                </thead>
                <tbody>
                  {sections.map((section) => (
                    <tr key={section.key}>
                      <td>{HOME_SECTION_LABELS[section.key]}</td>
                      <td>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            name={`visible_${section.key}`}
                            defaultChecked={section.visible}
                          />
                          Show
                        </label>
                      </td>
                      <td>
                        <input
                          type="number"
                          name={`order_${section.key}`}
                          min={0}
                          max={10000}
                          defaultValue={section.order}
                          style={{ width: 90 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Shelf sizes</h3></div>
          <div className="panel-body form-grid">
            <div className="field">
              <label htmlFor="trending_limit">Trending gift cards</label>
              <input
                id="trending_limit"
                name="trending_limit"
                type="number"
                min={1}
                max={24}
                defaultValue={config.home.trendingLimit}
              />
              <span className="hint">Between 1 and 24.</span>
            </div>
            <div className="field">
              <label htmlFor="recommended_limit">Recommended gift cards</label>
              <input
                id="recommended_limit"
                name="recommended_limit"
                type="number"
                min={1}
                max={12}
                defaultValue={config.home.recommendedLimit}
              />
              <span className="hint">Between 1 and 12.</span>
            </div>
          </div>
        </section>

        <div>
          <button className="btn primary" type="submit">Save home settings</button>
        </div>
      </form>
    </div>
  );
}
