import { describe, expect, it, vi } from 'vitest';

// Only the Supabase client is stubbed. The route under test must call the real
// safeNextPath helper — testing the helper alone would not catch a caller that
// reimplements it incorrectly (which is exactly how the open redirect shipped).
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ error: null }) },
  }),
}));

import { GET } from './route';

function callbackUrl(next: string) {
  return new Request(
    `https://giftly.qa/auth/callback?code=valid-code&next=${encodeURIComponent(next)}`,
  );
}

describe('auth callback redirect target', () => {
  it('rejects a backslash-normalized off-origin next value', async () => {
    const response = await GET(callbackUrl('/\\evil.example'));
    expect(response.headers.get('location')).toBe('https://giftly.qa/');
  });

  it('rejects a protocol-relative next value', async () => {
    const response = await GET(callbackUrl('//evil.example'));
    expect(response.headers.get('location')).toBe('https://giftly.qa/');
  });

  it('allows a legitimate relative path', async () => {
    const response = await GET(callbackUrl('/faq?tab=shipping'));
    expect(response.headers.get('location')).toBe('https://giftly.qa/faq?tab=shipping');
  });
});
