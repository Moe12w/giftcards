// src/lib/whatsapp.ts
// Sending a gift card or a gift box over WhatsApp.
//
// The customer picks WhatsApp as the delivery method, the app builds the
// official wa.me link with the gift or basket link in the message, and opens it
// in WhatsApp so the customer can send it from their own conversation.
import { Linking } from 'react-native';

/** Strips spaces and keeps the leading + so the number works internationally. */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  return cleaned;
}

/** True when the number looks like a phone number we can link to. */
export function isUsablePhone(phone: string): boolean {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return digits.length >= 8;
}

/** The wa.me link with the message pre-filled. */
export function whatsappLink(phone: string, message: string): string {
  const number = normalizePhone(phone).replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Opens WhatsApp with the message ready to send. */
export async function shareOnWhatsapp(phone: string, message: string): Promise<boolean> {
  if (!isUsablePhone(phone)) return false;
  try {
    await Linking.openURL(whatsappLink(phone, message));
    return true;
  } catch {
    return false;
  }
}
