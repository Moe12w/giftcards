import Link from 'next/link';
import { CheckCircle2, FileSpreadsheet, Info, ShieldCheck, Upload } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { importEnterpriseCodes, importEnterpriseRedemptions } from '@/lib/actions/enterprise';
import { Notice, PageHead, StatusTag } from '@/components/ui';

export default async function EnterpriseImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    inserted?: string;
    duplicates?: string;
    invalid?: string;
    reconciled?: string;
    confirmed?: string;
    skipped?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const canManage = ctx.role !== 'analyst';

  const [productsResult, batchesResult] = await Promise.all([
    ctx.supabase
      .from('enterprise_products')
      .select('id, name, denomination_minor, is_active')
      .eq('partner_id', ctx.partner.id)
      .order('name'),
    ctx.supabase
      .from('enterprise_import_batches')
      .select('*')
      .eq('partner_id', ctx.partner.id)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const products = productsResult.data ?? [];
  const batches = batchesResult.data ?? [];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Import"
        title="Bring your codes in, safely."
        description="Paste codes one per line. We check for duplicates, encrypt each code and keep only the last four digits visible."
        actions={
          <Link className="btn sm" href="/enterprise/inventory">
            View inventory
          </Link>
        }
      />

      <Notice error={params.error} />

      {params.imported === '1' ? (
        <div className="callout" role="status" style={{ display: 'grid', gap: 4 }}>
          <strong>
            <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> Import complete
          </strong>
          <span className="small">
            {params.inserted ?? 0} inserted · {params.duplicates ?? 0} duplicates skipped ·{' '}
            {params.invalid ?? 0} invalid rows.
          </span>
        </div>
      ) : null}

      {params.reconciled === '1' ? (
        <div className="callout" role="status" style={{ display: 'grid', gap: 4 }}>
          <strong>
            <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> Reconciliation
            complete
          </strong>
          <span className="small">
            {params.confirmed ?? 0} codes confirmed redeemed · {params.skipped ?? 0} rows skipped.
          </span>
        </div>
      ) : null}

      {!canManage ? (
        <div className="callout warn">
          Your role is read-only. Ask an owner or manager on your team to import codes.
        </div>
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Import gift codes</h3>
            <span className="tag lavender">Encrypted at rest</span>
          </div>
          <div className="panel-body">
            {products.length === 0 ? (
              <div className="callout warn">
                Create a reward product first. Codes need a product so the denomination and validity are
                known.{' '}
                <Link href="/enterprise/products/new" style={{ textDecoration: 'underline' }}>
                  Create a product
                </Link>
                .
              </div>
            ) : (
              <form action={importEnterpriseCodes} style={{ display: 'grid', gap: 16 }}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="enterprise_product_id">Product</label>
                    <select id="enterprise_product_id" name="enterprise_product_id" required defaultValue="">
                      <option value="" disabled>
                        Choose a product
                      </option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — {product.denomination_minor / 100} QAR
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="filename">Batch name</label>
                    <input id="filename" name="filename" placeholder="q1-rewards.txt" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="codes">Codes</label>
                  <textarea
                    id="codes"
                    name="codes"
                    required
                    placeholder={'GIFT-AAAA-1111\nGIFT-BBBB-2222\nGIFT-CCCC-3333'}
                    style={{ minHeight: 180, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem' }}
                  />
                  <span className="hint">
                    One code per line. Commas are ignored. Up to 2,000 codes per batch. Duplicates are
                    skipped, not overwritten.
                  </span>
                </div>
                <button className="btn lavender" type="submit" disabled={!canManage}>
                  <Upload size={16} /> Import codes
                </button>
              </form>
            )}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>How the import works</h3>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>1. Validate</strong>
                    <span>Each row needs a code and a product. Invalid rows are counted, not stored.</span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>2. Deduplicate</strong>
                    <span>A fingerprint per partner stops the same code being imported twice.</span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>3. Encrypt and store</strong>
                    <span>The code is encrypted; only the last four digits are shown in the dashboard.</span>
                  </div>
                </div>
              </div>
              <div className="callout info">
                <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Nobody on
                your team can read a full code from the dashboard. It is revealed to the recipient when it
                is allocated.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Reconcile redemptions</h3>
              <FileSpreadsheet size={16} />
            </div>
            <div className="panel-body">
              <p className="small muted" style={{ marginBottom: 12 }}>
                Paste the inventory references your vendor or redemption report confirms. Each matching
                code is marked redeemed.
              </p>
              <form action={importEnterpriseRedemptions} style={{ display: 'grid', gap: 12 }}>
                <div className="field">
                  <label htmlFor="redemptions">Inventory references</label>
                  <textarea
                    id="redemptions"
                    name="redemptions"
                    required
                    placeholder={'INV-AB12CD34EF\nINV-12AB34CD56'}
                    style={{ minHeight: 120, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem' }}
                  />
                </div>
                <button className="btn" type="submit" disabled={!canManage}>
                  Reconcile redemptions
                </button>
              </form>
              <div className="callout warn" style={{ marginTop: 12 }}>
                <Info size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> This changes the
                code status permanently. Only use a report you trust.
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Recent batches</h3>
          <span className="small muted">Newest first</span>
        </div>
        <div className="panel-body flush">
          {batches.length === 0 ? (
            <div className="table-empty">No imports yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th className="num">Rows</th>
                    <th className="num">Inserted</th>
                    <th className="num">Duplicates</th>
                    <th className="num">Invalid</th>
                    <th>Started</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="strong">{batch.filename ?? 'Manual import'}</td>
                      <td className="small muted">{batch.source}</td>
                      <td>
                        <StatusTag status={batch.status} />
                      </td>
                      <td className="num">{batch.total_rows}</td>
                      <td className="num">{batch.inserted_rows}</td>
                      <td className="num">{batch.duplicate_rows}</td>
                      <td className="num">{batch.invalid_rows}</td>
                      <td className="small muted">{formatDate(batch.created_at)}</td>
                      <td className="small muted">{batch.completed_at ? formatDate(batch.completed_at) : '—'}</td>
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
