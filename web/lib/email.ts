// web/lib/email.ts
// Sending gift cards to the people a business bought them for.
//
// The bulk flow needs to send one message per recipient. When an email
// provider is configured (RESEND_API_KEY) the message goes out immediately.
// Without one the message stays in the outbox as "queued", so the business
// can still download the links and send them any way it likes.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Giftly <gifts@giftly.qa>';

export interface EmailResult {
  delivered: boolean;
  id?: string;
  error?: string;
  reason?: string;
}

/** True when a real email provider is wired up. */
export function emailProviderReady(): boolean {
  return Boolean(RESEND_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    return { delivered: false, reason: 'email_provider_not_configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });

    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) {
      return { delivered: false, error: payload?.message ?? `Email provider returned ${response.status}` };
    }
    return { delivered: true, id: payload?.id };
  } catch (error) {
    return { delivered: false, error: error instanceof Error ? error.message : 'Email send failed' };
  }
}

/** The site the claim links point at. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** The web claim link a recipient opens. */
export function claimUrl(token: string): string {
  return `${siteUrl()}/claim/${token}`;
}

/** The in-app link, for recipients who already have the app. */
export function appClaimUrl(token: string): string {
  return `giftly://claim/${token}`;
}
