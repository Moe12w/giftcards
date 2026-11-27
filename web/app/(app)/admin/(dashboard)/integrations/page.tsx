import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import {
  resolveReconciliationCase,
  setPlatformStatus,
} from '@/lib/actions/integration';
import { PageHead } from '@/components/ui';
import { VendorIntegrationPanel } from '@/components/integrations/VendorIntegrationPanel';
import { integrationsCopy } from '@/lib/i18n/integrations';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminIntegrationsPage() {
  await requireAdmin();
  const locale = await getUserLocale();
  const labels = pick(integrationsCopy, locale).dashboard;
  const admin = createAdminClient();

  const [platforms, mappings, credentials, reservations, cases] = await Promise.all([
    admin
      .from('integration_platforms')
      .select('id, code, name, status, capabilities, updated_at')
      .order('code'),
    admin
      .from('integration_vendor_connections')
      .select('mapping_id, platform_code, mapping_status, external_vendor_id, external_branch_id, vendor_name')
      .order('mapping_id'),
    admin.rpc('integration_admin_list_credentials'),
    admin
      .from('integration_reservations')
      .select('reference, status, amount_minor, currency, external_order_id, expires_at')
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('integration_reconciliation_cases')
      .select('id, reason, status, external_order_id, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={labels.eyebrow}
        title="Integrations"
        description="External platform credentials, verified mappings and payment lifecycle review."
      />

      <div className="dash-grid">
        <VendorIntegrationPanel
          labels={labels}
          mappings={(mappings.data ?? []).map((row) => ({
            id: String(row.mapping_id),
            external_vendor_id: String(row.external_vendor_id),
            external_branch_id: row.external_branch_id ? String(row.external_branch_id) : null,
            status: String(row.mapping_status),
          }))}
          credentials={(credentials.data ?? []) as Array<{
            credential_id: string;
            mapping_id: string | null;
            platform_code: string;
            environment: string;
            label: string;
            key_prefix: string;
            status: string;
            last_used_at: string | null;
            created_at: string;
          }>}
          canManage
          showMappingSelector
          scope="admin"
        />

        <section className="panel">
          <div className="panel-head">
            <h3>Platforms</h3>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(platforms.data ?? []).map((platform) => (
                  <tr key={platform.id}>
                    <td>{platform.code}</td>
                    <td>{platform.name}</td>
                    <td>{platform.status}</td>
                    <td>{platform.updated_at?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <form action={setPlatformStatus} className="inline-form">
                        <input type="hidden" name="platform_code" value={platform.code} />
                        <select name="status" defaultValue={platform.status}>
                          <option value="draft">draft</option>
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="retired">retired</option>
                        </select>
                        <button className="btn sm" type="submit">Set</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Recent reservations</h3>
          </div>
          <div className="panel-body">
            {!reservations.data?.length ? (
              <p className="small muted">No reservations yet.</p>
            ) : (
              <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.data.map((reservation) => (
                    <tr key={reservation.reference}>
                      <td>{reservation.reference}</td>
                      <td>{reservation.status}</td>
                      <td>
                        {Number(reservation.amount_minor)} {reservation.currency}
                      </td>
                      <td>{reservation.external_order_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Open reconciliation cases</h3>
          </div>
          <div className="panel-body">
            {!cases.data?.length ? (
              <p className="small muted">No open cases.</p>
            ) : (
              <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Reason</th>
                    <th>Created</th>
                    <th>Resolve</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.external_order_id ?? '—'}</td>
                      <td>{item.reason}</td>
                      <td>{item.created_at?.slice(0, 10) ?? '—'}</td>
                      <td>
                        <form action={resolveReconciliationCase} className="inline-form">
                          <input type="hidden" name="case_id" value={item.id} />
                          <select name="resolution" defaultValue="resolved_released">
                            <option value="resolved_captured">captured</option>
                            <option value="resolved_released">released</option>
                            <option value="resolved_refunded">refunded</option>
                            <option value="ignored">ignored</option>
                          </select>
                          <button className="btn sm" type="submit">Resolve</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
