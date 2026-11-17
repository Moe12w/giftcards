'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  action: string;
}

/**
 * The dashboard setup checklist. Dismissal is stored locally so the dashboard
 * stays uncluttered, while the same tasks remain reachable from the Online
 * Payments and onboarding pages.
 */
export function SetupChecklist({
  title,
  subtitle,
  items,
  dismissLabel,
  storageKey,
}: {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
  dismissLabel: string;
  storageKey: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1');
    } catch {
      // Private mode: keep the checklist visible.
    }
    setReady(true);
  }, [storageKey]);

  const done = items.filter((item) => item.done).length;
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  if (!ready || dismissed || done === items.length) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Ignore storage failures.
    }
    setDismissed(true);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <span className="small muted">{subtitle}</span>
        </div>
        <div className="btn-row" style={{ alignItems: 'center' }}>
          <span className="tag neutral">{percent}%</span>
          <button className="btn sm ghost" type="button" onClick={dismiss} aria-label={dismissLabel}>
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="panel-body">
        <div className="progress" style={{ marginBottom: 14 }}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="split-list">
          {items.map((item) => (
            <div key={item.key}>
              <span className="k">
                {item.done ? (
                  <CheckCircle2 size={16} color="var(--success)" />
                ) : (
                  <Circle size={16} />
                )}{' '}
                {item.label}
              </span>
              <span className="v small">
                {item.done ? (
                  '✓'
                ) : (
                  <Link href={item.href} style={{ textDecoration: 'underline' }}>
                    {item.action}
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
