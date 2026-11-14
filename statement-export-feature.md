# Statement Export Feature Design Document
## Giftly Platform - Vendor/Business Accounting Statements

*Document Version: 1.0 - Greenfield implementation for statement export functionality*
*Designed for: Expo Router + React Native + Supabase PostgreSQL backend*
*Last Updated: November 2026*

---
## Overview

This feature enables vendors/enterprises to export their transaction data in multiple formats (CSV, JSON, PDF) for import into accounting software (QuickBooks, Xero, Sage, etc.). The feature leverages the existing sub-merchant payment splitting architecture and provides a complete API + UI solution.

### Business Value
- Vendors can reconcile their earnings with their own accounting software
- Reduces manual bookkeeping overhead
- Provides audit trail and formal documentation
- Increases platform stickiness and professional utility

### Target Screens
- Vendor/Business dashboard/profile screen
- Admin dashboard (all vendors)
- Customer dashboard (for their own order history - optional)

---
## 1. Database Changes

### 1.1. New `statements` Table

```sql
CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES sub_merchants(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  format VARCHAR(10) NOT NULL CHECK (format IN ('csv', 'json')),
  status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  file_path VARCHAR(255), -- Supabase Storage path: statements/{vendor_id}/{id}.{format}
  file_size INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_vendor_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_net_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMP,
  generated_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP, -- URL expiry for download
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Critical indexes (create immediately for performance)
CREATE INDEX IF NOT EXISTS idx_statements_vendor_period ON statements(vendor_id, period);
CREATE INDEX IF NOT EXISTS idx_statements_status ON statements(status);
CREATE INDEX IF NOT EXISTS idx_statements_generated ON statements(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_statements_vendor_active ON statements(vendor_id, status) WHERE status = 'completed';
```

### 1.2. Update RLS Policies

```sql
-- Vendors can view their own statements
CREATE POLICY "Vendors can view own statements"
ON statements FOR SELECT
USING (auth.uid() = vendor_id);

-- Admins can view all statements
CREATE POLICY "Admins can view all statements"
ON statements FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Admins can create statements (via API)
CREATE POLICY "Admins can create statements"
ON statements FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
```

### 1.3. Update Existing Tables (if needed)

Add index optimizations for statement generation queries:

```sql
-- Ensure we have optimal indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_split ON transactions USIN GIN(vendor_splits);
CREATE INDEX IF NOT EXISTS idx_transactions_myfatoorah_status ON transactions(myfatoorah_transaction_id, status);
```

---
## 2. API Endpoints

### 2.1. POST `/api/statements/generate`

Generate a new statement for a vendor.

**Authentication:** Requires admin or vendor authentication (vendor can only generate their own)

**Request Body:**
```json
{
  "vendor_id": "uuid",
  "period": "daily|weekly|monthly",
  "start_date": "2026-11-01T00:00:00Z", // optional, defaults to period start
  "end_date": "2026-11-14T23:59:59Z",    // optional, defaults to now
  "format": "csv|json"
}
```

**Response (202 Accepted):**
```json
{
  "statement_id": "uuid",
  "status": "generating",
  "message": "Statement generation started. Please check status.",
  "check_url": "/api/statements/:statement_id"
}
```

**Response (200 OK - if already completed):**
```json
{
  "statement_id": "uuid",
  "status": "completed",
  "download_url": "https://supabase.storage.com/statements/...",
  "format": "csv",
  "transaction_count": 42,
  "total_amount": 5280.00,
  "total_fee": 1056.00,
  "total_vendor_earnings": 1056.00,
  "total_net_payout": 1056.00
}
```

### 2.2. GET `/api/statements/:statement_id`

Check status and download a generated statement.

**Query Parameters:**
- `format`: csv|json (optional, defaults to generated format)

**Response (200 OK):**
```json
{
  "statement_id": "uuid",
  "status": "completed",
  "download_url": "https://...",
  "expires_at": "2026-11-21T23:59:59Z",
  "file_info": {
    "size": 1024,
    "format": "csv",
    "preview": "date,type,amount,...\\n..."
  }
}
```

