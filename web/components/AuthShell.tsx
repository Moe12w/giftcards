import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Logo } from '@/components/Logo';

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
        <p className="small">Giftly for business · Doha, Qatar</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
