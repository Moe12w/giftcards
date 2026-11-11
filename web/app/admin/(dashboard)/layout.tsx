import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireAdmin } from '@/lib/auth';
import { initials } from '@/lib/format';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();

  const nav: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { href: '/admin', label: 'Overview', icon: 'dashboard' },
        { href: '/admin/orders', label: 'Orders', icon: 'orders' },
        { href: '/admin/vouchers', label: 'Vouchers', icon: 'vouchers' },
      ],
    },
    {
      label: 'Network',
      items: [
        { href: '/admin/vendors', label: 'Vendors', icon: 'vendors' },
        { href: '/admin/customers', label: 'Customers', icon: 'customers' },
        { href: '/admin/enterprise', label: 'Enterprise', icon: 'enterprise' },
      ],
    },
    {
      label: 'Catalogue',
      items: [
        { href: '/admin/products', label: 'Products', icon: 'products' },
        { href: '/admin/promotions', label: 'Promotions', icon: 'promotions' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/admin/support', label: 'Support', icon: 'support' },
        { href: '/admin/audit', label: 'Audit log', icon: 'audit' },
      ],
    },
    {
      label: 'System',
      items: [{ href: '/admin/settings', label: 'Settings', icon: 'settings' }],
    },
  ];

  return (
    <DashShell
      portalLabel="Platform admin"
      workspaceName="Giftly Qatar"
      workspaceMeta="Marketplace operations"
      userName={ctx.profile?.full_name ?? ctx.user.email ?? 'Admin'}
      userEmail={ctx.user.email ?? ''}
      userInitials={initials(ctx.profile?.full_name ?? ctx.user.email ?? 'A')}
      accent="coral"
      nav={nav}
      topRight={
        <>
          <span className="tag coral">Admin</span>
          <Link className="btn sm ghost" href="/" target="_blank">
            <ExternalLink size={14} /> Public site
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
