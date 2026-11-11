import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { titleCase } from '@/lib/format';

export function StatusTag({ status }: { status: string | null | undefined }) {
  const value = (status ?? 'unknown').toLowerCase();
  const tone =
    value === 'approved' ||
    value === 'active' ||
    value === 'published' ||
    value === 'paid' ||
    value === 'completed' ||
    value === 'delivered' ||
    value === 'redeemed'
      ? 'success'
      : value === 'pending' ||
          value === 'pending_review' ||
          value === 'processing' ||
          value === 'reserved' ||
          value === 'claimed' ||
          value === 'issued' ||
          value === 'partially_redeemed'
        ? 'warning'
        : value === 'rejected' ||
            value === 'suspended' ||
            value === 'failed' ||
            value === 'cancelled' ||
            value === 'void' ||
            value === 'expired' ||
            value === 'invalid'
          ? 'danger'
          : value === 'draft' || value === 'archived' || value === 'incomplete'
            ? 'neutral'
            : 'neutral';
  return <span className={`tag ${tone}`}>{titleCase(value)}</span>;
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="copy">
        {eyebrow ? <span className="eyebrow mint">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="btn-row">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="icon-tile lavender">
        <Inbox size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Notice({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (!error && !success) return null;
  return (
    <div className={`callout ${error ? 'error' : ''}`} role="status">
      {error ?? success}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon,
  tone = 'mint',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'mint' | 'lavender' | 'coral' | 'gold' | 'sky';
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-icon" style={{ background: `var(--${tone}-soft)` }}>
          {icon}
        </span>
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
      {hint ? <span className="trend">{hint}</span> : null}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function ReadRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}
