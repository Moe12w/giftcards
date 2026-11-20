import Link from 'next/link';
import { CheckCircle2, Info, ScanLine, Ticket } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { PageHead, StatusTag } from '@/components/ui';
import { redeemVoucher } from '@/lib/actions/vendor';
import { RedeemPanel } from '@/components/RedeemPanel';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorRedeemPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    reference?: string;
    kind?: string;
    remaining?: string;
    sessions?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).redeem;
  const c = pick(common, locale);

  const { data: recent } = await ctx.supabase
    .from('redemptions')
    .select('id, reference, kind, amount_minor, sessions, occurred_at, vouchers(voucher_code, recipient_name)')
    .eq('vendor_id', ctx.vendor.id)
    .order('occurred_at', { ascending: false })
    .limit(8);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      {params.error ? (
        <div className="callout error" role="alert">
          {params.error}
        </div>
      ) : null}

      {params.ok === '1' ? (
        <section className="panel" style={{ borderColor: 'var(--success)' }}>
          <div className="panel-head" style={{ background: 'var(--mint-soft)' }}>
            <h3>
              <CheckCircle2 size={17} style={{ display: 'inline', verticalAlign: '-3px' }} />{' '}
              {t.recordedTitle}
            </h3>
            <StatusTag status={params.status ?? 'completed'} />
          </div>
          <div className="panel-body">
            <div className="grid-3">
              <div>
                <span className="small muted">{c.labels.reference}</span>
                <div className="strong mono">{params.reference ?? '—'}</div>
              </div>
              <div>
                <span className="small muted">{t.remainingValue}</span>
                <div className="strong">
                  {params.remaining ? formatMoney(Number(params.remaining)) : '—'}
                </div>
              </div>
              <div>
                <span className="small muted">{t.sessionsRemaining}</span>
                <div className="strong">{params.sessions ?? '—'}</div>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 18 }}>
              <Link className="btn primary sm" href="/vendor/redeem">
                {t.redeemAnother}
              </Link>
              <Link className="btn sm" href="/vendor/vouchers">
                {t.viewVouchers}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.newRedemption}</h3>
            <span className="tag mint">
              <ScanLine size={12} /> {t.liveBalance}
            </span>
          </div>
          <div className="panel-body">
            <RedeemPanel
              locale={locale}
              manual={
                <form action={redeemVoucher} style={{ display: 'grid', gap: 16 }}>
              <div className="field">
                <label htmlFor="code">{t.voucherCode}</label>
                <input
                  id="code"
                  name="code"
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="GFT-XXXX-XXXX"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}
                />
                <span className="hint">{t.codeHint}</span>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="amount">{t.amountToRedeem}</label>
                  <input id="amount" name="amount" inputMode="decimal" placeholder="25.00" />
                  <span className="hint">{t.giftCardsOnly}</span>
                </div>
                <div className="field">
                  <label htmlFor="sessions">{t.sessionsToRedeem}</label>
                  <input id="sessions" name="sessions" inputMode="numeric" placeholder="1" />
                  <span className="hint">{t.experienceOnly}</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="notes">{t.noteOptional}</label>
                <input id="notes" name="notes" placeholder={t.notePlaceholder} />
              </div>
              <div className="callout info">
                <Info size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                {t.eitherAmountOrSessions}
              </div>
              <button className="btn primary" type="submit">
                <ScanLine size={16} /> {t.recordRedemption}
              </button>
                </form>
              }
            />
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
                    <strong>{t.stepScan}</strong>
                    <span>{t.stepScanBody}</span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{t.stepCheck}</strong>
                    <span>{t.stepCheckBody}</span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{t.stepConfirm}</strong>
                    <span>{t.stepConfirmBody}</span>
                  </div>
                </div>
              </div>
              <div className="callout warn" style={{ marginTop: 8 }}>
                {t.cannotUndo}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.recentRedemptions}</h3>
              <Link className="small" href="/vendor/vouchers" style={{ fontWeight: 800 }}>
                {t.allVouchers}
              </Link>
            </div>
            <div className="panel-body flush">
              {(recent ?? []).length === 0 ? (
                <div className="table-empty">{t.noRedemptions}</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{c.labels.code}</th>
                        <th>{t.used}</th>
                        <th>{t.when}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recent ?? []).map((redemption) => {
                        const voucher = Array.isArray(redemption.vouchers)
                          ? redemption.vouchers[0]
                          : redemption.vouchers;
                        return (
                          <tr key={redemption.id}>
                            <td className="mono small">{voucher?.voucher_code ?? '—'}</td>
                            <td>
                              {redemption.kind === 'session'
                                ? `${redemption.sessions ?? 1} ${(redemption.sessions ?? 1) === 1 ? c.time.session : c.time.sessions}`
                                : formatMoney(Number(redemption.amount_minor ?? 0))}
                            </td>
                            <td className="small muted">
                              {formatDateTime(redemption.occurred_at, locale)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <div className="card gold">
            <span className="icon-tile ink">
              <Ticket size={20} />
            </span>
            <h3 style={{ marginTop: 12 }}>{t.lookingForCode}</h3>
            <p className="small" style={{ marginTop: 6 }}>
              {t.lookingForCodeBody}
            </p>
            <Link className="btn sm" href="/vendor/vouchers" style={{ marginTop: 12 }}>
              {t.openVouchers}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
