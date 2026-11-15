// src/lib/claim-link.ts
// Turning a claim token into a link that can be sent to somebody.
//
// The recipient may not have the app, so the web claim page is the link that
// goes in a WhatsApp message. When no site URL is configured the app's own
// deep link is used instead.
import { env } from './env';

export function claimShareUrl(token: string): string {
  const base = env.siteUrl.replace(/\/+$/, '');
  return base ? `${base}/claim/${token}` : `${env.appScheme}://claim/${token}`;
}
