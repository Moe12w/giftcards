import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { labelFor } from '@/lib/i18n/labels';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';

export async function StatusTag({ status }: { status: string | null | undefined }) {
  const locale = await getLocale();
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
  const label = value === 'unknown' ? pick(common, locale).states.unknown : labelFor(value, locale);
  return <span className={`tag ${tone}`}>{label}</span>;
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
  logoUrl,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Logo shown next to the title, when the business has uploaded one. */
  logoUrl?: string | null;
}) {
  return (
    <div className="page-head">
      <div className="copy">
        {eyebrow ? <span className="eyebrow mint">{eyebrow}</span> : null}
        <h1 className={logoUrl ? 'page-title-logo' : undefined}>
          {logoUrl ? <img className="page-logo" src={logoUrl} alt="" /> : null}
          {title}
        </h1>
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
