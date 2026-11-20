// web/lib/api-auth.ts
// Small helpers for private-file API routes: authenticate once, create the
// service-role client once, and return a NextResponse on failure.
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Authed = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
};
type Failed = { ok: false; response: NextResponse };

export async function apiUser(): Promise<Authed | Failed> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: new NextResponse('Unauthorized', { status: 401 }) };
  return { ok: true, supabase, user };
}

export function apiAdmin():
  | { ok: true; admin: ReturnType<typeof createAdminClient> }
  | Failed {
  try {
    return { ok: true, admin: createAdminClient() };
  } catch {
    return { ok: false, response: new NextResponse('Storage unavailable', { status: 503 }) };
  }
}