**Response (202 Accepted):**
```json
{
  "status": "generating",
  "message": "Statement is still being generated. Please retry in a few seconds."
}
```

### 2.3. GET `/api/statements/vendor/:vendorId`

List all statements for a vendor (with pagination).

**Query Parameters:**
- `period`: daily|weekly|monthly (optional)
- `format`: csv|json (optional)
- `start_date`: ISO date string (optional)
- `end_date`: ISO date string (optional)
- `page`: number (optional, default 1)
- `limit`: number (optional, default 20)

**Response (200 OK):**
```json
{
  "statements": [...],
  "total": 15,
  "page": 1,
  "pages": 1
}
```

---
## 3. Serverless Function Implementation

### 3.1. Directory Structure

```
app/api/statements/
├── [vendorId].tsx         # GET - list statements or check status
├── generate.tsx           # POST - generate new statement
├── [statementId].tsx     # GET - check status + download
└── utils/
    └── statementGenerator.ts  # Core generation logic
```

### 3.2. Core Generation Logic (`statementGenerator.ts`)

```typescript
// Core function that queries transactions and generates CSV/JSON

import { createClient } from '@supabase/supabase-js';
import type { StatementEntry } from '@/src/lib/types';

interface GenerateStatementParams {
  vendorId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  format: 'csv' | 'json';
}

export async function generateStatement(params: GenerateStatementParams) {
  const supa = createSupabaseClient();
  
  // Build date range based on period
  const { start, end } = getDateRange(params.period, params.startDate, params.endDate);
  
  // Query transactions for this vendor within date range
  const { data: transactions, error } = await supa
    .from('transactions')
    .select(`
      *,
      sub_merchants!inner(profile_id, settlement_percentage)
    `)
    .eq('sub_merchants.profile_id', params.vendorId)  // vendor splits
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  
  // Transform to statement entries
  const entries = transactions.map(tx => ({
    date: formatDate(tx.created_at),
    type: tx.status === 'completed' ? 'sale' : 'pending',
    amount: parseFloat(tx.vendor_total || '0'), // vendor share
    currency: tx.currency || 'SAR',
    platform_fee: parseFloat(tx.platform_fee || '0'),
    vendor_share: parseFloat(tx.vendor_total || '0') || 0,
    status: tx.status,
    order_id: tx.order_id || tx.myfatoorah_transaction_id || '',
    customer_name: tx.customer?.customer_name || undefined
  }));
  
  // Generate CSV or JSON
  if (params.format === 'csv') {
    return generateCSV(entries);
  } else {
    return generateJSON(entries);
  }
}
```

### 3.3. Date Range Calculation

```typescript
function getDateRange(
  period: 'daily' | 'weekly' | 'monthly',
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const now = new Date();
  const end = endDate ? new Date(endDate) : now;
  
  let start: Date;
  
  switch (period) {
    case 'daily':
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      break;
      
    case 'weekly':
      // Week starts on Sunday
      const day = end.getDay();
      const sunday = new Date(end);
      sunday.setDate(end.getDate() - day);
      start = new Date(sunday);
      start.setDate(sunday.getDate() - 6); // Go back 6 days for full week
      break;
      
    case 'monthly':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
  }
  
  // If custom start/end provided, use those
  if (startDate) start = new Date(startDate);
  if (endDate) end = new Date(endDate);
  
  return { start: start.toISOString(), end: end.toISOString() };
}
```

### 3.4. CSV Generation

```typescript
function generateCSV(entries: StatementEntry[]): string {
  // CSV Header
  const header = 'Date,Type,Amount (SAR),Platform Fee,Vendor Share,Status,Order ID,Customer Name';
  
  // CSV Rows
  const rows = entries.map(entry => [
    entry.date,
    entry.type,
    entry.amount.toFixed(2),
    entry.platform_fee.toFixed(2),
    entry.vendor_share.toFixed(2),
    entry.status,
    `"${entry.order_id}"`,
    `"${entry.customer_name || ''}"`
  ].join(','));
  
  return [header, ...rows].join('\n');
}
```

### 3.5. JSON Generation

