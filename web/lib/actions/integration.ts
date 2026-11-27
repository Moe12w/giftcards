'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type CredentialIssueState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  apiKey?: string;
  signingSecret?: string;
};

/**
 * Issues a key bound to one verified mapping. The plaintext is returned to the
 * calling client exactly once; only its hash and an encrypted secret are stored.
 */
export async function issueVendorCredential(
  _previous: CredentialIssueState,
  formData: FormData,
): Promise<CredentialIssueState> {
  const mappingId = String(formData.get('mapping_id') ?? '').trim();
  const environment = String(formData.get('environment') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim().slice(0, 80);

  if (!mappingId || (environment !== 'sandbox' && environment !== 'production')) {
    return { status: 'error', message: 'Invalid mapping or environment.' };
  }

  const apiKey = `tz_live_${randomBytes(24).toString('hex')}`;
  const signingSecret = randomBytes(32).toString('hex');

  const supabase = await createClient();
  const { error } = await supabase.rpc('integration_vendor_issue_credential', {
    p_mapping_id: mappingId,
    p_environment: environment,
    p_label: label || 'wordpress',
    p_key: apiKey,
    p_signing_secret: signingSecret,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath('/vendor/settings');
  return { status: 'success', apiKey, signingSecret };
}

export async function revokeVendorCredential(formData: FormData): Promise<void> {
  const credentialId = String(formData.get('credential_id') ?? '').trim();
  if (!credentialId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('integration_vendor_revoke_credential', {
    p_credential_id: credentialId,
  });
  if (error) {
    console.error('Could not revoke integration credential:', error.message);
    return;
  }

  revalidatePath('/vendor/settings');
  revalidatePath('/admin/integrations');
}
