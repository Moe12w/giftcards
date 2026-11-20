// web/lib/actions/_form.ts
// Shared FormData parsing helpers for server actions. Keeping one copy avoids
// the subtle drift (and repeated code) that came from pasting these into every
// action file.
import { redirect } from 'next/navigation';

import { parseMoneyToMinor } from '@/lib/money';

export function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value || null;
}

export function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

export function moneyField(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  try {
    return parseMoneyToMinor(raw);
  } catch {
    return null;
  }
}

export function intField(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}
