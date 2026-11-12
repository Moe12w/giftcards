import Link from 'next/link';
import { BadgePercent, Pause, Play, Plus, Search, Ticket } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSavePromo, adminTogglePromo } from '@/lib/actions/admin';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { formatMoney, minorToInput } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

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
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).promotions;
  const c = pick(common, locale);
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <BadgePercent size={17} />
          </span>
          <strong>{allPromos.length}</strong>
          <span>{t.allPromotions}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <BadgePercent size={17} />
          </span>
          <strong>{active}</strong>
          <span>{t.activeNow}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{totalRedemptions}</strong>
          <span>{t.totalRedemptions}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <BadgePercent size={17} />
          </span>
          <strong>{scheduled}</strong>
          <span>{t.scheduled}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{editing ? fill(t.editPromo, { code: editing.code }) : t.createPromo}</h3>
            {editing ? (
              <Link className="btn sm ghost" href="/admin/promotions">
                {t.cancelEdit}
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
                  <label htmlFor="code">{c.labels.code}</label>
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
                  <label htmlFor="kind">{t.kind}</label>
                  <select id="kind" name="kind" defaultValue={editing?.kind ?? 'percent'}>
                    <option value="percent">{t.percentage}</option>
                    <option value="fixed">{t.fixedAmount}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="value">{c.labels.value}</label>
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
                    placeholder={t.valuePlaceholder}
                  />
                  <span className="hint">{t.valueHint}</span>
                </div>
                <div className="field">
                  <label htmlFor="min_subtotal">{t.minSubtotal}</label>
                  <input
                    id="min_subtotal"
                    name="min_subtotal"
                    inputMode="decimal"
                    defaultValue={editing ? minorToInput(editing.min_subtotal_minor) : '0.00'}
                  />
                </div>
                <div className="field">
                  <label htmlFor="max_redemptions">{t.maxRedemptions}</label>
                  <input
                    id="max_redemptions"
                    name="max_redemptions"
                    inputMode="numeric"
                    defaultValue={editing?.max_redemptions ?? ''}
                    placeholder={t.unlimited}
                  />
                </div>
                <div className="field">
                  <label htmlFor="starts_at">{t.startsAt}</label>
                  <input
                    id="starts_at"
                    name="starts_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(editing?.starts_at)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ends_at">{t.endsAt}</label>
                  <input
                    id="ends_at"
                    name="ends_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(editing?.ends_at)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="active">{t.availability}</label>
                  <label className="checkbox-row">
                    <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> {c.status.active}
                  </label>
                </div>
              </div>
              <button className="btn primary" type="submit">
                {editing ? t.savePromotion : t.createPromotion}
              </button>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.howItWorks}</h3>
            <BadgePercent size={16} />
          </div>
          <div className="panel-body">
            <div className="timeline">
              <div className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>{t.percentage}</strong>
                  <span>{t.percentageHint}</span>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>{t.fixedAmount}</strong>
                  <span>{t.fixedHint}</span>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>{t.limits}</strong>
                  <span>{t.limitsHint}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <form className="toolbar" action="/admin/promotions" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allPromotions}</option>
          <option value="active">{c.status.active}</option>
          <option value="scheduled">{t.scheduled}</option>
          <option value="paused">{t.paused}</option>
          <option value="expired">{c.status.expired}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/promotions">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.title}</h3>
          <span className="small muted">{fill(t.shown, { count: promos.length })}</span>
        </div>
        <div className="panel-body flush">
          {promos.length === 0 ? (
            <div className="table-empty">{t.noPromotionsMatch}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.code}</th>
                    <th>{t.discount}</th>
                    <th className="num">{t.minSubtotalShort}</th>
                    <th className="num">{t.used}</th>
                    <th>{t.window}</th>
                    <th>{t.state}</th>
                    <th>{c.labels.created}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
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
                          <span className="sub">{titleCase(promo.kind, locale)}</span>
                        </td>
                        <td className="num">{formatMoney(Number(promo.min_subtotal_minor ?? 0))}</td>
                        <td className="num">
                          {promo.redeemed_count}
                          {promo.max_redemptions ? <span className="sub"> / {promo.max_redemptions}</span> : null}
                        </td>
                        <td className="small">
                          {promo.starts_at ? formatDateTime(promo.starts_at, locale) : t.anytime}
                          <br />
                          <span className="sub">
                            {promo.ends_at
                              ? fill(t.until, { date: formatDateTime(promo.ends_at, locale) })
                              : t.noEndDate}
                          </span>
                        </td>
                        <td>
                          <StatusTag status={state} />
                        </td>
                        <td className="small muted">{formatDate(promo.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/promotions?edit=${promo.id}`}>
                              {c.actions.edit}
                            </Link>
                            <form action={adminTogglePromo}>
                              <input type="hidden" name="promo_id" value={promo.id} />
                              <input type="hidden" name="active" value={promo.active ? 'false' : 'true'} />
                              <button className="btn sm ghost" type="submit">
                                {promo.active ? (
                                  <>
                                    <Pause size={13} /> {t.pause}
                                  </>
                                ) : (
                                  <>
                                    <Play size={13} /> {t.activate}
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
