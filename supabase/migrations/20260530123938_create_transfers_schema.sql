-- ============================================
-- DropBeam Database Schema
-- Transfers and encrypted file metadata
-- ============================================

-- ============================================
-- TRANSFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transfers (
  code VARCHAR(6) PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'expired', 'downloaded')),
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_expires_at ON transfers(expires_at);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);

-- ============================================
-- TRANSFER FILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transfer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_code VARCHAR(6) NOT NULL REFERENCES transfers(code) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  encryption_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_files_code ON transfer_files(transfer_code);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_files ENABLE ROW LEVEL SECURITY;

-- Allow anon access via Edge Functions (authenticated via service_role key)
CREATE POLICY "Allow anon select transfers"
  ON transfers FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert transfers"
  ON transfers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update transfers"
  ON transfers FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon select transfer_files"
  ON transfer_files FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert transfer_files"
  ON transfer_files FOR INSERT TO anon WITH CHECK (true);

-- ============================================
-- REALTIME (for download notifications)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE transfers;
