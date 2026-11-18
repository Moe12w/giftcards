import Link from 'next/link';
import { ArrowLeft, FileText, Upload } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { EmptyState, Notice, PageHead } from '@/components/ui';
import { adminDeactivateAgreement, adminPublishAgreement } from '@/lib/actions/admin-merchant';
import { AgreementPdfInput } from '@/components/AgreementPdfInput';
import type { MerchantAgreement } from '@/lib/merchant';
import { formatDate } from '@/lib/format';

interface SignatureCount {
  agreement_version: string;
}

export default async function AdminMerchantAgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string; deactivated?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();

  const [agreementsResult, signaturesResult] = await Promise.all([
    ctx.supabase.from('merchant_agreements').select('*').order('created_at', { ascending: false }),
    ctx.supabase.from('merchant_agreement_signatures').select('agreement_version'),
  ]);

  const agreements = (agreementsResult.data ?? []) as MerchantAgreement[];
  const signatures = (signaturesResult.data ?? []) as SignatureCount[];

  const signedCount = (version: string) => signatures.filter((row) => row.agreement_version === version).length;
  const active = agreements.find((agreement) => agreement.is_active) ?? null;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Merchant onboarding"
        title="Payment processing agreements"
        description="Upload the official agreement, set its version and activate it. Merchants can only sign the active version, and every signed copy stays preserved against the version it was signed for."
        actions={
          <Link className="btn sm ghost" href="/admin/merchant-onboarding">
            <ArrowLeft size={14} /> Applications
          </Link>
        }
      />

      <Notice
        error={params.error ?? agreementsResult.error?.message}
        success={
          params.published === '1'
            ? 'Agreement published and activated.'
            : params.deactivated === '1'
              ? 'Agreement deactivated.'
              : null
        }
      />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Publish a new version</h3>
            <Upload size={16} />
          </div>
          <div className="panel-body">
            <form action={adminPublishAgreement} className="form" style={{ display: 'grid', gap: 14 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="version">Version</label>
                  <input id="version" name="version" required placeholder="2026-01" />
                </div>
                <div className="field">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    name="title"
                    required
                    defaultValue="MyFatoorah Payment Processing Agreement"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="file">Agreement PDF</label>
                <AgreementPdfInput />
              </div>
              <div className="btn-row">
                <button className="btn primary" type="submit">
                  Publish and activate
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Active agreement</h3>
            <span className={`tag ${active ? 'success' : 'neutral'}`}>{active ? 'Active' : 'None'}</span>
          </div>
          <div className="panel-body">
            {active ? (
              <div className="split-list">
                <div>
                  <span className="k">Version</span>
                  <span className="v">{active.version}</span>
                </div>
                <div>
                  <span className="k">Title</span>
                  <span className="v">{active.title}</span>
                </div>
                <div>
                  <span className="k">File</span>
                  <span className="v small">{active.file_name}</span>
                </div>
                <div>
                  <span className="k">Signed by</span>
                  <span className="v">{signedCount(active.version)} merchant(s)</span>
                </div>
              </div>
            ) : (
              <div className="callout warn">
                No agreement is active. Merchants cannot sign until you publish one.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>All versions</h3>
          <span className="tag neutral">{agreements.length}</span>
        </div>
        <div className="panel-body">
          {agreements.length === 0 ? (
            <EmptyState
              title="No agreements yet"
              body="Publish the official payment processing agreement to let merchants sign it."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Title</th>
                    <th>Uploaded</th>
                    <th>Signatures</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((agreement) => (
                    <tr key={agreement.id}>
                      <td className="strong">{agreement.version}</td>
                      <td className="small">{agreement.title}</td>
                      <td className="small muted">{formatDate(agreement.created_at)}</td>
                      <td className="num">{signedCount(agreement.version)}</td>
                      <td>
                        <span className={`tag ${agreement.is_active ? 'success' : 'neutral'}`}>
                          {agreement.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <a
                            className="btn sm ghost"
                            href={`/api/merchant-agreements/${agreement.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileText size={13} /> View
                          </a>
                          {agreement.is_active ? (
                            <form action={adminDeactivateAgreement}>
                              <input type="hidden" name="agreement_id" value={agreement.id} />
                              <button className="btn sm ghost" type="submit">
                                Deactivate
                              </button>
                            </form>
                          ) : null}
                        </div>
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
  );
}
