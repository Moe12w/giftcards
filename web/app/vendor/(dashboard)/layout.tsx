import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import { DashShell, type NavGroup } from '@/components/DashShell';
import { requireVendor } from '@/lib/auth';
import { switchVendor } from '@/lib/actions/vendor';
import { initials, titleCase } from '@/lib/format';
import { VENDOR_SCRIPT } from '@/lib/tutorial';

export default async function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireVendor();
  const vendor = ctx.vendor;
  const locale = ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en';

  // The menu follows the life cycle of a gift: set up, create, sell, redeem, report.
  const nav: NavGroup[] = [
    {
      step: 1,
      label: 'Start here',
      labelAr: 'ابدأ من هنا',
      items: [
        {
          href: '/vendor',
          label: 'Overview',
          labelAr: 'نظرة عامة',
          icon: 'dashboard',
          hint: 'How the business stands today.',
          hintAr: 'حالة نشاطك اليوم.',
        },
        {
          href: '/vendor/onboarding',
          label: 'Onboarding',
          labelAr: 'خطوات البدء',
          icon: 'onboarding',
          hint: 'The checklist before you go live.',
          hintAr: 'قائمة التحقق قبل الانطلاق.',
        },
      ],
    },
    {
      step: 2,
      label: 'Create the gift',
      labelAr: 'أنشئ الهدية',
      items: [
        {
          href: '/vendor/products',
          label: 'Gifts',
          labelAr: 'الهدايا',
          icon: 'products',
          hint: 'Money, experiences and the packages you sell.',
          hintAr: 'Money والتجارب والباقات التي تبيعها.',
        },
      ],
    },
    {
      step: 3,
      label: 'Sell and deliver',
      labelAr: 'البيع والتسليم',
      items: [
        {
          href: '/vendor/orders',
          label: 'Orders',
          labelAr: 'الطلبات',
          icon: 'orders',
          hint: 'What was bought, and what you earned.',
          hintAr: 'ما تم شراؤه وما استحق لك.',
        },
        {
          href: '/vendor/vouchers',
          label: 'Vouchers',
          labelAr: 'البطاقات',
          icon: 'vouchers',
          hint: 'Every code issued and its balance.',
          hintAr: 'كل رمز صدر ورصيده.',
        },
      ],
    },
    {
      step: 4,
      label: 'Redeem at the counter',
      labelAr: 'الاستبدال عند الكاونتر',
      items: [
        {
          href: '/vendor/redeem',
          label: 'Redeem a code',
          labelAr: 'استبدال رمز',
          icon: 'redeem',
          hint: 'Take payment off a gift card.',
          hintAr: 'خصم الدفعة من بطاقة الهدية.',
        },
      ],
    },
    {
      step: 5,
      label: 'Run the business',
      labelAr: 'إدارة النشاط',
      items: [
        {
          href: '/vendor/analytics',
          label: 'Analytics',
          labelAr: 'التحليلات',
          icon: 'analytics',
          hint: 'What sells, and what is still unredeemed.',
          hintAr: 'ما يبيع وما لم يُستبدل بعد.',
        },
        {
          href: '/vendor/staff',
          label: 'Team',
          labelAr: 'الفريق',
          icon: 'staff',
          hint: 'Who can redeem, and who can manage.',
          hintAr: 'من يستبدل ومن يدير.',
        },
        {
          href: '/vendor/settings',
          label: 'Business settings',
          labelAr: 'إعدادات النشاط',
          icon: 'settings',
          hint: 'Your storefront, locations and documents.',
          hintAr: 'واجهتك ومواقعك ووثائقك.',
        },
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
      tutorial={VENDOR_SCRIPT}
      locale={locale}
      autoOpenTutorial={!ctx.profile?.tutorial_completed_at}
      topRight={
        <>
          <span className="tag mint">{titleCase(ctx.role)}</span>
          <Link className="btn sm ghost" href={`/vendors/${vendor.slug ?? vendor.id}`} target="_blank">
            View public page
          </Link>
          <Link className="btn sm primary" href="/vendor/redeem">
            <ScanLine size={15} /> Scan a gift
          </Link>
        </>
      }
    >
      {children}
    </DashShell>
  );
}
