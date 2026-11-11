import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireEnterprise } from '@/lib/auth';
import { initials, titleCase } from '@/lib/format';

export default async function EnterpriseDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireEnterprise();
  const partner = ctx.partner;

  const nav: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { href: '/enterprise', label: 'Overview', icon: 'dashboard' },
        { href: '/enterprise/reports', label: 'Reports', icon: 'reports' },
      ],
    },
    {
      label: 'Rewards',
      items: [
        { href: '/enterprise/products', label: 'Products', icon: 'products' },
        { href: '/enterprise/inventory', label: 'Inventory', icon: 'inventory' },
        { href: '/enterprise/import', label: 'Import codes', icon: 'import' },
      ],
    },
    {
      label: 'Account',
      items: [{ href: '/enterprise/settings', label: 'Settings', icon: 'settings' }],
    },
  ];

  return (
    <DashShell
      portalLabel="Enterprise portal"
      workspaceName={partner.name}
      workspaceMeta={`${[partner.industry, partner.status].filter(Boolean).map((value) => titleCase(String(value))).join(' · ') || 'Qatar'}`}
      userName={ctx.profile?.full_name ?? ctx.user.email ?? 'Partner'}
      userEmail={ctx.user.email ?? ''}
      userInitials={initials(ctx.profile?.full_name ?? ctx.user.email ?? 'P')}
      accent="lavender"
      nav={nav}
      topRight={
        <>
          <span className="tag lavender">{titleCase(ctx.role)}</span>
          <Link className="btn sm ghost" href="/corporate#enquiry" target="_blank">
            <ExternalLink size={14} /> Corporate site
          </Link>
          <Link className="btn sm primary" href="/enterprise/import">
            Import codes
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
