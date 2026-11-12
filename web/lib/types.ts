export type FulfilmentType = 'monetary' | 'experience' | 'enterprise_code';
export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'draft';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type VoucherStatus =
  | 'issued'
  | 'claimed'
  | 'active'
  | 'partially_redeemed'
  | 'redeemed'
  | 'expired'
  | 'cancelled'
  | 'void';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
export type InventoryStatus =
  | 'available'
  | 'reserved'
  | 'sold'
  | 'delivered'
  | 'redeemed'
  | 'expired'
  | 'invalid'
  | 'cancelled'
  | 'quarantined';
export type VendorRole = 'owner' | 'manager' | 'redemption_staff';
export type EnterpriseRole = 'owner' | 'manager' | 'analyst';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language: string;
  is_admin: boolean;
  status: string;
  avatar_url: string | null;
  tutorial_completed_at: string | null;
  created_at: string;
}

export interface Vendor {
  id: string;
  owner_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: VendorStatus;
  commission_bps: number;
  max_unredeemed_minor: number;
  slug: string | null;
  category_id: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  social_handle: string | null;
  rating: number;
  is_featured: boolean;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorMember {
  vendor_id: string;
  user_id: string;
  role: VendorRole;
  active: boolean;
  created_at: string;
  vendors?: Vendor | null;
  profiles?: Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  kind: 'denomination' | 'package';
  label: string;
  amount_minor: number | null;
  session_count: number | null;
  price_minor: number;
  currency: string;
  valid_until: string | null;
  active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  vendor_id: string | null;
  partner_id: string | null;
  enterprise_product_id: string | null;
  category_id: string | null;
  title: string;
  title_ar: string | null;
  slug: string;
  description: string | null;
  image_url: string | null;
  terms_and_conditions: string | null;
  redemption_instructions: string | null;
  fulfilment_type: FulfilmentType;
  session_count: number | null;
  min_amount_minor: number;
  max_amount_minor: number;
  preset_amounts_minor: number[];
  currency: string;
  expiry_days: number | null;
  valid_until: string | null;
  booking_required: boolean;
  split_session_allowed: boolean;
  multi_session_per_visit: boolean;
  is_active: boolean;
  status: ProductStatus;
  icon: string | null;
  tone: string | null;
  rating: number;
  location: string | null;
  occasions: string[];
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
  vendors?: Pick<Vendor, 'id' | 'name' | 'logo_url' | 'status' | 'slug'> | null;
  partner?: Pick<Vendor, 'id' | 'name' | 'logo_url' | 'slug'> | null;
}

export interface Voucher {
  id: string;
  product_id: string;
  vendor_id: string | null;
  buyer_id: string | null;
  order_id: string | null;
  voucher_code: string;
  qr_payload: string | null;
  fulfilment_type: FulfilmentType;
  status: VoucherStatus;
  initial_value_minor: number;
  remaining_value_minor: number | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
  used_sessions: number;
  currency: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  delivery_status: string | null;
  scheduled_for: string | null;
  gift_message: string | null;
  created_at: string;
  redeemed_at: string | null;
  products?: Pick<Product, 'id' | 'title' | 'fulfilment_type'> | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  vendor_id: string | null;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  commission_minor: number;
  vendor_share_minor: number;
  currency: string;
  recipient_name: string | null;
  recipient_email: string | null;
  delivery_method: string | null;
  created_at: string;
  products?: Pick<Product, 'id' | 'title' | 'fulfilment_type'> | null;
  orders?: Pick<Order, 'id' | 'order_ref' | 'status' | 'buyer_id' | 'created_at'> | null;
}

export interface Order {
  id: string;
  order_ref: string;
  buyer_id: string;
  status: OrderStatus;
  payment_status: string;
  subtotal_minor: number;
  discount_minor: number;
  fee_minor: number;
  total_minor: number;
  currency: string;
  sender_name: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  delivery_method: string | null;
  scheduled_for: string | null;
  paid_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface Redemption {
  id: string;
  reference: string;
  voucher_id: string;
  vendor_id: string | null;
  staff_user_id: string | null;
  kind: 'monetary' | 'session' | 'enterprise_code';
  amount_minor: number | null;
  sessions: number | null;
  quantity: number;
  status: 'completed' | 'reversed';
  service_label: string | null;
  notes: string | null;
  occurred_at: string;
  created_at: string;
  vouchers?: Pick<Voucher, 'id' | 'voucher_code' | 'recipient_name' | 'fulfilment_type'> | null;
}

export interface EnterprisePartner {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  expected_volume: string | null;
  notes: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseMember {
  partner_id: string;
  user_id: string;
  role: EnterpriseRole;
  active: boolean;
  created_at: string;
  profiles?: Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | null;
}

export interface EnterpriseProduct {
  id: string;
  partner_id: string;
  name: string;
  external_ref: string | null;
  denomination_minor: number;
  currency: string;
  selling_price_minor: number;
  wholesale_cost_minor: number | null;
  commission_bps: number;
  terms_and_conditions: string | null;
  redemption_instructions: string | null;
  expiry_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventorySummary {
  inventory_id: string;
  partner_id: string;
  enterprise_product_id: string;
  import_batch_id: string | null;
  inventory_ref: string;
  code_masked: string;
  denomination_minor: number;
  currency: string;
  status: InventoryStatus;
  allocated_order_id: string | null;
  allocated_at: string | null;
  delivered_at: string | null;
  confirmed_redeemed_at: string | null;
  expires_at: string | null;
  invalid_reason: string | null;
  created_at: string;
  updated_at: string;
  enterprise_products?: Pick<EnterpriseProduct, 'id' | 'name'> | null;
}

export interface ImportBatch {
  id: string;
  partner_id: string;
  filename: string | null;
  source: string;
  total_rows: number;
  inserted_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  status: string;
  error_report: unknown;
  created_at: string;
  completed_at: string | null;
}

export interface VendorApplication {
  id: string;
  vendor_id: string;
  status: string;
  step: string;
  payload: Record<string, unknown>;
  business_name: string | null;
  business_category: string | null;
  business_description: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_location: string | null;
  business_website: string | null;
  logo_url: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
  vendors?: Pick<Vendor, 'id' | 'name' | 'status' | 'logo_url'> | null;
}

export interface PromoCode {
  id: string;
  code: string;
  kind: string;
  value: number;
  min_subtotal_minor: number;
  max_redemptions: number | null;
  redeemed_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  kind: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  impressions: number;
  clicks: number;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface SupportRequest {
  id: string;
  customer_id: string | null;
  kind: string;
  subject: string;
  body: string;
  reference: string | null;
  status: string;
  created_at: string;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  doc_type: string;
  file_url: string;
  status: string;
  created_at: string;
}

export interface VendorLocation {
  id: string;
  vendor_id: string;
  area: string | null;
  address: string | null;
  hours: string | null;
  is_primary: boolean;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  is_public: boolean;
  updated_at: string;
}
