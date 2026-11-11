import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireAdmin } from '@/lib/auth';
import { initials } from '@/lib/format';
import { ADMIN_SCRIPT } from '@/lib/tutorial';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const locale = ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en';

  // The menu follows the life cycle: who is allowed to sell, what is live,
  // what moved, and who needs help.
  const nav: NavGroup[] = [
    {
      step: 1,
      label: 'Start here',
      labelAr: 'ابدأ من هنا',
      items: [
        {
          href: '/admin',
          label: 'Overview',
          labelAr: 'نظرة عامة',
          icon: 'dashboard',
          hint: 'Sales, balance, reviews and open tickets.',
          hintAr: 'المبيعات والرصيد والطلبات والمذاكر المفتوحة.',
        },
        {
          href: '/admin/vendors',
          label: 'Vendors',
          labelAr: 'البائعون',
          icon: 'vendors',
          hint: 'Applications, terms and who is live.',
          hintAr: 'الطلبات والشروط ومن هو منشور.',
        },
      ],
    },
    {
      step: 2,
      label: 'Moderate the catalogue',
      labelAr: 'راقب الكتالوج',
      items: [
        {
          href: '/admin/products',
          label: 'Products',
          labelAr: 'المنتجات',
          icon: 'products',
          hint: 'Every gift from every vendor and partner.',
          hintAr: 'كل هدية من كل بائع وشريك.',
        },
        {
          href: '/admin/promotions',
          label: 'Promotions',
          labelAr: 'العروض',
          icon: 'promotions',
          hint: 'Discount codes customers can use.',
          hintAr: 'أكواد الخصم التي يستخدمها العملاء.',
        },
      ],
    },
    {
      step: 3,
      label: 'Follow the money',
      labelAr: 'تابع المال',
      items: [
        {
          href: '/admin/orders',
          label: 'Orders',
          labelAr: 'الطلبات',
          icon: 'orders',
          hint: 'What was bought, by whom and for how much.',
          hintAr: 'ما اشتراه من، وبكم.',
        },
        {
          href: '/admin/vouchers',
          label: 'Vouchers',
          labelAr: 'البطاقات',
          icon: 'vouchers',
          hint: 'Issued, claimed, redeemed and outstanding.',
          hintAr: 'المصدرة والمطالَب بها والمستبدلة والمتبقية.',
        },
      ],
    },
    {
      step: 4,
      label: 'The network',
      labelAr: 'الشبكة',
      items: [
        {
          href: '/admin/customers',
          label: 'Customers',
          labelAr: 'العملاء',
          icon: 'customers',
          hint: 'Accounts, order history and standing.',
          hintAr: 'الحسابات وسجل الطلبات والحالة.',
        },
        {
          href: '/admin/enterprise',
          label: 'Enterprise',
          labelAr: 'الشركاء',
          icon: 'enterprise',
          hint: 'Corporate partners, codes and redemptions.',
          hintAr: 'الشركاء المؤسسيون والرموز والاستبدالات.',
        },
      ],
    },
    {
      step: 5,
      label: 'Look after the platform',
      labelAr: 'رعِ المنصة',
      items: [
        {
          href: '/admin/support',
          label: 'Support',
          labelAr: 'الدعم',
          icon: 'support',
          hint: 'Messages waiting for an answer.',
          hintAr: 'رسائل تنتظر الرد.',
        },
        {
          href: '/admin/audit',
          label: 'Audit log',
          labelAr: 'سجل التدقيق',
          icon: 'audit',
          hint: 'Every sensitive action, kept on record.',
          hintAr: 'كل إجراء حساس محفوظ في السجل.',
        },
        {
          href: '/admin/settings',
          label: 'Settings',
          labelAr: 'الإعدادات',
          icon: 'settings',
          hint: 'Platform configuration and public values.',
          hintAr: 'إعدادات المنصة والقيم العامة.',
        },
      ],
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
      tutorial={ADMIN_SCRIPT}
      locale={locale}
      autoOpenTutorial={!ctx.profile?.tutorial_completed_at}
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
