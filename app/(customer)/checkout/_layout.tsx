import React from 'react';

import { AuthGateLayout } from '@/src/components/AuthGateLayout';

/** Orders and payment need a signed-in customer. */
export default function CheckoutLayout() {
  return <AuthGateLayout />;
}
