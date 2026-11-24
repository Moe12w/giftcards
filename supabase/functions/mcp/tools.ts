// supabase/functions/mcp/tools.ts
// The six Tazella MCP tools.
//
// Reads are public. Writes and order lookups need a Supabase customer JWT,
// which the caller sends as `Authorization: Bearer <access_token>`. The
// service-role client is only used after that check, and every order query is
// filtered by `buyer_id`, so one customer can never read another's order.

import { adminClient, sha256Hex } from '../_shared/clients.ts';
import { getPaymentStatus } from '../_shared/myfatoorah.ts';
import { createInvoiceForOrder, InvoiceError } from '../_shared/invoices.ts';
import { ToolError } from './protocol.ts';
import {
  asRecord,
  emailField,
  enumField,
  integerField,
  isoDateField,
  phoneField,
  searchTerm,
  stringField,
  uuidField,
} from './validate.ts';

type Admin = ReturnType<typeof adminClient>;

export interface ToolContext {
  admin: Admin;
  userId: string | null;
}

interface BusinessRow {
  id: string;
  business_kind?: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  city: string | null;
  area: string | null;
  rating: number | string | null;
  description: string | null;
  gift_count: number | null;
}

interface VendorRow {
  id: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  city?: string | null;
  area?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  social_handle?: string | null;
  rating?: number | string | null;
  status?: string;
  commission_bps?: number | null;
}

interface VariantRow {
  id: string;
  label: string;
  kind: string;
  amount_minor: number | null;
  session_count: number | null;
  price_minor: number;
  currency: string;
  active: boolean;
  valid_until: string | null;
  sort_order?: number | null;
  booking_required?: boolean | null;
}

interface ProductRow {
  id: string;
  vendor_id: string | null;
  title: string;
  title_ar: string | null;
  description: string | null;
  fulfilment_type: string;
  currency: string;
  min_amount_minor: number | null;
  max_amount_minor: number | null;
  preset_amounts_minor: number[] | null;
  image_url: string | null;
  status: string;
  is_active: boolean;
  valid_until: string | null;
  expiry_days: number | null;
  terms_and_conditions: string | null;
  redemption_instructions: string | null;
  booking_required: boolean;
  split_session_allowed?: boolean;
  multi_session_per_visit?: boolean;
  session_count: number | null;
  location: string | null;
  occasions: string[] | null;
  rating?: number | string | null;
  product_variants?: VariantRow[] | null;
  vendor?: VendorRow | null;
}

interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_variant_id: string | null;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  currency: string;
  gift_message: string | null;
  recipient_name: string | null;
  product?: { title?: string | null; fulfilment_type?: string | null; vendor?: { name?: string | null } | null } | null;
}

interface OrderRow {
  id: string;
  order_ref: string | null;
  status: string;
  payment_status: string;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  fee_minor: number;
  total_minor: number;
  created_at: string;
  updated_at: string | null;
  paid_at: string | null;
  delivery_method: string | null;
  scheduled_for: string | null;
  recipient_name: string | null;
  order_items?: OrderItemRow[] | null;
}

const BUSINESS_FIELDS =
  'id,business_kind,name,slug,logo_url,banner_url,city,area,rating,description,gift_count';

const PRODUCT_FIELDS =
  'id,vendor_id,title,title_ar,description,fulfilment_type,currency,min_amount_minor,max_amount_minor,preset_amounts_minor,image_url,status,is_active,valid_until,expiry_days,terms_and_conditions,redemption_instructions,booking_required,split_session_allowed,multi_session_per_visit,session_count,location,occasions,rating,product_variants(*)';

const ORDER_FIELDS =
  'id,order_ref,status,payment_status,currency,subtotal_minor,discount_minor,fee_minor,total_minor,created_at,updated_at,paid_at,delivery_method,scheduled_for,recipient_name,order_items(id,product_id,product_variant_id,quantity,unit_price_minor,total_minor,currency,gift_message,recipient_name,product:products(title,fulfilment_type,vendor:vendors(name)))';

const SITE_URL = (
  Deno.env.get('TAZELLA_SITE_URL') ?? 'https://giftcards-jade.vercel.app'
).replace(/\/$/, '');

