'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  requireApprovedBusinessBuyer,
  requireEnterprise,
  requireVendor,
} from '@/lib/auth';

export type SupportAudience = 'vendor' | 'enterprise' | 'business';

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

/**
 * Creates a support ticket from any dashboard.
 *
 * The caller is re-authenticated here rather than trusted from the form, so a
 * ticket always belongs to the signed-in user and records the organisation it
 * came from. RLS still backs this up: the insert policy only allows rows whose
 * `customer_id` is the caller.
 */
export async function submitSupportTicket(formData: FormData) {
  const audience = str(formData, 'audience') as SupportAudience;
  const returnTo = str(formData, 'return_to') || '/vendor/support';
  const subject = str(formData, 'subject');
  const body = str(formData, 'body');
  const reference = str(formData, 'reference') || null;

  if (!subject || !body) {
    back(returnTo, 'Add a subject and a message before sending.');
  }

  let supabase;
  let userId: string;
  let organizationName: string | null = null;
  let organizationId: string | null = null;

  if (audience === 'enterprise') {
    const ctx = await requireEnterprise();
    supabase = ctx.supabase;
    userId = ctx.user.id;
    organizationName = ctx.partner.name;
    organizationId = ctx.partner.id;
  } else if (audience === 'business') {
    const ctx = await requireApprovedBusinessBuyer();
    supabase = ctx.supabase;
    userId = ctx.user.id;
    organizationName = ctx.account.company_name;
    organizationId = ctx.account.id;
  } else {
    const ctx = await requireVendor();
    supabase = ctx.supabase;
    userId = ctx.user.id;
    organizationName = ctx.vendor.name;
    organizationId = ctx.vendor.id;
  }

  const { error } = await supabase.from('support_requests').insert({
    customer_id: userId,
    kind: 'support',
    requester_kind: audience,
    organization_name: organizationName,
    organization_id: organizationId,
    subject,
    body,
    reference,
  });
  if (error) back(returnTo, error.message);

  revalidatePath(returnTo);
  revalidatePath('/admin/support');
  redirect(`${returnTo}?sent=1`);
}

/**
 * Appends a reply to a ticket the signed-in user owns.
 *
 * The ticket is re-read with the user's own id in the filter, so a forged
 * request id cannot write into somebody else's thread. RLS enforces the same
 * rule at the database level.
 */
export async function replyToSupportTicket(formData: FormData) {
  const audience = str(formData, 'audience') as SupportAudience;
  const returnTo = str(formData, 'return_to') || '/vendor/support';
  const requestId = str(formData, 'request_id');
  const body = str(formData, 'body');

  if (!requestId || !body) {
    back(returnTo, 'Write a message before sending.');
  }

  let supabase;
  let userId: string;
  let authorName: string;

  if (audience === 'enterprise') {
    const ctx = await requireEnterprise();
    supabase = ctx.supabase;
    userId = ctx.user.id;
    authorName = ctx.profile?.full_name ?? ctx.user.email ?? 'Requester';
  } else if (audience === 'business') {
    const ctx = await requireApprovedBusinessBuyer();
    supabase = ctx.supabase;
    userId = ctx.user.id;
    authorName = ctx.profile?.full_name ?? ctx.user.email ?? 'Requester';
  } else {
    const ctx = await requireVendor();
    supabase = ctx.supabase;
    userId = ctx.user.id;
    authorName = ctx.profile?.full_name ?? ctx.user.email ?? 'Requester';
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('support_requests')
    .select('id')
    .eq('id', requestId)
    .eq('customer_id', userId)
    .maybeSingle();
  if (ticketError || !ticket) back(returnTo, 'That request is not available.');

  const { error } = await supabase.from('support_ticket_messages').insert({
    request_id: requestId,
    author_id: userId,
    author_role: 'requester',
    author_name: authorName,
    body,
  });
  if (error) back(returnTo, error.message);

  revalidatePath(returnTo);
  revalidatePath('/admin/support');
  redirect(`${returnTo}?sent=1`);
}
