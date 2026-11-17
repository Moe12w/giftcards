import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, FileText, ShieldCheck } from 'lucide-react';
import { StatusTag } from '@/components/ui';
import { formatDate } from '@/lib/format';
import {
  MERCHANT_DOC_COPY,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  merchantProgress,
  requiredDocKeys,
} from '@/lib/merchant';
import type { MerchantBundle } from '@/lib/merchant-server';

const NEXT_STEP: Record<string, string> = {
  not_started: 'Start your payment application when you are ready.',
  in_progress: 'Continue where you left off.',
  documents_required: 'Upload the missing documents.',
  agreement_pending: 'Read and sign the payment processing agreement.',
  submitted: 'We received your application. No action needed right now.',
  under_review: 'Our team is reviewing your application.',
  additional_information_required: 'Replace the documents we flagged, then resubmit.',
  approved: 'Approved. We are activating your payment methods.',
  rejected: 'This application was not approved. See the note below.',
  active: 'Payments are active on your account.',
};

export async function MerchantPaymentsOverview({
  bundle,
  basePath,
}: {
  bundle: MerchantBundle;
  basePath: string;
}) {
  const { application, documents, signature, agreement } = bundle;

  if (!application) {
    return (
      <div className="callout error">
        {bundle.error ?? 'The payment application is unavailable right now.'}
      </div>
    );
  }

  const progress = merchantProgress(application, documents, signature, basePath);
  const required = requiredDocKeys(application.business_type);
  const uploaded = documents.filter((doc) => required.includes(doc.doc_type) && doc.status !== 'rejected');
  const signedCurrent = Boolean(signature && agreement && signature.agreement_id === agreement.id);
  const editable = bundle.canManage && ['not_started', 'in_progress', 'documents_required', 'agreement_pending', 'additional_information_required', 'rejected'].includes(
    application.status,
  );

  return (
    <div className="dash-grid">
      <section className="panel">
        <div className="panel-head">
          <h3>Payment processing status</h3>
          <StatusTag status={application.status} />
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
          <div className="progress">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {progress.done} of {progress.steps.length} steps complete · {NEXT_STEP[application.status]}
          </p>

          <div className="timeline">
            {progress.steps.map((step) => (
              <div className="timeline-item" key={step.key}>
                <span
                  className="timeline-dot"
                  style={{ background: step.done ? 'var(--mint)' : 'var(--surface)' }}
                />
                <div>
                  <strong>{step.label}</strong>
                  <span>{step.done ? 'Complete' : 'Not yet'}</span>
                </div>
              </div>
            ))}
          </div>

          {application.decision_note ? (
            <div className={`callout ${application.status === 'rejected' ? 'error' : 'info'}`}>
              {application.decision_note}
            </div>
          ) : null}

          <div className="btn-row">
            {editable ? (
              <Link className="btn primary" href={progress.nextHref}>
                {application.status === 'not_started' ? 'Start application' : 'Continue'} <ArrowRight size={15} />
              </Link>
            ) : null}
            {application.submitted_at ? (
              <Link className="btn ghost" href={`${basePath}/review`}>
                View submitted application
              </Link>
            ) : (
              <Link className="btn ghost" href={`${basePath}/review`}>
                Review &amp; submit
              </Link>
            )}
          </div>
        </div>
      </section>

      {bundle.supplier ? (
        <section className="panel">
          <div className="panel-head">
            <h3>MyFatoorah supplier</h3>
            <StatusTag
              status={
                bundle.supplier.supplierStatus === 'active'
                  ? 'approved'
                  : bundle.supplier.supplierStatus === 'rejected'
                    ? 'rejected'
                    : bundle.supplier.supplierStatus
                      ? 'pending'
                      : 'not_started'
              }
            />
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            <div className="split-list">
              <div>
                <span className="k">Supplier code</span>
                <span className="v mono">{bundle.supplier.supplierCode ?? 'Not created yet'}</span>
              </div>
              <div>
                <span className="k">Provider status</span>
                <span className="v">{bundle.supplier.supplierStatus ?? 'Not created yet'}</span>
              </div>
              <div>
                <span className="k">Deposit terms</span>
                <span className="v">{bundle.supplier.depositTerms ?? 'Set by MyFatoorah'}</span>
              </div>
              <div>
                <span className="k">Last synchronised</span>
                <span className="v">{bundle.supplier.lastSyncedAt ? formatDate(bundle.supplier.lastSyncedAt) : 'Never'}</span>
              </div>
              <div>
                <span className="k">Live payments</span>
                <span className="v">
                  {bundle.supplier.paymentEligibility ? (
                    <span className="tag success">Enabled</span>
                  ) : (
                    <span className="tag neutral">Not enabled</span>
                  )}
                </span>
              </div>
            </div>
            {bundle.supplier.rejectionComment ? (
              <div className="callout error">MyFatoorah said: {bundle.supplier.rejectionComment}</div>
            ) : null}
            {bundle.supplier.lastError ? (
              <div className="callout warn">Last provider error: {bundle.supplier.lastError}</div>
            ) : null}
            {!bundle.supplier.paymentEligibility ? (
              <p className="small muted" style={{ margin: 0 }}>
                Live payments are enabled by Giftly after MyFatoorah confirms the supplier is Active and your
                onboarding checks are complete.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Documents</h3>
          <span className="tag neutral">
            {uploaded.length}/{required.length}
          </span>
        </div>
        <div className="panel-body">
          {application.business_type ? (
            <div className="split-list">
              {required.map((key) => {
                const document = documents.find((doc) => doc.doc_type === key);
                return (
                  <div key={key}>
                    <span className="k" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <FileText size={14} /> {MERCHANT_DOC_COPY[key]?.label ?? key.replace(/_/g, ' ')}
                    </span>
                    <span className="v small" style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                      {document ? <StatusTag status={document.status} /> : <span className="muted">Missing</span>}
                      {document?.provider_submission_status === 'submitted' ? (
                        <span className="tag success">Sent to MyFatoorah</span>
                      ) : document?.provider_submission_status === 'failed' ? (
                        <span className="tag danger">Provider submission failed</span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="small muted">
              Choose your business type in step 1 and we will show exactly which documents you need.
            </p>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Link className="btn sm" href={`${basePath}/application?step=3`}>
              Manage documents
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Payment processing agreement</h3>
          <StatusTag status={signedCurrent ? 'approved' : 'pending'} />
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 10 }}>
          {agreement ? (
            <>
              <div className="split-list">
                <div>
                  <span className="k">Version</span>
                  <span className="v">{agreement.version}</span>
                </div>
                <div>
                  <span className="k">Title</span>
                  <span className="v">{agreement.title}</span>
                </div>
                <div>
                  <span className="k">Signed</span>
                  <span className="v">
                    {signedCurrent && signature
                      ? `${formatDate(signature.signed_at)} · ${signature.signatory_name}`
                      : signature
                        ? `Version ${signature.agreement_version} only — a newer version needs signing`
                        : 'Not yet'}
                  </span>
                </div>
              </div>
              <div className="btn-row">
                <a className="btn sm ghost" href={`/api/merchant-agreements/${agreement.id}`} target="_blank" rel="noreferrer">
                  Read agreement
                </a>
                <Link className="btn sm" href={`${basePath}/agreement`}>
                  <ShieldCheck size={14} /> {signedCurrent ? 'View signature' : 'Sign agreement'}
                </Link>
              </div>
            </>
          ) : (
            <p className="small muted">
              The agreement is not available yet. Please contact support and we will publish it.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Payment methods</h3>
          <span className="tag neutral">{application.payment_methods.length} selected</span>
        </div>
        <div className="panel-body">
          {application.status === 'active' ? (
            <div className="callout" style={{ marginBottom: 12 }}>
              <CheckCircle2 size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
              <strong>Payments Active</strong>
            </div>
          ) : null}
          <div className="split-list">
            {PAYMENT_METHODS.map((method) => {
              const enabled = application.payment_methods.includes(method.key);
              return (
                <div key={method.key}>
                  <span className="k" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {enabled ? (
                      <CheckCircle2 size={15} color="var(--success)" />
                    ) : (
                      <Circle size={15} />
                    )}{' '}
                    {PAYMENT_METHOD_LABELS[method.key] ?? method.key}
                  </span>
                  <span className="v small">
                    {enabled ? (application.status === 'active' ? 'Enabled' : 'Selected') : 'Not selected'}
                  </span>
                </div>
              );
            })}
          </div>
          {editable ? (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <Link className="btn sm" href={`${basePath}/application?step=2`}>
                Change payment methods
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
