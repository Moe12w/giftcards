import { useSyncExternalStore } from 'react';

import type { GiftCardCheckoutController } from '../controller';
import type { CheckoutState } from '../types';

export interface GiftCardCheckoutHook {
  state: CheckoutState;
  validate: (code: string) => Promise<CheckoutState>;
  apply: (requestedAmountMinor?: number) => Promise<CheckoutState>;
  remove: () => Promise<CheckoutState>;
  refresh: () => Promise<CheckoutState>;
  reset: () => void;
}

/** Subscribes a React tree to a controller. The controller owns all state. */
export function useGiftCardCheckout(controller: GiftCardCheckoutController): GiftCardCheckoutHook {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return {
    state,
    validate: (code) => controller.validate(code),
    apply: (requestedAmountMinor) => controller.apply(requestedAmountMinor),
    remove: () => controller.remove(),
    refresh: () => controller.refresh(),
    reset: () => controller.reset(),
  };
}
