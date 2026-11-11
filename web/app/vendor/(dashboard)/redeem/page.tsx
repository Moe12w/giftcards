import Link from 'next/link';
import { CheckCircle2, Info, ScanLine, Ticket } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { PageHead, StatusTag } from '@/components/ui';
import { redeemVoucher } from '@/lib/actions/vendor';
import { RedeemPanel } from '@/components/RedeemPanel';

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

  const { data: recent } = await ctx.supabase
    .from('redemptions')
    .select('id, reference, kind, amount_minor, sessions, occurred_at, vouchers(voucher_code, recipient_name)')
    .eq('vendor_id', ctx.vendor.id)
    .order('occurred_at', { ascending: false })
    .limit(8);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="At the counter"
        title="Redeem a voucher"
        description="Scan the customer's app or wallet pass with the camera, or type the code by hand. Use the amount for gift cards, or the number of sessions for an experience."
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
              <CheckCircle2 size={17} style={{ display: 'inline', verticalAlign: '-3px' }} /> Redemption
              recorded
            </h3>
            <StatusTag status={params.status ?? 'completed'} />
          </div>
          <div className="panel-body">
            <div className="grid-3">
              <div>
                <span className="small muted">Reference</span>
                <div className="strong mono">{params.reference ?? '—'}</div>
              </div>
              <div>
                <span className="small muted">Remaining value</span>
                <div className="strong">
                  {params.remaining ? formatMoney(Number(params.remaining)) : '—'}
                </div>
              </div>
              <div>
                <span className="small muted">Sessions remaining</span>
                <div className="strong">{params.sessions ?? '—'}</div>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 18 }}>
              <Link className="btn primary sm" href="/vendor/redeem">
                Redeem another
              </Link>
              <Link className="btn sm" href="/vendor/vouchers">
                View vouchers
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>New redemption</h3>
            <span className="tag mint">
              <ScanLine size={12} /> Live balance
            </span>
          </div>
          <div className="panel-body">
            <RedeemPanel
              locale={ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en'}
              manual={
                <form action={redeemVoucher} style={{ display: 'grid', gap: 16 }}>
              <div className="field">
                <label htmlFor="code">Voucher code</label>
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
                <span className="hint">The code is on the customer's gift card or QR pass.</span>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="amount">Amount to redeem (QAR)</label>
                  <input id="amount" name="amount" inputMode="decimal" placeholder="25.00" />
                  <span className="hint">Gift cards only.</span>
                </div>
                <div className="field">
                  <label htmlFor="sessions">Sessions to redeem</label>
                  <input id="sessions" name="sessions" inputMode="numeric" placeholder="1" />
                  <span className="hint">Experience gifts only.</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="notes">Note (optional)</label>
                <input id="notes" name="notes" placeholder="Table 4, two flat whites" />
              </div>
              <div className="callout info">
                <Info size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Enter either an
                amount or a number of sessions — not both. The voucher status updates automatically.
              </div>
              <button className="btn primary" type="submit">
                <ScanLine size={16} /> Record redemption
              </button>
                </form>
              }
            />
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>How it works</h3>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>1. Scan the gift</strong>
                    <span>
                      The customer opens the app or their wallet pass and the camera reads the code.
                      You can still type a code by hand.
                    </span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>2. Check what is owed</strong>
                    <span>
                      You see the gift, the recipient and the balance left before you confirm.
                    </span>
                  </div>
                </div>
                <div className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>3. Confirm once</strong>
                    <span>
                      The balance is deducted immediately and a reference is saved for your reports.
                    </span>
                  </div>
                </div>
              </div>
              <div className="callout warn" style={{ marginTop: 8 }}>
                Redemptions cannot be undone from this screen. If you make a mistake, contact support
                with the reference.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent redemptions</h3>
              <Link className="small" href="/vendor/vouchers" style={{ fontWeight: 800 }}>
                All vouchers
              </Link>
            </div>
            <div className="panel-body flush">
              {(recent ?? []).length === 0 ? (
                <div className="table-empty">No redemptions yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Used</th>
                        <th>When</th>
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
                                ? `${redemption.sessions ?? 1} session${(redemption.sessions ?? 1) === 1 ? '' : 's'}`
                                : formatMoney(Number(redemption.amount_minor ?? 0))}
                            </td>
                            <td className="small muted">{formatDateTime(redemption.occurred_at)}</td>
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
            <h3 style={{ marginTop: 12 }}>Looking for a code?</h3>
            <p className="small" style={{ marginTop: 6 }}>
              Vouchers are listed with their live balance and status. Use the search to find a
              recipient.
            </p>
            <Link className="btn sm" href="/vendor/vouchers" style={{ marginTop: 12 }}>
              Open vouchers
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
