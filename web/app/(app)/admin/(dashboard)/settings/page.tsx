import { Globe, Lock, Mail, Plus, Save, Send, Settings2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import {
  adminSaveEmailSettings,
  adminSaveSetting,
  adminSendQueuedEmails,
  adminSendTestEmail,
} from '@/lib/actions/admin';
import { emailKeyHint, getEmailConfig } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';
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
  searchParams: Promise<{
    saved?: string;
    error?: string;
    sent?: string;
    failed?: string;
    tested?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).settings;
  const c = pick(common, locale);
  const config = await getEmailConfig();
  const keyHint = await emailKeyHint();
  const providerReady = Boolean(config.apiKey);

  // The outbox is written by the bulk gift flow and is only readable with the
  // service role, so this panel reports the counts and lets an admin push the
  // backlog out after a provider is added.
  let queue = { queued: 0, sent: 0, failed: 0 };
  let queueUnavailable = false;
  try {
    const admin = createAdminClient();
    const [queuedResult, sentResult, failedResult] = await Promise.all([
      admin.from('bulk_email_outbox').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
      admin.from('bulk_email_outbox').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
      admin.from('bulk_email_outbox').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ]);
    queue = {
      queued: queuedResult.count ?? 0,
      sent: sentResult.count ?? 0,
      failed: failedResult.count ?? 0,
    };
  } catch {
    queueUnavailable = true;
  }

  const { data, error } = await ctx.supabase
    .from('system_settings')
    .select('*')
    .order('key', { ascending: true });

  const settings = data ?? [];

  // Rows that hold a secret are never rendered back into the page. The email
  // provider key and the enterprise encryption key both live here; they are
  // edited through their own forms, never as plain text in a list.
  const secretKeyPattern = /(^|[._-])(key|secret|token|password)([._-]|$)/i;
  const secretSettings = settings.filter((setting) => secretKeyPattern.test(setting.key));
  const visibleSettings = settings.filter((setting) => !secretKeyPattern.test(setting.key));
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

      <Notice
        error={params.error ?? error?.message}
        success={
          params.saved === '1'
            ? t.saved
            : params.tested
              ? fill(t.emailTestSent, { email: params.tested })
              : params.sent !== undefined || params.failed !== undefined
                ? fill(t.emailRetryDone, { sent: params.sent ?? '0', failed: params.failed ?? '0' })
                : null
        }
      />

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

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <h3>
            <Mail size={16} /> {t.emailTitle}
          </h3>
          <span className={`tag ${providerReady ? 'mint' : 'neutral'}`}>
            {providerReady ? t.emailOn : t.emailOff}
          </span>
        </div>
        <div className="panel-body">
          <p className="small muted">{providerReady ? t.emailOnBody : t.emailOffBody}</p>
          <p className="small muted" style={{ marginTop: 6 }}>
            {config.source === 'database'
              ? t.emailSourceDashboard
              : config.source === 'environment'
                ? t.emailSourceEnvironment
                : t.emailSourceNone}
          </p>

          <form action={adminSaveEmailSettings} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <div className="field">
              <label htmlFor="email_api_key">{t.emailApiKey}</label>
              <input
                id="email_api_key"
                name="api_key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={keyHint ? fill(t.emailApiKeySaved, { hint: keyHint }) : 're_…'}
              />
              <span className="small muted">{t.emailApiKeyHint}</span>
            </div>
            <div className="field">
              <label htmlFor="email_from">{t.emailFromLabel}</label>
              <input id="email_from" name="from" defaultValue={config.from} />
              <span className="small muted">{t.emailFromHint}</span>
            </div>
            {keyHint ? (
              <label className="checkbox-row">
                <input type="checkbox" name="remove_key" /> {t.emailRemoveKey}
              </label>
            ) : null}
            <div className="btn-row">
              <button className="btn sm primary" type="submit">
                <Save size={15} /> {c.actions.save}
              </button>
            </div>
          </form>

          <form action={adminSendTestEmail} className="inline-form" style={{ marginTop: 14 }}>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label htmlFor="email_test_to">{t.emailTestTo}</label>
              <input id="email_test_to" name="to" type="email" placeholder={ctx.user.email ?? ''} />
            </div>
            <button className="btn sm ghost" type="submit" disabled={!providerReady}>
              <Send size={15} /> {t.emailSendTest}
            </button>
          </form>

          <div className="kpi-grid" style={{ marginTop: 14 }}>
            <div className="kpi">
              <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
                <Mail size={17} />
              </span>
              <strong>{queue.queued}</strong>
              <span>{t.emailQueued}</span>
            </div>
            <div className="kpi">
              <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
                <Send size={17} />
              </span>
              <strong>{queue.sent}</strong>
              <span>{t.emailSent}</span>
            </div>
            <div className="kpi">
              <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
                <Mail size={17} />
              </span>
              <strong>{queue.failed}</strong>
              <span>{t.emailFailed}</span>
            </div>
          </div>

          {queueUnavailable ? <div className="callout warn" style={{ marginTop: 12 }}>{t.emailQueueUnavailable}</div> : null}

          <form action={adminSendQueuedEmails} style={{ marginTop: 14 }}>
            <button
              className="btn sm primary"
              type="submit"
              disabled={!providerReady || queue.queued === 0}
            >
              <Send size={15} /> {fill(t.emailRetry, { count: queue.queued })}
            </button>
          </form>
        </div>
      </section>

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
              <input id="value" name="value" placeholder='hello@tazella.com.qa or {"enabled":true}' />
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

      {visibleSettings.length === 0 && secretSettings.length === 0 ? (
        <div className="empty">
          <span className="icon-tile lavender">
            <Settings2 size={22} />
          </span>
          <h3>{t.noSettings}</h3>
          <p>{t.noSettingsBody}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {visibleSettings.map((setting) => (
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

      {secretSettings.length > 0 ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h3>
              <Lock size={16} /> {t.secretSettings}
            </h3>
          </div>
          <div className="panel-body">
            <p className="small muted">{t.secretSettingsBody}</p>
            <ul style={{ margin: '10px 0 0', paddingInlineStart: 18 }}>
              {secretSettings.map((setting) => (
                <li key={setting.key} className="small mono">
                  {setting.key} ·{' '}
                  {fill(t.secretUpdated, { date: formatDateTime(setting.updated_at, locale) })}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <div className="callout info">
        <Lock size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.publicWarning}
      </div>
    </div>
  );
}
