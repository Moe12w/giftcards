# Payment Processing Architecture: MyFatoorah Sub-Merchant System

*Document generated for Giftly platform - sub-merchant payment splitting with MyFatoorah.*
*Since no vendors or transaction data exists yet, all schemas designed from optimal foundations.*

---

## 1. Overview

This document defines the complete payment processing architecture for integrating MyFatoorah sub-merchant (vendor/partner) payment splitting into the Giftly platform. The system enables:

- Customer payments split between platform (master merchant) and sub-merchants (vendors/enterprises)
- Automatic settlement of vendor shares to their bank accounts via MyFatoorah
- Full audit trail and reporting in the dashboard
- KYC verification flow before vendors can receive payments

**Key Benefits:**
- No need for vendors to have separate MyFatoorah accounts
- Platform maintains one master relationship with MyFatoorah
- Vendors get auto-settled based on configured percentages
- Full visibility and control from the admin dashboard

---

## 2. Database Schema (PostgreSQL via Supabase)

Since no data exists yet, all tables created from optimal foundations with performance as primary objective.

### 1.1. `sub_merchants` Table

```sql
CREATE TABLE IF NOT EXISTS sub_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  myfatoorah_merchant_id VARCHAR(50) UNIQUE NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('vendor', 'enterprise')),
  settlement_percentage NUMERIC(5,2) NOT NULL DEFAULT 20.0 CHECK (settlement_percentage >= 0 AND settlement_percentage <= 100),
  myfatoorah_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (myfatoorah_status IN ('pending', 'verified', 'active', 'suspended')),
  kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  bank_name VARCHAR(255) NOT NULL,
  bank_account_last4 VARCHAR(10) NOT NULL,
  swift_code VARCHAR(20),
  total_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid_out NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_payout_threshold NUMERIC(12,2) NOT NULL DEFAULT 50.0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  kyc_verified_at TIMESTAMP,
  myfatoorah_onboarded_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMP NULL
);

-- Critical indexes (create immediately for performance)
CREATE INDEX IF NOT EXISTS idx_sub_merchants_merchant_id ON sub_merchants(myfatoorah_merchant_id);
CREATE INDEX IF NOT EXISTS idx_sub_merchants_profile ON sub_merchants(profile_id);
CREATE INDEX IF NOT EXISTS idx_sub_merchants_active_kyc ON sub_merchants(is_active, myfatoorah_status, kyc_status);
CREATE INDEX IF NOT EXISTS idx_sub_merchants_settlement ON sub_merchants(settlement_percentage DESC);
```

### 1.2. `vendor_documents` Table

```sql
CREATE TABLE IF NOT EXISTS vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES sub_merchants(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('trade_license','owner_id_copy','bank_statement','business_photo','utility_bill','other')),
  storage_path VARCHAR(255) NOT NULL, -- Format: vendor-documents/{vendor_id}/{doc_type}/{filename}
  file_url TEXT NOT NULL, -- Generated public URL (Supabase Storage)
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  uploaded_at TIMESTAMP NOT NULL DEFAULT now(),
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  myfatoorah_submitted BOOLEAN DEFAULT false,
  myfatoorah_response JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for verification workflow
CREATE INDEX IF NOT EXISTS idx_vendor_docs_vendor_status ON vendor_documents(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_docs_type ON vendor_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_vendor_docs_verified ON vendor_docs(status, verified_at);
```

### 1.3. `transactions` Table

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_splits JSONB NOT NULL DEFAULT '[]',
  myfatoorah_transaction_id VARCHAR(50) UNIQUE,
  myfatoorah_webhook_id VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded')),
  settled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for payment processing (high-frequency queries)