```typescript
function generateJSON(entries: StatementEntry[]): string {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    period: entries[0]?.period,
    total_transactions: entries.length,
    total_amount: entries.reduce((sum, e) => sum + e.amount, 0),
    total_fee: entries.reduce((sum, e) => sum + e.platform_fee, 0),
    total_vendor_earnings: entries.reduce((sum, e) => sum + e.vendor_share, 0),
    entries
  }, null, 2); // pretty-printed
}
```

---
## 4. User Interface Design

### 4.1. UI/UX Design Principles

Follow existing patterns from:
- `app/(customer)\(tabs)\profile.tsx` - Vendor profile screen
- `app/(customer)\(tabs)\index.tsx` - Home dashboard
- Design system: `src/theme/` + `src/components/`

### 4.2. Statement Screen Component

**File:** `src/screens/vendor/StatementsScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Button, FlatList, Modal, Text, View, TouchableOpacity, RefreshControl, StyleSheet,
  ScrollView, Pressable, TextInput, Alert, AppState
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { Card, SectionHeader, ListRow, EmptyState } from '@/src/components';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function StatementsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({ start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() });
  [generatedStatement, setGeneratedStatement] = useState<{ statementId?: string; status: string } | null>(null);

  // Fetch statements
  useEffect(() => {
    fetchStatements();
  }, [period, format]);

  async function fetchStatements() {
    setLoading(true);
    try {
      const { data, error } = await supa
        .from('statements')
        .select('*')
        .eq('vendor_id', user?.id)
        .order('generated_at', { ascending: false });
      
      if (error) throw error;
      setStatements(data || []);
    } catch (e) {
      console.error('Failed to fetch statements:', e);
    } finally {
      setLoading(false);
    }
  }

  // Generate new statement
  async function handleGenerate() {
    // Show date range picker or use default
    const periodStart = period === 'daily' 
      ? dateRange.start 
      : period === 'weekly'
      ? // calculate week start
      : // calculate month start
      dateRange.start;
    
    const periodEnd = dateRange.end;
    
    setGeneratedStatement({ status: 'generating' });
    
    const { error } = await supa.rpc('generate_statement', {
      p_vendor_id: user?.id,
      p_period: period,
      p_start_date: periodStart.toISOString(),
      p_end_date: periodEnd.toISOString(),
      p_format: format
    });
    
    if (error) {
      Alert.alert(t('states.error.title'), t('states.error.body'));
      setGeneratedStatement(null);
    }
  }

  // Download statement
  async function handleDownload(statement: any) {
    // Open download URL or show in modal
    const url = statement.file_path 
      ? `${supabaseUrl}/storage/v1/statement/${statement.id}`
      : statement.download_url;
    
    // Trigger download
    Linking.openURL(url);
  }

  // Refresh control
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatements();
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={colors.teal}
        />
      }
    >
      {/* Header with filters */}
      <View style={styles.header}>
        <Card tone="white" style={styles.filterCard}>
          <View style={styles.filterRow}>
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>{t('statements.period')}:</Text>
              <FlatList
                data={['daily', 'weekly', 'monthly']}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setPeriod(item as 'daily' | 'weekly' | 'monthly');
                      setFormat('csv'); // reset to CSV for new generation
                      fetchStatements();
                    }}
                    style={[{ color: period === item ? colors.teal : colors.textMuted }, styles.filterChip]}
                  >
                    <Text style={styles.filterChipText}>{t(`statements.period.${item}`)}</Text>
                  </Pressable>
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>
            
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>{t('statements.format')}:</Text>
              <View style={styles.formatOptions}>
                <Pressable
                  onPress={() => { setFormat('csv'); fetchStatements(); }}
                  style={[{ backgroundColor: format === 'csv' ? colors.teal : colors.surface }, styles.formatChip]}
                >
                  <Text style={styles.formatChipText}>{t('statements.format.csv')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setFormat('json'); fetchStatements(); }}
                  style={[{ backgroundColor: format === 'json' ? colors.teal : colors.surface }, styles.formatChip]}
                >
                  <Text style={styles.formatChipText}>{t('statements.format.json')}</Text>
                </Pressable>
              </View>
            </View>
            
            <View style={styles.filterColumn}>
              <Pressable onPress={handleGenerate} style={styles.generateBtn}>
                <Text style={styles.generateBtnText}>{t('statements.generate')}</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      </View>

      {/* Statements list */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.teal} style={styles.loader} />
      : statements.length === 0 ? (
        <EmptyState
          title={t('statements.noStatements')}
          body={t('statements.noStatementsBody')}
          icon="calendar"
          tone="teal"
        />
      ) : (
        <FlatList
          data={statements}
          keyExtractor={(item) => item.id}
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => statementItem(item)}
        />
      )}

      {/* Generating status */}
      {generatedStatement && generatedStatement.status === 'generating' && (
        <View style={styles.generating}>
          <Text>{t('statements.generating')}</Text>
          <ActivityIndicator size="small" color={colors.teal} />
        </View>
      )}
    </ScrollView>
  );
}
```

