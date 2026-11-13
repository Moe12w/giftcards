import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { adminSaveAdvertisingRule } from '@/lib/actions/advertising';

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export default async function AdminAdvertisingRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();

  const { data: rules, error } = await ctx.supabase
    .from('advertising_rules')
    .select('*')
    .order('key', { ascending: true });

  const rows = rules ?? [];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Advertising rules"
        description="Approval, activation, attribution, frequency caps and auto-renew are all controlled here. Changes apply to future evaluations without an app release."
      />
      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Rule saved.' : null} />

      <section className="panel">
        <div className="panel-head">
          <h3>{rows.length} rules</h3>
          <span className="small muted">Stored as typed JSON values</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Value</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((rule: any) => (
                  <tr key={rule.id}>
                    <td>
                      <span className="strong">{rule.name}</span>
                      <div className="sub mono">{rule.key}</div>
                      {rule.description ? <div className="sub">{rule.description}</div> : null}
                    </td>
                    <td>
                      <span className="tag neutral mono">{displayValue(rule.value)}</span>
                    </td>
                    <td className="small">{rule.value_type}</td>
                    <td><StatusTag status={rule.is_active ? 'active' : 'archived'} /></td>
                    <td className="small muted">{formatDateTime(rule.updated_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <a className="btn sm ghost" href={`#rule-${rule.key}`}>Edit</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        {rows.map((rule: any) => (
          <section className="panel" id={`rule-${rule.key}`} key={rule.id}>
            <div className="panel-head">
              <h3>{rule.name}</h3>
              <StatusTag status={rule.is_active ? 'active' : 'archived'} />
            </div>
            <div className="panel-body">
              <form action={adminSaveAdvertisingRule} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="key" value={rule.key} />
                <input type="hidden" name="value_type" value={rule.value_type} />
                <div className="field">
                  <label htmlFor={`name-${rule.key}`}>Name</label>
                  <input id={`name-${rule.key}`} name="name" defaultValue={rule.name} required />
                </div>
                <div className="field">
                  <label htmlFor={`value-${rule.key}`}>Value</label>
                  <input
                    id={`value-${rule.key}`}
                    name="value"
                    defaultValue={displayValue(rule.value)}
                    required
                    className="mono"
                  />
                  <span className="hint">
                    {rule.value_type === 'boolean'
                      ? 'true or false'
                      : rule.value_type === 'integer'
                        ? 'Whole number'
                        : rule.value_type === 'number'
                          ? 'Number'
                          : 'JSON value'}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor={`description-${rule.key}`}>Description</label>
                  <input id={`description-${rule.key}`} name="description" defaultValue={rule.description ?? ''} />
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" name="is_active" defaultChecked={rule.is_active} />
                  Active
                </label>
                <button className="btn primary" type="submit">Save rule</button>
              </form>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
