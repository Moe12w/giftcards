// web/lib/i18n/labels.ts
// Turns the words stored in the database into words a person can read.
//
// The database stores snake_case keys like `pending_review`. Those become
// "Pending review" in English and "قيد المراجعة" in Arabic.
import { common } from './common';
import { pick, type Locale } from './index';

const copy = common;

/** Statuses, roles and fulfilment types the platform stores. */
const LABELS: Record<string, { group: 'status' | 'roles' | 'fulfilment' | 'delivery'; key: string }> = {
  active: { group: 'status', key: 'active' },
  approved: { group: 'status', key: 'approved' },
  archived: { group: 'status', key: 'archived' },
  cancelled: { group: 'status', key: 'cancelled' },
  claimed: { group: 'status', key: 'claimed' },
  completed: { group: 'status', key: 'completed' },
  delivered: { group: 'status', key: 'delivered' },
  draft: { group: 'status', key: 'draft' },
  expired: { group: 'status', key: 'expired' },
  failed: { group: 'status', key: 'failed' },
  incomplete: { group: 'status', key: 'incomplete' },
  invalid: { group: 'status', key: 'invalid' },
  issued: { group: 'status', key: 'issued' },
  paid: { group: 'status', key: 'paid' },
  partially_redeemed: { group: 'status', key: 'partially_redeemed' },
  pending: { group: 'status', key: 'pending' },
  pending_review: { group: 'status', key: 'pending_review' },
  processing: { group: 'status', key: 'processing' },
  published: { group: 'status', key: 'published' },
  rejected: { group: 'status', key: 'rejected' },
  redeemed: { group: 'status', key: 'redeemed' },
  reserved: { group: 'status', key: 'reserved' },
  suspended: { group: 'status', key: 'suspended' },
  void: { group: 'status', key: 'void' },

  admin: { group: 'roles', key: 'admin' },
  analyst: { group: 'roles', key: 'analyst' },
  customer: { group: 'roles', key: 'customer' },
  enterprise_user: { group: 'roles', key: 'enterprise_user' },
  manager: { group: 'roles', key: 'manager' },
  owner: { group: 'roles', key: 'owner' },
  redemption_staff: { group: 'roles', key: 'redemption_staff' },
  vendor_manager: { group: 'roles', key: 'vendor_manager' },
  vendor_owner: { group: 'roles', key: 'vendor_owner' },
  vendor_redemption_staff: { group: 'roles', key: 'vendor_redemption_staff' },

  enterprise_code: { group: 'fulfilment', key: 'enterprise_code' },
  experience: { group: 'fulfilment', key: 'experience' },
  monetary: { group: 'fulfilment', key: 'monetary' },

  email: { group: 'delivery', key: 'email' },
  link: { group: 'delivery', key: 'link' },
  sms: { group: 'delivery', key: 'sms' },
  whatsapp: { group: 'delivery', key: 'whatsapp' },
};

/**
 * The readable name of a stored value. Values the platform does not know are
 * shown as they are, just tidied up.
 */
export function labelFor(value: string | null | undefined, locale: Locale): string {
  const raw = (value ?? '').trim();
  if (!raw) return pick(copy, locale).states.unknown;

  const known = LABELS[raw.toLowerCase()];
  if (known) {
    const group = pick(copy, locale)[known.group] as Record<string, string>;
    return group[known.key] ?? raw;
  }

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
