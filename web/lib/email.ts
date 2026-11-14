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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tells a requester that support answered their ticket.
 *
 * The message repeats the answer so it is readable straight from the inbox,
 * and points at the app for the full thread. It is bilingual on the same
 * `preferred_language` the rest of the platform uses.
 */
export async function sendSupportReplyEmail({
  to,
  name,
  ticketSubject,
  reply,
  locale,
}: {
  to: string;
  name?: string | null;
  ticketSubject: string;
  reply: string;
  locale?: 'en' | 'ar' | null;
}): Promise<EmailResult> {
  const isArabic = locale === 'ar';
  const greeting = name ? (isArabic ? `مرحباً ${name},` : `Hi ${name},`) : isArabic ? 'مرحباً,' : 'Hi,';

  const subject = isArabic
    ? `رد جديد على تذكرة الدعم: ${ticketSubject}`
    : `New reply on your support ticket: ${ticketSubject}`;

  const text = isArabic
    ? `${greeting}\n\nرد فريق دعم غيفتلي على تذكرتك "${ticketSubject}":\n\n${reply}\n\nافتح تطبيق غيفتلي ثم الملف الشخصي ← الدعم لمتابعة المحادثة.\n\n— غيفتلي`
    : `${greeting}\n\nGiftly support replied to your ticket "${ticketSubject}":\n\n${reply}\n\nOpen the Giftly app and go to Profile → Support to continue the conversation.\n\n— Giftly`;

  const html = isArabic
    ? `<p>${escapeHtml(greeting)}</p><p>رد فريق دعم غيفتلي على تذكرتك <strong>${escapeHtml(ticketSubject)}</strong>:</p><blockquote>${escapeHtml(reply).replace(/\n/g, '<br />')}</blockquote><p>افتح تطبيق غيفتلي ثم الملف الشخصي ← الدعم لمتابعة المحادثة.</p><p>— غيفتلي</p>`
    : `<p>${escapeHtml(greeting)}</p><p>Giftly support replied to your ticket <strong>${escapeHtml(ticketSubject)}</strong>:</p><blockquote>${escapeHtml(reply).replace(/\n/g, '<br />')}</blockquote><p>Open the Giftly app and go to Profile → Support to continue the conversation.</p><p>— Giftly</p>`;

  return sendEmail({ to, subject, html, text });
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
