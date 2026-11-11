import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireVendor } from '@/lib/auth';
import { switchVendor } from '@/lib/actions/vendor';
import { initials, titleCase } from '@/lib/format';

export default async function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireVendor();
  const vendor = ctx.vendor;

  const nav: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { href: '/vendor', label: 'Overview', icon: 'dashboard' },
        { href: '/vendor/analytics', label: 'Analytics', icon: 'analytics' },
      ],
    },
    {
      label: 'Sell',
      items: [
        { href: '/vendor/products', label: 'Gifts', icon: 'products' },
        { href: '/vendor/orders', label: 'Orders', icon: 'orders' },
        { href: '/vendor/vouchers', label: 'Vouchers', icon: 'vouchers' },
        { href: '/vendor/redeem', label: 'Redeem', icon: 'redeem' },
      ],
    },
    {
      label: 'Business',
      items: [
        { href: '/vendor/onboarding', label: 'Onboarding', icon: 'onboarding' },
        { href: '/vendor/staff', label: 'Team', icon: 'staff' },
        { href: '/vendor/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ];

  const switcher =
    ctx.memberships.length > 1 ? (
      <form action={switchVendor} className="workspace-switch">
        <select name="vendor_id" defaultValue={vendor.id} aria-label="Switch vendor">
          {ctx.memberships.map((membership) => (
            <option key={membership.vendor_id} value={membership.vendor_id}>
              {membership.vendors?.name ?? 'Vendor'}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          Switch
        </button>
      </form>
    ) : null;

  return (
    <DashShell
      portalLabel="Vendor dashboard"
      workspaceName={vendor.name}
      workspaceMeta={`${[vendor.area, vendor.city].filter(Boolean).join(' · ') || 'Qatar'} · ${titleCase(vendor.status)}`}
      userName={ctx.profile?.full_name ?? ctx.user.email ?? 'Vendor'}
      userEmail={ctx.user.email ?? ''}
      userInitials={initials(ctx.profile?.full_name ?? ctx.user.email ?? 'V')}
      accent="mint"
      nav={nav}
      workspaceSwitcher={switcher}
      topRight={
        <>
          <span className="tag mint">{titleCase(ctx.role)}</span>
          <Link className="btn sm ghost" href={`/vendors/${vendor.slug ?? vendor.id}`} target="_blank">
            View public page
          </Link>
          <Link className="btn sm primary" href="/vendor/redeem">
            <ScanLine size={15} /> Redeem
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
