// supabase/functions/_shared/wallet/content.ts
// The two pass payloads, built from one voucher.
//
// Pure on purpose: no Deno APIs and no network, so the shape of both passes is
// covered by the repo's Node test run. The QR message is the same string the
// card screen already shows, so the vendor scanner keeps working unchanged.

export interface WalletVoucher {
  id: string;
  vendorName: string;
  currency: string;
  balanceMinor: number;
  expiresAt: string | null;
  status: string;
  totalSessions: number | null;
  remainingSessions: number | null;
}

export const HOW_TO_USE =
  'Show this pass at the counter. The balance stays valid until the gift expires or reaches zero.';

export function isSessionVoucher(voucher: WalletVoucher): boolean {
  return (voucher.totalSessions ?? 0) > 0;
}

/** Minor units to a stable, non-locale string: "QAR 75.00". */
export function formatMoney(minor: number, currency: string): string {
  const value = Math.max(0, Math.round(minor)) / 100;
  return `${currency} ${value.toFixed(2)}`;
}

/** The string the vendor scanner already understands. */
export function barcodeMessage(voucherId: string): string {
  return `tazilla:card:${voucherId}`;
}

function expiryText(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'No expiry';
  return date.toISOString().slice(0, 10);
}

export function applePass(input: {
  voucher: WalletVoucher;
  passTypeId: string;
  teamId: string;
  webServiceUrl: string;
  authenticationToken: string;
}): Record<string, unknown> {
  const { voucher } = input;
  const sessions = isSessionVoucher(voucher);
  const primaryValue = sessions
    ? `${Math.max(0, voucher.remainingSessions ?? 0)} of ${voucher.totalSessions}`
    : formatMoney(voucher.balanceMinor, voucher.currency);

  return {
    formatVersion: 1,
    passTypeIdentifier: input.passTypeId,
    serialNumber: voucher.id,
    teamIdentifier: input.teamId,
    organizationName: 'Tazilla',
    description: `${voucher.vendorName} gift card`,
    logoText: 'Tazilla',
    foregroundColor: 'rgb(255,255,255)',
    backgroundColor: 'rgb(11,74,68)',
    labelColor: 'rgb(203,232,227)',
    webServiceURL: input.webServiceUrl,
    authenticationToken: input.authenticationToken,
    ...(voucher.expiresAt ? { expirationDate: voucher.expiresAt } : {}),
    storeCard: {
      headerFields: [
        { key: 'vendor', label: 'WHERE', value: voucher.vendorName.slice(0, 40) },
      ],
      primaryFields: [
        {
          key: sessions ? 'sessions' : 'balance',
          label: sessions ? 'SESSIONS LEFT' : 'BALANCE',
          value: primaryValue,
          changeMessage: sessions ? '%@ left' : 'Balance is now %@',
        },
      ],
      secondaryFields: [
        { key: 'expiry', label: 'EXPIRES', value: expiryText(voucher.expiresAt) },
      ],
      auxiliaryFields: [],
      backFields: [
        { key: 'how', label: 'HOW TO USE', value: HOW_TO_USE },
        { key: 'support', label: 'SUPPORT', value: 'https://tazilla.com.qa' },
      ],
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: barcodeMessage(voucher.id),
        messageEncoding: 'iso-8859-1',
        altText: voucher.vendorName.slice(0, 40),
      },
    ],
  };
}

/** The class every Tazilla gift card object belongs to. */
export function googleClassId(issuerId: string): string {
  return `${issuerId}.tazilla_giftcard_v1`;
}

/** Derived from the voucher, so an object can always be addressed again. */
export function googleObjectId(issuerId: string, voucherId: string): string {
  const suffix = voucherId.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  return `${issuerId}.tazilla_${suffix}`;
}

export function googleGiftCardObject(input: {
  issuerId: string;
  voucher: WalletVoucher;
}): Record<string, unknown> {
  const { voucher } = input;
  const sessions = isSessionVoucher(voucher);
  const closed = voucher.status === 'expired' || voucher.status === 'voided' || voucher.status === 'redeemed';

  const textModules = [
    { id: 'vendor', header: 'Where', body: voucher.vendorName },
    { id: 'expiry', header: 'Expires', body: expiryText(voucher.expiresAt) },
    ...(sessions
      ? [
          {
            id: 'sessions',
            header: 'Sessions left',
            body: `${Math.max(0, voucher.remainingSessions ?? 0)} of ${voucher.totalSessions}`,
          },
        ]
      : []),
  ];

  return {
    id: googleObjectId(input.issuerId, voucher.id),
    classId: googleClassId(input.issuerId),
    state: closed ? 'EXPIRED' : 'ACTIVE',
    cardNumber: (voucher.id.replace(/-/g, '').slice(0, 12) || 'TAZILLA').toUpperCase(),
    hexBackgroundColor: '#0B4A44',
    barcode: {
      type: 'QR_CODE',
      value: barcodeMessage(voucher.id),
      alternateText: voucher.vendorName.slice(0, 40),
    },
    textModulesData: textModules,
    // A money card carries a real balance. A session card has no money on it, so
    // no balance is published rather than a misleading zero.
    ...(sessions
      ? {}
      : {
          balance: {
            micros: String(Math.max(0, Math.round(voucher.balanceMinor)) * 10_000),
            currencyCode: voucher.currency,
          },
        }),
    ...(voucher.expiresAt
      ? { validTimeInterval: { end: { date: voucher.expiresAt } } }
      : {}),
  };
}
