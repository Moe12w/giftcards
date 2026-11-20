import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Pencil, ShieldCheck } from 'lucide-react';
import { Notice } from '@/components/ui';
import { MerchantDocumentUpload } from '@/components/MerchantDocumentUpload';
import { WizardRail, type WizardStep } from '@/components/WizardRail';
import { reopenMerchantApplication, saveMerchantStep } from '@/lib/actions/merchant';
import { QATAR_IBAN_HINT } from '@/lib/iban';
import {
  BUSINESS_TYPES,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  IMAGE_ACCEPT,
  MERCHANT_DOC_COPY,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  QATAR_BANKS,
  REPRESENTATIVE_ROLES,
  docMeta,
  requiredDocKeys,
} from '@/lib/merchant';
import type { MerchantBundle } from '@/lib/merchant-server';
import { formatDate } from '@/lib/format';

export interface ApplicationWizardProps {
  bundle: MerchantBundle;
  /** `/vendor/payments` or `/enterprise/payments`. */
  basePath: string;
  step: number;
  error?: string | null;
  success?: string | null;
  tone?: 'mint' | 'lavender';
}

const STEPS: WizardStep[] = [
  { key: '1', label: 'Business & representative' },
  { key: '2', label: 'Payment methods' },
  { key: '3', label: 'Documents' },
  { key: '4', label: 'Banking' },
  { key: '5', label: 'Agreement' },
];

const UPLOAD_COPY = {
  upload: 'Upload',
  replace: 'Replace',
  remove: 'Remove',
  preview: 'Preview',
  uploading: 'Uploading…',
  saved: 'Saved.',
  failed: 'That file could not be uploaded.',
  tooLarge: 'That file is too large. Keep it under 5 MB.',
  formats: 'PDF, PNG, JPEG or WebP · up to 5 MB',
};

