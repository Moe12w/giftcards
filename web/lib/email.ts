// web/lib/email.ts
// Sending gift cards to the people a business bought them for.
//
// The provider settings live in the admin dashboard (`system_settings`), so a
// key can be pasted in and used without a redeploy. The environment variables
// stay as a fallback for deployments that set them instead.
//
// Without a key nothing is sent: bulk messages are queued in the outbox so the
// business can still download the links and send them any way it likes.
//
// Server only. The provider key is a platform secret and is read with the
// service role client; never import this module from a client component.
import { createAdminClient } from '@/lib/supabase/admin';

export const DEFAULT_EMAIL_FROM = 'Giftly <gifts@giftly.qa>';

/** How long a saved configuration is reused before it is read again. */
const CONFIG_TTL_MS = 30_000;

export interface EmailConfig {
  /** Null when no provider is configured at all. */
  apiKey: string | null;
  from: string;
  /** Where the settings came from, so the admin page can say so. */
  source: 'database' | 'environment' | 'none';
}

let cached: { at: number; config: EmailConfig } | null = null;

/** Drops the cached settings, so a change on the admin page applies at once. */
export function forgetEmailConfig() {
  cached = null;
}

function envConfig(): EmailConfig {
  const key = (process.env.RESEND_API_KEY ?? '').trim();
  return {
    apiKey: key || null,
    from: (process.env.EMAIL_FROM ?? '').trim() || DEFAULT_EMAIL_FROM,
    source: key ? 'environment' : 'none',
  };
}

/**
 * Reads the email provider settings, newest source first: the admin dashboard,
 * then the environment, then nothing.
 *
 * The key row is private in `system_settings`, so a signed-in customer cannot
 * read it. The service role client is used here because sending also happens
 * from a business user's request.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.config;

  const fallback = envConfig();
  let config = fallback;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('system_settings')
      .select('key, value')
      .in('key', ['email.resend_api_key', 'email.from']);

    const rows = (data ?? []) as { key: string; value: unknown }[];
    const read = (key: string): string | null => {
      const value = rows.find((row) => row.key === key)?.value;
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    };

    const savedKey = read('email.resend_api_key');
    const savedFrom = read('email.from');

    if (savedKey) {
      config = { apiKey: savedKey, from: savedFrom ?? fallback.from, source: 'database' };
    } else if (savedFrom) {
      config = { apiKey: fallback.apiKey, from: savedFrom, source: fallback.apiKey ? 'environment' : 'none' };
    }
  } catch {
    // No service role key on this deployment: the environment still works.
  }

  cached = { at: Date.now(), config };
  return config;
}

export interface EmailResult {
  delivered: boolean;
  id?: string;
  error?: string;
  reason?: string;
}

/** True when a real email provider is wired up. */
export async function emailProviderReady(): Promise<boolean> {
  const config = await getEmailConfig();
  return Boolean(config.apiKey);
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
  const { apiKey, from } = await getEmailConfig();
  if (!apiKey) {
    return { delivered: false, reason: 'email_provider_not_configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
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

/** The sender line, shown in the admin email panel so nobody has to guess. */
export async function emailFrom(): Promise<string> {
  return (await getEmailConfig()).from;
}

/**
 * A masked hint of the saved key, so an admin can tell which key is in use
 * without the key ever reaching the page.
 */
export async function emailKeyHint(): Promise<string | null> {
  const key = (await getEmailConfig()).apiKey;
  return key ? `••••${key.slice(-4)}` : null;
}

/**
 * Turns stored plain text back into a minimal HTML body.
 *
 * The outbox keeps the text of everything it queued, so a message written while
 * no provider was configured can still be delivered later without its original
 * markup.
 */
export function plainHtmlFromText(text: string): string {
  return `<div style="font-family:'Figtree','Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1c">${escapeHtml(
    text,
  ).replace(/\n/g, '<br />')}</div>`;
}

/**
 * Tells someone they have been sent a gift card, and how to claim it.
 *
 * This is the single-gift message: the bulk flow has its own per-recipient
 * template. It is bilingual on the same locale the rest of the platform uses,
 * and it never contains a card code — only the one-time claim link.
 */
export async function sendClaimLinkEmail({
  to,
  name,
  senderName,
  title,
  amountLabel,
  link,
  appLink,
  message,
  locale,
}: {
  to: string;
  name?: string | null;
  senderName: string;
  title: string;
  amountLabel: string;
  link: string;
  appLink: string;
  message?: string | null;
  locale?: 'en' | 'ar' | null;
}): Promise<EmailResult> {
  const isArabic = locale === 'ar';
  const greeting = name ? (isArabic ? `مرحباً ${name},` : `Hi ${name},`) : isArabic ? 'مرحباً,' : 'Hi,';
  const headline = isArabic
    ? `${senderName} أرسل لك ${title}`
    : `${senderName} sent you ${title}`;
  const subject = isArabic ? `لديك هدية من ${senderName}` : `You have a gift from ${senderName}`;
  const cta = isArabic ? 'استلم هديتك' : 'Claim your gift';
  const appCta = isArabic ? 'افتحها في تطبيق غيفتلي' : 'Open it in the Giftly app';
  const footnote = isArabic
    ? 'الهدية محفوظة في تطبيق غيفتلي ويمكن استخدامها على أجزاء. الرابط صالح لمرة واحدة.'
    : 'The gift card lives in the Giftly app and can be spent in parts. This link works once.';

  const text = [
    greeting,
    headline,
    amountLabel,
    message ?? '',
    `${cta}: ${link}`,
    `${appCta}: ${appLink}`,
    footnote,
    '— Giftly',
  ]
    .filter(Boolean)
    .join('\n\n');

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff8ec;font-family:'Figtree','Segoe UI',Arial,sans-serif;color:#1c1c1c">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #1c1c1c;border-radius:20px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#6e6e6e">Giftly</p>
    <p style="margin:0 0 6px;font-size:16px">${escapeHtml(greeting)}</p>
    <h1 style="margin:0 0 10px;font-size:26px;line-height:1.15">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 4px;font-size:18px;font-weight:700">${escapeHtml(amountLabel)}</p>
    ${
      message
        ? `<blockquote style="margin:16px 0;padding:12px 14px;border-left:3px solid #1c1c1c;background:#fbf6ec;font-size:14px">${escapeHtml(
            message,
          ).replace(/\n/g, '<br />')}</blockquote>`
        : ''
    }
    <p style="margin:22px 0 0">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#f2b233;color:#1c1c1c;text-decoration:none;font-weight:700;padding:12px 20px;border:2px solid #1c1c1c;border-radius:12px">${escapeHtml(
        cta,
      )}</a>
    </p>
    <p style="margin:12px 0 0;font-size:14px"><a href="${escapeHtml(
      appLink,
    )}" style="color:#1c1c1c">${escapeHtml(appCta)}</a></p>
    <p style="margin:18px 0 0;font-size:12px;color:#8a8a8a">${escapeHtml(footnote)}</p>
  </div>
</body></html>`;

  return sendEmail({ to, subject, html, text });
}
