'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AUTH_MAX_FAILED,
  AUTH_WINDOW_SECONDS,
  authErrorMessage,
  authIdentifier,
  safeNextPath,
} from '@/lib/security';
import { merchantErrorMessage } from '@/lib/merchant';

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  return safeNextPath(typeof value === 'string' ? value : '', fallback);
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

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function clientIp(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || headerStore.get('x-real-ip') || null;
  } catch {
    return null;
  }
}

/**
 * Returns true (deny) when limiter state cannot be established. A limiter
 * outage must not silently remove the brute-force throttle.
 */
async function attemptsExceeded(identifier: string, windowSeconds: number, maxFailed: number): Promise<boolean> {
  const client = admin();
  if (!client) return true;
  try {
    const { data, error } = await client.rpc('auth_attempts_exceeded', {
      p_identifier: identifier,
      p_window_seconds: windowSeconds,
      p_max_failed: maxFailed,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

async function recordAuthAttempt(identifier: string, success: boolean, ip: string | null): Promise<void> {
  const client = admin();
  if (!client) return;
  try {
    await client.rpc('record_auth_attempt', { p_identifier: identifier, p_success: success });
    if (ip) {
      await client.rpc('record_auth_attempt', { p_identifier: `ip:${ip}`, p_success: success });
    }
    if (success) {
      await client.rpc('clear_auth_attempts', { p_identifier: identifier });
      if (ip) await client.rpc('clear_auth_attempts', { p_identifier: `ip:${ip}` });
    }
  } catch {
    // Throttling must never lock a legitimate user out of the app.
  }
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Signs a user in through Supabase, recording the attempt and enforcing the
 * per-identifier and per-IP limits before the credentials are checked.
 * If the limiter cannot be read, sign-in is denied rather than allowed.
 */
async function signInWithLimiter(
  supabase: ServerSupabase,
  email: string,
  password: string,
  loginPath: string,
) {
  const identifier = authIdentifier(email);
  const ip = await clientIp();

  let limited = false;
  try {
    limited = Boolean(ip) && (await attemptsExceeded(`ip:${ip}`, AUTH_WINDOW_SECONDS, 40));
    if (!limited) limited = await attemptsExceeded(identifier, AUTH_WINDOW_SECONDS, AUTH_MAX_FAILED);
  } catch {
    limited = true;
  }

  if (limited) {
    await recordAuthAttempt(identifier, false, ip);
    fail(loginPath, 'Too many attempts. Please wait a few minutes and try again.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await recordAuthAttempt(identifier, false, ip);
    fail(loginPath, authErrorMessage(error));
  }

  await recordAuthAttempt(identifier, true, ip);
  return data.user;
}

/** Per-address and per-IP throttle for public sign-up forms. */
async function signUpAllowed(email: string): Promise<boolean> {
  const identifier = `signup:${authIdentifier(email)}`;
  const ip = await clientIp();
  if (await attemptsExceeded(identifier, 3600, 5)) return false;
  if (ip && (await attemptsExceeded(`signup:ip:${ip}`, 3600, 10))) return false;
  return true;
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
  const user = await signInWithLimiter(supabase, email, password, '/vendor/login');

  const { data: membership } = await supabase
    .from('vendor_members')
    .select('vendor_id')
    .eq('user_id', user.id)
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
  const user = await signInWithLimiter(supabase, email, password, '/enterprise/login');

  const { data: membership } = await supabase
    .from('enterprise_members')
    .select('partner_id')
    .eq('user_id', user.id)
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
  const user = await signInWithLimiter(supabase, email, password, '/admin/login');

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
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
  const resetPath = loginPath.replace('/login', '/forgot-password');
  if (!email) fail(resetPath, 'Enter your email address.');

  // Password-reset requests are unauthenticated and are a common way to make
  // a platform send mail to somebody else, so throttle per address and per IP.
  const identifier = `reset:${authIdentifier(email)}`;
  const ip = await clientIp();
  const ipIdentifier = ip ? `reset:ip:${ip}` : null;
  const limited =
    (await attemptsExceeded(identifier, 3600, 5)) ||
    (ipIdentifier ? await attemptsExceeded(ipIdentifier, 3600, 10) : false);
  if (limited) redirect(`${resetPath}?sent=1`);

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });

  await recordAuthAttempt(identifier, !error, null);
  if (ipIdentifier) await recordAuthAttempt(ipIdentifier, !error, null);

  if (error) fail(resetPath, authErrorMessage(error));
  redirect(`${resetPath}?sent=1`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) fail('/reset-password', 'Use at least 8 characters.');
  if (password !== confirm) fail('/reset-password', 'The two passwords do not match.');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail('/reset-password', authErrorMessage(error));
  redirect('/reset-password?done=1');
}

/**
 * Creates the auth user (when needed) and its business record, then sends the
 * person straight into their dashboard. No documents, bank details or payment
 * information are collected at this stage — those live in Online Payments and
 * never block access.
 */
async function createMerchantAccount(formData: FormData, kind: 'vendor' | 'partner'): Promise<never> {
  const registerPath = kind === 'vendor' ? '/vendor/register' : '/enterprise/register';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUser = user;

  if (!currentUser) {
    const fullName = String(formData.get('full_name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const mobile = String(formData.get('mobile') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const accepted = formData.get('terms') === 'on';

    if (!fullName || !email || !password) {
      fail(registerPath, 'Enter your name, email and password.');
    }
    if (password.length < 8) {
      fail(registerPath, 'Use at least 8 characters for your password.');
    }
    if (!mobile) {
      fail(registerPath, 'Enter your mobile number.');
    }
    if (!accepted) {
      fail(registerPath, 'Accept the terms and privacy policy to continue.');
    }
    if (!(await signUpAllowed(email))) {
      fail(registerPath, 'Too many attempts. Please wait a few minutes and try again.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: mobile } },
    });
    if (error) fail(registerPath, authErrorMessage(error));
    if (!data.session) {
      redirect(`${registerPath}?notice=confirm-email`);
    }
    currentUser = data.user;
  }

  if (!currentUser) fail(registerPath, 'Could not create your account.');

  // Registration asks for the person, not the business. The provisional record
  // name comes from their name and is corrected in the setup wizard, so no
  // business paperwork is collected before the dashboard opens.
  const metadataName = String((currentUser.user_metadata as { full_name?: string } | null)?.full_name ?? '').trim();
  const businessName =
    String(formData.get('business_name') ?? '').trim() ||
    String(formData.get('full_name') ?? '').trim() ||
    metadataName ||
    (currentUser.email ?? '').split('@')[0] ||
    '';
  if (businessName.length < 2) {
    fail(registerPath, 'Add your name so we can create your account.');
  }

  const { error } = await supabase.rpc('register_merchant_account', {
    p_kind: kind,
    p_full_name: String(formData.get('full_name') ?? '').trim() || metadataName || null,
    p_business_name: businessName,
    p_email:
      String(formData.get('business_email') ?? formData.get('email') ?? '').trim() ||
      currentUser.email ||
      null,
    p_phone: String(formData.get('mobile') ?? '').trim() || null,
  });

  if (error) fail(registerPath, merchantErrorMessage(error.message));

  if (kind === 'partner') redirect('/enterprise/onboarding?welcome=1');
  redirect('/vendor/onboarding?welcome=1');
}

export async function registerVendorAccount(formData: FormData) {
  return createMerchantAccount(formData, 'vendor');
}

export async function registerEnterpriseAccount(formData: FormData) {
  return createMerchantAccount(formData, 'partner');
}

export async function businessSignIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'), '/business');
  if (!email || !password) fail('/business/login', 'Enter your email and password.');

  const supabase = await createClient();
  const user = await signInWithLimiter(supabase, email, password, '/business/login');

  const { data: account } = await supabase
    .from('business_accounts')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account) redirect('/business/register?notice=finish');
  if (account.status === 'approved') redirect(next);
  redirect(`/business/status?status=${encodeURIComponent(account.status)}`);
}

export async function registerBusinessAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUser = user;

  if (!currentUser) {
    const fullName = String(formData.get('contact_name') ?? '').trim() || String(formData.get('full_name') ?? '').trim();
    const email = String(formData.get('business_email') ?? '').trim() || String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!fullName || !email || !password) {
      fail('/business/register', 'Enter your contact name, business email and password.');
    }
    if (password.length < 8) {
      fail('/business/register', 'Use at least 8 characters for your password.');
    }
    if (!(await signUpAllowed(email))) {
      fail('/business/register', 'Too many attempts. Please wait a few minutes and try again.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) fail('/business/register', authErrorMessage(error));
    if (!data.session) {
      redirect('/business/register?notice=confirm-email');
    }
    currentUser = data.user;
  }

  if (!currentUser) fail('/business/register', 'Could not create your account.');

  const { data: existing } = await supabase
    .from('business_accounts')
    .select('id, status')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (existing) {
    if (existing.status === 'approved') redirect('/business');
    redirect(`/business/status?status=${encodeURIComponent(existing.status)}`);
  }

  const companyName = String(formData.get('company_name') ?? '').trim();
  const contactName = String(formData.get('contact_name') ?? '').trim();
  const businessEmail = String(formData.get('business_email') ?? '').trim() || currentUser.email || '';
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const country = String(formData.get('country') ?? 'Qatar').trim() || 'Qatar';
  const companyReg = String(formData.get('company_registration_number') ?? '').trim() || null;
  const businessType = String(formData.get('business_type') ?? '').trim() || null;

  if (companyName.length < 2) fail('/business/register', 'Enter your company name to continue.');
  if (contactName.length < 2) fail('/business/register', 'Enter the contact person’s name.');
  if (!businessEmail) fail('/business/register', 'Enter a business email.');

  const { error } = await supabase.from('business_accounts').insert({
    user_id: currentUser.id,
    company_name: companyName,
    contact_name: contactName,
    business_email: businessEmail,
    phone,
    country,
    company_registration_number: companyReg,
    business_type: businessType,
    status: 'pending_approval',
  });

  if (error) fail('/business/register', 'Could not create your business account. Please try again.');

  // The platform role is only set when the account does not already have one,
  // so a vendor owner or admin keeps their role.
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (!existingRole || existingRole.role === 'customer') {
    await supabase.from('user_roles').upsert({
      user_id: currentUser.id,
      role: 'business_buyer',
    });
  }

  // The platform can decide that new accounts skip the approval queue.
  const { data: needsApproval } = await supabase.rpc('bulk_registration_requires_approval');
  if (needsApproval === false) {
    await supabase
      .from('business_accounts')
      .update({ status: 'approved', decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', currentUser.id);
    redirect('/business?approved=1');
  }

  redirect('/business/status?status=pending_approval&submitted=1');
}

