import Link from 'next/link';
import { LifeBuoy, ScanLine } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireVendor } from '@/lib/auth';
import { switchVendor } from '@/lib/actions/vendor';
import { initials, titleCase } from '@/lib/format';
import { VENDOR_SCRIPT } from '@/lib/tutorial';
import { getUserLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';
import { pick } from '@/lib/i18n';

export default async function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireVendor();
  const vendor = ctx.vendor;
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const chrome = pick(vendorCopy, locale).chrome;
  const t = pick(vendorCopy, locale).nav;

  // The menu follows the life cycle of a gift: set up, create, sell, redeem, report.
  const nav: NavGroup[] = [
    {
      step: 1,
      label: t.group1,
      items: [
        { href: '/vendor', label: t.overview, icon: 'dashboard', hint: t.overviewHint },
        { href: '/vendor/onboarding', label: t.onboarding, icon: 'onboarding', hint: t.onboardingHint },
      ],
    },
    {
      step: 2,
      label: t.group2,
      items: [
        { href: '/vendor/products', label: t.gifts, icon: 'products', hint: t.giftsHint },
        { href: '/vendor/bulk-products', label: t.bulkProducts ?? 'Bulk products', icon: 'products', hint: t.bulkProductsHint ?? 'Exclusive bulk offers for business buyers.' },
      ],
    },
    {
      step: 3,
      label: t.group3,
      items: [
        { href: '/vendor/orders', label: t.orders, icon: 'orders', hint: t.ordersHint },
        { href: '/vendor/bulk-orders', label: t.bulkOrders ?? 'Bulk orders', icon: 'finance', hint: t.bulkOrdersHint ?? 'Corporate orders and what you earned.' },
        { href: '/vendor/vouchers', label: t.vouchers, icon: 'vouchers', hint: t.vouchersHint },
      ],
    },
    {
      step: 4,
      label: t.group4,
      items: [{ href: '/vendor/redeem', label: t.redeem, icon: 'redeem', hint: t.redeemHint }],
    },
    {
      step: 5,
      label: t.group5,
      items: [
        { href: '/vendor/analytics', label: t.analytics, icon: 'analytics', hint: t.analyticsHint },
        { href: '/vendor/staff', label: t.team, icon: 'staff', hint: t.teamHint },
        { href: '/vendor/settings', label: t.settings, icon: 'settings', hint: t.settingsHint },
        { href: '/vendor/support', label: t.support, icon: 'support', hint: t.supportHint },
      ],
    },
    {
      step: 6,
      label: t.group6,
      items: [
        { href: '/vendor/advertising', label: t.advertising, icon: 'promotions', hint: t.advertisingHint },
        { href: '/vendor/advertising/new', label: t.advertisingNew, icon: 'reports', hint: t.advertisingNewHint },
      ],
    },
  ];

  const switcher =
    ctx.memberships.length > 1 ? (
      <form action={switchVendor} className="workspace-switch">
        <select name="vendor_id" defaultValue={vendor.id} aria-label={chrome.switchVendor}>
          {ctx.memberships.map((membership) => (
            <option key={membership.vendor_id} value={membership.vendor_id}>
              {membership.vendors?.name ?? chrome.workspaceFallback}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          {chrome.switch}
        </button>
      </form>
    ) : null;

  return (
    <DashShell
      portalLabel={chrome.portal}
      workspaceName={vendor.name}
      workspaceLogoUrl={vendor.logo_url ?? null}
      workspaceMeta={`${[vendor.area, vendor.city].filter(Boolean).join(' · ') || chrome.qatar} · ${titleCase(vendor.status, locale)}`}
      userName={ctx.profile?.full_name ?? ctx.user.email ?? chrome.workspaceFallback}
      userEmail={ctx.user.email ?? ''}
      userInitials={initials(ctx.profile?.full_name ?? ctx.user.email ?? 'V')}
      accent="mint"
      nav={nav}
      workspaceSwitcher={switcher}
      tutorial={VENDOR_SCRIPT}
      locale={locale}
      autoOpenTutorial={!ctx.profile?.tutorial_completed_at}
      topRight={
        <>
          <span className="tag mint dash-role">{titleCase(ctx.role, locale)}</span>
          <Link className="btn sm ghost" href="/vendor/support">
            <LifeBuoy size={15} /> {t.support}
          </Link>
          <Link className="btn sm ghost" href={`/vendors/${vendor.slug ?? vendor.id}`} target="_blank">
            {chrome.viewPublicPage}
          </Link>
          <Link className="btn sm primary" href="/vendor/redeem">
            <ScanLine size={15} /> {chrome.scanAGift}
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