export function ApplicationWizard({ bundle, basePath, step, error, success, tone = 'mint' }: ApplicationWizardProps) {
  const { application, documents, signature, agreement } = bundle;

  if (!application) {
    return <div className="callout error">{bundle.error ?? 'The payment application is unavailable right now.'}</div>;
  }

  const stepKey = String(Math.min(Math.max(step, 1), 5));
  const required = requiredDocKeys(application.business_type);
  const documentsReady = required.every((key) =>
    documents.some((doc) => doc.doc_type === key && doc.status !== 'rejected'),
  );
  const locked = ['submitted', 'under_review', 'approved', 'active'].includes(application.status);
  const canReopen = ['submitted', 'under_review', 'approved', 'rejected'].includes(application.status);
  const readOnly = !bundle.canManage;

  const rail = STEPS.map((item) => ({
    ...item,
    href: locked ? undefined : `${basePath}/application?step=${item.key}`,
  }));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <WizardRail steps={rail} current={stepKey} tone={tone} />

      <Notice error={error} success={success} />

      {readOnly ? (
        <div className="callout info">
          You have read-only access to this application. Ask an owner or manager of the organisation to make changes.
        </div>
      ) : null}

      {locked ? (
        <div className="callout info" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            Your application has been submitted, so the details are locked. You can still review everything on the{' '}
            <Link href={`${basePath}/review`} style={{ textDecoration: 'underline' }}>
              review page
            </Link>
            .
          </span>
          {canReopen && !readOnly ? (
            <form action={reopenMerchantApplication}>
              <input type="hidden" name="application_id" value={application.id} />
              <button className="btn sm" type="submit">
                <Pencil size={14} /> Edit application
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {stepKey === '1' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Business and representative</h3>
            <span className="tag neutral">Step 1 of 5</span>
          </div>
          <div className="panel-body">
            <form action={saveMerchantStep} className="form" style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="application_id" value={application.id} />
              <input type="hidden" name="step" value="1" />

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="contact_name">Contact name</label>
                  <input id="contact_name" name="contact_name" required defaultValue={application.contact_name ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="contact_role">Representative role</label>
                  <select id="contact_role" name="contact_role" required defaultValue={application.contact_role ?? ''}>
                    <option value="">Choose a role</option>
                    {REPRESENTATIVE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="business_name">Business name</label>
                  <input id="business_name" name="business_name" required defaultValue={application.business_name ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="business_email">Email address</label>
                  <input
                    id="business_email"
                    name="business_email"
                    type="email"
                    required
                    defaultValue={application.business_email ?? ''}
                  />
                </div>
                <div className="field">
                  <label htmlFor="business_phone">Mobile number</label>
                  <input
                    id="business_phone"
                    name="business_phone"
                    type="tel"
                    required
                    defaultValue={application.business_phone ?? ''}
                  />
                </div>
              </div>

              <div className="field">
                <span className="field-label">Business type</span>
                <div className="choice-grid">
                  {BUSINESS_TYPES.map((type) => (
                    <label key={type.key} className="card choice-card">
                      <input
                        type="radio"
                        name="business_type"
                        value={type.key}
                        required
                        defaultChecked={application.business_type === type.key}
                      />
                      <span className="choice-card-text">{type.label}</span>
                    </label>
                  ))}
                </div>
                <span className="hint">
                  Independent businesses are not asked for commercial registration or manager documents.
                </span>
              </div>

              <div className="callout info">
                If you selected <strong>Company / corporate</strong>, complete the commercial details below. Leave them
                blank for a home business.
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="cr_number">Commercial registration (CR) number</label>
                  <input id="cr_number" name="cr_number" defaultValue={application.cr_number ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="activity_name">Company activity name</label>
                  <input id="activity_name" name="activity_name" defaultValue={application.activity_name ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="activity_code">Company activity code</label>
                  <input id="activity_code" name="activity_code" defaultValue={application.activity_code ?? ''} />
                </div>
              </div>

              <div className="btn-row">
                <Link className="btn ghost" href={basePath}>
                  Back to overview
                </Link>
                <button className="btn primary" type="submit" disabled={readOnly}>
                  Save and continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {stepKey === '2' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Which payment methods would you like to accept?</h3>
            <span className="tag neutral">Step 2 of 5</span>
          </div>
          <div className="panel-body">
            <form action={saveMerchantStep} className="form" style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="application_id" value={application.id} />
              <input type="hidden" name="step" value="2" />

              <p className="small muted" style={{ margin: 0 }}>
                Select every method you want to offer. You can change this before you submit.
              </p>

              <div className="choice-grid">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method.key} className="card choice-card">
                    <span className="choice-card-row">
                      <span className="choice-card-main">
                        <input
                          type="checkbox"
                          name="payment_methods"
                          value={method.key}
                          defaultChecked={application.payment_methods.includes(method.key)}
                        />
                        <strong>{PAYMENT_METHOD_LABELS[method.key] ?? method.key}</strong>
                      </span>
                      {method.recommended ? <span className="tag success">Recommended</span> : null}
                    </span>
                  </label>
                ))}
              </div>

              <div className="btn-row">
                <Link className="btn ghost" href={`${basePath}/application?step=1`}>
                  <ArrowLeft size={15} /> Back
                </Link>
                <button className="btn primary" type="submit" disabled={readOnly}>
                  Save and continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {stepKey === '3' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Business documents</h3>
            <span className="tag neutral">
              {required.filter((key) => documents.some((doc) => doc.doc_type === key && doc.status !== 'rejected')).length}/
              {required.length}
            </span>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            {!application.business_type ? (
              <div className="callout warn">
                <AlertCircle size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Choose your business type
                in step 1 first — that decides which documents are required.{' '}
                <Link href={`${basePath}/application?step=1`} style={{ textDecoration: 'underline' }}>
                  Go to step 1
                </Link>
              </div>
            ) : (
              <>
                <p className="small muted" style={{ margin: 0 }}>
                  Each file is saved the moment you upload it, so you can stop and come back later. Maximum 5 MB per
                  file.
                </p>
                <div className="grid-2">
                  {required.map((key) => {
                    const copy = MERCHANT_DOC_COPY[key];
                    const meta = docMeta(key);
                    const document = documents.find((doc) => doc.doc_type === key) ?? null;
                    return (
                      <MerchantDocumentUpload
                        key={key}
                        applicationId={application.id}
                        docType={key}
                        label={copy?.label ?? key.replace(/_/g, ' ')}
                        hint={copy?.hint ?? ''}
                        accept={meta?.imageOnly ? IMAGE_ACCEPT : DOCUMENT_ACCEPT}
                        document={
                          document
                            ? {
                                id: document.id,
                                file_name: document.file_name,
                                status: document.status,
                                rejection_reason: document.rejection_reason,
                              }
                            : null
                        }
                        copy={UPLOAD_COPY}
                      />
                    );
                  })}
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  {DOCUMENT_MAX_BYTES / (1024 * 1024)} MB limit · PDF, PNG, JPEG or WebP.
                </p>
              </>
            )}

            <div className="btn-row">
              <Link className="btn ghost" href={`${basePath}/application?step=2`}>
                <ArrowLeft size={15} /> Back
              </Link>
              {documentsReady ? (
                <Link className="btn primary" href={`${basePath}/application?step=4`}>
                  Continue to banking <ArrowRight size={16} />
                </Link>
              ) : (
                <span className="small muted">Upload every document to continue.</span>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {stepKey === '4' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Banking information</h3>
            <span className="tag neutral">Step 4 of 5</span>
          </div>
          <div className="panel-body">
            <form action={saveMerchantStep} className="form" style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="application_id" value={application.id} />
              <input type="hidden" name="step" value="4" />

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="bank_name">Bank</label>
                  <input
                    id="bank_name"
                    name="bank_name"
                    list="qatar-banks"
                    required
                    defaultValue={application.bank_name ?? ''}
                    placeholder="Start typing to search…"
                  />
                  <datalist id="qatar-banks">
                    {QATAR_BANKS.map((bank) => (
                      <option key={bank} value={bank} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label htmlFor="bank_account_name">Account holder name</label>
                  <input
                    id="bank_account_name"
                    name="bank_account_name"
                    required
                    defaultValue={application.bank_account_name ?? ''}
                  />
                  <span className="hint">Use the name exactly as it appears on the bank account letter.</span>
                </div>
                <div className="field">
                  <label htmlFor="bank_account_number">Account number</label>
                  <input
                    id="bank_account_number"
                    name="bank_account_number"
                    defaultValue={application.bank_account_number ?? ''}
                  />
                </div>
                <div className="field">
                  <label htmlFor="bank_iban">IBAN</label>
                  <input
                    id="bank_iban"
                    name="bank_iban"
                    defaultValue={application.bank_iban ?? ''}
                    placeholder="QA58DOHB00001234567890ABCDEFG"
                    pattern="[Qq][Aa][0-9]{2}[A-Za-z0-9 -]{25,45}"
                    title={QATAR_IBAN_HINT}
                  />
                  <span className="hint">{QATAR_IBAN_HINT} Provide an account number, an IBAN, or both.</span>
                </div>
                <div className="field">
                  <label htmlFor="bank_currency">Currency</label>
                  <select id="bank_currency" name="bank_currency" defaultValue={application.bank_currency || 'QAR'}>
                    <option value="QAR">QAR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="btn-row">
                <Link className="btn ghost" href={`${basePath}/application?step=3`}>
                  <ArrowLeft size={15} /> Back
                </Link>
                <button className="btn primary" type="submit" disabled={readOnly}>
                  Save and continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {stepKey === '5' ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Payment processing agreement</h3>
            <span className="tag neutral">Step 5 of 5</span>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            {agreement ? (
              <>
                <div className="split-list">
                  <div>
                    <span className="k">Agreement</span>
                    <span className="v">{agreement.title}</span>
                  </div>
                  <div>
                    <span className="k">Version</span>
                    <span className="v">{agreement.version}</span>
                  </div>
                  <div>
                    <span className="k">Signed</span>
                    <span className="v">
                      {signature ? `${formatDate(signature.signed_at)} · ${signature.signatory_name}` : 'Not yet'}
                    </span>
                  </div>
                </div>

                {signature ? (
                  <div className="callout" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CheckCircle2 size={16} color="var(--success)" />
                    <span>
                      Signed by <strong>{signature.signatory_name}</strong> ({signature.signatory_role}) on{' '}
                      {formatDate(signature.signed_at)}. Version {signature.agreement_version} is preserved on file.
                    </span>
                  </div>
                ) : null}

                <div className="btn-row">
                  <a
                    className="btn ghost"
                    href={`/api/merchant-agreements/${agreement.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={15} /> Read the agreement
                  </a>
                  <Link className="btn primary" href={`${basePath}/agreement`}>
                    <ShieldCheck size={15} /> {signature ? 'View signature' : 'Review and sign'}
                  </Link>
                </div>
              </>
            ) : (
              <div className="callout warn">
                The agreement is not published yet. Please contact support and we will make it available.
              </div>
            )}

            <div className="btn-row">
              <Link className="btn ghost" href={`${basePath}/application?step=4`}>
                <ArrowLeft size={15} /> Back
              </Link>
              <Link className="btn primary" href={`${basePath}/review`}>
                Review application <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
