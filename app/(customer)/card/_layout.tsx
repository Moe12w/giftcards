import React from 'react';

import { AuthGateLayout } from '@/src/components/AuthGateLayout';

/** A voucher detail is only meaningful for its owner. */
export default function CardLayout() {
  return <AuthGateLayout />;
}
