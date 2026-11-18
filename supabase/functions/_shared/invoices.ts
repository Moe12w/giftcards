// Shared MyFatoorah invoice creation for every payment entry point:
// Expo checkout, bulk checkout and MCP payment links.
// All supplier resolution, validation, allocation and recording lives here.

import { sendPayment } from './myfatoorah.ts';
import {
  buildInvoiceSuppliers,
  minorToMajor,
  supplierReadinessIssue,
  supplierSharesMatchTotal,
  type AllocationLine,
} from './invoice-allocation.ts';

export class InvoiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InvoiceError';
  }
}

export interface CreateInvoiceInput {
  orderId: string;
  reference: string;
  customerName: string;
  customerEmail?: string | null;
  customerMobile?: string | null;
  language?: 'en' | 'ar';
  notificationOption?: 'LNK' | 'EML' | 'SMS' | 'ALL';
  callbackUrl: string;
  errorUrl: string;
  webhookUrl: string;
}

export interface CreatedInvoice {
  invoiceId: string;
  invoiceUrl: string;
  amountMinor: number;
  suppliers: Array<{ SupplierCode: number; InvoiceShare: number }>;
}

/** Resolve the supplier for each order line, validate readiness and allocate. */
export async function allocationForOrder(admin: any, orderId: string) {
  const { data: items, error: itemError } = await admin
    .from('order_items')
    .select('id, product_id, total_minor, quantity')
    .eq('order_id', orderId);
  if (itemError || !items?.length) {
    throw new InvoiceError('order_has_no_items', 'This order has no gift cards to pay for.');
  }

  const productIds = [...new Set(items.map((item: any) => item.product_id))];
  const { data: products, error: productError } = await admin
    .from('products')
    .select(
      'id, vendors(id,status,myfatoorah_supplier_code,myfatoorah_supplier_status,payment_eligibility), enterprise_partners(id,status,myfatoorah_supplier_code,myfatoorah_supplier_status,payment_eligibility)',
    )
    .in('id', productIds);
  if (productError) {
    throw new InvoiceError('catalogue_unavailable', 'Could not verify the gift cards right now.');
  }

  const byId = new Map<string, any>(((products ?? []) as any[]).map((product) => [product.id, product]));
  const lines: AllocationLine[] = [];
  let amountMinor = 0;

  for (const item of items as any[]) {
    const product = byId.get(item.product_id);
    const vendor = Array.isArray(product?.vendors) ? product?.vendors[0] : product?.vendors;
    const partner = Array.isArray(product?.enterprise_partners)
      ? product?.enterprise_partners[0]
      : product?.enterprise_partners;
    const supplier = vendor ?? partner;
    const issue = supplierReadinessIssue({
      supplierCode: supplier?.myfatoorah_supplier_code,
      supplierStatus: supplier?.myfatoorah_supplier_status,
      paymentEligibility: supplier?.payment_eligibility,
      platformStatus: vendor ? vendor.status : partner?.status,
    });
    if (issue) throw new InvoiceError(issue, 'The business selling this gift card is not ready to accept payments.');

    const lineMinor = Number(item.total_minor ?? 0);
    if (!Number.isFinite(lineMinor) || lineMinor <= 0) {
      throw new InvoiceError('invalid_order_total', 'This order has no payable amount.');
    }
    lines.push({ supplierCode: supplier.myfatoorah_supplier_code, amountMinor: lineMinor });
    amountMinor += lineMinor;
  }

  const suppliers = buildInvoiceSuppliers(lines);
  if (!suppliers.length || !supplierSharesMatchTotal(suppliers, amountMinor)) {
    throw new InvoiceError('allocation_mismatch', 'The supplier allocation does not match the order total.');
  }
  return { amountMinor, suppliers };
}

/** Creates and records one v2 invoice for an existing order. */
export async function createInvoiceForOrder(admin: any, input: CreateInvoiceInput): Promise<CreatedInvoice> {
  const { amountMinor, suppliers } = await allocationForOrder(admin, input.orderId);

  const payload: Record<string, unknown> = {
    CustomerName: input.customerName || 'Giftly customer',
    NotificationOption: input.notificationOption ?? 'LNK',
    InvoiceValue: minorToMajor(amountMinor),
    DisplayCurrencyIso: 'QAR',
    CustomerReference: input.reference,
    UserDefinedField: input.orderId,
    CallBackUrl: input.callbackUrl,
    ErrorUrl: input.errorUrl,
    WebhookUrl: input.webhookUrl,
    Suppliers: suppliers,
  };
  if (input.customerEmail) payload.CustomerEmail = input.customerEmail;
  if (input.customerMobile) payload.CustomerMobile = input.customerMobile;
  if (input.language === 'ar') payload.Language = 'AR';

  const provider = await sendPayment(payload);
  const invoiceId = String(provider?.InvoiceId ?? '');
  const invoiceUrl = String(provider?.InvoiceURL ?? '');
  if (!invoiceId || !invoiceUrl) {
    throw new InvoiceError('payment_provider_error', 'The payment provider did not return a payment link.');
  }

  const { error } = await admin.rpc('myfatoorah_payment_recorded', {
    p_order_id: input.orderId,
    p_invoice_id: invoiceId,
    p_invoice_url: invoiceUrl,
    p_payment_url: invoiceUrl,
    p_supplier_code: String(suppliers[0].SupplierCode),
    p_provider_response: {},
  });
  if (error) {
    throw new InvoiceError('payment_record_failed', 'Could not record the payment safely.');
  }

  return { invoiceId, invoiceUrl, amountMinor, suppliers };
}