### 4.3. Statement List Item Component

```typescript
function statementItem(statement: any) {
  return (
    <Card tone="white" style={styles.statementCard} onPress={() => openStatementDetails(statement)}>
      <View style={styles.statementHeader}>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>
            {t(`statements.period.${statement.period}`)} {formatDate(statement.start_date)} - {formatDate(statement.end_date)}
          </Text>
        </View>
        <View style={styles.statusBadge} tone={statement.status === 'completed' ? 'teal' : 'gray'}>
          {statement.status}
        </View>
      </View>
      
      <View style={styles.statementSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('statements.transactions')}</Text>
          <Text style={styles.summaryValue}>{statement.transaction_count} {t('statements.transactions')}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('statements.totalAmount')}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(statement.total_amount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('statements.platformFee')}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(statement.total_fee)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('statements.vendorEarnings')}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(statement.total_vendor_earnings)}</Text>
        </View>
      </View>
      
      <View style={styles.statementActions}>
        <Pressable onPress={() => handleDownload(statement)} style={styles.downloadBtn}>
          <Text style={styles.downloadBtnText}>{t('statements.download')}</Text>
        </Pressable>
        {statement.status === 'completed' && (
          <Pressable onPress={() => shareStatement(statement)} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>{t('statements.share')}</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}
```

### 4.4. Empty States & Error Handling

**Empty State (no statements yet):**
- Title: "No statements yet"
- Body: "Generate your first statement to track your earnings"
- Button: "Generate Statement" -> triggers handleGenerate

**Error State:**
- Alert with error message
- "Try Again" button
- Automatic retry after network recovery

---
## 5. Admin Dashboard Integration

### 5.1. Admin Statements Screen

**File:** `app/(admin)/statements/[vendorId].tsx`

Allows admins to:
- View statements for any vendor
- Generate statements on behalf of vendors
- Download all statements
- Bulk operations

**Key Differences from Vendor Screen:**
- Can select any vendor (not just current user)
- Can generate statements for date ranges
- Can view all formats (CSV + JSON)
- Bulk download functionality

### 5.2. API Endpoints for Admin

```
GET /api/statements/vendor/:vendorId  - List all statements for vendor
POST /api/statements/generate        - Generate statement (admin only, any vendor)
GET /api/statements/:statementId     - Check status + download
```

---
## 6. Implementation Phasing

### Phase 1: MVP (Estimated: 1 week)
- [ ] Create `statements` table in Supabase
- [ ] Add RLS policies
- [ ] Implement API: `POST /api/statements/generate` (CSV only, monthly period)
- [ ] Implement API: `GET /api/statements/:statementId` (download)
- [ ] Create vendor statements screen (CSV + monthly period)
- [ ] Basic date range handling
- [ ] Test with sandbox data

### Phase 2: Enhanced Functionality (Estimated: 2 weeks)
- [ ] Add JSON format support
- [ ] Add daily and weekly period options
- [ ] Add custom date range picker
- [ ] Add statement summary totals at top
- [ ] Refresh control for statement list
- [ ] Improve error handling and loading states

