import Link from 'next/link';
import { ArrowLeft, Download, FileText, ShieldCheck } from 'lucide-react';
import { Notice } from '@/components/ui';
import { SignaturePad } from '@/components/SignaturePad';
import { signMerchantAgreement } from '@/lib/actions/merchant';
import { REPRESENTATIVE_ROLES } from '@/lib/merchant';
import type { MerchantBundle } from '@/lib/merchant-server';
import { formatDate } from '@/lib/format';

export function AgreementPanel({
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
  const { application, agreement, signature } = bundle;

  if (!application) {
    return <div className="callout error">{bundle.error ?? 'The payment application is unavailable right now.'}</div>;
  }

  // A signature only counts for the exact agreement version it was made against.
  const signedThisVersion = Boolean(signature && agreement && signature.agreement_id === agreement.id);
  const locked = ['submitted', 'under_review', 'approved', 'active'].includes(application.status);
  const readOnly = !bundle.canManage;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Notice error={error} success={success} />

      <section className="panel">
        <div className="panel-head">
          <h3>Payment processing agreement</h3>
          <Link className="btn sm ghost" href={basePath}>
            <ArrowLeft size={14} /> Online payments
          </Link>
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
          {!agreement ? (
            <div className="callout warn">
              No agreement is active right now. Please contact support and we will publish the current version.
            </div>
          ) : (
            <>
              <div className="split-list">
                <div>
                  <span className="k">Document</span>
                  <span className="v">{agreement.title}</span>
                </div>
                <div>
                  <span className="k">Version</span>
                  <span className="v">{agreement.version}</span>
                </div>
                <div>
                  <span className="k">File</span>
                  <span className="v small">{agreement.file_name}</span>
                </div>
              </div>

              <div className="btn-row">
                <a
                  className="btn"
                  href={`/api/merchant-agreements/${agreement.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText size={15} /> Open in a new tab
                </a>
                <a className="btn ghost" href={`/api/merchant-agreements/${agreement.id}`} download>
                  <Download size={15} /> Download PDF
                </a>
              </div>

              <p className="small muted" style={{ margin: 0 }}>
                Read the full agreement before signing. Once you sign, this version is stored securely with your
                business reference, your name, the date and time, and signing audit information.
              </p>

              {signature && !signedThisVersion ? (
                <div className="callout warn">
                  You previously signed version <strong>{signature.agreement_version}</strong>. That signed copy stays on
                  file, but a newer version ({agreement.version}) now requires a fresh signature.{' '}
                  <a
                    href={`/api/merchant-agreements/${signature.agreement_id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'underline' }}
                  >
                    Download the signed version
                  </a>
                  .
                </div>
              ) : null}

              {signedThisVersion && signature ? (
                <div className="callout">
                  <div className="split-list">
                    <div>
                      <span className="k">Signed by</span>
                      <span className="v">
                        {signature.signatory_name} · {signature.signatory_role}
                      </span>
                    </div>
                    <div>
                      <span className="k">Signed at</span>
                      <span className="v">{formatDate(signature.signed_at)}</span>
                    </div>
                    <div>
                      <span className="k">Agreement version</span>
                      <span className="v">{signature.agreement_version}</span>
                    </div>
                    <div>
                      <span className="k">Business reference</span>
                      <span className="v small mono">{application.id}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {!signedThisVersion && !locked && !readOnly ? (
                <form
                  action={signMerchantAgreement}
                  className="form"
                  style={{ display: 'grid', gap: 16, marginTop: 4 }}
                >
                  <input type="hidden" name="application_id" value={application.id} />
                  <input
                    type="hidden"
                    name="consent_text"
                    value={`I agree to the ${agreement.title} (version ${agreement.version}).`}
                  />

                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="signatory_name">Signatory full name</label>
                      <input
                        id="signatory_name"
                        name="signatory_name"
                        required
                        defaultValue={signature?.signatory_name ?? application.contact_name ?? ''}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="signatory_role">Signatory role</label>
                      <select
                        id="signatory_role"
                        name="signatory_role"
                        required
                        defaultValue={signature?.signatory_role ?? application.contact_role ?? ''}
                      >
                        <option value="">Choose a role</option>
                        {REPRESENTATIVE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label>Signature</label>
                    <SignaturePad
                      hint="Draw your signature with a mouse, finger or stylus."
                      clearLabel="Clear"
                    />
                  </div>

                  <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
                    <span>
                      I have read and agree to the {agreement.title} (version {agreement.version}) and confirm I am
                      authorised to sign on behalf of this business.
                    </span>
                  </label>

                  <div className="btn-row">
                    <button className="btn primary" type="submit">
                      <ShieldCheck size={15} /> Sign agreement
                    </button>
                    <span className="small muted">
                      Your signature, name, role, date, agreement version and business reference are recorded.
                    </span>
                  </div>
                </form>
              ) : null}

              {!signedThisVersion && locked ? (
                <div className="callout info">
                  Your application is already submitted. If a new agreement version is issued, support will reopen the
                  signing step for you.
                </div>
              ) : null}

              {!signedThisVersion && readOnly && !locked ? (
                <div className="callout info">
                  You have read-only access. Ask an owner or manager to sign the agreement.
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
