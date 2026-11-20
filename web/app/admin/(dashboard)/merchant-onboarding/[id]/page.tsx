import Link from 'next/link';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import {
  adminAddMerchantNote,
  adminReviewMerchantApplication,
  adminReviewMerchantDocument,
} from '@/lib/actions/admin-merchant';
import {
  MERCHANT_DOC_COPY,
  PAYMENT_METHOD_LABELS,
  requiredDocKeys,
  type MerchantApplication,
  type MerchantDocument,
  type MerchantSignature,
} from '@/lib/merchant';
import { formatDate } from '@/lib/format';

interface SignatureRow extends MerchantSignature {
  ip_address: string | null;
  user_agent: string | null;
  content_sha256: string | null;
  merchant_agreements: { version: string; title: string } | null;
}

interface EventRow {
  id: number;
  kind: string;
  note: string | null;
  actor_role: string | null;
  created_at: string;
}

const DECISIONS = [
  { key: 'under_review', label: 'Mark under review' },
  { key: 'additional_information_required', label: 'Request more information' },
  { key: 'approved', label: 'Approve application' },
  { key: 'rejected', label: 'Reject application' },
  { key: 'active', label: 'Activate payments' },
];

export default async function AdminMerchantApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reviewed?: string; decided?: string; noted?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireAdmin();

  const [applicationResult, documentsResult, signaturesResult, eventsResult] = await Promise.all([
    ctx.supabase
      .from('merchant_applications')
      .select('*, vendors(id, name, slug), enterprise_partners(id, name, slug)')
      .eq('id', id)
      .maybeSingle(),
    ctx.supabase
      .from('merchant_application_documents')
      .select('*')
      .eq('application_id', id)
      .order('doc_type', { ascending: true }),
    ctx.supabase
      .from('merchant_agreement_signatures')
      .select('*, merchant_agreements(version, title)')
      .eq('application_id', id)
      .order('signed_at', { ascending: false }),
    ctx.supabase
      .from('merchant_application_events')
      .select('id, kind, note, actor_role, created_at')
      .eq('application_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const application = applicationResult.data as
    | (MerchantApplication & {
        vendors: { id: string; name: string; slug: string | null } | null;
        enterprise_partners: { id: string; name: string; slug: string | null } | null;
      })
    | null;

  if (!application) {
    return (
      <div className="dash-content">
        <PageHead eyebrow="Merchant onboarding" title="Application not found" />
        <Link className="btn" href="/admin/merchant-onboarding">
          <ArrowLeft size={15} /> Back to applications
        </Link>
      </div>
    );
  }

  const documents = (documentsResult.data ?? []) as MerchantDocument[];
  const signatures = (signaturesResult.data ?? []) as unknown as SignatureRow[];
  const events = (eventsResult.data ?? []) as EventRow[];
  const required = requiredDocKeys(application.business_type);
  const owner = application.vendors?.name ?? application.enterprise_partners?.name ?? '—';
  const canDecide = ['submitted', 'under_review', 'additional_information_required', 'approved'].includes(
    application.status,
  );

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Merchant onboarding"
        title={application.business_name ?? owner}
        description={`${application.owner_type === 'vendor' ? 'Vendor' : 'Enterprise'} · ${owner} · application ${application.id.slice(0, 8)}`}
        actions={
          <>
            {application.partner_id ? (
              <Link className="btn sm" href={`/admin/enterprise/${application.partner_id}`}>
                Manage partner supplier
              </Link>
            ) : null}
            <Link className="btn sm ghost" href="/admin/merchant-onboarding">
              <ArrowLeft size={14} /> All applications
            </Link>
          </>
        }
      />

      <Notice
        error={query.error}
        success={
          query.reviewed === '1'
            ? 'Document review saved.'
            : query.decided === '1'
              ? 'Application decision saved.'
              : query.noted === '1'
                ? 'Note added.'
                : null
        }
      />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Application</h3>
            <StatusTag status={application.status} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">Business type</span>
                <span className="v">
                  {application.business_type === 'company'
                    ? 'Company / corporate'
                    : application.business_type === 'home'
                      ? 'Home business / independent'
                      : '—'}
                </span>
              </div>
              <div>
                <span className="k">Representative</span>
                <span className="v">
                  {application.contact_name ?? '—'}
                  {application.contact_role ? ` · ${application.contact_role}` : ''}
                </span>
              </div>
              <div>
                <span className="k">Email / mobile</span>
                <span className="v small">
                  {application.business_email ?? '—'} · {application.business_phone ?? '—'}
                </span>
              </div>
              {application.cr_number ? (
                <div>
                  <span className="k">CR number</span>
                  <span className="v">{application.cr_number}</span>
                </div>
              ) : null}
              <div>
                <span className="k">Payment methods</span>
                <span className="v small">
                  {application.payment_methods.length > 0
                    ? application.payment_methods.map((key) => PAYMENT_METHOD_LABELS[key] ?? key).join(', ')
                    : 'None selected'}
                </span>
              </div>
              <div>
                <span className="k">Bank</span>
                <span className="v small">
                  {application.bank_name ?? '—'} · {application.bank_account_name ?? '—'}
                  {application.bank_iban ? ` · ${application.bank_iban}` : ''}
                </span>
              </div>
              <div>
                <span className="k">Submitted</span>
                <span className="v small">
                  {application.submitted_at ? formatDate(application.submitted_at) : 'Not submitted'}
                </span>
              </div>
              <div>
                <span className="k">Last updated</span>
                <span className="v small">{formatDate(application.updated_at)}</span>
              </div>
            </div>

            {application.decision_note ? (
              <div className="callout info" style={{ marginTop: 14 }}>
                <strong>Last note:</strong> {application.decision_note}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Decision</h3>
          </div>
          <div className="panel-body">
            {canDecide ? (
              <form action={adminReviewMerchantApplication} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="application_id" value={application.id} />
                <div className="field">
                  <label htmlFor="status">New status</label>
                  <select id="status" name="status" defaultValue="under_review">
                    {DECISIONS.map((decision) => (
                      <option key={decision.key} value={decision.key}>
                        {decision.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="note">Note to the merchant</label>
                  <textarea id="note" name="note" placeholder="Required when rejecting. Shared with the merchant." />
                </div>
                <div className="btn-row">
                  <button className="btn primary" type="submit">
                    Save decision
                  </button>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Activation only follows after MyFatoorah approves the merchant account. This never happens
                  automatically.
                </p>
              </form>
            ) : (
              <p className="small muted">
                This application is {application.status.replace(/_/g, ' ')}. Decisions are closed.
              </p>
            )}

            <div style={{ marginTop: 18 }}>
              <h4 style={{ marginBottom: 8 }}>Internal note</h4>
              <form action={adminAddMerchantNote} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="application_id" value={application.id} />
                <textarea name="note" required placeholder="Visible to admins only." />
                <div className="btn-row">
                  <button className="btn sm" type="submit">
                    Add note
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Documents</h3>
          <span className="tag neutral">
            {documents.filter((doc) => required.includes(doc.doc_type)).length}/{required.length}
          </span>
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
          {!application.business_type ? (
            <p className="small muted">The merchant has not chosen a business type yet.</p>
          ) : null}
          {required.map((key) => {
            const document = documents.find((doc) => doc.doc_type === key) ?? null;
            const copy = MERCHANT_DOC_COPY[key];
            return (
              <div key={key} className="panel" style={{ padding: 14, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{copy?.label ?? key.replace(/_/g, ' ')}</strong>
                    <div className="small muted">{document ? document.file_name : 'Not uploaded'}</div>
                  </div>
                  {document ? <StatusTag status={document.status} /> : <span className="tag neutral">Missing</span>}
                </div>

                {document ? (
                  <>
                    {document.rejection_reason ? (
                      <span className="small" style={{ color: 'var(--danger)' }}>
                        Reason: {document.rejection_reason}
                      </span>
                    ) : null}
                    <div className="btn-row">
                      <a
                        className="btn sm ghost"
                        href={`/api/merchant-documents/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={14} /> Preview
                      </a>
                      <a className="btn sm ghost" href={`/api/merchant-documents/${document.id}`} download>
                        <Download size={14} /> Download
                      </a>
                    </div>
                    <form action={adminReviewMerchantDocument} style={{ display: 'grid', gap: 8 }}>
                      <input type="hidden" name="document_id" value={document.id} />
                      <input type="hidden" name="application_id" value={application.id} />
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor={`status-${document.id}`}>Review status</label>
                          <select id={`status-${document.id}`} name="status" defaultValue="approved">
                            <option value="pending_review">Pending review</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="replacement_required">Replacement required</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`reason-${document.id}`}>Reason</label>
                          <input
                            id={`reason-${document.id}`}
                            name="reason"
                            placeholder="Required when rejecting or requesting a replacement"
                          />
                        </div>
                      </div>
                      <div className="btn-row">
                        <button className="btn sm" type="submit">
                          Save review
                        </button>
                      </div>
                    </form>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Signed agreements</h3>
          <span className="tag neutral">{signatures.length}</span>
        </div>
        <div className="panel-body">
          {signatures.length === 0 ? (
            <p className="small muted">No agreement has been signed yet.</p>
          ) : (
            <div className="split-list">
              {signatures.map((signature) => (
                <div key={signature.id}>
                  <span className="k">
                    <strong>{signature.agreement_version}</strong> · {signature.signatory_name} ({signature.signatory_role})
                  </span>
                  <span className="v small">
                    {formatDate(signature.signed_at)}
                    {signature.ip_address ? ` · ${signature.ip_address}` : ''}{' '}
                    <a
                      className="small"
                      style={{ textDecoration: 'underline' }}
                      href={`/api/merchant-agreements/${signature.agreement_id}/signed?signature=${signature.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download signed PDF
                    </a>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>History</h3>
        </div>
        <div className="panel-body">
          {events.length === 0 ? (
            <p className="small muted">No activity yet.</p>
          ) : (
            <div className="timeline">
              {events.map((event) => (
                <div className="timeline-item" key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{event.kind.replace(/_/g, ' ')}</strong>
                    <span>
                      {formatDate(event.created_at)}
                      {event.actor_role ? ` · ${event.actor_role}` : ''}
                      {event.note ? ` · ${event.note}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
