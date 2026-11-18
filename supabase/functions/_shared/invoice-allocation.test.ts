import { describe, expect, it } from 'vitest';
import {
  aggregateSupplierShares,
  buildInvoiceSuppliers,
  minorToMajor,
  supplierReadinessIssue,
  supplierSharesMatchTotal,
} from './invoice-allocation.ts';

describe('supplier allocation helpers', () => {
  it('groups multiple lines belonging to the same supplier', () => {
    const shares = aggregateSupplierShares([
      { supplierCode: '123', amountMinor: 4500 },
      { supplierCode: 123, amountMinor: 2500 },
      { supplierCode: '456', amountMinor: 3000 },
    ]);
    expect(shares).toEqual([
      { supplierCode: '123', amountMinor: 7000 },
      { supplierCode: '456', amountMinor: 3000 },
    ]);
  });

  it('builds v2 Suppliers[] with InvoiceShare only and no commission fields', () => {
    const suppliers = buildInvoiceSuppliers([
      { supplierCode: '123', amountMinor: 7000 },
      { supplierCode: '456', amountMinor: 3000 },
    ]);
    expect(suppliers).toEqual([
      { SupplierCode: 123, InvoiceShare: 70 },
      { SupplierCode: 456, InvoiceShare: 30 },
    ]);
    expect(JSON.stringify(suppliers)).not.toContain('Proposed');
  });

  it('reconciles shares with the invoice total', () => {
    const suppliers = buildInvoiceSuppliers([
      { supplierCode: '123', amountMinor: 12345 },
      { supplierCode: '456', amountMinor: 5555 },
    ]);
    expect(supplierSharesMatchTotal(suppliers, 17900)).toBe(true);
    expect(supplierSharesMatchTotal(suppliers, 17901)).toBe(false);
  });

  it('converts fils to major units', () => {
    expect(minorToMajor(125000)).toBe(1250);
    expect(minorToMajor(1)).toBe(0.01);
  });

  it('reports why a supplier is not eligible', () => {
    expect(supplierReadinessIssue({ supplierCode: '1', supplierStatus: 'active', paymentEligibility: true })).toBeNull();
    expect(supplierReadinessIssue({ supplierCode: null, supplierStatus: 'active', paymentEligibility: true })).toBe('supplier_not_ready');
    expect(supplierReadinessIssue({ supplierCode: '1', supplierStatus: 'pending', paymentEligibility: true })).toBe('supplier_not_active');
    expect(supplierReadinessIssue({ supplierCode: '1', supplierStatus: 'active', paymentEligibility: false })).toBe('payments_not_enabled');
    expect(supplierReadinessIssue({ supplierCode: '1', supplierStatus: 'active', paymentEligibility: true, platformStatus: 'suspended' })).toBe('supplier_not_ready');
  });
});
