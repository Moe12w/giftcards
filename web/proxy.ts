import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Public marketing pages must stay on the CDN: no auth work for anonymous
  // visitors. Only the authenticated portals and the auth callback need the
  // session refreshed by the proxy.
  matcher: [
    '/admin/:path*',
    '/vendor/:path*',
    '/enterprise/:path*',
    '/business/:path*',
    '/auth/:path*',
  ],
};
