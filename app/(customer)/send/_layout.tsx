import React from 'react';

import { AuthGateLayout } from '@/src/components/AuthGateLayout';

/** Sending a gift is tied to the customer's account. */
export default function SendLayout() {
  return <AuthGateLayout />;
}
