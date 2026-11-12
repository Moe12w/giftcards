'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';

export function AuthShell({
  tone = 'mint',
  eyebrow,
  title,
  description,
  points,
  children,
}: {
  tone?: 'mint' | 'lavender' | 'coral';
  eyebrow: string;
  title: string;
  description: string;
  points?: string[];
  children: ReactNode;
}) {
  const locale = useLocale();
  const t = pick(componentsCopy, locale).authShell;

  return (
    <div className="auth-shell">
      <aside className={`auth-side ${tone}`}>
        <Logo />
        <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
          {points?.length ? (
            <ul className="check-list" style={{ marginTop: 4 }}>
              {points.map((point) => (
                <li key={point}>
                  <Check size={16} /> {point}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="small">{t.forBusiness}</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <Link className="auth-back" href="/">
            <ArrowLeft size={15} />
            {t.backToHome}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
