import Link from 'next/link';
import { CheckCircle2, Circle, ExternalLink, RefreshCw } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { Notice, PageHead } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { GIFT_PAYMENTS_SETTINGS_KEY, getPaymentMyFatoorahConfig } from '@/lib/myfatoorah';
import {
  adminProcessMyFatoorahRefund,
  adminSavePaymentProviderSettings,
  adminTestPaymentProviderConnectionForm,
} from '@/lib/actions/admin-payments';
import { adminSyncMyFatoorahSuppliers as syncSuppliers } from '@/lib/actions/admin-supplier';
import { CopyField } from '@/components/CopyField';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    test?: string;
    detail?: string;
    refund?: string;
  }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const config = await getPaymentMyFatoorahConfig();

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data: savedSetting } = await admin
    .from('system_settings')
    .select('value, updated_at')
    .eq('key', GIFT_PAYMENTS_SETTINGS_KEY)
    .maybeSingle();

  const [paymentsResult, refundsResult] = await Promise.all([
    admin
      .from('myfatoorah_payments')
      .select('id, order_id, invoice_id, payment_id, amount_minor, payment_status, created_at, paid_at, supplier_code, orders(order_ref)')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('myfatoorah_refunds')
      .select('id, order_id, amount_minor, status, refund_reference, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const payments = paymentsResult.data ?? [];
  const refunds = refundsResult.data ?? [];
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
  const callbackUrl = `${config.appPublicUrl}/api/merchant-payment/callback`;

  const setupSteps = [
    {
      label: 'API key and environment saved',
      done: config.apiKey.length > 0,
    },
    {
      label: 'Webhook secret saved (must match the MyFatoorah portal)',
      done: config.webhookSecret.length > 0,
    },
    {
      label: 'Public app URL saved for return URLs',
      done: config.appPublicUrl.length > 0,
    },
    {
      label: 'Connection test passed',
      done: query.test === 'ok',
    },
  ];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Platform administration"
        title="Payment management"
        description="MyFatoorah supplier keys, webhooks, gift-card payments and refunds."
      />

      <Notice
        error={query.error}
        success={
          query.saved === '1'
            ? 'Payment provider settings saved.'
            : query.refund === '1'
              ? 'Refund request recorded. MyFatoorah will confirm the final status by webhook.'
              : null
        }
      />
      {query.test ? (
        <div className={`callout ${query.test === 'ok' ? 'info' : 'warn'}`}>
          Connection test: {query.detail ?? (query.test === 'ok' ? 'OK' : 'Failed')}
        </div>
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>MyFatoorah configuration</h3>
            <span className={`tag ${config.apiKey ? 'success' : 'danger'}`}>
              {config.apiKey ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div className="panel-body">
            <form action={adminSavePaymentProviderSettings} className="form" style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label htmlFor="api_key">API key</label>
                <input
                  id="api_key"
                  name="api_key"
                  type="password"
                  autoComplete="off"
                  placeholder={config.apiKey ? 'Saved — leave blank to keep' : 'Paste the MyFatoorah token'}
                />
              </div>
              <div className="field">
                <label htmlFor="base_url">API base URL</label>
                <input
                  id="base_url"
                  name="base_url"
                  defaultValue={config.baseUrl}
                  placeholder="https://apitest.myfatoorah.com"
                />
                <span className="hint">
                  Test: https://apitest.myfatoorah.com · Live Qatar: https://api-qa.myfatoorah.com
                </span>
              </div>
              <div className="field">
                <label htmlFor="webhook_secret">Webhook secret</label>
                <input
                  id="webhook_secret"
                  name="webhook_secret"
                  type="password"
                  autoComplete="off"
                  placeholder={config.webhookSecret ? 'Saved — leave blank to keep' : 'Secret from the portal'}
                />
              </div>
              <div className="field">
                <label htmlFor="app_public_url">Public app URL</label>
                <input
                  id="app_public_url"
                  name="app_public_url"
                  defaultValue={config.appPublicUrl}
                  placeholder="https://giftly.qa"
                />
                <span className="hint">Used for payment return and error URLs.</span>
              </div>
              <div className="btn-row">
                <button className="btn primary" type="submit">
                  Save configuration
                </button>
                <button className="btn ghost" type="submit" formAction={adminTestPaymentProviderConnectionForm}>
                  <RefreshCw size={15} /> Test connection
                </button>
                <button className="btn ghost" type="submit" formAction={syncSuppliers}>
                  Sync supplier statuses
                </button>
              </div>
            </form>
            <p className="small muted" style={{ marginTop: 12 }}>
              {config.source === 'database'
                ? `Active key source: admin settings${savedSetting?.updated_at ? ` · updated ${formatDateTime(savedSetting.updated_at)}` : ''}.`
                : config.source === 'environment'
                  ? 'Active key source: environment secrets. Save a key above to manage it here.'
                  : 'No key is configured yet.'}
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Webhook &amp; return URLs</h3>
            <StatusIcon done={config.webhookSecret.length > 0 && config.appPublicUrl.length > 0} />
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            <div className="field">
              <label>Webhook URL (paste into MyFatoorah)</label>
              <CopyField value={webhookUrl} />
            </div>
            <div className="field">
              <label>Return / callback URL</label>
              <CopyField value={callbackUrl} />
            </div>
            <div className="callout info">
              In the MyFatoorah portal, open Integration Settings → Webhook Settings, enable v2 webhooks, paste the
              URL above, enable <strong>PAYMENT_STATUS_CHANGED</strong>, <strong>SUPPLIER_STATUS_CHANGED</strong> and{' '}
              <strong>REFUND_STATUS_CHANGED</strong>, and use the exact same webhook secret saved on this page.
            </div>
            <div className="callout warn">
              Commission and deposit terms are provider-managed. Do not set a supplier commission in MyFatoorah
              expecting Giftly to deduct it again — this integration records provider values only.
            </div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Setup checklist</h3>
          <span className="tag neutral">
            {setupSteps.filter((step) => step.done).length}/{setupSteps.length}
          </span>
        </div>
        <div className="panel-body">
          <div className="split-list">
            {setupSteps.map((step) => (
              <div key={step.label}>
                <span className="k">
                  <StatusIcon done={step.done} /> {step.label}
                </span>
                <span className="v small">{step.done ? 'Done' : 'Pending'}</span>
              </div>
            ))}
          </div>
          <div className="callout info" style={{ marginTop: 14 }}>
            Deploy the Edge Functions before going live:{' '}
            <code>supabase functions deploy supplier-onboard upload-supplier-document sync-myfatoorah-suppliers create-payment create-bulk-payment payment-webhook</code>.
            The payment webhook must be deployed with JWT verification disabled.
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Link className="btn sm ghost" href="/admin/merchant-onboarding">
              Review merchant applications <ExternalLink size={14} />
            </Link>
            <Link className="btn sm ghost" href="/admin/vendors">
              Vendor payment management
            </Link>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Recent payments</h3>
          <span className="tag neutral">{payments.length}</span>
        </div>
        <div className="panel-body">
          {payments.length === 0 ? (
            <p className="small muted">No MyFatoorah gift-card payments yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Invoice</th>
                    <th>Supplier</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const order = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
                    return (
                      <tr key={payment.id}>
                        <td>{order?.order_ref ?? payment.order_id}</td>
                        <td className="mono">{payment.invoice_id}</td>
                        <td className="mono">{payment.supplier_code ?? '—'}</td>
                        <td>QAR {((payment.amount_minor ?? 0) / 100).toFixed(2)}</td>
                        <td>{payment.payment_status}</td>
                        <td>{formatDateTime(payment.created_at)}</td>
                        <td>
                          {payment.payment_status === 'paid' ? (
                            <form action={adminProcessMyFatoorahRefund}>
                              <input type="hidden" name="order_id" value={payment.order_id} />
                              <input type="hidden" name="amount_minor" value={payment.amount_minor} />
                              <button className="btn sm ghost" type="submit">
                                Refund
                              </button>
                            </form>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {refunds.length > 0 ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <h3>Recent refunds</h3>
            <span className="tag neutral">{refunds.length}</span>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Order</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => (
                    <tr key={refund.id}>
                      <td className="mono">{refund.refund_reference ?? '—'}</td>
                      <td>{refund.order_id}</td>
                      <td>QAR {((refund.amount_minor ?? 0) / 100).toFixed(2)}</td>
                      <td>{refund.status}</td>
                      <td>{formatDateTime(refund.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatusIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 size={16} color="var(--success)" />
  ) : (
    <Circle size={16} />
  );
}
