// Pure helpers shared by every MyFatoorah payment entry point.
// No Deno globals and no network calls here, so the same code runs in Edge
// Functions and in unit tests.

export interface AllocationLine {
  supplierCode: string | number | null | undefined;
  amountMinor: number;
}

export interface AggregatedShare {
  supplierCode: string;
  amountMinor: number;
}

/** 125000 fils -> 1250.00 QAR, rounded to provider precision. */
export function minorToMajor(minor: number): number {
  return Number((Number(minor) / 100).toFixed(2));
}

/** Collapse one line per order item into one share per supplier. */
export function aggregateSupplierShares(lines: AllocationLine[]): AggregatedShare[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const code = String(line.supplierCode ?? '').trim();
    if (!code || !Number.isFinite(line.amountMinor) || line.amountMinor <= 0) continue;
    totals.set(code, (totals.get(code) ?? 0) + line.amountMinor);
  }
  return [...totals.entries()].map(([supplierCode, amountMinor]) => ({ supplierCode, amountMinor }));
}

/** v2 Suppliers[] — use InvoiceShare only; commission stays provider-managed. */
export function buildInvoiceSuppliers(lines: AllocationLine[]): Array<{ SupplierCode: number; InvoiceShare: number }> {
  return aggregateSupplierShares(lines).map((share) => ({
    SupplierCode: Number(share.supplierCode),
    InvoiceShare: minorToMajor(share.amountMinor),
  }));
}

/** The sum of all InvoiceShare values must equal the invoice total. */
export function supplierSharesMatchTotal(shares: Array<{ InvoiceShare: number }>, totalMinor: number): boolean {
  const sum = shares.reduce((total, share) => total + Number(share.InvoiceShare || 0), 0);
  return Math.abs(sum - minorToMajor(totalMinor)) < 0.005;
}

/** Returns a human-readable reason when a supplier cannot receive payments. */
export function supplierReadinessIssue(supplier: {
  status?: string | null;
  supplierCode?: string | number | null;
  supplierStatus?: string | null;
  paymentEligibility?: boolean | null;
  platformStatus?: string | null;
}): string | null {
  if (!supplier.supplierCode) return 'supplier_not_ready';
  if (supplier.platformStatus && !['approved', 'active'].includes(String(supplier.platformStatus))) {
    return 'supplier_not_ready';
  }
  if (String(supplier.supplierStatus ?? '').toLowerCase() !== 'active') return 'supplier_not_active';
  if (!supplier.paymentEligibility) return 'payments_not_enabled';
  return null;
}
