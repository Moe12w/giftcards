-- Migration: 0100_create_statements_table.sql
-- Description: Create statements table for vendor accounting exports
-- Created: November 2026

-- Create the statements table
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
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Critical indexes for statement generation performance
CREATE INDEX IF NOT EXISTS idx_statements_vendor_period ON statements(vendor_id, period);
CREATE INDEX IF NOT EXISTS idx_statements_status ON statements(status);
CREATE INDEX IF NOT EXISTS idx_statements_generated ON statements(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_statements_vendor_active ON statements(vendor_id, status) WHERE status = 'completed';

-- Comment on table
COMMENT ON TABLE statements IS 'Vendor accounting statement exports for CSV/JSON download';

-- Create RLS policies
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

-- Admins can create statements (via API only, not direct DB access typically)
-- This policy is intentionally restrictive; generation happens via API with proper auth
-- Uncomment if direct DB insert needed for admin testing:
-- CREATE POLICY "Admins can create statements"
-- ON statements FOR INSERT
-- WITH CHECK (
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
-- );