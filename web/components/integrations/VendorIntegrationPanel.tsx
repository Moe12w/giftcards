'use client';

import { useActionState } from 'react';

import {
  issueVendorCredential,
  revokeVendorCredential,
  type CredentialIssueState,
} from '@/lib/actions/integration';
import { integrationsCopy } from '@/lib/i18n/integrations';

type Labels = typeof integrationsCopy.en.dashboard;

export interface VendorMappingSummary {
  id: string;
  external_vendor_id: string;
  external_branch_id: string | null;
  status: string;
}

export interface CredentialSummary {
  credential_id: string;
  mapping_id: string | null;
  platform_code: string;
  environment: string;
  label: string;
  key_prefix: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
}

export interface VendorIntegrationPanelProps {
  labels: Labels;
  mappings: VendorMappingSummary[];
  credentials: CredentialSummary[];
  canManage: boolean;
  showMappingSelector?: boolean;
  defaultMappingId?: string | null;
}

const initialState: CredentialIssueState = { status: 'idle' };

export function VendorIntegrationPanel({
  labels,
  mappings,
  credentials,
  canManage,
  showMappingSelector = false,
  defaultMappingId = null,
}: VendorIntegrationPanelProps) {
  const [state, formAction, pending] = useActionState(issueVendorCredential, initialState);
  const activeMappings = mappings.filter((mapping) => mapping.status === 'active');

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{labels.title}</h3>
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
        <p className="small muted">{labels.description}</p>

        {activeMappings.length === 0 ? (
          <div className="callout warn">{labels.noMapping}</div>
        ) : (
          <>
            {canManage ? (
              <form action={formAction} className="form" style={{ display: 'grid', gap: 12 }}>
                {showMappingSelector ? (
                  <div className="field">
                    <label htmlFor="tazella_mapping">{labels.mapping}</label>
                    <select id="tazella_mapping" name="mapping_id" required defaultValue="">
                      <option value="">—</option>
                      {activeMappings.map((mapping) => (
                        <option key={mapping.id} value={mapping.id}>
                          {mapping.external_vendor_id}
                          {mapping.external_branch_id ? ` / ${mapping.external_branch_id}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input type="hidden" name="mapping_id" value={defaultMappingId ?? activeMappings[0]?.id ?? ''} />
                )}
                <div className="field">
                  <label htmlFor="tazella_environment">{labels.environment}</label>
                  <select id="tazella_environment" name="environment" defaultValue="sandbox">
                    <option value="sandbox">{labels.sandbox}</option>
                    <option value="production">{labels.production}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tazella_label">{labels.label}</label>
                  <input
                    id="tazella_label"
                    name="label"
                    maxLength={80}
                    placeholder={labels.labelPlaceholder}
                  />
                </div>
                <button className="btn primary" type="submit" disabled={pending}>
                  {labels.create}
                </button>

                {state.status === 'error' && (
                  <p className="small" style={{ color: 'crimson' }} role="alert">
                    {state.message}
                  </p>
                )}
                {state.status === 'success' && (
                  <div className="callout info" style={{ display: 'grid', gap: 8 }}>
                    <strong>{labels.shownOnce}</strong>
                    <div>
                      <span className="k">{labels.apiKey}</span>
                      <code>{state.apiKey}</code>
                    </div>
                    <div>
                      <span className="k">{labels.signingSecret}</span>
                      <code>{state.signingSecret}</code>
                    </div>
                    <p className="small">{labels.warning}</p>
                  </div>
                )}
              </form>
            ) : (
              <div className="callout info">{labels.needPermission}</div>
            )}

            <h4>{labels.credentials}</h4>
            {credentials.length === 0 ? (
              <p className="small muted">{labels.noCredentials}</p>
            ) : (
              <div className="split-list">
                {credentials.map((credential) => (
                  <div key={credential.credential_id}>
                    <span className="k">
                      {credential.platform_code} · {credential.environment} · {credential.key_prefix}
                    </span>
                    <span className="v">
                      {credential.label} ·{' '}
                      {credential.status === 'active' ? labels.active : labels.revoked} ·{' '}
                      {labels.lastUsed}:{' '}
                      {credential.last_used_at
                        ? credential.last_used_at.slice(0, 10)
                        : labels.never}
                      {canManage && credential.status === 'active' && (
                        <form
                          action={revokeVendorCredential}
                          style={{ display: 'inline', marginInlineStart: 8 }}
                        >
                          <input type="hidden" name="credential_id" value={credential.credential_id} />
                          <button className="btn sm" type="submit">
                            {labels.revoke}
                          </button>
                        </form>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
