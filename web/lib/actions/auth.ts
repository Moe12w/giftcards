'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const next = typeof value === 'string' ? value : '';
  if (next.startsWith('/') && !next.startsWith('//')) return next;
  return fallback;
}

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const proto = headerStore.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function vendorSignIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'), '/vendor');
  if (!email || !password) fail('/vendor/login', 'Enter your email and password.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail('/vendor/login', error?.message ?? 'Could not sign you in.');

  const { data: membership } = await supabase
    .from('vendor_members')
    .select('vendor_id')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect('/vendor/register?notice=finish');
  redirect(next);
}

export async function enterpriseSignIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) fail('/enterprise/login', 'Enter your email and password.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail('/enterprise/login', error?.message ?? 'Could not sign you in.');

  const { data: membership } = await supabase
    .from('enterprise_members')
    .select('partner_id')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    await supabase.auth.signOut();
    fail('/enterprise/login', 'This account is not linked to an enterprise partner.');
  }
  redirect('/enterprise');
}

export async function adminSignIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) fail('/admin/login', 'Enter your email and password.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail('/admin/login', error?.message ?? 'Could not sign you in.');

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', data.user.id).maybeSingle(),
    supabase.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle(),
  ]);

  if (role?.role !== 'admin' && !profile?.is_admin) {
    await supabase.auth.signOut();
    fail('/admin/login', 'This account does not have admin access.');
  }
  redirect('/admin');
}

const PORTAL_LOGIN: Record<string, string> = {
  vendor: '/vendor/login',
  enterprise: '/enterprise/login',
  admin: '/admin/login',
};

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const portal = String(formData.get('portal') ?? 'vendor');
  const loginPath = PORTAL_LOGIN[portal] ?? '/vendor/login';
  if (!email) fail(loginPath.replace('/login', '/forgot-password'), 'Enter your email address.');

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });

  if (error) fail(loginPath.replace('/login', '/forgot-password'), error.message);
  redirect(`${loginPath.replace('/login', '/forgot-password')}?sent=1`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) fail('/reset-password', 'Use at least 8 characters.');
  if (password !== confirm) fail('/reset-password', 'The two passwords do not match.');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail('/reset-password', error.message);
  redirect('/reset-password?done=1');
}

export async function registerVendorAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUser = user;

  if (!currentUser) {
    const fullName = String(formData.get('full_name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!fullName || !email || !password) {
      fail('/vendor/register', 'Enter your name, email and password.');
    }
    if (password.length < 8) {
      fail('/vendor/register', 'Use at least 8 characters for your password.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) fail('/vendor/register', error.message);
    if (!data.session) {
      redirect('/vendor/register?notice=confirm-email');
    }
    currentUser = data.user;
  }

  if (!currentUser) fail('/vendor/register', 'Could not create your account.');

  const { data: existing } = await supabase
    .from('vendor_members')
    .select('vendor_id')
    .eq('user_id', currentUser.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (existing) redirect('/vendor');

  const businessName = String(formData.get('business_name') ?? '').trim();
  if (businessName.length < 2) {
    fail('/vendor/register', 'Enter your business name to continue.');
  }

  const { error } = await supabase.rpc('register_vendor_account', {
    p_business_name: businessName,
    p_category: String(formData.get('business_category') ?? '').trim() || null,
    p_description: String(formData.get('business_description') ?? '').trim() || null,
    p_email: String(formData.get('business_email') ?? '').trim() || null,
    p_phone: String(formData.get('business_phone') ?? '').trim() || null,
    p_location: String(formData.get('business_location') ?? '').trim() || null,
    p_website: String(formData.get('business_website') ?? '').trim() || null,
  });

  if (error) fail('/vendor/register', error.message);
  redirect('/vendor/onboarding?welcome=1');
}

export async function acceptVendorInvite(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  if (!token) fail('/vendor/join', 'This invite link is missing its token.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_vendor_invite', { p_token: token });
  if (error) fail(`/vendor/join?token=${encodeURIComponent(token)}`, error.message);
  redirect('/vendor?joined=1');
}
