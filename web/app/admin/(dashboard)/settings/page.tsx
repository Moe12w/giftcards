import { Globe, Lock, Plus, Settings2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSaveSetting } from '@/lib/actions/admin';
import { formatDateTime } from '@/lib/format';
import { Notice, PageHead } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

function settingValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).settings;
  const c = pick(common, locale);

  const { data, error } = await ctx.supabase
    .from('system_settings')
    .select('*')
    .order('key', { ascending: true });

  const settings = data ?? [];
  const publicCount = settings.filter((setting) => setting.is_public).length;
  const recent = settings.filter(
    (setting) => Date.now() - new Date(setting.updated_at).getTime() < 7 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Settings2 size={17} />
          </span>
          <strong>{settings.length}</strong>
          <span>{t.settings}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Globe size={17} />
          </span>
          <strong>{publicCount}</strong>
          <span>{t.public}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Lock size={17} />
          </span>
          <strong>{settings.length - publicCount}</strong>
          <span>{t.private}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Settings2 size={17} />
          </span>
          <strong>{recent}</strong>
          <span>{t.updatedThisWeek}</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.addOrReplace}</h3>
          <Plus size={16} />
        </div>
        <div className="panel-body">
          <form action={adminSaveSetting} className="inline-form">
            <div className="field">
              <label htmlFor="key">{t.key}</label>
              <input id="key" name="key" required placeholder="support.email" />
            </div>
            <div className="field" style={{ flex: '2 1 320px' }}>
              <label htmlFor="value">{c.labels.value}</label>
              <input id="value" name="value" placeholder='hello@giftly.qa or {"enabled":true}' />
              <span className="hint">{t.jsonHint}</span>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" name="is_public" /> {t.public}
            </label>
            <button className="btn primary" type="submit">
              {t.saveSetting}
            </button>
          </form>
        </div>
      </section>

      {settings.length === 0 ? (
        <div className="empty">
          <span className="icon-tile lavender">
            <Settings2 size={22} />
          </span>
          <h3>{t.noSettings}</h3>
          <p>{t.noSettingsBody}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {settings.map((setting) => (
            <section className="panel" key={setting.key}>
              <div className="panel-head">
                <div>
                  <h3 className="mono" style={{ fontSize: '0.95rem' }}>
                    {setting.key}
                  </h3>
                  <span className="small muted">
                    {setting.description ?? t.noDescription} ·{' '}
                    {fill(t.updatedAt, { date: formatDateTime(setting.updated_at, locale) })}
                  </span>
                </div>
                <span className={`tag ${setting.is_public ? 'mint' : 'neutral'}`}>
                  {setting.is_public ? t.public : t.private}
                </span>
              </div>
              <div className="panel-body">
                <form action={adminSaveSetting} style={{ display: 'grid', gap: 12 }}>
                  <input type="hidden" name="key" value={setting.key} />
                  <div className="field">
                    <label htmlFor={`value-${setting.key}`}>{c.labels.value}</label>
                    <textarea
                      id={`value-${setting.key}`}
                      name="value"
                      defaultValue={settingValue(setting.value)}
                      style={{
                        minHeight: 96,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <label className="checkbox-row">
                      <input type="checkbox" name="is_public" defaultChecked={setting.is_public} /> {t.public}
                    </label>
                    <button className="btn sm primary" type="submit">
                      {c.actions.save}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="callout info">
        <Lock size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.publicWarning}
      </div>
    </div>
  );
}
