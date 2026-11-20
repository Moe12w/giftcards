import { requireAdmin } from '@/lib/auth';
import { adminSaveExpoControls } from '@/lib/actions/expo-app';
import { Notice, PageHead } from '@/components/ui';
import { readExpoConfig } from '@/lib/expo-app-config';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminExpoControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).nav;
  const config = await readExpoConfig(ctx.supabase);
  const { maintenance, announcement } = config.controls;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.group7}
        title={t.expoControls}
        description={t.expoControlsHint}
      />
      <Notice error={params.error} success={params.saved === '1' ? 'App controls saved.' : null} />

      <form action={adminSaveExpoControls} style={{ display: 'grid', gap: 16 }}>
        <section className="panel">
          <div className="panel-head">
            <h3>Maintenance screen</h3>
            <span className="small muted">Replaces the customer app until switched off</span>
          </div>
          <div className="panel-body form-grid">
            <div className="field full">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="maintenance_enabled"
                  defaultChecked={maintenance.enabled}
                />
                Show the maintenance screen
              </label>
            </div>
            <div className="field">
              <label htmlFor="maintenance_message">Message (English)</label>
              <textarea id="maintenance_message" name="maintenance_message" rows={3} defaultValue={maintenance.message} />
            </div>
            <div className="field">
              <label htmlFor="maintenance_message_ar">Message (Arabic)</label>
              <textarea id="maintenance_message_ar" name="maintenance_message_ar" rows={3} defaultValue={maintenance.messageAr} />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Home announcement</h3>
            <span className="small muted">Customers can dismiss it; it returns when the text changes</span>
          </div>
          <div className="panel-body form-grid">
            <div className="field full">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="announcement_enabled"
                  defaultChecked={announcement.enabled}
                />
                Show an announcement on the home page
              </label>
            </div>
            <div className="field">
              <label htmlFor="announcement_text">Text (English)</label>
              <textarea id="announcement_text" name="announcement_text" rows={3} defaultValue={announcement.text} />
            </div>
            <div className="field">
              <label htmlFor="announcement_text_ar">Text (Arabic)</label>
              <textarea id="announcement_text_ar" name="announcement_text_ar" rows={3} defaultValue={announcement.textAr} />
            </div>
          </div>
        </section>

        <div>
          <button className="btn primary" type="submit">Save app controls</button>
        </div>
      </form>
    </div>
  );
}
