// web/lib/security.ts
// Pure security helpers shared by server actions. No React, no Next imports, so
// they can be unit tested in plain Node.

/** Max failed sign-in attempts allowed per identifier inside the window. */
export const AUTH_MAX_FAILED = 8;
/** Sliding window for the sign-in limiter, in seconds (15 minutes). */
export const AUTH_WINDOW_SECONDS = 900;

const PLACEHOLDER_ORIGIN = 'https://placeholder.invalid';

/**
 * Returns a same-origin relative path, or the fallback.
 * Rejects protocol-relative URLs (`//evil.example`), backslashes (browsers
 * normalise `\` to `/`), absolute URLs and control characters.
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate || candidate.includes('\\') || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return fallback;
  }
  if (!candidate.startsWith('/')) return fallback;
  try {
    const parsed = new URL(candidate, PLACEHOLDER_ORIGIN);
    if (parsed.origin !== PLACEHOLDER_ORIGIN) return fallback;
    if (parsed.protocol !== 'https:') return fallback;
  } catch {
    return fallback;
  }
  return candidate;
}

/** Allowlist of image MIME types the platform accepts for uploads. */
export const ALLOWED_IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

export type AllowedImage = (typeof ALLOWED_IMAGE_TYPES)[keyof typeof ALLOWED_IMAGE_TYPES];

/** Max upload size in bytes (4 MB). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Returns the safe extension for an uploaded image, or null when rejected. */
export function imageExtension(mime: string | null | undefined): AllowedImage | null {
  if (!mime) return null;
  return ALLOWED_IMAGE_TYPES[mime.toLowerCase() as keyof typeof ALLOWED_IMAGE_TYPES] ?? null;
}

/**
 * Validates an uploaded image: exact MIME allowlist, non-empty and size cap.
 * The MIME allowlist is what gets stored as the object's Content-Type, so it
 * must reject `image/svg+xml` and every other type outright.
 */
export function validateImageUpload(file: {
  type: string;
  size: number;
}): { ok: true; extension: AllowedImage } | { ok: false; error: string } {
  const extension = imageExtension(file.type);
  if (!extension) {
    return { ok: false, error: 'Use a PNG, JPEG or WebP image.' };
  }
  if (file.size <= 0) return { ok: false, error: 'Choose an image to upload.' };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'That image is too large. Keep it under 4 MB.' };
  }
  return { ok: true, extension };
}

/** Normalises a user-supplied website into a safe http(s) URL, or null. */
export function normalizeWebsite(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Escapes a value for safe inclusion in an HTML e-mail body. */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Neutralises spreadsheet formula injection in CSV exports.
 *
 * RFC4180 quoting keeps embedded commas, quotes and newlines inside a single
 * cell. Without it a value containing a newline could start a new row whose
 * first cell begins with `=`, bypassing a leading-character-only check.
 */
export function csvCell(value: string | null | undefined): string {
  const raw = String(value ?? '');
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Maps a Supabase auth error to a message that is safe to show to a user.
 * Provider text can reveal whether an address is registered, whether its
 * e-mail is confirmed, or how the rate limiter is configured.
 */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/rate limit|too many|security purposes|try again later/i.test(raw)) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (/email not confirmed/i.test(raw)) {
    return 'Could not sign you in. Check your details and try again.';
  }
  if (/invalid login credentials|invalid email|invalid password|invalid_credentials/i.test(raw)) {
    return 'Could not sign you in. Check your details and try again.';
  }
  if (/user already registered|already been registered|already exists/i.test(raw)) {
    return 'Could not create your account. If you already have one, sign in or reset your password.';
  }
  if (/password should be at least|password is too short/i.test(raw)) {
    return 'Use a stronger password.';
  }
  return 'Something went wrong. Please try again.';
}

/** Normalises an identifier (e-mail) for the attempt ledger. */
export function authIdentifier(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase();
}
