import Link from 'next/link';
import { StatusTag } from '@/components/ui';
import type { Locale } from '@/lib/i18n';
import { formatDateTime } from '@/lib/format';

export interface SupplierPanelDocument {
  id: string;
  doc_type: string;
  status: string;
  myfatoorah_file_type: number | null;
  provider_submission_status: string | null;
}

export interface SupplierPanelProps {
  ownerType: 'vendor' | 'partner';
  ownerId: string;
  applicationStatus: string | null;
  applicationId?: string | null;
  supplier: {
    code: string | null;
    status: string | null;
    platformStatus: string;
    depositTerms: string | null;
    commissionPercentage: number | null;
    lastSyncedAt: string | null;
    rejectionComment: string | null;
    lastError: string | null;
    eligibility: boolean;
  };
  documents: SupplierPanelDocument[];
  actions: {
    create: (formData: FormData) => void | Promise<void>;
    sync: (formData: FormData) => void | Promise<void>;
    setEligibility: (formData: FormData) => void | Promise<void>;
    resubmitDocument: (formData: FormData) => void | Promise<void>;
  };
  locale: Locale;
}

/** One supplier panel used by both vendor and enterprise admin detail pages. */
export function AdminSupplierPanel({
  ownerType,
  ownerId,
  applicationStatus,
  applicationId,
  supplier,
  documents,
  actions,
  locale,
}: SupplierPanelProps) {
  const idField = ownerType === 'vendor' ? 'vendor_id' : 'partner_id';
  const status = supplier.status
    ? supplier.status === 'active'
      ? 'approved'
      : supplier.status === 'rejected'
        ? 'rejected'
        : 'pending'
    : 'not_started';

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>MyFatoorah payment management</h3>
        <StatusTag status={status} />
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
        <div className="split-list">
          <div>
            <span className="k">Payment application</span>
            <span className="v">{applicationStatus ?? 'Not started'}</span>
          </div>
          <div>
            <span className="k">Supplier code</span>
            <span className="v mono">{supplier.code ?? 'Not created'}</span>
          </div>
          <div>
            <span className="k">Provider status</span>
            <span className="v">{supplier.status ?? 'Not created'}</span>
          </div>
          <div>
            <span className="k">{ownerType === 'vendor' ? 'Vendor' : 'Partner'} status</span>
            <span className="v">{supplier.platformStatus}</span>
          </div>
          <div>
            <span className="k">Deposit terms</span>
            <span className="v">{supplier.depositTerms ?? 'Provider-managed'}</span>
          </div>
          <div>
            <span className="k">Provider commission</span>
            <span className="v">
              {supplier.commissionPercentage != null ? `${supplier.commissionPercentage}%` : 'Provider-managed'}
            </span>
          </div>
          <div>
            <span className="k">Last synchronised</span>
            <span className="v">
              {supplier.lastSyncedAt ? formatDateTime(supplier.lastSyncedAt, locale) : 'Never'}
            </span>
          </div>
          <div>
            <span className="k">Live payments</span>
            <span className="v">
              {supplier.eligibility ? <span className="tag success">Enabled</span> : <span className="tag neutral">Disabled</span>}
            </span>
          </div>
        </div>

        {supplier.rejectionComment ? (
          <div className="callout error">MyFatoorah rejection: {supplier.rejectionComment}</div>
        ) : null}
        {supplier.lastError ? <div className="callout warn">Last provider error: {supplier.lastError}</div> : null}

        <div className="btn-row">
          {!supplier.code ? (
            <form action={actions.create}>
              <input type="hidden" name={idField} value={ownerId} />
              <button className="btn sm primary" type="submit">
                Create MyFatoorah supplier
              </button>
            </form>
          ) : null}
          <form action={actions.sync}>
            <input type="hidden" name={idField} value={ownerId} />
            <button className="btn sm ghost" type="submit">
              Sync provider status
            </button>
          </form>
          <form action={actions.setEligibility}>
            <input type="hidden" name={idField} value={ownerId} />
            <input type="hidden" name="eligible" value={supplier.eligibility ? 'false' : 'true'} />
            <input
              type="hidden"
              name="note"
              value={supplier.eligibility ? 'Disabled by administrator' : 'Enabled by administrator'}
            />
            <button className="btn sm" type="submit">
              {supplier.eligibility ? 'Disable live payments' : 'Enable live payments'}
            </button>
          </form>
          {applicationId ? (
            <Link className="btn sm ghost" href={`/admin/merchant-onboarding/${applicationId}`}>
              Review application
            </Link>
          ) : null}
        </div>

        {documents.length > 0 ? (
          <div className="split-list">
            {documents.map((document) => (
              <div key={document.id}>
                <span className="k">{document.doc_type.replace(/_/g, ' ')}</span>
                <span className="v small" style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                  <StatusTag status={document.status} />
                  <span className="muted">
                    {document.provider_submission_status === 'submitted'
                      ? `Sent to MyFatoorah · FileType ${document.myfatoorah_file_type ?? '—'}`
                      : document.provider_submission_status === 'failed'
                        ? 'Provider submission failed'
                        : 'Not sent to provider'}
                  </span>
                  {document.provider_submission_status !== 'submitted' && supplier.code ? (
                    <form action={actions.resubmitDocument}>
                      <input type="hidden" name={idField} value={ownerId} />
                      <input type="hidden" name="document_id" value={document.id} />
                      <button className="btn sm ghost" type="submit">
                        Submit to MyFatoorah
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