### Phase 3: Admin & Polish (Estimated: 2-3 weeks)
- [ ] Admin statements screen
- [ ] Bulk download for admins
- [ ] PDF generation (optional - can use server-side library)
- [ ] Email statement functionality
- [ ] Multiple currency support
- [ ] Export history and metadata
- [ ] Performance optimization with pagination

### Phase 4: Future Enhancements
- [ ] PDF statement generation with formatting
- [ ] Scheduled automated statements (weekly/monthly email)
- [ ] Integration with QuickBooks/Xero OAuth
- [ ] Multi-entity support (multiple vendors per company)
- [ ] API webhook for statement completion notifications
---
## 7. Data Structure Reference

### StatementEntry Interface (TypeScript)

```typescript
export interface StatementEntry {
  id: string;
  date: string;           // ISO date string, e.g., "2026-11-14"
  type: 'sale' | 'payout' | 'refund'; // Transaction direction
  amount: number;         // In major currency units (SAR, etc.)
  currency: string;       // e.g., "SAR", "USD"
  platform_fee: number;   // Platform cut in same currency
  vendor_share: number;   // Vendor earnings in same currency
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  order_id: string;       // Reference number from MyFatoorah or internal order
  customer_name?: string; // Optional - customer who made the purchase
  transaction_id?: string; // MyFatoorah transaction ID
}
```

### StatementMetadata Interface

```typescript
export interface StatementMetadata {
  statement_id: string;
  vendor_id: string;
  period: 'daily' | 'weekly' | 'monthly';
  format: 'csv' | 'json';
  transaction_count: number;
  total_amount: number;     // Total transaction amount
  total_fee: number;        // Total platform fee
  total_vendor_earnings: number; // What vendor earned
  total_net_payout: number; // Net amount after fees
  generated_at: string;     // When statement was generated
  generated_by: string;     // vendor or admin
  expires_at?: string;      // URL expiry time
}
---
## 8. Security Checklist

### 8.1. RLS Policies (Verify in Supabase)
- [ ] Vendors can only SELECT their own statements
- [ ] Admins can SELECT all statements
- [ ] Admins can INSERT statements (via API only, not direct DB)
- [ ] Statements table has proper `auth.uid()` checks

### 8.2. API Security
- [ ] All statement endpoints require authentication
- [ ] Vendor can only generate their own statements
- [ ] Admin token verification for admin endpoints
- [ ] Rate limiting on statement generation (prevent abuse)
- [ ] Statement URLs expire after 24 hours
- [ ] No PII exposed in URLs or logs

### 8.3. Data Validation
- [ ] Period must be one of: daily, weekly, monthly
- [ ] Start date must be before end date
- [ ] Date range cannot exceed 1 year (business rule)
- [ ] Format must be one of: csv, json
- [ ] Vendor ID must reference existing sub_merchant

### 8.4. Supabase Storage Security
- [ ] Store files in `supabase-storage/statements/{vendor_id}/{id}.{format}`
- [ ] Bucket policy: vendors can only read their own files
- [ ] Signed URLs with expiry (1-24 hours)
- [ ] No public read access on statement bucket folders
---
## 9. Testing Checklist

### 9.1. Unit Tests
- [ ] Statement generation CSV format correctness
- [ ] Statement generation JSON format correctness
- [ ] Date range calculation (daily/weekly/monthly)
- [ ] RPC function behavior with various inputs
- [ ] API endpoint validation (bad inputs rejected)

### 9.2. Integration Tests
- [ ] Vendor can generate monthly CSV statement
- [ ] Vendor can generate weekly JSON statement
- [ ] Admin can generate statement for any vendor
- [ ] Download URL works and file is accessible
- [ ] Expired URLs return 404/error
- [ ] Other vendor's statements not visible to different vendor

### 9.3. Manual Testing Steps
1. **As a vendor:**
   - Log into vendor dashboard
   - Navigate to "Statements" section
   - Select period: Monthly
   - Format: CSV
   - Click "Generate Statement"
   - Wait for generation (shows spinner)
   - Click "Download" - CSV file downloads
   - Open CSV in Excel/Sheets - verify columns and data
   - Verify summary totals match their earnings dashboard

2. **As an admin:**
   - Log into admin dashboard
   - Navigate to vendor statements
   - Select a different vendor
   - Generate statement for that vendor
   - Verify statement appears in their dashboard too (or admin-only view)

3. **Edge Cases:**
   - Generate statement with no transactions in period (should show 0 transactions)
   - Generate statement with future/past dates
   - Multiple rapid generation requests (race conditions)
   - Statement generation failure (network error, no data)
   - Download expired URL

---
## 10. UI/UX Design Specifications

### 10.1. Color Palette (from existing theme)
- Primary: `colors.teal` (#008080) - for active chips, buttons
- Secondary: `colors.pink` (#EC4899) - for status badges
- Surface: `colors.surface` (#FAFAFA) - card backgrounds
- Text: `colors.text` (#212121) - primary text
- Muted: `colors.textMuted` (#6B7280) - secondary text

### 10.2. Component Library Usage
- **Card** - Statement cards, filter cards
- **SectionHeader** - Section titles (if needed)
- **FlatList** - Statements list
- **RefreshControl** - Pull-to-refresh
- **ActivityIndicator** - Loading states
- **Alert** - Error messages, confirmation dialogs
- **Pressable** - Buttons and interactive elements
- **TextInput** - If custom date range needed (or use native picker)

### 10.3. Typography
- Headers: `fontFamily: fonts.bold`, `fontSize: fontSizes.xl`
- Body: `fontFamily: fonts.regular`, `fontSize: fontSizes.md`
- Small text: `fontFamily: fonts.regular`, `fontSize: fontSizes.xs`
- Chip labels: `fontFamily: fonts.medium`, `fontSize: fontSizes.xs`

### 10.4. Spacing System
- Use `spacing.md` (16px) for card margins
- Use `spacing.sm` (8px) for internal gaps
- Use `spacing.lg` (24px) for section margins
- Horizontal list gap: `spacing.sm`

### 10.5. Responsive Design
- Statements list: single column on mobile
- Filter chips: horizontal scroll on mobile, grid on tablet/web
- Summary totals: always visible on statement card
- Date pickers: adapt to device width

---
## 11. Migration Script

### 11.1. Create the statements table

```bash
# Save migration
supabase migration save 0100_create_statements_table.sql