CREATE INDEX IF NOT EXISTS idx_transactions_myfatoorah_id ON transactions(myfatoorah_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_completed ON transactions(status, created_at) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_split ON transactions USING GIN(vendor_splits);
```

### 1.4. `payouts` Table

```sql
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES sub_merchants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  myfatoorah_payout_id VARCHAR(50) UNIQUE,
  method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer','wallet','check')),
  bank_name_at_payout VARCHAR(255),
  bank_account_last4 VARCHAR(10),
  swift_code_at_payout VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  initiated_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for payout tracking
CREATE INDEX IF NOT EXISTS idx_payouts_vendor_status ON payouts(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_initiated ON payouts(initiated_at DESC);
```

---

## 2. Document Storage Strategy

**Critical: No BLOBs in PostgreSQL**

- **Store**: File URL (Supabase Storage path) + metadata in DB
- **Don't**: `file_bytea` column (bloats DB backups 10-100x, slows queries)
- **Location**: `supabase-storage/vendor-documents/{vendor_id}/{doc_type}/{filename}`

### 2.1. Folder Structure

```
supabase-storage/
├─ vendor-documents/
│  ├─ {vendor_id}/
│  │  ├─ trade_license/
│  │  │  └─ 1730764800000_license.pdf
│  │  ├─ owner_id_copy/
│  │  │  └─ 1730764800000_id.pdf
│  │  ├─ bank_statement/
│  │  │  └─ 1730764800000_statement.pdf
│  │  └─ business_photo/
│  │     └─ 1730764800000_photo.jpg
│└─ kyc-webhook-logs/
   └─ {date}/
```

### 2.2. Supabase RLS Policies

```sql
-- Users can view own vendor docs
CREATE POLICY "Users can view own vendor docs" 
ON vendor_documents FOR SELECT 
USING (auth.uid() = vendor_id);

-- Admins can manage all docs
CREATE POLICY "Admins can manage all docs" 
ON vendor_documents FOR ALL 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Vendors can upload own docs
CREATE POLICY "Vendors can upload own docs" 
ON vendor_documents FOR INSERT 
WITH CHECK (auth.uid() = vendor_id);
```

---

## 3. Vendor Onboarding Flow (5 Steps)

### Step 1: Business Details
- Fill business name, trade name, company license
- Upload trade license document (PDF/JPG/PNG, max 5MB)
- System creates `sub_merchants` record (status: pending)
- System creates `vendor_documents` record for trade_license (status: pending)

### Step 2: Bank Details
- Enter bank account name, number, SWIFT/BIC
- System updates `sub_merchants` with bank details
- Minimum: `bank_name` + `bank_account_last4` required

### Step 3: KYC Documents
- Upload: Owner ID copy, bank statement, business photo (optional)
- Each doc creates `vendor_documents` record (status: pending)
- System submits all docs to MyFatoorah KYC API
- MyFatoorah reviews (1-3 business days)
- Webhook: `kyc.verified` or `kyc.rejected`

### Step 4: Review & Submit
- Admin reviews docs (optional - MyFatoorah may auto-verify)
- Submit application
- System: `sub_merchants.myfatoorah_status = 'verified'`, `is_active = true`
- Vendor can now receive payments

### Step 5: Success
- Vendor notified: "Approved! You can now receive payments"
- Dashboard shows: "Settlement %: 20.0% of each payment"
- Earnings accumulate in `sub_merchants.total_earned`

---

## 3. Payment Processing Flow

### 3.1. Customer Purchase

```
Customer → App → MyFatoorah Charge API
               │
               ├──► Platform: 80% → Master merchant account
               │        │
               │        └─► DB: INSERT transactions
               │             (total_amount, platform_fee, vendor_splits)
               │
               └──► Vendor 1: 20% → Vendor's MyFatoorah sub-merchant account
                    │
                    ├─► MyFatoorah auto-settles to vendor's registered bank
                    │
                    └─► Webhook: transaction.completed
                         │
                         └─► DB: UPDATE sub_merchants
                             total_earned += vendor_share
                             
                            │
                            └─► If total_earned >= threshold (50 SAR)
                                │
                                └─► Trigger payout to vendor bank
```

### 3.2. Transaction API Call

```http
POST https://sandbox.myfatoorah.com/api/v2/transactions/charge
Headers:
  Authorization: Bearer MASTER_MERCHANT_KEY
  Content-Type: application/json

Body:
{
  "merchant_merchant_id": "MASTER_MERCHANT_ID",
  "amount": 10000,          // total in fils/halalas (e.g., 100.00 SAR)
  "currency": "SAR",
  "customer": {
    "customer_type": "individual",
    "customer_name": "Ali Mohammed",
    "customer_email": "ali@example.com",
    "customer_phone": "+966501234567"
  },
  "splash_screen": {
    "title": "Payment Successful",
    "desc": "Thank you for your purchase"
  },
  "redirect": {
    "return_url": "https://app.giftly.com/payment/success",
    "cancel_url": "https://app.giftly.com/payment/cancel"
  },
  "sub_merchants": [
    {
      "sub_merchant_id": "VENDOR_1_MERCHANT_ID",
      "percentage": 20.0,      // 20% goes to vendor 1
      "type": "percentage"
    },
    {
      "sub_merchant_id": "VENDOR_2_MERCHANT_ID", 
      "percentage": 80.0,      // 80% goes to platform
      "type": "percentage"
    }
  ]
}
```

### 3.3. Webhook Handler (Expo Server)

```http
POST https://your-expo-app.com/api/myfatoorah/webhook
Headers:
  Content-Type: application/json
  MyFatoorah-Signature: sha256=...

Body:
{
  "event": "transaction.completed",
  "data": {
    "transaction_id": "TX123456",
    "merchant_merchant_id": "MASTER_MERCHANT_ID",
    "amount": 10000,
    "sub_merchants": [
      {
        "sub_merchant_id": "VENDOR_1_MERCHANT_ID",
        "amount": 2000,    // their split
        "status": "settled"
      },
      {
        "sub_merchant_id": "VENDOR_2_MERCHANT_ID",
        "amount": 8000,
        "status": "settled"
      }
    ],
    "customer": { ... },
    "order_id": "ORDER_789",
    "timestamp": "2026-11-14T18:30:00Z"
  }
}
```

Handler updates:
1. `transactions` table (insert new record)
2. `sub_merchants` (total_earned += vendor_share)
3. Check `total_earned >= minimum_payout_threshold` (50 SAR)
4. If yes: INSERT `payouts` record (status: pending) + initiate MyFatoorah payout

### 3.4. Payout Flow

```http
POST https://sandbox.myfatoorah.com/api/v2/transactions/payout
Headers:
  Authorization: Bearer MASTER_MERCHANT_KEY
  Content-Type: application/json

Body:
{
  "sub_merchant_id": "VENDOR_1_MERCHANT_ID",
  "amount": 2000, // in fils/halalas
  "currency": "SAR",
  "beneficiary_name": "Vendor Company Name",
  "beneficiary_account_number": "123456789",
  "beneficiary_bank_name": "Bank Name",
  "beneficiary_swift": "SWIFT123456"
}
```

---

## 4. Financial Tracking

### 4.1. Vendor Earnings Accumulation

```sql
-- After each completed transaction:
UPDATE sub_merchants 
SET total_earned = total_earned + 20.00,
    updated_at = now()
WHERE id = 'vendor_123';
```

### 4.2. Payout Eligibility

```sql
-- Check before initiating payout
SELECT 
  id,
  total_earned,
  minimum_payout_threshold,
  CASE 
    WHEN total_earned >= minimum_payout_threshold THEN 'eligible'
    ELSE 'pending'
  END as payout_status
FROM sub_merchants
WHERE id = 'vendor_123';
```

### 4.3. Payout History

```sql
SELECT 
  p.id,
  p.amount,
  p.method,
  p.status,
  p.initiated_at,
  p.completed_at,
  s.settlement_percentage
FROM payouts p
JOIN sub_merchants s ON p.vendor_id = s.id
WHERE p.vendor_id = 'vendor_123'
ORDER BY p.initiated_at DESC;
```

---

## 5. Admin Dashboard Features

### 5.1. Vendor Onboarding Queue

```
Pending KYC: 3 vendors
- Al Noor Trading: trade_license ✓, id_copy ⚠ missing
- Gulf Enterprises: all docs under MyFatoorah review
- Tech Solutions FZ LLC: all docs uploaded, awaiting review

Approved Vendors: 5
- Each shows: settlement %, total earned, total paid out, next payout date

Rejected Vendors: 1
- Reason: "blurry trade license - please re-upload"
```

### 5.2. Vendor Detail Page

```
Vendor: Al Noor Trading
MyFatoorah Merchant ID: MF_00123
Settlement: 20.0% of each payment
Bank: Islamic Bank of Qatar ****1234
SWIFT: IBQAQAQA

Earnings Summary:
- This month: 125.50 SAR
- Total earned: 1,230.00 SAR
- Total paid out: 800.00 SAR
- Pending payout: 450.00 SAR (threshold: 50 SAR)

Recent Transactions:
- TX123456: 50.00 SAR (20.00 to vendor) - completed Nov 14
- TX123789: 75.00 SAR (15.00 to vendor) - completed Nov 12

Documents:
- trade_license: ✓ verified Nov 10
- owner_id_copy: ⚠ pending review

Actions:
- [Re-upload docs] [Change settlement %] [Request manual payout]
```

### 5.3. Revenue Report (Admin)

```sql
SELECT 
  DATE(created_at) as day,
  SUM(total_amount) as daily_revenue,
  SUM(platform_fee) as daily_platform_fee,
  COUNT(*) as transaction_count
FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
AND status = 'completed'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 6. Edge Cases & Error Handling

### 6.1. Duplicate MyFatoorah Merchant ID

```sql
-- Constraint prevents: UNIQUE on myfatoorah_merchant_id
-- Application-level handling:
try {
  await insertSubMerchant(...);
} catch (err) {
  if (err.code === '23505') { -- unique_violation
    throw new Error('MyFatoorah merchant ID already registered');
  }
  throw err;
}
```

### 6.2. KYC Rejection & Re-onboarding

```sql
-- Reset when vendor re-submits docs
UPDATE vendor_documents 
SET status = 'pending', rejection_reason = NULL, uploaded_at = now(), verified_at = NULL, verified_by = NULL
WHERE vendor_id = 'vendor_123' AND doc_type = 'trade_license';

-- Reset sub-merchant status
UPDATE sub_merchants 
SET myfatoorah_status = 'pending', kyc_status = 'pending', is_active = false
WHERE profile_id = 'profile_123';
```

### 6.3. Settlement Percentage Change

```sql
-- When platform changes vendor splits
UPDATE sub_merchants 
SET settlement_percentage = 25.0,
    updated_at = now()
WHERE id = 'vendor_123';

-- Historical transactions keep original split (stored in vendor_splits JSONB)
-- New transactions use updated percentage
```

### 6.4. Payout Failure Workflow

```sql
-- On payout failure, increment retry count
UPDATE payouts 
SET retry_count = retry_count + 1,
    failure_reason = 'Insufficient funds / Bank rejected',
    status = 'pending', -- Retry
    initiated_at = now() -- Reset for retry
WHERE id = 'payout_123'
AND retry_count < max_retries; -- 3 max

-- If max_retries exceeded, mark as failed
UPDATE payouts 
SET status = 'failed',
    failure_reason = 'Max retries exceeded'
WHERE id = 'payout_123'
AND retry_count >= max_retries;
```

---

## 7. Migration Files

### 7.1. `0069_perfect_submerchant_schema.sql`

Contains all table creations and indexes (see full document in chat for complete SQL).

### 7.2. Recording Migration

```bash
# In Supabase project root:
supabase migration save 0069_perfect_submerchant_schema.sql
supabase migration train  # Applies pending migrations
```

### 7.2. Verification

```bash
# Check migrations are recorded
SELECT * FROM supabase_migrations.schema_migrations WHERE version >= '0069';

# Verify indexes exist
\d sub_merchants
\d vendor_documents
\d transactions
\d payouts
```

---

## 8. Performance Expectations

| Query | Expected Latency (with indexes) |
|-------|--------------------------------|
| Get vendor by MyFatoorah ID | < 1ms |
| List active vendors for payout | 5-50ms |
| Get vendor total earnings | 2-10ms |
| Insert new transaction | 5-15ms |
| Get transactions since date | 10-100ms |
| List pending payouts | 5-30ms |

**Caching strategy**: `getActiveVendors` cached 5 minutes, `transaction` lookups cached per vendor.

---

## 9. Quick Start Checklist

### 9.1. Essential (Run First)

- [ ] Create MyFatoorah master merchant account (sandbox first)
- [ ] Get master merchant key + merchant ID
- [ ] Get webhook secret
- [ ] Set up Supabase migration `0069_perfect_submerchant_schema.sql`
- [ ] Create `0070_seed_vendor_onboarding.sql` (optional, for existing vendors)

### 9.2. Database

- [ ] Run migration train
- [ ] Verify 4 tables created: `sub_merchants`, `vendor_documents`, `transactions`, `payouts`
- [ ] Verify 9 indexes created
- [ ] Test: insert sample vendor, get by merchant ID

### 9.3. MyFatoorah Setup

- [ ] Configure webhook URL: `https://your-expo-app.com/api/myfatoorah/webhook`
- [ ] Set up KYC document requirements in MyFatoorah dashboard
- [ ] Test sandbox transactions (no real money)
- [ ] Test split settlement with test vendor(s)

### 9.4. Application Code

- [ ] Implement payment initiation with `sub_merchants` array
- [ ] Implement webhook handler with signature verification
- [ ] Implement vendor onboarding wizard (5 steps)
- [ ] Implement admin verification queue
- [ ] Implement payout trigger logic (threshold check)

### 9.5. Go-Live

- [ ] Switch from sandbox to production MyFatoorah keys
- [ ] Onboard first 2-3 vendors
- [ ] Test end-to-end: customer pay → vendor receives split
- [ ] Monitor first month of transactions
- [ ] Document any adjustments needed

---

## 10. Contact & Support

**For questions about this architecture:**
- Review the full SQL schema in `0069_perfect_submerchant_schema.sql`
- Check Supabase documentation for RLS policies
- MyFatoorah developer docs: `https://www.myfatoorah.com/en/api-based-services/`

**Schema evolution:**
- New vendors: INSERT into `sub_merchants` + `vendor_documents`
- Percentage changes: UPDATE `sub_merchants.settlement_percentage`
- Payout failures: UPDATE `payouts.retry_count`, re-attempt
- No downtime expected with proper indexing

---
*Document version: 1.0 - Greenfield implementation for Giftly platform*
*Last updated: November 2026*
*Designed for: MyFatoorah sub-merchant payment splitting system*