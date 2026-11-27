import {
  FetchTransport,
  GiftCardCheckoutController,
  SdkError,
  isExpired,
} from '../src/index';

/**
 * Vanilla browser integration. `hostBaseUrl` points at YOUR backend, never at
 * Tazella. The browser bundle contains no API key and no signing secret.
 */
const transport = new FetchTransport({
  hostBaseUrl: '/api/gift-card',
  // If the host uses a session cookie, forward it from the host backend.
  // headers: () => ({ Authorization: `Bearer ${hostSessionToken}` }),
});

const controller = new GiftCardCheckoutController(transport, {
  externalVendorId: '55671',
  externalBranchId: '55671-02',
  externalOrderId: 'PLATFORM-998877',
  currency: 'QAR',
  orderAmountMinor: 20000,
});

controller.subscribe(() => {
  const state = controller.getSnapshot();
  if (state.status === 'applied' && isExpired(state)) {
    // The expiry time came from Tazella; refresh instead of guessing.
    void controller.refresh();
  }
});

export async function checkCard(code: string) {
  try {
    return await controller.validate(code);
  } catch (error) {
    if (error instanceof SdkError) return error.message;
    throw error;
  }
}

export async function applyCard() {
  return controller.apply();
}

export async function removeCard() {
  return controller.remove();
}