# The SQL content goes in the generated file
# Then train the migration
supabase migration train
```

### 11.2. Verify migration

```bash
# Check migrations are recorded
SELECT * FROM supabase_migrations.schema_migrations WHERE version >= '0100';

# Verify table exists
\dt statements

# Verify RLS policies
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'statements';
```

### 11.3. Test the migration

```bash
# Insert test statement
INSERT INTO statements (vendor_id, period, start_date, end_date, format, status)
VALUES ('test-vendor-id', 'monthly', '2026-11-01', '2026-11-30', 'csv', 'completed');

# Verify it appears
SELECT * FROM statements WHERE vendor_id = 'test-vendor-id';
```

---
## 12. Quick Reference: API cURL Examples

### Generate Statement (Vendor)
```bash
curl -X POST https://your-expo-app.com/api/statements/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "your-vendor-uuid",
    "period": "monthly",
    "format": "csv"
  }'
```

### Check Statement Status
```bash
curl https://your-expo-app.com/api/statements/stmt-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Download Statement
```bash
curl -o statement.csv https://your-expo-app.com/api/statements/stmt-uuid?format=csv \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### List All Vendor Statements
```bash
curl https://your-expo-app.com/api/statements/vendor/your-vendor-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```
---
## 13. Known Limitations (Phase 1)

- CSV format only (no JSON in MVP)
- Monthly period only (daily/weekly in Phase 2)
- No PDF generation (Phase 3+)
- No email functionality (Phase 3+)
- No scheduled/automated statements (Phase 4+)
- Single vendor per statement (no batch multi-vendor)
- No QuickBooks/Xero direct integration (manual export only)

---
## 14. Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-11-14 | 1.0 | Initial design document | AI Agent |

---
*This document is designed to be self-contained so another AI agent can implement the feature without needing chat context. All code references existing patterns from the gift-card-marketplace codebase. UI components follow the established design system in `src/components/` and `src/theme/`.*