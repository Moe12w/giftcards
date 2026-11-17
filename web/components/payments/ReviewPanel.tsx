import Link from 'next/link';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { Notice, StatusTag } from '@/components/ui';
import { submitMerchantApplication } from '@/lib/actions/merchant';
import {
  MERCHANT_DOC_COPY,
  PAYMENT_METHOD_LABELS,
  merchantProgress,
  merchantReadyToSubmit,
  requiredDocKeys,
} from '@/lib/merchant';
import type { MerchantBundle } from '@/lib/merchant-server';
import { formatDate } from '@/lib/format';

export function ReviewPanel({
  bundle,
  basePath,
  error,
  success,
}: {
  bundle: MerchantBundle;
  basePath: string;
  error?: string | null;
  success?: string | null;
}) {
  const { application, documents, signature, agreement } = bundle;

  if (!application) {
    return <div className="callout error">{bundle.error ?? 'The payment application is unavailable right now.'}</div>;
  }

  const progress = merchantProgress(application, documents, signature, basePath);
  const required = requiredDocKeys(application.business_type);
  const missing = required.filter(
    (key) => !documents.some((doc) => doc.doc_type === key && doc.status !== 'rejected'),
  );
  const signedThisVersion = Boolean(signature && agreement && signature.agreement_id === agreement.id);
  const alreadySubmitted = ['submitted', 'under_review', 'approved', 'active'].includes(application.status);
  const readOnly = !bundle.canManage;
  // The submission step itself cannot be complete before submitting, so readiness
  // is judged on the five steps that come before it.
  const ready = merchantReadyToSubmit(progress, signedThisVersion) && !alreadySubmitted && !readOnly;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Notice error={error} success={success} />

      {readOnly ? (
        <div className="callout info">
          You have read-only access to this application. Ask an owner or manager to make changes or submit it.
        </div>
      ) : null}

      {alreadySubmitted ? (
        <div className="callout" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <CheckCircle2 size={18} color="var(--success)" />
          <span>
            <strong>Application submitted.</strong> We received it on {formatDate(application.submitted_at ?? application.updated_at)}.
            You can track progress in Online Payments.
          </span>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Review your application</h3>
          <StatusTag status={application.status} />
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 18 }}>
          <div className="progress">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {progress.done} of {progress.steps.length} steps complete.
          </p>

          <div className="split-list">
            <div>
              <span className="k">Business name</span>
              <span className="v">
                {application.business_name ?? '—'}{' '}
                {!alreadySubmitted && !readOnly ? (
                  <Link href={`${basePath}/application?step=1`} className="small" style={{ textDecoration: 'underline' }}>
                    Edit
                  </Link>
                ) : null}
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
            <div>
              <span className="k">Business type</span>
              <span className="v">
                {application.business_type === 'company' ? 'Company / corporate' : application.business_type === 'home' ? 'Home business / independent' : '—'}
              </span>
            </div>
            {application.business_type === 'company' ? (
              <div>
                <span className="k">CR number</span>
                <span className="v">{application.cr_number ?? '—'}</span>
              </div>
            ) : null}
            <div>
              <span className="k">Payment methods</span>
              <span className="v small">
                {application.payment_methods.length > 0
                  ? application.payment_methods.map((key) => PAYMENT_METHOD_LABELS[key] ?? key).join(', ')
                  : 'None selected'}{' '}
                {!alreadySubmitted && !readOnly ? (
                  <Link href={`${basePath}/application?step=2`} className="small" style={{ textDecoration: 'underline' }}>
                    Edit
                  </Link>
                ) : null}
              </span>
            </div>
            <div>
              <span className="k">Bank</span>
              <span className="v small">
                {application.bank_name ?? '—'} · {application.bank_account_name ?? '—'}
                {!alreadySubmitted && !readOnly ? (
                  <>
                    {' '}
                    <Link href={`${basePath}/application?step=4`} className="small" style={{ textDecoration: 'underline' }}>
                      Edit
                    </Link>
                  </>
                ) : null}
              </span>
            </div>
            <div>
              <span className="k">Agreement</span>
              <span className="v small">
                {signedThisVersion && signature
                  ? `Signed · version ${signature.agreement_version}`
                  : 'Not signed'}{' '}
                {!alreadySubmitted && !readOnly ? (
                  <Link href={`${basePath}/agreement`} className="small" style={{ textDecoration: 'underline' }}>
                    {signedThisVersion ? 'View' : 'Sign'}
                  </Link>
                ) : null}
              </span>
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: 8 }}>Documents</h4>
            <div className="split-list">
              {required.map((key) => {
                const document = documents.find((doc) => doc.doc_type === key);
                return (
                  <div key={key}>
                    <span className="k">{MERCHANT_DOC_COPY[key]?.label ?? key.replace(/_/g, ' ')}</span>
                    <span className="v small">
                      {document ? document.file_name : <span className="muted">Missing</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {!alreadySubmitted ? (
              <div className="btn-row" style={{ marginTop: 10 }}>
                <Link className="btn sm" href={`${basePath}/application?step=3`}>
                  Manage documents
                </Link>
              </div>
            ) : null}
          </div>

          {!alreadySubmitted && missing.length > 0 ? (
            <div className="callout warn">
              <AlertCircle size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {missing.length} document
              {missing.length === 1 ? '' : 's'} still missing.
            </div>
          ) : null}

          {!alreadySubmitted ? (
            <form action={submitMerchantApplication} style={{ display: 'grid', gap: 14 }}>
              <input type="hidden" name="application_id" value={application.id} />
              <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5 }}>
                <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
                <span>
                  I confirm the information and documents are accurate and complete, and I understand that payments only
                  activate after MyFatoorah approves the merchant account.
                </span>
              </label>
              <div className="btn-row">
                <button className="btn primary" type="submit" disabled={!ready}>
                  <Send size={15} /> Submit application
                </button>
                {!ready ? (
                  <span className="small muted">Finish every step and sign the agreement to enable submission.</span>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
