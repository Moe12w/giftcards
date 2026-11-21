import React from 'react';

import { AuthGateLayout } from '@/src/components/AuthGateLayout';

/** Language stays public so guests can switch before signing in. */
export default function ProfileLayout() {
  return <AuthGateLayout publicSegments={['language']} />;
}
