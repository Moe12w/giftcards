import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gift, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/money';
import { getLocale } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'You received a gift card' };

/**
 * The web side of the claim link.
 *
 * The full claiming happens in the Giftly app (that is where the gift is
 * stored), so this page shows what the gift is and opens the app. The token is
 * only ever passed to the database, which hashes it.
 */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('claim_preview', { p_token: token });
  const gift = (Array.isArray(data) ? data[0] : data) as any | null;

  if (error || !gift) notFound();

  const amount = Number(gift.amount_minor ?? 0);
  const appUrl = `giftly://claim/${token}`;

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <span className="icon-tile mint" style={{ marginInline: 'auto' }}><Gift size={26} /></span>
          <p className="eyebrow mint" style={{ marginTop: 16 }}>
            {gift.sender_name ? `${gift.sender_name} sent you a gift` : 'You received a gift card'}
          </p>
          <h1 style={{ marginTop: 8 }}>{gift.product_title ?? 'Giftly gift card'}</h1>
          <p style={{ marginTop: 10 }}>
            {gift.vendor_name ?? 'Giftly'}
            {amount > 0 ? <> · {formatMoney(amount, locale)}</> : null}
          </p>

          {gift.gift_message ? (
            <p style={{ marginTop: 16, padding: 14, borderLeft: '3px solid var(--ink)', background: 'var(--surface-soft)', textAlign: 'start' }}>
              {gift.gift_message}
            </p>
          ) : null}

          <a className="btn primary" href={appUrl} style={{ marginTop: 20 }}>
            <Smartphone size={16} /> Open in the Giftly app
          </a>

          <p className="small muted" style={{ marginTop: 14 }}>
            The gift is stored in the Giftly app, where it can be spent in parts and added to your wallet.
          </p>

          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <Link className="btn ghost sm" href="/download">Get the app</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
