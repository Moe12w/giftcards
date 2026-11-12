'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageButton } from '@/components/LanguageSwitch';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { site } from '@/lib/i18n/site';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const locale = useLocale();
  const copy = pick(site, locale);

  const links = [
    { href: '/vendors', label: copy.nav.vendors },
    { href: '/corporate', label: copy.nav.business },
    { href: '/faq', label: copy.nav.howItWorks },
    { href: '/contact', label: copy.nav.contact },
  ];

  return (
    <header className="site-header">
      <div className="container inner">
        <Logo />
        <nav className={`site-nav${open ? ' open' : ''}`} aria-label={copy.nav.main}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageButton />
          <Link className="btn ghost sm" href="/vendor/login">
            {copy.nav.vendorSignIn}
          </Link>
          <Link className="btn primary sm" href="/download">
            {copy.nav.getTheApp}
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