const DELIVERY_METHODS = ['email', 'sms', 'link', 'in_app', 'whatsapp'] as const;
type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const TOOLS = [
  {
    name: 'search_businesses',
    title: 'Search gift card businesses',
    description:
      "Search Tazella's Qatar marketplace for approved local businesses that sell gift cards. Use this first when a customer names a business, a city, or a kind of gift (for example spa, coffee, salon or adventure). Returns business IDs, names, locations, ratings and a short list of available gift cards. Gift card prices are in QAR, stored in fils (1 QAR = 100 fils).",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          maxLength: 120,
          description:
            'Optional words to match against business names, descriptions, cities, areas or gift card names.',
        },
        city: {
          type: 'string',
          maxLength: 80,
          description: 'Optional city filter, for example "Doha".',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 8,
          description: 'Maximum number of businesses to return. Defaults to 8.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_business_details',
    title: 'Get business details',
    description:
      'Get full details for one approved Tazella business: description, location, contact links, rating, all available gift cards, terms, expiry rules and redemption instructions. Use a business_id from search_businesses, or a slug.',
    inputSchema: {
      type: 'object',
      properties: {
        business_id: {
          type: 'string',
          format: 'uuid',
          description: 'The business_id returned by search_businesses.',
        },
        slug: {
          type: 'string',
          maxLength: 120,
          description: 'The business slug, when a business_id is not available.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_gift_cards',
    title: 'Get gift cards for a business',
    description:
      'List every published gift card for one business, with its available amounts or experience packages, prices, currency, availability and restrictions. Use the business_id from search_businesses. For monetary cards, amounts are chosen with amount_minor; for experience cards, packages are chosen with variant_id.',
    inputSchema: {
      type: 'object',
      properties: {
        business_id: {
          type: 'string',
          format: 'uuid',
          description: 'The business_id returned by search_businesses.',
        },
        query: {
          type: 'string',
          maxLength: 120,
          description: 'Optional words to filter the business gift cards by name or description.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 20,
          description: 'Maximum number of gift cards to return. Defaults to 20.',
        },
      },
      required: ['business_id'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_gift_card_details',
    title: 'Get gift card details',
    description:
      'Get one gift card in full: description, all denominations or packages, prices, currency, expiry, terms, redemption instructions and restrictions. Always call this before creating an order so the customer sees the exact amount and package.',
    inputSchema: {
      type: 'object',
      properties: {
        gift_card_id: {
          type: 'string',
          format: 'uuid',
          description: 'The gift_card_id returned by search_businesses or get_gift_cards.',
        },
      },
      required: ['gift_card_id'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'create_gift_card_order',
    title: 'Prepare a gift card order',
    description:
      'Prepare a pending Tazella order after the customer has confirmed the business, gift card, amount or package, quantity and recipient. This tool does NOT take payment, does NOT create a payment link and does NOT issue a gift card. Prices are calculated by the server from the live catalogue; never send or invent a price. Requires the customer to be signed in to Tazella and to send their access token as a Bearer token. Use a new idempotency_key for each intended order, and reuse the same key when retrying the same order.',
    inputSchema: {
      type: 'object',
      properties: {
        business_id: {
          type: 'string',
          format: 'uuid',
          description: 'The business that sells the gift card. Must match the gift card.',
        },
        gift_card_id: {
          type: 'string',
          format: 'uuid',
          description: 'The gift card to order.',
        },
        amount_minor: {
          type: 'integer',
          minimum: 1,
          maximum: 10000000,
          description:
            'For monetary gift cards only: the face value in fils (1 QAR = 100 fils). Must be within the range returned by get_gift_card_details.',
        },
        variant_id: {
          type: 'string',
          format: 'uuid',
          description:
            'For experience gift cards only: the package variant_id returned by get_gift_card_details.',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 1,
          description: 'Number of gift cards to prepare. Defaults to 1.',
        },
        sender_name: {
          type: 'string',
          maxLength: 120,
          description: 'Optional name the recipient should see as the sender.',
        },
        recipient: {
          type: 'object',
          description:
            'Optional recipient details. Required when the delivery method is email, SMS or WhatsApp.',
          properties: {
            name: { type: 'string', maxLength: 120 },
            email: { type: 'string', maxLength: 254 },
            phone: { type: 'string', maxLength: 24 },
          },
          additionalProperties: false,
        },
        gift_message: {
          type: 'string',
          maxLength: 500,
          description: 'Optional message from the sender to the recipient.',
        },
        delivery_method: {
          type: 'string',
          enum: [...DELIVERY_METHODS],
          description:
            'How the gift should be delivered. Defaults to email when an email is supplied, WhatsApp when only a phone is supplied, otherwise link.',
        },
        scheduled_for: {
          type: 'string',
          format: 'date-time',
          description: 'Optional future date-time for scheduled delivery.',
        },
        idempotency_key: {
          type: 'string',
          minLength: 8,
          maxLength: 100,
          description:
            'A unique key for this intended order. Reuse it when retrying the same request so a duplicate order is not created.',
        },
      },
      required: ['business_id', 'gift_card_id', 'idempotency_key'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'check_order_status',
    title: 'Check order status',
    description:
      'Check the status of one of the signed-in customer\'s Tazella orders, using the order_ref or order_id returned by create_gift_card_order. Only orders that belong to the authenticated customer are returned. Requires the customer access token as a Bearer token.',
    inputSchema: {
      type: 'object',
      properties: {
        order_ref: {
          type: 'string',
          maxLength: 60,
          description: 'The human-readable order reference, for example MCP-ABC123.',
        },
        order_id: {
          type: 'string',
          format: 'uuid',
          description: 'The internal order UUID, when available.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'create_payment_link',
    title: 'Create a secure payment link',
    description:
      'Turn an existing pending Tazella order into a payable MyFatoorah link. Requires the customer access token as a Bearer token. Use the same idempotency_key when retrying the same order. Never invent an amount; the server uses the order total and the selling businesses\' supplier allocations. Default channel is link: share the returned payment_url with the customer in the chat. Set channel to email, sms or all only when the customer explicitly asks Tazella/MyFatoorah to send it.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', format: 'uuid' },
        order_ref: { type: 'string', maxLength: 60 },
        channel: {
          type: 'string',
          enum: ['link', 'email', 'sms', 'all'],
          default: 'link',
        },
        send_to: {
          type: 'string',
          maxLength: 254,
          description: 'Email or +974 phone for email/sms/all. Defaults to the customer account.',
        },
        idempotency_key: {
          type: 'string',
          minLength: 8,
          maxLength: 100,
          description: 'Unique key for this link. Reuse it when retrying the same order.',
        },
      },
      required: ['idempotency_key'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: 'get_payment_link',
    title: 'Check a payment link',
    description:
      'Read the status of a payment link for one of the signed-in customer\'s orders: active, paid, expired or cancelled. Requires the customer access token as a Bearer token. Never returns card data, supplier codes or full contact details.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', format: 'uuid' },
        order_ref: { type: 'string', maxLength: 60 },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'send_payment_link',
    title: 'Send a payment link',
    description:
      'Create a payment link and, optionally, ask MyFatoorah to email or SMS it. With channel=link (default), just return the URL for the assistant to share in the chat. Requires the customer access token as a Bearer token.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', format: 'uuid' },
        order_ref: { type: 'string', maxLength: 60 },
        channel: { type: 'string', enum: ['link', 'email', 'sms', 'all'], default: 'link' },
        send_to: { type: 'string', maxLength: 254 },
        idempotency_key: { type: 'string', minLength: 8, maxLength: 100 },
      },
      required: ['idempotency_key'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
] as const;

export const PROTECTED_TOOLS = new Set([
  'create_gift_card_order',
  'check_order_status',
  'create_payment_link',
  'get_payment_link',
  'send_payment_link',
]);

export const WRITE_TOOLS = new Set([
  'create_gift_card_order',
  'create_payment_link',
  'send_payment_link',
]);

export const USER_LIMIT_TOOLS = new Set([
  'create_payment_link',
  'get_payment_link',
  'send_payment_link',
]);

function futureOrNull(value: string | null | undefined): boolean {
  return !value || Date.parse(value) > Date.now();
}

function money(minor: number | null | undefined, currency: string): string | null {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return null;
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function numbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isProductAvailable(product: ProductRow): boolean {
  return (
    product.status === 'published' &&
    product.is_active === true &&
    futureOrNull(product.valid_until)
  );
}

function isVariantAvailable(variant: VariantRow): boolean {
  return variant.active === true && futureOrNull(variant.valid_until);
}

function activeVariants(product: ProductRow): VariantRow[] {
  return (product.product_variants ?? [])
    .filter(
      (variant) =>
        isVariantAvailable(variant) &&
        (product.fulfilment_type !== 'experience' || variant.kind === 'package'),
    )
    .slice()
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.price_minor - b.price_minor,
    );
}

function startingPrice(product: ProductRow): number | null {
  if (product.fulfilment_type === 'monetary') {
    const presets = numbers(product.preset_amounts_minor).sort((a, b) => a - b);
    if (presets.length > 0) return presets[0];
    const min = product.min_amount_minor ?? 0;
    return min > 0 ? min : null;
  }
  const variants = activeVariants(product);
  return variants.length > 0
    ? Math.min(...variants.map((variant) => variant.price_minor))
    : null;
}

function serializeGiftCard(product: ProductRow, businessName?: string | null) {
  const currency = product.currency || 'QAR';
  const variants = activeVariants(product);
  const presets = numbers(product.preset_amounts_minor).sort((a, b) => a - b);
  const min = product.min_amount_minor ?? 0;
  const max = product.max_amount_minor ?? 0;
  const available = isProductAvailable(product);
  const start = startingPrice(product);

  const denominations =
    product.fulfilment_type === 'monetary'
      ? presets.map((amount) => ({
          kind: 'amount',
          label: money(amount, currency),
          amount_minor: amount,
          price_minor: amount,
          price: money(amount, currency),
          currency,
        }))
      : variants.map((variant) => ({
          kind: 'package',
          variant_id: variant.id,
          label: variant.label,
          session_count: variant.session_count,
          price_minor: variant.price_minor,
          price: money(variant.price_minor, variant.currency || currency),
          currency: variant.currency || currency,
          booking_required:
            variant.booking_required ?? product.booking_required ?? false,
        }));

  const restrictions = [
    product.booking_required
      ? 'Booking may be required before the gift can be redeemed.'
      : null,
    product.fulfilment_type === 'experience'
      ? 'Experience package: sessions are redeemed one at a time.'
      : 'Monetary gift card: spend in parts; any remaining balance stays on the card.',
    product.valid_until ? `Available until ${product.valid_until}.` : null,
    product.expiry_days
      ? `Expires ${product.expiry_days} days after issuance.`
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    gift_card_id: product.id,
    business_id: product.vendor_id,
    business_name: businessName ?? product.vendor?.name ?? null,
    name: product.title,
    name_ar: product.title_ar,
    description: product.description,
    fulfilment_type: product.fulfilment_type,
    currency,
    image_url: product.image_url,
    location: product.location,
    occasions: strings(product.occasions),
    available,
    availability_note: available
      ? 'Available to order.'
      : 'This gift card is not currently available to order.',
    starting_price_minor: start,
    starting_price: money(start, currency),
    denominations,
    purchase_options:
      product.fulfilment_type === 'monetary'
        ? {
            type: 'amount',
            min_amount_minor: min,
            min_amount: money(min, currency),
            max_amount_minor: max,
            max_amount: money(max, currency),
            preset_amounts_minor: presets,
            presets: presets.map((amount) => ({
              amount_minor: amount,
              amount: money(amount, currency),
              price_minor: amount,
              price: money(amount, currency),
            })),
            instructions:
              'Call create_gift_card_order with amount_minor. The amount is the face value and the price; the server validates it against this range.',
          }
        : {
            type: 'package',
            packages: variants.map((variant) => ({
              variant_id: variant.id,
              label: variant.label,
              session_count: variant.session_count,
              price_minor: variant.price_minor,
              price: money(variant.price_minor, variant.currency || currency),
              currency: variant.currency || currency,
              available: isVariantAvailable(variant),
              valid_until: variant.valid_until,
              booking_required:
                variant.booking_required ?? product.booking_required ?? false,
            })),
            instructions:
              'Call create_gift_card_order with variant_id from this list. The server uses the package price.',
          },
    terms_and_conditions: product.terms_and_conditions,
    redemption_instructions: product.redemption_instructions,
    expiry: {
      expiry_days: product.expiry_days,
      valid_until: product.valid_until,
      note: 'The gift card page shows the expiry that applies to this product.',
    },
    restrictions,
  };
}

function serializeBusiness(business: BusinessRow, products: ProductRow[]) {
  return {
    business_id: business.id,
    name: business.name,
    slug: business.slug,
    description: business.description,
    logo_url: business.logo_url,
    banner_url: business.banner_url ?? null,
    city: business.city,
    area: business.area,
    location:
      [business.area, business.city].filter(Boolean).join(', ') || 'Qatar',
    rating:
      business.rating === null || business.rating === undefined
        ? null
        : Number(business.rating),
    gift_count: business.gift_count ?? products.length,
    gift_cards: products.slice(0, 4).map((product) => {
      const start = startingPrice(product);
      return {
        gift_card_id: product.id,
        name: product.title,
        name_ar: product.title_ar,
        fulfilment_type: product.fulfilment_type,
        starting_price_minor: start,
        starting_price: money(start, product.currency || 'QAR'),
        currency: product.currency || 'QAR',
      };
    }),
  };
}

function statusMeaning(status: string): string {
  switch (status) {
    case 'pending':
      return 'Order prepared and awaiting payment. No charge has been made and no gift card has been issued.';
    case 'paid':
      return 'Payment received. Gift card issuance is handled by the existing fulfilment process.';
    case 'failed':
      return 'Payment failed or the order could not be completed.';
    case 'cancelled':
      return 'The order was cancelled.';
    case 'refunded':
      return 'The order was refunded.';
    default:
      return 'The order status is recorded.';
  }
}

function nextStep(status: string): string {
  if (status === 'pending') {
    return 'Payment is not connected to MCP in this phase. Do not tell the customer the gift card has been purchased or issued.';
  }
  if (status === 'paid') {
    return 'Payment is recorded. Check the Tazella app for the issued gift card.';
  }
  return 'No further action is available through MCP.';
}

function serializeOrder(order: OrderRow, replay: boolean) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  return {
    order_id: order.id,
    order_ref: order.order_ref,
    status: order.status,
    status_meaning: statusMeaning(order.status),
    payment_status: order.payment_status,
    currency: order.currency,
    subtotal_minor: order.subtotal_minor,
    subtotal: money(order.subtotal_minor, order.currency),
    discount_minor: order.discount_minor,
    fee_minor: order.fee_minor,
    total_minor: order.total_minor,
    total: money(order.total_minor, order.currency),
    created_at: order.created_at,
    updated_at: order.updated_at,
    paid_at: order.paid_at,
    delivery_method: order.delivery_method,
    scheduled_for: order.scheduled_for,
    recipient_name: order.recipient_name,
    items: items.map((item) => ({
      order_item_id: item.id,
      gift_card_id: item.product_id,
      gift_card_name: item.product?.title ?? null,
      business_name: item.product?.vendor?.name ?? null,
      variant_id: item.product_variant_id,
      quantity: item.quantity,
      unit_price_minor: item.unit_price_minor,
      unit_price: money(item.unit_price_minor, item.currency || order.currency),
      total_minor: item.total_minor,
      total: money(item.total_minor, item.currency || order.currency),
      currency: item.currency || order.currency,
      gift_message: item.gift_message,
      recipient_name: item.recipient_name,
    })),
    idempotent_replay: replay,
    next_step: nextStep(order.status),
  };
}

function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const [name, domain] = value.split('@');
  if (!domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length <= 4 ? '***' : `***${digits.slice(-4)}`;
}

async function findBusiness(admin: Admin, businessId: string): Promise<BusinessRow> {
  const { data, error } = await admin
    .from('marketplace_businesses')
    .select(BUSINESS_FIELDS)
    .eq('id', businessId)
    .eq('business_kind', 'vendor')
    .maybeSingle();
  if (error) {
    throw new ToolError('business_lookup_failed', 'Could not load the business right now.');
  }
  if (!data) {
    throw new ToolError(
      'business_not_found',
      'No approved Tazella business matches that business_id.',
    );
  }
  return data as BusinessRow;
}

async function loadProducts(
  admin: Admin,
  vendorIds: string[],
): Promise<ProductRow[]> {
  if (vendorIds.length === 0) return [];
  const { data, error } = await admin
    .from('products')
    .select(PRODUCT_FIELDS)
    .in('vendor_id', vendorIds)
    .eq('status', 'published')
    .eq('is_active', true)
    .order('rating', { ascending: false });
  if (error) {
    throw new ToolError('catalogue_unavailable', 'Could not load gift cards right now.');
  }
  return (data ?? []) as ProductRow[];
}

async function loadOrder(
  admin: Admin,
  orderId: string,
  buyerId: string,
  replay: boolean,
) {
  const { data, error } = await admin
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('id', orderId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
  if (error || !data) {
    throw new ToolError('order_not_found', 'That order is not available for this account.');
  }
  return serializeOrder(data as OrderRow, replay);
}

async function searchBusinesses(ctx: ToolContext, args: Record<string, unknown>) {
  const queryRaw = stringField(args, 'query', { max: 120 });
  const cityRaw = stringField(args, 'city', { max: 80 });
  const limit = integerField(args, 'limit', { min: 1, max: 20, default: 8 }) ?? 8;
  const query = queryRaw ? searchTerm(queryRaw) : '';
  const city = cityRaw ? searchTerm(cityRaw) : '';

  let request = ctx.admin
    .from('marketplace_businesses')
    .select(BUSINESS_FIELDS)
    .eq('business_kind', 'vendor')
    .gt('gift_count', 0)
    .order('rating', { ascending: false })
    .limit(limit);

  if (city) request = request.ilike('city', `%${city}%`);
  if (query) {
    request = request.or(
      `name.ilike.%${query}%,description.ilike.%${query}%,city.ilike.%${query}%,area.ilike.%${query}%`,
    );
  }

  const { data, error } = await request;
  if (error) {
    throw new ToolError('search_failed', 'Could not search businesses right now.');
  }
  const businesses = (data ?? []) as BusinessRow[];

  // A customer may search for "spa" when the business description does not use
  // that word. Matching product titles catch those cases too.
  if (query) {
    const { data: matches } = await ctx.admin
      .from('products')
      .select('vendor_id')
      .eq('status', 'published')
      .eq('is_active', true)
      .not('vendor_id', 'is', null)
      .or(
        `title.ilike.%${query}%,description.ilike.%${query}%,title_ar.ilike.%${query}%`,
      )
      .limit(50);

    const known = new Set(businesses.map((business) => business.id));
    const matchRows = (matches ?? []) as { vendor_id?: string | null }[];
    const missing = [
      ...new Set(
        matchRows
          .map((row) => row.vendor_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
      .filter((id) => !known.has(id))
      .slice(0, Math.max(0, limit - businesses.length));

    if (missing.length > 0) {
      const { data: extra } = await ctx.admin
        .from('marketplace_businesses')
        .select(BUSINESS_FIELDS)
        .in('id', missing)
        .eq('business_kind', 'vendor')
        .gt('gift_count', 0);
      for (const row of (extra ?? []) as BusinessRow[]) {
        if (!known.has(row.id)) {
          businesses.push(row);
          known.add(row.id);
        }
      }
    }
  }

  const products = await loadProducts(
    ctx.admin,
    businesses.map((business) => business.id),
  );
  const byVendor = new Map<string, ProductRow[]>();
  for (const product of products) {
    if (!product.vendor_id) continue;
    const list = byVendor.get(product.vendor_id) ?? [];
    list.push(product);
    byVendor.set(product.vendor_id, list);
  }

  return {
    query: queryRaw ?? null,
    city: cityRaw ?? null,
    count: businesses.length,
    businesses: businesses.map((business) =>
      serializeBusiness(business, byVendor.get(business.id) ?? []),
    ),
    guidance:
      businesses.length === 0
        ? 'No businesses matched. Try a broader query, a different city, or ask the customer for another kind of gift.'
        : 'Use get_business_details or get_gift_cards with a business_id to see the full gift card options. Prices are in QAR, in fils.',
  };
}

async function getBusinessDetails(ctx: ToolContext, args: Record<string, unknown>) {
  const businessId = uuidField(args, 'business_id');
  const slug = stringField(args, 'slug', { max: 120 });
  if (!businessId && !slug) {
    throw new ToolError('invalid_arguments', 'Provide business_id or slug.');
  }

  let request = ctx.admin
    .from('marketplace_businesses')
    .select(BUSINESS_FIELDS)
    .eq('business_kind', 'vendor');
  request = businessId
    ? request.eq('id', businessId)
    : request.eq('slug', slug as string);

  const { data: businessData, error } = await request.maybeSingle();
  if (error) {
    throw new ToolError('business_lookup_failed', 'Could not load the business right now.');
  }
  if (!businessData) {
    throw new ToolError(
      'business_not_found',
      'No approved Tazella business matches that business_id or slug.',
    );
  }
  const business = businessData as BusinessRow;

  const { data: vendorData, error: vendorError } = await ctx.admin
    .from('vendors')
    .select(
      'id,name,name_ar,description,logo_url,banner_url,city,area,address,website,phone,email,social_handle,rating,status',
    )
    .eq('id', business.id)
    .maybeSingle();
  if (vendorError || !vendorData) {
    throw new ToolError('business_not_found', 'That business is not available.');
  }
  const vendor = vendorData as VendorRow;
  if (vendor.status !== 'approved') {
    throw new ToolError('business_unavailable', 'That business is not currently approved.');
  }

  const products = await loadProducts(ctx.admin, [business.id]);

  return {
    business: {
      business_id: business.id,
      name: business.name,
      name_ar: vendor.name_ar ?? null,
      description: vendor.description ?? business.description,
      logo_url: vendor.logo_url ?? business.logo_url,
      banner_url: vendor.banner_url ?? business.banner_url ?? null,
      city: vendor.city ?? business.city,
      area: vendor.area ?? business.area,
      address: vendor.address ?? null,
      location:
        [vendor.area ?? business.area, vendor.city ?? business.city]
          .filter(Boolean)
          .join(', ') || 'Qatar',
      website: vendor.website ?? null,
      phone: vendor.phone ?? null,
      email: vendor.email ?? null,
      social_handle: vendor.social_handle ?? null,
      rating:
        vendor.rating === null || vendor.rating === undefined
          ? null
          : Number(vendor.rating),
      gift_count: business.gift_count ?? products.length,
    },
    gift_cards: products.map((product) =>
      serializeGiftCard(product, business.name),
    ),
    policies: {
      expiry:
        'Each gift card lists its own expiry window and any fixed valid_until date. Use the expiry returned on that gift card.',
      redemption:
        'The recipient shows the gift card QR code at the business. Monetary cards keep a running balance and can be spent in parts; experience cards are redeemed session by session.',
      availability:
        'Only published, active gift cards can be ordered. If a card is unavailable, offer the customer another card or business.',
    },
    links: {
      website: vendor.website ?? null,
      app: `${SITE_URL}/download`,
    },
  };
}

async function getGiftCards(ctx: ToolContext, args: Record<string, unknown>) {
  const businessId = uuidField(args, 'business_id', { required: true }) as string;
  const queryRaw = stringField(args, 'query', { max: 120 });
  const limit = integerField(args, 'limit', { min: 1, max: 50, default: 20 }) ?? 20;

  const business = await findBusiness(ctx.admin, businessId);
  let products = await loadProducts(ctx.admin, [businessId]);

  if (queryRaw) {
    const needle = queryRaw.toLowerCase();
    products = products.filter((product) =>
      [product.title, product.title_ar, product.description].some((value) =>
        value ? value.toLowerCase().includes(needle) : false,
      ),
    );
  }
  products = products.slice(0, limit);

  return {
    business_id: business.id,
    business_name: business.name,
    count: products.length,
    gift_cards: products.map((product) =>
      serializeGiftCard(product, business.name),
    ),
    guidance:
      products.length === 0
        ? 'This business has no gift cards matching that search. Try get_business_details to see everything it offers.'
        : 'For monetary cards, choose amount_minor within the returned range. For experience cards, choose a variant_id. Always call get_gift_card_details before ordering.',
  };
}

async function getGiftCardDetails(ctx: ToolContext, args: Record<string, unknown>) {
  const giftCardId = uuidField(args, 'gift_card_id', { required: true }) as string;

  const { data, error } = await ctx.admin
    .from('products')
    .select(
      '*,vendor:vendors(id,name,name_ar,logo_url,banner_url,city,area,address,website,phone,email,social_handle,rating,status),product_variants(*)',
    )
    .eq('id', giftCardId)
    .maybeSingle();
  if (error) {
    throw new ToolError('gift_card_lookup_failed', 'Could not load the gift card right now.');
  }
  if (!data) {
    throw new ToolError('gift_card_not_found', 'No gift card matches that gift_card_id.');
  }
  const product = data as ProductRow;
  if (!isProductAvailable(product)) {
    throw new ToolError(
      'gift_card_unavailable',
      'That gift card is not currently published and active.',
    );
  }
  if (product.vendor?.status !== 'approved') {
    throw new ToolError('business_unavailable', 'The business selling that gift card is not approved.');
  }

  return {
    gift_card: serializeGiftCard(product, product.vendor?.name ?? null),
    business: {
      business_id: product.vendor_id,
      name: product.vendor?.name ?? null,
      name_ar: product.vendor?.name_ar ?? null,
      logo_url: product.vendor?.logo_url ?? null,
      city: product.vendor?.city ?? null,
      area: product.vendor?.area ?? null,
      address: product.vendor?.address ?? null,
      website: product.vendor?.website ?? null,
      rating:
        product.vendor?.rating === null || product.vendor?.rating === undefined
          ? null
          : Number(product.vendor.rating),
    },
    buying_guide: {
      price:
        'The server calculates the price from the live catalogue. Never send a price in create_gift_card_order.',
      confirmation:
        'Repeat the business, gift card, amount or package, quantity and recipient back to the customer before preparing the order.',
      payment:
        'MCP only prepares a pending order in this phase. It does not take payment, create a payment link or issue a gift card.',
    },
  };
}

async function createGiftCardOrder(ctx: ToolContext, args: Record<string, unknown>) {
  if (!ctx.userId) {
    throw new ToolError(
      'auth_required',
      'Sign in to Tazella first. This tool needs the customer\'s Tazella access token as a Bearer token. No order can be prepared without it.',
    );
  }

  const businessId = uuidField(args, 'business_id', { required: true }) as string;
  const giftCardId = uuidField(args, 'gift_card_id', { required: true }) as string;
  const variantId = uuidField(args, 'variant_id');
  const amountMinor = integerField(args, 'amount_minor', {
    min: 1,
    max: 10_000_000,
  });
  const quantity = integerField(args, 'quantity', { min: 1, max: 10, default: 1 }) ?? 1;
  const senderName = stringField(args, 'sender_name', { max: 120 });
  const giftMessage = stringField(args, 'gift_message', { max: 500 });
  const requestedDelivery = enumField(args, 'delivery_method', DELIVERY_METHODS);
  const scheduledFor = isoDateField(args, 'scheduled_for', { future: true });
  const idempotencyKey = stringField(args, 'idempotency_key', {
    required: true,
    min: 8,
    max: 100,
  }) as string;

  const recipientRaw = args.recipient;
  const recipient =
    recipientRaw === undefined || recipientRaw === null
      ? {}
      : asRecord(recipientRaw, 'recipient');
  const recipientName = stringField(recipient, 'name', { max: 120 });
  const recipientEmail = emailField(recipient, 'email');
  const recipientPhone = phoneField(recipient, 'phone');

  const { data: productData, error: productError } = await ctx.admin
    .from('products')
    .select(
      'id,vendor_id,title,fulfilment_type,currency,min_amount_minor,max_amount_minor,preset_amounts_minor,status,is_active,valid_until,expiry_days,terms_and_conditions,redemption_instructions,booking_required,vendor:vendors(id,name,status,commission_bps)',
    )
    .eq('id', giftCardId)
    .maybeSingle();
  if (productError) {
    throw new ToolError('gift_card_lookup_failed', 'Could not load the gift card right now.');
  }
  if (!productData) {
    throw new ToolError('gift_card_not_found', 'No gift card matches that gift_card_id.');
  }
  const product = productData as ProductRow;

  if (product.vendor_id !== businessId) {
    throw new ToolError(
      'business_mismatch',
      'That gift card does not belong to the supplied business_id. Use the business_id returned by get_gift_card_details.',
    );
  }
  if (!isProductAvailable(product)) {
    throw new ToolError(
      'gift_card_unavailable',
      'That gift card is not currently published and active.',
    );
  }
  if (!product.vendor || product.vendor.status !== 'approved') {
    throw new ToolError('business_unavailable', 'The business selling that gift card is not approved.');
  }

  const currency = product.currency || 'QAR';
  let unitPrice: number;
  let variant: VariantRow | null = null;

  if (product.fulfilment_type === 'monetary') {
    if (variantId) {
      throw new ToolError(
        'invalid_arguments',
        'Monetary gift cards use amount_minor, not variant_id.',
      );
    }
    if (amountMinor === undefined) {
      throw new ToolError(
        'amount_required',
        'Choose an amount for this monetary gift card and send it as amount_minor.',
      );
    }
    const min = product.min_amount_minor ?? 0;
    const max = product.max_amount_minor ?? 0;
    if (min <= 0 || max < min) {
      throw new ToolError(
        'gift_card_unavailable',
        'This gift card does not have a valid amount range.',
      );
    }
    if (amountMinor < min || amountMinor > max) {
      throw new ToolError(
        'amount_out_of_range',
        `Choose an amount between ${money(min, currency)} and ${money(max, currency)}.`,
      );
    }
    unitPrice = amountMinor;
  } else if (product.fulfilment_type === 'experience') {
    if (amountMinor !== undefined) {
      throw new ToolError(
        'invalid_arguments',
        'Experience gifts use variant_id, not amount_minor.',
      );
    }
    if (!variantId) {
      throw new ToolError(
        'variant_required',
        'Choose a package for this experience gift and send its variant_id.',
      );
    }
    const { data: variantData, error: variantError } = await ctx.admin
      .from('product_variants')
      .select(
        'id,label,kind,amount_minor,session_count,price_minor,currency,active,valid_until,sort_order,booking_required',
      )
      .eq('id', variantId)
      .eq('product_id', product.id)
      .maybeSingle();
    if (variantError) {
      throw new ToolError('variant_lookup_failed', 'Could not load that package right now.');
    }
    if (!variantData) {
      throw new ToolError(
        'variant_not_found',
        'That package does not belong to this gift card.',
      );
    }
    variant = variantData as VariantRow;
    if (variant.kind !== 'package') {
      throw new ToolError(
        'variant_not_found',
        'That variant is not a package for this experience gift.',
      );
    }
    if (!isVariantAvailable(variant)) {
      throw new ToolError('variant_unavailable', 'That package is not currently available.');
    }
    unitPrice = variant.price_minor;
  } else {
    throw new ToolError(
      'gift_card_unavailable',
      'This product is not a customer gift card and cannot be ordered through MCP.',
    );
  }

  const total = unitPrice * quantity;
  if (total > 10_000_000) {
    throw new ToolError(
      'order_too_large',
      'The order total is above the MCP limit. Reduce the amount or quantity.',
    );
  }

  let deliveryMethod: DeliveryMethod =
    requestedDelivery ??
    (recipientEmail ? 'email' : recipientPhone ? 'whatsapp' : 'link');
  if (deliveryMethod === 'email' && !recipientEmail) {
    throw new ToolError(
      'recipient_email_required',
      'Email delivery needs a recipient email address.',
    );
  }
  if (
    (deliveryMethod === 'sms' || deliveryMethod === 'whatsapp') &&
    !recipientPhone
  ) {
    throw new ToolError(
      'recipient_phone_required',
      'SMS and WhatsApp delivery need a recipient phone number.',
    );
  }

  const fingerprint = await sha256Hex(`${ctx.userId}:${idempotencyKey}`);
  const paymentReference = `mcp:${fingerprint}`;

  const { data: existing, error: existingError } = await ctx.admin
    .from('orders')
    .select('id')
    .eq('payment_reference', paymentReference)
    .eq('buyer_id', ctx.userId)
    .maybeSingle();
  if (existingError) {
    throw new ToolError('order_lookup_failed', 'Could not check for an existing order.');
  }
  if (existing) {
    return loadOrder(ctx.admin, (existing as { id: string }).id, ctx.userId, true);
  }

  const orderRef = `MCP-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  const { data: orderData, error: orderError } = await ctx.admin
    .from('orders')
    .insert({
      buyer_id: ctx.userId,
      status: 'pending',
      payment_status: 'unpaid',
      currency,
      subtotal_minor: total,
      discount_minor: 0,
      fee_minor: 0,
      total_minor: total,
      order_ref: orderRef,
      payment_reference: paymentReference,
      sender_name: senderName ?? null,
      recipient_name: recipientName ?? null,
      recipient_email: recipientEmail ?? null,
      recipient_phone: recipientPhone ?? null,
      gift_message: giftMessage ?? null,
      delivery_method: deliveryMethod,
      scheduled_for: scheduledFor ?? null,
    })
    .select('id')
    .single();

  if (orderError) {
    if ((orderError as { code?: string }).code === '23505') {
      const { data: replay } = await ctx.admin
        .from('orders')
        .select('id')
        .eq('payment_reference', paymentReference)
        .eq('buyer_id', ctx.userId)
        .maybeSingle();
      if (replay) {
        return loadOrder(ctx.admin, (replay as { id: string }).id, ctx.userId, true);
      }
    }
    throw new ToolError('order_failed', 'Could not prepare the order. Nothing was charged.');
  }
  if (!orderData) {
    throw new ToolError('order_failed', 'Could not prepare the order. Nothing was charged.');
  }
  const orderId = (orderData as { id: string }).id;

  const commissionBps = Math.max(
    0,
    Math.min(10_000, Number(product.vendor.commission_bps ?? 0)),
  );
  const commissionMinor = Math.round((total * commissionBps) / 10_000);
  const vendorShareMinor = total - commissionMinor;

  const { error: itemError } = await ctx.admin.from('order_items').insert({
    order_id: orderId,
    product_id: product.id,
    product_variant_id: variant?.id ?? null,
    vendor_id: product.vendor_id,
    quantity,
    unit_price_minor: unitPrice,
    total_minor: total,
    commission_minor: commissionMinor,
    vendor_share_minor: vendorShareMinor,
    currency,
    gift_message: giftMessage ?? null,
    recipient_name: recipientName ?? null,
    recipient_email: recipientEmail ?? null,
    recipient_phone: recipientPhone ?? null,
    delivery_method: deliveryMethod,
    scheduled_for: scheduledFor ?? null,
  });

  if (itemError) {
    // The order header exists but its item did not. Remove the orphan so the
    // customer is never left with a half-created order.
    await ctx.admin.from('orders').delete().eq('id', orderId);
    throw new ToolError('order_failed', 'Could not prepare the order. Nothing was charged.');
  }

  const response = await loadOrder(ctx.admin, orderId, ctx.userId, false);
  return {
    ...response,
    prepared_for: {
      recipient_name: recipientName ?? null,
      recipient_email: maskEmail(recipientEmail ?? null),
      recipient_phone: maskPhone(recipientPhone ?? null),
      delivery_method: deliveryMethod,
      scheduled_for: scheduledFor ?? null,
    },
    selected: variant
      ? {
          type: 'package',
          variant_id: variant.id,
          label: variant.label,
          session_count: variant.session_count,
          price_minor: unitPrice,
          price: money(unitPrice, currency),
        }
      : {
          type: 'amount',
          amount_minor: unitPrice,
          amount: money(unitPrice, currency),
        },
  };
}

async function checkOrderStatus(ctx: ToolContext, args: Record<string, unknown>) {
  if (!ctx.userId) {
    throw new ToolError(
      'auth_required',
      'Sign in to Tazella first. This tool needs the customer\'s Tazella access token as a Bearer token.',
    );
  }

  const orderId = uuidField(args, 'order_id');
  const orderRef = stringField(args, 'order_ref', { max: 60 });
  if (!orderId && !orderRef) {
    throw new ToolError('invalid_arguments', 'Provide order_ref or order_id.');
  }

  let request = ctx.admin
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('buyer_id', ctx.userId);
  request = orderId
    ? request.eq('id', orderId)
    : request.eq('order_ref', orderRef as string);

  const { data, error } = await request.maybeSingle();
  if (error) {
    throw new ToolError('order_lookup_failed', 'Could not load that order right now.');
  }
  if (!data) {
    throw new ToolError(
      'order_not_found',
      'No order with that reference belongs to this account.',
    );
  }

  return {
    order: serializeOrder(data as OrderRow, false),
    security_note:
      'Only orders belonging to the signed-in Tazella customer are returned.',
  };
}

// ---------------------------------------------------------------------------
// Payment links (MCP)
// ---------------------------------------------------------------------------

const PAYMENT_LINK_TTL_MS = 30 * 60 * 1000;

function maskContact(value: string | null): string | null {
  if (!value) return null;
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 1)}***@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `+974****${digits.slice(-4)}` : '***';
}

async function resolveBuyerOrder(ctx: ToolContext, args: Record<string, unknown>) {
  const orderId = uuidField(args, 'order_id');
  const orderRef = stringField(args, 'order_ref', { max: 60 });
  if (!orderId && !orderRef) {
    throw new ToolError('order_required', 'Provide order_id or order_ref from create_gift_card_order.');
  }
  let query = ctx.admin.from('orders').select(
    'id,order_ref,status,payment_status,currency,total_minor,buyer_id,recipient_email,recipient_phone,recipient_name,payment_reference',
  ).eq('buyer_id', ctx.userId!);
  query = orderId ? query.eq('id', orderId) : query.eq('order_ref', orderRef!);
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    throw new ToolError('order_not_found', 'That order is not available for this account.');
  }
  return data as any;
}

async function createPaymentLink(ctx: ToolContext, args: Record<string, unknown>) {
  const order = await resolveBuyerOrder(ctx, args);
  if (order.payment_status === 'paid') {
    throw new ToolError('order_already_paid', 'This order has already been paid.');
  }
  if (order.payment_status !== 'unpaid' || order.status !== 'pending') {
    throw new ToolError('order_not_payable', 'This order cannot be paid. Prepare a new order.');
  }

  const idempotencyKey = stringField(args, 'idempotency_key', { required: true, min: 8, max: 100 })!;
  const channel = enumField(args, 'channel', ['link', 'email', 'sms', 'all']) ?? 'link';

  const { data: existing } = await ctx.admin
    .from('payment_links')
    .select('id, payment_url, amount_minor, currency, status, expires_at, channel, send_to_masked')
    .eq('order_id', order.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing && existing.status === 'active' && new Date(existing.expires_at).getTime() > Date.now()) {
    return {
      order_ref: order.order_ref,
      status: 'active',
      amount_minor: existing.amount_minor,
      amount: money(existing.amount_minor, existing.currency),
      payment_url: existing.payment_url,
      expires_at: existing.expires_at,
      delivery: { channel: existing.channel, sent_to: existing.send_to_masked },
      existing: true,
    };
  }

  const sendTo = stringField(args, 'send_to', { max: 254 });
  const customerEmail =
    channel === 'email' || channel === 'all'
      ? sendTo?.includes('@') ? sendTo : order.recipient_email
      : null;
  const customerPhone =
    channel === 'sms' || channel === 'all'
      ? sendTo && !sendTo.includes('@') ? sendTo : order.recipient_phone
      : null;
  if ((channel === 'email' || channel === 'all') && !customerEmail) {
    throw new ToolError('email_required', 'An email address is needed to send the link by email.');
  }
  if ((channel === 'sms' || channel === 'all') && !customerPhone) {
    throw new ToolError('phone_required', 'A phone number is needed to send the link by SMS.');
  }

  let invoice;
  try {
    invoice = await createInvoiceForOrder(ctx.admin, {
      orderId: order.id,
      reference: order.payment_reference || order.id,
      customerName: order.recipient_name || 'Tazella customer',
      customerEmail,
      customerMobile: customerPhone ? customerPhone.replace(/[^\d+]/g, '') : null,
      notificationOption:
        channel === 'email' ? 'EML' : channel === 'sms' ? 'SMS' : channel === 'all' ? 'ALL' : 'LNK',
      callbackUrl: `${SITE_URL}/api/merchant-payment/callback?order=${order.id}`,
      errorUrl: `${SITE_URL}/api/merchant-payment/callback?order=${order.id}&failed=1`,
      webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
    });
  } catch (error) {
    if (error instanceof InvoiceError) {
      throw new ToolError(error.code, 'The payment link could not be created. Please try again.');
    }
    if (String(error).includes('myfatoorah_not_configured')) {
      throw new ToolError('payments_unavailable', 'Online payments are not configured yet.');
    }
    console.error('[mcp] SendPayment failed', String(error));
    throw new ToolError('payment_provider_error', 'The payment provider could not create a link. Please try again.');
  }
  const invoiceId = invoice.invoiceId;
  const paymentUrl = invoice.invoiceUrl;

  const { data: payment } = await ctx.admin
    .from('myfatoorah_payments')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();
  const expiresAt = new Date(Date.now() + PAYMENT_LINK_TTL_MS).toISOString();
  const sentToMasked = maskContact(customerEmail ?? customerPhone);

  const { data: link, error: linkError } = await ctx.admin
    .from('payment_links')
    .upsert(
      {
        order_id: order.id,
        payment_id: payment?.id ?? null,
        invoice_id: invoiceId,
        payment_url: paymentUrl,
        amount_minor: invoice.amountMinor,
        currency: order.currency || 'QAR',
        status: 'active',
        channel,
        send_to_masked: sentToMasked,
        idempotency_key: idempotencyKey,
        expires_at: expiresAt,
        created_by: ctx.userId,
        metadata: { source: 'mcp' },
      },
      { onConflict: 'order_id,idempotency_key' },
    )
    .select('id, payment_url, amount_minor, currency, status, expires_at, channel, send_to_masked')
    .single();
  if (linkError || !link) {
    throw new ToolError('link_record_failed', 'The link was created but could not be saved. Retry with the same key.');
  }

  return {
    order_ref: order.order_ref,
    status: 'active',
    amount_minor: link.amount_minor,
    amount: money(link.amount_minor, link.currency),
    payment_url: link.payment_url,
    expires_at: link.expires_at,
    delivery: { channel: link.channel, sent_to: link.send_to_masked },
    existing: false,
  };
}

async function getPaymentLink(ctx: ToolContext, args: Record<string, unknown>) {
  const order = await resolveBuyerOrder(ctx, args);
  const { data: link, error } = await ctx.admin
    .from('payment_links')
    .select('id, payment_url, amount_minor, currency, status, expires_at, last_checked_at, channel, send_to_masked')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !link) {
    throw new ToolError('link_not_found', 'No payment link has been created for this order yet.');
  }

  let status = String(link.status);
  if (order.payment_status === 'paid') status = 'paid';
  else if (status === 'active' && new Date(link.expires_at).getTime() <= Date.now()) status = 'expired';

  if (
    status === 'active' &&
    (!link.last_checked_at || Date.now() - new Date(link.last_checked_at).getTime() > 2 * 60 * 1000)
  ) {
    try {
      const provider = await getPaymentStatus({ key: order.payment_reference || order.id, keyType: 'CustomerReference' });
      if (provider?.InvoiceStatus === 'Paid' || provider?.InvoiceStatus === 'paid') status = 'paid';
      await ctx.admin
        .from('payment_links')
        .update({ last_checked_at: new Date().toISOString(), status })
        .eq('id', link.id);
    } catch (refreshError) {
      console.error('[mcp] payment link refresh failed', String(refreshError));
    }
  }

  return {
    order_ref: order.order_ref,
    status,
    payment_status: order.payment_status,
    amount_minor: link.amount_minor,
    amount: money(link.amount_minor, link.currency),
    payment_url: status === 'active' ? link.payment_url : null,
    expires_at: link.expires_at,
    delivery: { channel: link.channel, sent_to: link.send_to_masked },
    note:
      status === 'paid'
        ? 'Payment is confirmed by provider status. Gift card issuance follows the verified webhook.'
        : undefined,
  };
}

async function sendPaymentLink(ctx: ToolContext, args: Record<string, unknown>) {
  const result = await createPaymentLink(ctx, args);
  return {
    ...result,
    delivery_note:
      result.delivery.channel === 'link'
        ? 'Share this URL with the customer in the chat. The assistant must not claim the gift card is issued.'
        : 'MyFatoorah was asked to send the link. Confirm delivery with the customer.',
  };
}

export async function callTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const args =
    rawArgs === undefined || rawArgs === null
      ? {}
      : asRecord(rawArgs, 'arguments');

  switch (name) {
    case 'search_businesses':
      return searchBusinesses(ctx, args);
    case 'get_business_details':
      return getBusinessDetails(ctx, args);
    case 'get_gift_cards':
      return getGiftCards(ctx, args);
    case 'get_gift_card_details':
      return getGiftCardDetails(ctx, args);
    case 'create_gift_card_order':
      return createGiftCardOrder(ctx, args);
    case 'check_order_status':
      return checkOrderStatus(ctx, args);
    case 'create_payment_link':
      return createPaymentLink(ctx, args);
    case 'get_payment_link':
      return getPaymentLink(ctx, args);
    case 'send_payment_link':
      return sendPaymentLink(ctx, args);
    default:
      throw new ToolError('unknown_tool', `Unknown tool: ${name}`);
  }
}
