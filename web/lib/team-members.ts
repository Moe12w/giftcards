import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface NewTeamMember {
  fullName: string;
  email: string;
  password: string;
}

export interface TeamMemberResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

/** Same password rule as registration: at least 8 characters. */
export function validateNewMemberPassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters for the password.';
  if (password.length > 128) return 'The password is too long.';
  return null;
}

/**
 * Creates a verified auth user so the person can sign in immediately with the
 * email and password chosen by the manager/admin. Never overwrites an existing
 * account's password.
 */
export async function createTeamMemberAccount(input: NewTeamMember): Promise<TeamMemberResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'Enter a valid email address.' };
  const passwordError = validateNewMemberPassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  const admin = createAdminClient();

  // Do not pre-check by listing users: the unique email constraint on
  // auth.users is authoritative and also protects against concurrent creates.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() || null },
  });

  if (error) {
    const message = String(error.message ?? '').toLowerCase();
    if (message.includes('already') || message.includes('exist')) {
      return {
        ok: false,
        error: 'An account with that email already exists. Ask them to sign in, or contact Tazella support.',
      };
    }
    return { ok: false, error: 'Could not create the account. Please try again.' };
  }
  if (!data.user) return { ok: false, error: 'Could not create the account. Please try again.' };

  // The on_auth_user_created trigger creates the profile and customer role.
  return { ok: true, userId: data.user.id };
}
