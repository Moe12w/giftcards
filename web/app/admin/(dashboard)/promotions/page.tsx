import Link from 'next/link';
import { BadgePercent, Pause, Play, Plus, Search, Ticket } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSavePromo, adminTogglePromo } from '@/lib/actions/admin';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { formatMoney, minorToInput } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function promoState(promo: {
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}): string {
  if (!promo.active) return 'paused';
  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return 'scheduled';
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) return 'expired';
  return 'active';
}

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; edit?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const { data, error } = await ctx.supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  const allPromos = data ?? [];
  const promos = allPromos.filter((promo) => {
    const state = promoState(promo);
    if (status && state !== status) return false;
    if (!q) return true;
    return promo.code.toLowerCase().includes(q);
  });

  const editing = params.edit ? allPromos.find((promo) => promo.id === params.edit) ?? null : null;
  const active = allPromos.filter((promo) => promoState(promo) === 'active').length;
  const scheduled = allPromos.filter((promo) => promoState(promo) === 'scheduled').length;
  const totalRedemptions = allPromos.reduce((sum, promo) => sum + Number(promo.redeemed_count ?? 0), 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Catalogue"
        title="Promotions"
        description="Discount codes customers can apply at checkout. Percent codes use whole percentages; fixed codes use QAR."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Promotion saved.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <BadgePercent size={17} />
          </span>
          <strong>{allPromos.length}</strong>
          <span>All promotions</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <BadgePercent size={17} />
          </span>
          <strong>{active}</strong>
          <span>Active now</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{totalRedemptions}</strong>
          <span>Total redemptions</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <BadgePercent size={17} />
          </span>
          <strong>{scheduled}</strong>
          <span>Scheduled</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{editing ? `Edit ${editing.code}` : 'Create a promotion'}</h3>
            {editing ? (
              <Link className="btn sm ghost" href="/admin/promotions">
                Cancel edit
              </Link>
            ) : (
              <Plus size={16} />
            )}
          </div>
          <div className="panel-body">
            <form action={adminSavePromo} style={{ display: 'grid', gap: 14 }}>
              {editing ? <input type="hidden" name="promo_id" value={editing.id} /> : null}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="code">Code</label>
                  <input
                    id="code"
                    name="code"
                    required
                    defaultValue={editing?.code ?? ''}
                    placeholder="GIFT20"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="kind">Kind</label>
                  <select id="kind" name="kind" defaultValue={editing?.kind ?? 'percent'}>
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="value">Value</label>
                  <input
                    id="value"
                    name="value"
                    inputMode="decimal"
                    required
                    defaultValue={
                      editing
                        ? editing.kind === 'fixed'
                          ? minorToInput(editing.value)
                          : String(editing.value)
                        : ''
                    }
                    placeholder="20 or 50.00"
                  />
                  <span className="hint">Percent (1–100) or QAR amount, depending on the kind.</span>
                </div>
                <div className="field">
                  <label htmlFor="min_subtotal">Minimum subtotal (QAR)</label>
                  <input
                    id="min_subtotal"
                    name="min_subtotal"
                    inputMode="decimal"
                    defaultValue={editing ? minorToInput(editing.min_subtotal_minor) : '0.00'}
                  />
                </div>
                <div className="field">
                  <label htmlFor="max_redemptions">Max redemptions</label>
                  <input
                    id="max_redemptions"
                    name="max_redemptions"
                    inputMode="numeric"
                    defaultValue={editing?.max_redemptions ?? ''}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="field">
                  <label htmlFor="starts_at">Starts at</label>
                  <input
                    id="starts_at"
                    name="starts_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(editing?.starts_at)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ends_at">Ends at</label>
                  <input
                    id="ends_at"
                    name="ends_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(editing?.ends_at)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="active">Availability</label>
                  <label className="checkbox-row">
                    <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Active
                  </label>
                </div>
              </div>
              <button className="btn primary" type="submit">
                {editing ? 'Save promotion' : 'Create promotion'}
              </button>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>How promo codes work</h3>
            <BadgePercent size={16} />
          </div>
          <div className="panel-body">
            <div className="timeline">
              <div className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>Percentage</strong>
                  <span>A value of 20 means 20% off the subtotal.</span>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>Fixed amount</strong>
                  <span>The value is stored in fils and shown as QAR.</span>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>Limits</strong>
                  <span>Minimum subtotal, maximum redemptions and the date window are enforced at checkout.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <form className="toolbar" action="/admin/promotions" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Promo code…" aria-label="Search promotions" />
        </div>
        <select name="status" defaultValue={status} aria-label="Promotion status">
          <option value="">All promotions</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="paused">Paused</option>
          <option value="expired">Expired</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/promotions">
            Clear
          </Link>
        ) : null}
      </form>

      <section className="panel">
        <div className="panel-head">
          <h3>Promotions</h3>
          <span className="small muted">{promos.length} shown</span>
        </div>
        <div className="panel-body flush">
          {promos.length === 0 ? (
            <div className="table-empty">No promotions match.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th className="num">Min subtotal</th>
                    <th className="num">Used</th>
                    <th>Window</th>
                    <th>State</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => {
                    const state = promoState(promo);
                    return (
                      <tr key={promo.id}>
                        <td className="mono strong">{promo.code}</td>
                        <td>
                          <span className="tag gold">
                            {promo.kind === 'percent' ? `${promo.value}%` : formatMoney(Number(promo.value))}
                          </span>
                          <br />
                          <span className="sub">{titleCase(promo.kind)}</span>
                        </td>
                        <td className="num">{formatMoney(Number(promo.min_subtotal_minor ?? 0))}</td>
                        <td className="num">
                          {promo.redeemed_count}
                          {promo.max_redemptions ? <span className="sub"> / {promo.max_redemptions}</span> : null}
                        </td>
                        <td className="small">
                          {promo.starts_at ? formatDateTime(promo.starts_at) : 'Anytime'}
                          <br />
                          <span className="sub">
                            {promo.ends_at ? `Until ${formatDateTime(promo.ends_at)}` : 'No end date'}
                          </span>
                        </td>
                        <td>
                          <StatusTag status={state} />
                        </td>
                        <td className="small muted">{formatDate(promo.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/promotions?edit=${promo.id}`}>
                              Edit
                            </Link>
                            <form action={adminTogglePromo}>
                              <input type="hidden" name="promo_id" value={promo.id} />
                              <input type="hidden" name="active" value={promo.active ? 'false' : 'true'} />
                              <button className="btn sm ghost" type="submit">
                                {promo.active ? (
                                  <>
                                    <Pause size={13} /> Pause
                                  </>
                                ) : (
                                  <>
                                    <Play size={13} /> Activate
                                  </>
                                )}
                              </button>
                            </form>
                          </div>
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
    </div>
  );
}
