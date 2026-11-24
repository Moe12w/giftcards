import Link from 'next/link';
import { ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { Notice, PageHead } from '@/components/ui';
import { adminSaveAdvertisingPaymentSettings } from '@/lib/actions/advertising';
import { MYFATOORAH_SETTINGS_KEY } from '@/lib/myfatoorah';

function mask(secret: string): string {
  if (!secret) return 'Not set';
  return `${'•'.repeat(12)}${secret.slice(-4)}`;
}

export default async function AdminAdvertisingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  const ctx = await requireAdmin();

  const { data: setting } = await ctx.supabase
    .from('system_settings')
    .select('value, updated_at')
    .eq('key', MYFATOORAH_SETTINGS_KEY)
    .maybeSingle();

  const value = (setting?.value ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof value[key] === 'string' ? String(value[key]) : '');
  const apiKey = text('api_key');
  const baseUrl = text('base_url');
  const webhookSecret = text('webhook_secret');
  const appUrl = text('app_public_url');

  const envApiKey = Boolean(process.env.MYFATOORAH_API_KEY);
  const envWebhookSecret = Boolean(process.env.MYFATOORAH_WEBHOOK_SECRET);
  const envAppUrl = process.env.APP_PUBLIC_URL?.trim() ?? '';
  const configured = Boolean(apiKey || envApiKey);
  const webhookConfigured = Boolean(webhookSecret || envWebhookSecret);
  const effectiveAppUrl = (appUrl || envAppUrl).replace(/\/+$/, '');
  const effectiveBaseUrl = baseUrl || process.env.MYFATOORAH_BASE_URL || 'https://apitest.myfatoorah.com';

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/advertising">
        <ArrowLeft size={15} /> Advertising
      </Link>
      <PageHead
        eyebrow="Advertising & promotions"
        title="Payments"
        description="MyFatoorah card payments for advertising checkout. Promotional credit stays available as a separate payment option."
      />
      <Notice
        error={query.error}
        success={query.saved === '1' ? 'Payment settings saved.' : null}
      />

      <div className="pill-row">
        <span className={`tag ${configured ? 'success' : 'warning'}`}>
          {configured ? 'Card payments configured' : 'Card payments not configured'}
        </span>
        <span className={`tag ${webhookConfigured ? 'success' : 'warning'}`}>
          {webhookConfigured ? 'Webhook secret set' : 'Webhook secret missing'}
        </span>
        <span className="tag neutral">{apiKey ? 'Key stored in admin' : envApiKey ? 'Key from environment' : 'No key'}</span>
        {setting?.updated_at ? (
          <span className="small muted">Updated {formatDateTime(setting.updated_at)}</span>
        ) : null}
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <CreditCard size={17} /> MyFatoorah keys
            </h3>
            <span className="small muted">Server-side only</span>
          </div>
          <div className="panel-body">
            <form action={adminSaveAdvertisingPaymentSettings} style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label htmlFor="api_key">API key</label>
                <input
                  id="api_key"
                  name="api_key"
                  type="password"
                  autoComplete="off"
                  placeholder={apiKey ? `${mask(apiKey)} — leave blank to keep` : 'Bearer token from the portal'}
                />
                <span className="hint">
                  MyFatoorah portal → Integration Settings → API Key. Stored in the database, never sent to a browser.
                </span>
              </div>

              <div className="field">
                <label htmlFor="base_url">API base URL</label>
                <input
                  id="base_url"
                  name="base_url"
                  defaultValue={baseUrl}
                  placeholder="https://apitest.myfatoorah.com"
                />
                <span className="hint">
                  Test: <span className="mono">https://apitest.myfatoorah.com</span>. Live: use the Qatar API URL from
                  MyFatoorah&apos;s API Key page (currently{' '}
                  <span className="mono">https://api-qa.myfatoorah.com</span>). Currently effective:{' '}
                  <span className="mono">{effectiveBaseUrl}</span>.
                </span>
              </div>

              <div className="field">
                <label htmlFor="webhook_secret">Webhook secret key</label>
                <input
                  id="webhook_secret"
                  name="webhook_secret"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    webhookSecret ? `${mask(webhookSecret)} — leave blank to keep` : 'Secure key from the webhook settings'
                  }
                />
                <span className="hint">
                  Portal → Webhooks → secure key. Without it the webhook refuses every event, so payments would only be
                  confirmed by the browser return.
                </span>
              </div>

              <div className="field">
                <label htmlFor="app_public_url">App public URL</label>
                <input
                  id="app_public_url"
                  name="app_public_url"
                  defaultValue={appUrl}
                  placeholder="https://tazilla.com.qa"
                />
                <span className="hint">
                  Used to build the callback and webhook URLs. Leave blank to use <span className="mono">APP_PUBLIC_URL</span>.
                </span>
              </div>

              <label className="checkbox-row">
                <input type="checkbox" name="clear_keys" value="on" />
                <span>
                  Remove the saved keys
                  <span className="sub">Environment variables, if any, take over again.</span>
                </span>
              </label>

              <div>
                <button className="btn primary" type="submit">
                  <ShieldCheck size={15} /> Save payment settings
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Where MyFatoorah calls us</h3>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div className="mini-row">
                <span className="small muted">Webhook URL (register in the portal)</span>
                <span className="small mono">
                  {effectiveAppUrl ? `${effectiveAppUrl}/api/advertising/myfatoorah/webhook` : 'Set the app public URL'}
                </span>
              </div>
              <div className="mini-row">
                <span className="small muted">Browser return URL</span>
                <span className="small mono">
                  {effectiveAppUrl
                    ? `${effectiveAppUrl}/api/advertising/myfatoorah/callback`
                    : 'Set the app public URL'}
                </span>
              </div>
            </div>
            <div className="callout info" style={{ marginTop: 12 }}>
              Set the app public URL to the exact origin customers use (HTTPS). MyFatoorah rejects localhost for these
              URLs, and the browser return is only a hint — the payment itself is confirmed server-to-server.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
