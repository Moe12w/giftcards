import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireEnterprise } from '@/lib/auth';
import { initials, titleCase } from '@/lib/format';
import { ENTERPRISE_SCRIPT } from '@/lib/tutorial';

export default async function EnterpriseDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireEnterprise();
  const partner = ctx.partner;
  const locale = ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en';

  // The menu follows the life cycle of a corporate code: set up, define the
  // reward, import the codes, then allocate and reconcile them.
  const nav: NavGroup[] = [
    {
      step: 1,
      label: 'Start here',
      labelAr: 'ابدأ من هنا',
      items: [
        {
          href: '/enterprise',
          label: 'Overview',
          labelAr: 'نظرة عامة',
          icon: 'dashboard',
          hint: 'Stock, allocations and redemptions today.',
          hintAr: 'المخزون والتخصيصات والاستبدالات اليوم.',
        },
        {
          href: '/enterprise/settings',
          label: 'Company settings',
          labelAr: 'إعدادات الشركة',
          icon: 'settings',
          hint: 'Your details and who on the team can act.',
          hintAr: 'بياناتك ومن يمكنه التصرف من الفريق.',
        },
      ],
    },
    {
      step: 2,
      label: 'Define the reward',
      labelAr: 'عرّف المكافأة',
      items: [
        {
          href: '/enterprise/products',
          label: 'Products',
          labelAr: 'المنتجات',
          icon: 'products',
          hint: 'Face value, selling price and commission.',
          hintAr: 'قيمة الرمز وسعر البيع والعمولة.',
        },
      ],
    },
    {
      step: 3,
      label: 'Bring the codes',
      labelAr: 'استورد الرموز',
      items: [
        {
          href: '/enterprise/import',
          label: 'Import codes',
          labelAr: 'استيراد الرموز',
          icon: 'import',
          hint: 'Paste your codes and check the result.',
          hintAr: 'الصق رموزك وراجع النتيجة.',
        },
      ],
    },
    {
      step: 4,
      label: 'Allocate and reconcile',
      labelAr: 'الخصم والمطابقة',
      items: [
        {
          href: '/enterprise/inventory',
          label: 'Inventory',
          labelAr: 'المخزون',
          icon: 'inventory',
          hint: 'Every code and where it is in its life.',
          hintAr: 'كل رمز وأين هو في رحلته.',
        },
        {
          href: '/enterprise/reports',
          label: 'Reports',
          labelAr: 'التقارير',
          icon: 'reports',
          hint: 'What to hand over to finance.',
          hintAr: 'ما يمرَّر إلى المحاسبة.',
        },
      ],
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
      tutorial={ENTERPRISE_SCRIPT}
      locale={locale}
      autoOpenTutorial={!ctx.profile?.tutorial_completed_at}
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
