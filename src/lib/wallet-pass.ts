// src/lib/wallet-pass.ts
// Apple Wallet and Google Wallet passes for a gift card.
//
// The pass itself is built and signed on the server: the certificate must never
// reach the app. This module only asks for a link and opens it.
import { demoMode, hasSupabaseConfig } from './env';
import { getSupabase } from './supabase';

export interface WalletPassLinks {
  apple: string | null;
  google: string | null;
}

function usable(): boolean {
  return hasSupabaseConfig && !demoMode;
}

/**
 * The signed pass URL for each provider, or null for one we could not build
 * (for example while the certificates are not configured).
 */
export async function fetchWalletPassLinks(
  voucherId: string,
): Promise<WalletPassLinks | null> {
  if (!usable()) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke('wallet-pass', {
      body: { action: 'links', voucherId },
    });
    if (error) return null;
    const body = data as { apple?: unknown; google?: unknown } | null;
    return {
      apple: typeof body?.apple === 'string' ? body.apple : null,
      google: typeof body?.google === 'string' ? body.google : null,
    };
  } catch {
    return null;
  }
}

/**
 * Pushes the current balance to an already-saved Google Wallet pass. Fire and
 * forget: a pass that was never saved answers 404 and nothing happens.
 */
export async function syncWalletPass(voucherId: string): Promise<void> {
  if (!usable()) return;
  try {
    await getSupabase().functions.invoke('wallet-pass', {
      body: { action: 'sync', voucherId },
    });
  } catch {
    // A stale wallet pass is not worth interrupting a redemption for.
  }
}
