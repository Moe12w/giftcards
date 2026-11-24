'use server';

import { str, optional, back, moneyField, intField, checkbox } from './_form';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireEnterprise, requireVendor } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTeamMemberAccount } from '@/lib/team-members';

/** Vendor owner/manager creates a staff account that can log in immediately. */
export async function vendorCreateStaff(formData: FormData) {
  const ctx = await requireVendor();
  const path = '/vendor/staff';
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    back(path, 'Only the owner or a manager can add team members.');
  }

  const role = str(formData, 'role');
  if (!['manager', 'redemption_staff'].includes(role)) back(path, 'Choose a valid role.');
  if (ctx.role === 'manager' && role === 'manager') {
    back(path, 'Only the owner can add another manager.');
  }

  const result = await createTeamMemberAccount({
    fullName: str(formData, 'full_name'),
    email: str(formData, 'email'),
    password: str(formData, 'password'),
  });
  if (!result.ok || !result.userId) back(path, result.error ?? 'Could not create the account.');

  const { error } = await ctx.supabase.from('vendor_members').upsert(
    {
      vendor_id: ctx.vendor.id,
      user_id: result.userId,
      role,
      active: true,
      invited_by: ctx.user.id,
    },
    { onConflict: 'vendor_id,user_id' },
  );
  if (error) {
    back(path, 'The account was created but could not be added to the team. Contact Tazella support.');
  }

  await ctx.supabase.rpc('write_audit', {
    p_action: 'vendor.member.created',
    p_entity_type: 'vendor',
    p_entity_id: ctx.vendor.id,
    p_before: null,
    p_after: { user_id: result.userId, email: str(formData, 'email').toLowerCase(), role },
  });

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

/** Enterprise owner/manager creates a colleague who can log in immediately. */
export async function enterpriseCreateMember(formData: FormData) {
  const ctx = await requireEnterprise();
  const path = '/enterprise/settings';
  if (ctx.role === 'analyst') back(path, 'Analysts have read-only access.');

  const role = str(formData, 'role');
  if (!['manager', 'analyst'].includes(role)) back(path, 'Choose a valid role.');

  const result = await createTeamMemberAccount({
    fullName: str(formData, 'full_name'),
    email: str(formData, 'email'),
    password: str(formData, 'password'),
  });
  if (!result.ok || !result.userId) back(path, result.error ?? 'Could not create the account.');

  const { error } = await ctx.supabase.from('enterprise_members').upsert(
    {
      partner_id: ctx.partner.id,
      user_id: result.userId,
      role,
      active: true,
    },
    { onConflict: 'partner_id,user_id' },
  );
  if (error) {
    back(path, 'The account was created but could not be added to the team. Contact Tazella support.');
  }

  await ctx.supabase.rpc('write_audit', {
    p_action: 'enterprise.member.created',
    p_entity_type: 'enterprise_partner',
    p_entity_id: ctx.partner.id,
    p_before: null,
    p_after: { user_id: result.userId, email: str(formData, 'email').toLowerCase(), role },
  });

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

/** Admin creates another admin who can log in immediately. */
export async function adminCreateTeamMember(formData: FormData) {
  await requireAdmin();
  const path = '/admin/team';
  const role = str(formData, 'role');
  if (role !== 'admin') back(path, 'Only admin accounts can be created here.');

  const result = await createTeamMemberAccount({
    fullName: str(formData, 'full_name'),
    email: str(formData, 'email'),
    password: str(formData, 'password'),
  });
  if (!result.ok || !result.userId) back(path, result.error ?? 'Could not create the account.');

  const admin = createAdminClient();
  const { error } = await admin.from('user_roles').upsert(
    { user_id: result.userId, role: 'admin' },
    { onConflict: 'user_id' },
  );
  if (error) back(path, 'The account was created but could not be given admin access.');

  await admin.rpc('write_audit', {
    p_action: 'admin.user.created',
    p_entity_type: 'user',
    p_entity_id: result.userId,
    p_before: null,
    p_after: { email: str(formData, 'email').toLowerCase(), role },
  });

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}
