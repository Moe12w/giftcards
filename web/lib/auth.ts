import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type {
  BusinessAccount,
  EnterpriseMember,
  EnterprisePartner,
  Profile,
  Vendor,
  VendorMember,
  VendorRole,
} from '@/lib/types';

export const VENDOR_COOKIE = 'gv_vendor';

interface VendorContext {
  supabase: SupabaseClient;
  user: User;
  profile: Profile | null;
  memberships: VendorMember[];
  vendor: Vendor;
  role: VendorRole;
}

/**
 * Guards every /vendor page. Resolves the vendor the user is currently working
 * in from the `gv_vendor` cookie, falling back to their first membership.
 */
async function loadVendorContext(): Promise<VendorContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/vendor/login');

  const [{ data: membershipRows }, { data: profile }] = await Promise.all([
    supabase
      .from('vendor_members')
      .select('vendor_id, user_id, role, active, created_at, vendors(*)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  const memberships = (membershipRows ?? []) as unknown as VendorMember[];
  if (memberships.length === 0) redirect('/vendor/register?error=no-vendor');

  const cookieStore = await cookies();
  const selected = cookieStore.get(VENDOR_COOKIE)?.value;
  const membership =
    memberships.find((item) => item.vendor_id === selected) ?? memberships[0];
  const vendor = membership.vendors as Vendor | null;
  if (!vendor) redirect('/vendor/register?error=no-vendor');

  return {
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
    memberships,
    vendor,
    role: membership.role,
  };
}

interface AdvertiserContext {
  supabase: SupabaseClient;
  user: User;
  profile: Profile | null;
  memberships: VendorMember[];
  vendor: Vendor;
  role: VendorRole;
  /** Which surface created this context: a vendor member or an enterprise partner. */
  kind: 'vendor' | 'enterprise';
  partner: EnterprisePartner | null;
  home: '/vendor/advertising' | '/enterprise/advertising';
}

/**
 * Guards the advertising surfaces. Resolves the advertiser from either a
 * vendor membership (kind: 'vendor') or an enterprise partner that acts through
 * its linked advertising vendor (kind: 'enterprise'). Enterprise partners reuse
 * the vendor campaign lifecycle behind a partner -> vendor link, so they get the
 * exact same wizard, checkout, lifecycle and tracking flows.
 */
async function loadAdvertiserContext(options?: {
  prefer?: 'vendor' | 'enterprise';
}): Promise<AdvertiserContext> {
  const prefer = options?.prefer ?? 'vendor';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/vendor/login');

  const [{ data: membershipRows }, { data: enterpriseRows }, { data: profile }] = await Promise.all([
    supabase
      .from('vendor_members')
      .select('vendor_id, user_id, role, active, created_at, vendors(*)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('enterprise_members')
      .select('partner_id, user_id, role, active, created_at, enterprise_partners(*)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  const memberships = (membershipRows ?? []) as unknown as VendorMember[];
  const cookieStore = await cookies();
  const selected = cookieStore.get(VENDOR_COOKIE)?.value;
  const membership =
    prefer === 'enterprise' ? undefined : memberships.find((item) => item.vendor_id === selected) ?? memberships[0];

  const base = {
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
  };

  if (membership?.vendors) {
    const vendor = membership.vendors as Vendor;
    return {
      ...base,
      memberships,
      vendor,
      role: membership.role,
      kind: 'vendor',
      partner: null,
      home: '/vendor/advertising',
    };
  }

  const enterpriseMemberships = (enterpriseRows ?? []) as unknown as (EnterpriseMember & {
    enterprise_partners: EnterprisePartner | null;
  })[];

  const enterpriseMembership = enterpriseMemberships[0];
  if (!enterpriseMembership?.enterprise_partners) redirect('/vendor/register?error=no-vendor');

  const partner = enterpriseMembership.enterprise_partners;

  const { data: vendorJson, error: vendorError } = await supabase.rpc('advertising_get_partner_vendor', {
    p_partner_id: enterpriseMembership.partner_id,
  });
  const vendor = (vendorJson ?? null) as unknown as Vendor | null;
  if (vendorError || !vendor) redirect('/vendor/register?error=no-vendor');

  const { data: canManage, error: manageError } = await supabase.rpc('advertising_can_manage_vendor', {
    p_vendor_id: vendor.id,
  });
  if (manageError || !canManage) redirect('/vendor/register?error=no-vendor');

  return {
    ...base,
    memberships,
    vendor,
    role: enterpriseMembership.role as VendorRole,
    kind: 'enterprise',
    partner,
    home: '/enterprise/advertising',
  };
}

interface EnterpriseContext {
  supabase: SupabaseClient;
  user: User;
  profile: Profile | null;
  memberships: EnterpriseMember[];
  partner: EnterprisePartner;
  role: EnterpriseMember['role'];
}

async function loadEnterpriseContext(): Promise<EnterpriseContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/enterprise/login');

  const [{ data: membershipRows }, { data: profile }] = await Promise.all([
    supabase
      .from('enterprise_members')
      .select('partner_id, user_id, role, active, created_at, enterprise_partners(*)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  const memberships = (membershipRows ?? []) as unknown as (EnterpriseMember & {
    enterprise_partners: EnterprisePartner | null;
  })[];
  if (memberships.length === 0) redirect('/enterprise/login?error=no-partner');

  const membership = memberships[0];
  const partner = membership.enterprise_partners;
  if (!partner) redirect('/enterprise/login?error=no-partner');

  return {
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
    memberships,
    partner,
    role: membership.role,
  };
}

interface AdminContext {
  supabase: SupabaseClient;
  user: User;
  profile: Profile | null;
}

async function loadAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ]);

  const isAdmin = role?.role === 'admin' || Boolean(profile?.is_admin);
  if (!isAdmin) redirect('/admin/login?error=not-admin');

  return {
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
  };
}

export interface BusinessBuyerContext {
  supabase: SupabaseClient;
  user: User;
  profile: Profile | null;
  account: BusinessAccount | null;
}

/**
 * Loads the signed-in user's business/bulk-buyer account (if any).
 * Used for registration status pages and the bulk buyer portal.
 */
async function loadBusinessBuyerContext(): Promise<BusinessBuyerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: account }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('business_accounts').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  return {
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
    account: (account as BusinessAccount | null) ?? null,
  };
}

// React's cache() memoises these guards for the lifetime of one server
// request. Layouts and pages both call the same guard, and a server action
// re-renders both, so this collapses what used to be two (or more) auth
// round trips into one.
export const getBusinessBuyerContext = cache(loadBusinessBuyerContext);

/** Resolves the vendor the user is currently working in. */
export const requireVendor = cache(loadVendorContext);

/** Resolves either a vendor member or an enterprise advertiser. */
export const requireAdvertiser = cache(loadAdvertiserContext);

/** Guards the enterprise dashboard. */
export const requireEnterprise = cache(loadEnterpriseContext);

/** Guards the admin dashboard. */
export const requireAdmin = cache(loadAdminContext);

/**
 * Guards /business pages. Requires an approved business account to access
 * restricted bulk offers, pricing and bulk purchasing.
 */
export const requireApprovedBusinessBuyer = cache(async function requireApprovedBusinessBuyer(): Promise<
  Omit<BusinessBuyerContext, 'account'> & { account: BusinessAccount }
> {
  const ctx = await getBusinessBuyerContext();
  if (!ctx) redirect('/business/login');

  if (!ctx.account) redirect('/business/register');
  if (ctx.account.status !== 'approved') {
    redirect(`/business/status?status=${encodeURIComponent(ctx.account.status)}`);
  }

  return { ...ctx, account: ctx.account };
});
