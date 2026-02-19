-- Add access level for teachers: 'scanner' | 'admin' | 'both'
-- Default 'both' so existing teachers keep full access.
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'both'
  CHECK (access IN ('scanner', 'admin', 'both'));
