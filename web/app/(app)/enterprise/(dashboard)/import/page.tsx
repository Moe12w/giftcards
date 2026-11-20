import Link from 'next/link';
import { CheckCircle2, FileSpreadsheet, Info, ShieldCheck, Upload } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { importEnterpriseCodes, importEnterpriseRedemptions } from '@/lib/actions/enterprise';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

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
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).import;
  const c = pick(common, locale);
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <Link className="btn sm" href="/enterprise/inventory">
            {t.viewInventory}
          </Link>
        }
      />

      <Notice error={params.error} />

      {params.imported === '1' ? (
        <div className="callout" role="status" style={{ display: 'grid', gap: 4 }}>
          <strong>
            <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> {t.importComplete}
          </strong>
          <span className="small">
            {fill(t.importSummary, {
              inserted: params.inserted ?? 0,
              duplicates: params.duplicates ?? 0,
              invalid: params.invalid ?? 0,
            })}
          </span>
        </div>
      ) : null}

      {params.reconciled === '1' ? (
        <div className="callout" role="status" style={{ display: 'grid', gap: 4 }}>
          <strong>
            <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> {t.reconciliationComplete}
          </strong>
          <span className="small">
            {fill(t.reconciliationSummary, {
              confirmed: params.confirmed ?? 0,
              skipped: params.skipped ?? 0,
            })}
          </span>
        </div>
      ) : null}

      {!canManage ? (
        <div className="callout warn">
          {t.readOnly}
        </div>
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.importGiftCodes}</h3>
            <span className="tag lavender">{t.encryptedAtRest}</span>
          </div>
          <div className="panel-body">
            {products.length === 0 ? (
              <div className="callout warn">
                {t.needsProduct}{' '}
                <Link href="/enterprise/products/new" style={{ textDecoration: 'underline' }}>
                  {t.createProduct}
                </Link>
                .
              </div>
            ) : (
              <form action={importEnterpriseCodes} style={{ display: 'grid', gap: 16 }}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="enterprise_product_id">{t.productLabel}</label>
                    <select id="enterprise_product_id" name="enterprise_product_id" required defaultValue="">
                      <option value="" disabled>
                        {t.chooseProduct}
                      </option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — {product.denomination_minor / 100} QAR
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="filename">{t.batchName}</label>
                    <input id="filename" name="filename" placeholder="q1-rewards.txt" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="codes">{t.codes}</label>
                  <textarea
                    id="codes"
                    name="codes"
                    required
                    placeholder={'GIFT-AAAA-1111\nGIFT-BBBB-2222\nGIFT-CCCC-3333'}
                    style={{ minHeight: 180, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem' }}
                  />
                  <span className="hint">
                    {t.codesHint}
                  </span>
                </div>
                <button className="btn lavender" type="submit" disabled={!canManage}>
                  <Upload size={16} /> {t.importCodes}
                </button>
              </form>
            )}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>{t.howItWorks}</h3>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{t.step1Title}</strong>
                    <span>{t.step1Body}</span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{t.step2Title}</strong>
                    <span>{t.step2Body}</span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{t.step3Title}</strong>
                    <span>{t.step3Body}</span>
                  </div>
                </div>
              </div>
              <div className="callout info">
                <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.securityNote}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.reportUsedCodes}</h3>
              <FileSpreadsheet size={16} />
            </div>
            <div className="panel-body">
              <p className="small muted" style={{ marginBottom: 12 }}>
                {t.reportUsedCodesBody}
              </p>
              <form action={importEnterpriseRedemptions} style={{ display: 'grid', gap: 12 }}>
                <div className="field">
                  <label htmlFor="redemptions">{t.inventoryReferences}</label>
                  <textarea
                    id="redemptions"
                    name="redemptions"
                    required
                    placeholder={'INV-AB12CD34EF\nINV-12AB34CD56'}
                    style={{ minHeight: 120, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem' }}
                  />
                </div>
                <button className="btn" type="submit" disabled={!canManage}>
                  {t.reportUsedCodesAction}
                </button>
              </form>
              <div className="callout warn" style={{ marginTop: 12 }}>
                <Info size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.warningNote}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.recentBatches}</h3>
          <span className="small muted">{t.newestFirst}</span>
        </div>
        <div className="panel-body flush">
          {batches.length === 0 ? (
            <div className="table-empty">{t.noImportsYet}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.batch}</th>
                    <th>{t.source}</th>
                    <th>{c.labels.status}</th>
                    <th className="num">{t.rows}</th>
                    <th className="num">{t.inserted}</th>
                    <th className="num">{t.duplicates}</th>
                    <th className="num">{t.invalid}</th>
                    <th>{t.started}</th>
                    <th>{t.completed}</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="strong">{batch.filename ?? t.manualImport}</td>
                      <td className="small muted">{batch.source}</td>
                      <td>
                        <StatusTag status={batch.status} />
                      </td>
                      <td className="num">{batch.total_rows}</td>
                      <td className="num">{batch.inserted_rows}</td>
                      <td className="num">{batch.duplicate_rows}</td>
                      <td className="num">{batch.invalid_rows}</td>
                      <td className="small muted">{formatDate(batch.created_at, locale)}</td>
                      <td className="small muted">{batch.completed_at ? formatDate(batch.completed_at, locale) : '—'}</td>
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
