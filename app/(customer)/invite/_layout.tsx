import React from 'react';

import { AuthGateLayout } from '@/src/components/AuthGateLayout';

/** Joining a basket from an invite requires an account. */
export default function InviteLayout() {
  return <AuthGateLayout />;
}
