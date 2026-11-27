import { FetchTransport, GiftCardCheckoutController } from '../src/index';
import { GiftCardPaymentMethod } from '../src/react/index';

const transport = new FetchTransport({ hostBaseUrl: '/api/gift-card' });

const controller = new GiftCardCheckoutController(transport, {
  externalVendorId: '55671',
  externalBranchId: '55671-02',
  externalOrderId: 'PLATFORM-998877',
  currency: 'QAR',
  orderAmountMinor: 20000,
});

/** Drop this next to the host's other payment method radios. */
export function GiftCardOption() {
  return (
    <GiftCardPaymentMethod
      controller={controller}
      refreshIntervalMs={30000}
      labels={{ title: 'Pay with a Tazella gift card' }}
      className="host-checkout-payment-method"
    />
  );
}
