import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Package,
  Plus,
  ScanLine,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { vendorSalesTotals, vendorTopProducts, vendorVoucherTotals } from '@/lib/aggregates';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Kpi, PageHead, StatusTag } from '@/components/ui';
import { HelpButton } from '@/components/HelpButton';
import { SetupChecklist } from '@/components/SetupChecklist';
import { loadMerchantBundleCached } from '@/lib/merchant-server';
import { requiredDocKeys } from '@/lib/merchant';
import { fulfilmentLabel } from '@/lib/catalog';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorOverviewPage() {
  const ctx = await requireVendor();
  const supabase = ctx.supabase;
  const vendor = ctx.vendor;
  const locale = await getLocale();
  const copy = pick(vendorCopy, locale);
  const t = copy.overview;
  const c = pick(common, locale);

  const [
    itemsResult,
    redemptionsResult,
    redemptionCount,
    productsResult,
    locationsCount,
    outstandingResult,
    salesTotals,
    voucherTotals,
    topTotals,
    paymentsBundle,
  ] = await Promise.all([
    supabase
      .from('order_items')
      .select(
        'id, total_minor, vendor_share_minor, commission_minor, created_at, orders!inner(order_ref, status, created_at, sender_name, recipient_name), products(title)',
      )
      .eq('vendor_id', vendor.id)
      .eq('orders.status', 'paid')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('redemptions')
      .select('id, reference, kind, amount_minor, sessions, occurred_at, vouchers(voucher_code, recipient_name)')
      .eq('vendor_id', vendor.id)
      .order('occurred_at', { ascending: false })
      .limit(6),
    supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id),
    supabase.from('products').select('id, title, status, fulfilment_type').eq('vendor_id', vendor.id),
    supabase
      .from('vendor_locations')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id),
    supabase.rpc('vendor_outstanding_minor', { p_vendor_id: vendor.id }),
    vendorSalesTotals(supabase, vendor.id),
    vendorVoucherTotals(supabase, vendor.id),
    vendorTopProducts(supabase, vendor.id, { limit: 5 }),
    loadMerchantBundleCached(supabase, 'vendor', vendor.id),
  ]);

  const paidItems = itemsResult.data ?? [];
  const redemptions = redemptionsResult.data ?? [];
  const products = productsResult.data ?? [];

  const activeVouchers = voucherTotals.active;

  const outstandingRaw = outstandingResult.data as unknown;
  const outstandingValue = Array.isArray(outstandingRaw)
    ? (outstandingRaw[0] as { vendor_outstanding_minor?: number })?.vendor_outstanding_minor
    : (outstandingRaw as number | null);
  const outstanding = Number(outstandingValue ?? 0);

  const top = topTotals;
  const topMax = top[0]?.grossMinor ?? 1;

  const publishedCount = products.filter((product) => product.status === 'published').length;

  const paymentsApp = paymentsBundle.application;
  const paymentDocsRequired = requiredDocKeys(paymentsApp?.business_type ?? null);
  const paymentDocsUploaded = paymentsBundle.documents.filter(
    (doc) => paymentDocsRequired.includes(doc.doc_type) && doc.status !== 'rejected',
  ).length;
  const agreementSigned = Boolean(
    paymentsBundle.signature &&
      paymentsBundle.agreement &&
      paymentsBundle.signature.agreement_id === paymentsBundle.agreement.id,
  );

  const setupItems = [
    {
      key: 'profile',
      label: 'Complete business profile',
      done: Boolean(vendor.description) && Boolean(vendor.phone) && Boolean(vendor.category_id),
      href: '/vendor/onboarding?step=business',
      action: 'Complete',
    },
    {
      key: 'logo',
      label: 'Add business logo',
      done: Boolean(vendor.logo_url),
      href: '/vendor/onboarding?step=profile',
      action: 'Upload',
    },
    {
      key: 'location',
      label: 'Add your business location',
      done: (locationsCount.count ?? 0) > 0 || Boolean(vendor.city && vendor.area),
      href: '/vendor/settings#locations',
      action: 'Add',
    },
    {
      key: 'gifts',
      label: 'Set up your gift card offerings',
      done: publishedCount > 0,
      href: '/vendor/products/new',
      action: 'Create',
    },
    {
      key: 'payments',
      label: 'Configure online payments',
      done: Boolean(paymentsApp && paymentsApp.payment_methods.length > 0),
      href: '/vendor/payments/application?step=2',
      action: 'Configure',
    },
    {
      key: 'documents',
      label: 'Submit business verification documents',
      done: paymentDocsRequired.length > 0 && paymentDocsUploaded >= paymentDocsRequired.length,
      href: '/vendor/payments/application?step=3',
      action: 'Upload',
    },
    {
      key: 'agreement',
      label: 'Sign payment processing agreement',
      done: agreementSigned,
      href: '/vendor/payments/agreement',
      action: 'Sign',
    },
  ];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={fill(t.greeting, { name: ctx.profile?.full_name?.split(' ')[0] ?? t.greetingFallback })}
        description={fill(t.intro, { vendor: vendor.name })}
        actions={
          <>
            <HelpButton step="lifecycle" />
            <Link className="btn sm" href="/vendor/products/new">
              <Plus size={15} /> {t.newGift}
            </Link>
            <Link className="btn sm primary" href="/vendor/redeem">
              <ScanLine size={15} /> {t.redeemCode}
            </Link>
          </>
        }
      />

      <SetupChecklist
        title="Complete your business setup"
        subtitle="A few steps to get the most out of Tazella. You can dismiss this any time."
        items={setupItems}
        dismissLabel="Dismiss setup checklist"
        storageKey={`vendor-setup-${vendor.id}`}
      />

      {vendor.status !== 'approved' ? (
        <div className="callout warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            {t.accountStatusBefore} <strong>{titleCase(vendor.status, locale)}</strong>
            {t.accountStatusAfter}{' '}
            <Link href="/vendor/onboarding" style={{ textDecoration: 'underline' }}>
              {t.seeApplicationStatus}
            </Link>
            .
          </span>
        </div>
      ) : null}

      <div className="kpi-grid">
        <Kpi
          label={t.grossSales}
          value={formatMoney(salesTotals.grossMinor)}
          hint={`${salesTotals.paidOrders} ${salesTotals.paidOrders === 1 ? t.paidOrder : t.paidOrders}`}
          icon={<Banknote size={17} />}
          tone="mint"
        />
        <Kpi
          label={t.yourShare}
          value={formatMoney(salesTotals.shareMinor)}
          hint={fill(t.commission, { amount: formatMoney(salesTotals.commissionMinor) })}
          icon={<TrendingUp size={17} />}
          tone="lavender"
        />
        <Kpi
          label={t.activeVouchers}
          value={String(activeVouchers)}
          hint={fill(t.issuedInTotal, { count: voucherTotals.total })}
          icon={<Ticket size={17} />}
          tone="gold"
        />
        <Kpi
          label={t.outstandingLiability}
          value={formatMoney(outstanding)}
          hint={fill(t.redemptionsRecorded, { count: redemptionCount.count ?? 0 })}
          icon={<ScanLine size={17} />}
          tone="coral"
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.recentOrders}</h3>
            <Link className="small" href="/vendor/orders" style={{ fontWeight: 800 }}>
              {t.seeAll} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
            </Link>
          </div>
          <div className="panel-body flush">
            {paidItems.length === 0 ? (
              <div className="table-empty">{t.noPaidOrders}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.order}</th>
                      <th>{t.gift}</th>
                      <th>{t.recipient}</th>
                      <th className="num">{c.labels.total}</th>
                      <th className="num">{t.yourShare}</th>
                      <th>{c.labels.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidItems.slice(0, 8).map((item) => {
                      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                      const product = Array.isArray(item.products) ? item.products[0] : item.products;
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="strong">{order?.order_ref ?? '—'}</span>
                          </td>
                          <td>{product?.title ?? t.gift}</td>
                          <td>{order?.recipient_name ?? '—'}</td>
                          <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                          <td className="num strong">{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                          <td className="small muted">{formatDate(item.created_at, locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.topGifts}</h3>
            <Link className="small" href="/vendor/analytics" style={{ fontWeight: 800 }}>
              {copy.nav.analytics}
            </Link>
          </div>
          <div className="panel-body">
            {top.length === 0 ? (
              <p className="small muted">{t.noSalesYet}</p>
            ) : (
              <div className="split-list">
                {top.map((product) => (
                  <div key={product.title ?? 'other'} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span className="strong">{product.title ?? t.gift}</span>
                      <span>{formatMoney(product.grossMinor)}</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${Math.max(6, (product.grossMinor / topMax) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.latestRedemptions}</h3>
            <Link className="small" href="/vendor/vouchers" style={{ fontWeight: 800 }}>
              {copy.nav.vouchers}
            </Link>
          </div>
          <div className="panel-body">
            {redemptions.length === 0 ? (
              <p className="small muted">{t.noRedemptionsYet}</p>
            ) : (
              <div className="timeline">
                {redemptions.map((redemption) => {
                  const voucher = Array.isArray(redemption.vouchers)
                    ? redemption.vouchers[0]
                    : redemption.vouchers;
                  return (
                    <div className="timeline-item" key={redemption.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>
                          {redemption.kind === 'session'
                            ? `${redemption.sessions ?? 1} ${(redemption.sessions ?? 1) === 1 ? t.sessionRedeemed : t.sessionsRedeemed}`
                            : redemption.kind === 'monetary'
                              ? `${formatMoney(Number(redemption.amount_minor ?? 0))} ${t.amountRedeemed}`
                              : t.codeRedeemed}
                        </strong>
                        <span>
                          {voucher?.voucher_code ?? redemption.reference} ·{' '}
                          {voucher?.recipient_name ?? t.customer} ·{' '}
                          {formatDateTime(redemption.occurred_at, locale)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.yourGifts}</h3>
            <Link className="small" href="/vendor/products" style={{ fontWeight: 800 }}>
              {t.manage}
            </Link>
          </div>
          <div className="panel-body">
            {products.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <span className="icon-tile mint">
                  <Package size={20} />
                </span>
                <h3>{t.noGiftsYet}</h3>
                <p>{t.createGiftStart}</p>
                <Link className="btn sm primary" href="/vendor/products/new">
                  <Plus size={14} /> {t.createGift}
                </Link>
              </div>
            ) : (
              <div className="split-list">
                {products.slice(0, 6).map((product) => (
                  <div key={product.id}>
                    <span className="k">
                      <strong style={{ color: 'var(--ink)' }}>{product.title}</strong>
                      <br />
                      <span className="small muted">{fulfilmentLabel(product.fulfilment_type, locale)}</span>
                    </span>
                    <span className="v">
                      <StatusTag status={product.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.quickActions}</h3>
          </div>
          <div className="panel-body">
            <div className="quick-grid">
              <Link className="quick-link" href="/vendor/products/new">
                <span className="icon-tile mint">
                  <Plus size={18} />
                </span>
                {t.newGift}
              </Link>
              <Link className="quick-link" href="/vendor/redeem">
                <span className="icon-tile gold">
                  <ScanLine size={18} />
                </span>
                {t.scanGift}
              </Link>
              <Link className="quick-link" href="/vendor/orders">
                <span className="icon-tile lavender">
                  <ShoppingBag size={18} />
                </span>
                {copy.nav.orders}
              </Link>
              <Link className="quick-link" href="/vendor/staff">
                <span className="icon-tile coral">
                  <Users size={18} />
                </span>
                {copy.nav.team}
              </Link>
            </div>
            <div className="callout info" style={{ marginTop: 16 }}>
              <CheckCircle2 size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
              {t.experienceNote}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
