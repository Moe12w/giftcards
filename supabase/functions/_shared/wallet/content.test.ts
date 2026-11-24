import { describe, expect, it } from 'vitest';

import {
  applePass,
  barcodeMessage,
  formatMoney,
  googleGiftCardObject,
  googleObjectId,
  isSessionVoucher,
  type WalletVoucher,
} from './content';

const VALUE_CARD: WalletVoucher = {
  id: '8a1f0c2e-1111-4a2b-9c3d-000000000001',
  vendorName: 'Bayt Al Shaar',
  currency: 'QAR',
  balanceMinor: 7500,
  expiresAt: '2027-01-31T00:00:00+00:00',
  status: 'claimed',
  totalSessions: 0,
  remainingSessions: 0,
};

const SESSION_CARD: WalletVoucher = {
  ...VALUE_CARD,
  id: '8a1f0c2e-2222-4a2b-9c3d-000000000002',
  totalSessions: 5,
  remainingSessions: 3,
  balanceMinor: 0,
};

describe('wallet pass content', () => {
  it('formats money without locale drift', () => {
    expect(formatMoney(7500, 'QAR')).toBe('QAR 75.00');
    expect(formatMoney(0, 'QAR')).toBe('QAR 0.00');
    expect(formatMoney(-500, 'QAR')).toBe('QAR 0.00');
  });

  it('uses the same QR message the app already shows', () => {
    expect(barcodeMessage(VALUE_CARD.id)).toBe(`tazilla:card:${VALUE_CARD.id}`);
  });

  it('builds a store card with the balance, barcode and web service', () => {
    const pass = applePass({
      voucher: VALUE_CARD,
      passTypeId: 'pass.qa.tazilla.card',
      teamId: 'TEAM123456',
      webServiceUrl: 'https://example.supabase.co/functions/v1/wallet-pass',
      authenticationToken: 'token',
    }) as Record<string, any>;

    expect(pass.serialNumber).toBe(VALUE_CARD.id);
    expect(pass.passTypeIdentifier).toBe('pass.qa.tazilla.card');
    expect(pass.teamIdentifier).toBe('TEAM123456');
    expect(pass.authenticationToken).toBe('token');
    expect(pass.expirationDate).toBe(VALUE_CARD.expiresAt);
    expect(pass.storeCard.primaryFields[0].value).toBe('QAR 75.00');
    expect(pass.storeCard.primaryFields[0].changeMessage).toContain('%@');
    expect(pass.storeCard.headerFields[0].value).toBe('Bayt Al Shaar');
    expect(pass.barcodes[0]).toMatchObject({
      format: 'PKBarcodeFormatQR',
      message: barcodeMessage(VALUE_CARD.id),
    });
  });

  it('shows sessions instead of money on an experience card', () => {
    const pass = applePass({
      voucher: SESSION_CARD,
      passTypeId: 'pass.qa.tazilla.card',
      teamId: 'TEAM123456',
      webServiceUrl: 'https://example.test',
      authenticationToken: 'token',
    }) as Record<string, any>;

    expect(pass.storeCard.primaryFields[0].value).toBe('3 of 5');
    expect(pass.storeCard.primaryFields[0].label).toBe('SESSIONS LEFT');
  });

  it('omits the expiry when the gift never expires', () => {
    const pass = applePass({
      voucher: { ...VALUE_CARD, expiresAt: null },
      passTypeId: 'pass.qa.tazilla.card',
      teamId: 'TEAM123456',
      webServiceUrl: 'https://example.test',
      authenticationToken: 'token',
    }) as Record<string, any>;

    expect(pass.expirationDate).toBeUndefined();
    expect(pass.storeCard.secondaryFields[0].value).toBe('No expiry');
  });

  it('derives a stable Google object id', () => {
    expect(googleObjectId('3388000000011111111', VALUE_CARD.id)).toBe(
      '3388000000011111111.tazilla_8a1f0c2e11114a2b9c3d000000000001',
    );
  });

  it('publishes the balance in micros, not minor units', () => {
    const object = googleGiftCardObject({
      issuerId: '3388000000011111111',
      voucher: VALUE_CARD,
    }) as Record<string, any>;

    expect(object.state).toBe('ACTIVE');
    expect(object.balance).toEqual({ micros: '75000000', currencyCode: 'QAR' });
    expect(object.barcode.value).toBe(barcodeMessage(VALUE_CARD.id));
  });

  it('marks a spent card expired and a session card without money', () => {
    const spent = googleGiftCardObject({
      issuerId: '3388000000011111111',
      voucher: { ...VALUE_CARD, status: 'redeemed' },
    }) as Record<string, any>;
    expect(spent.state).toBe('EXPIRED');

    const sessions = googleGiftCardObject({
      issuerId: '3388000000011111111',
      voucher: SESSION_CARD,
    }) as Record<string, any>;
    expect(sessions.balance).toBeUndefined();
    expect(isSessionVoucher(SESSION_CARD)).toBe(true);
    expect(sessions.textModulesData.some((module: any) => module.id === 'sessions')).toBe(
      true,
    );
  });
});
