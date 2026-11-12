'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';

export function SiteFooter() {
  const locale = useLocale();
  const t = pick(componentsCopy, locale).siteFooter;

  const columns = [
    {
      title: t.marketplace,
      links: [
        { href: '/vendors', label: t.vendors },
        { href: '/download', label: t.download },
        { href: '/faq', label: t.faq },
        { href: '/corporate', label: t.corporate },
      ],
    },
    {
      title: t.forBusiness,
      links: [
        { href: '/contact', label: t.contact },
        { href: '/terms', label: t.terms },
        { href: '/privacy', label: t.privacy },
      ],
    },
    {
      title: t.support,
      links: [
        { href: '/vendor/login', label: t.vendorDashboard },
        { href: '/enterprise/login', label: t.enterpriseDashboard },
        { href: '/admin/login', label: t.admin },
      ],
    },
  ];

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="inner">
          <div>
            <Logo />
            <p className="small" style={{ marginTop: 14, maxWidth: 300 }}>
              {t.tagline}
            </p>
            <p className="small" style={{ marginTop: 14 }}>
              Doha, Qatar · hello@giftly.qa
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Giftly. {t.rights}
          </span>
          <span>{t.madeFor}</span>
        </div>
      </div>
    </footer>
  );
}
