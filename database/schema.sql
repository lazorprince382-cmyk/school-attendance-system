-- PostgreSQL schema for school attendance system

CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  access TEXT NOT NULL DEFAULT 'both' CHECK (access IN ('scanner', 'admin', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  external_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  class_name TEXT,
  guardian_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id),
  action TEXT NOT NULL CHECK (action IN ('IN', 'OUT')),
  timestamp TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_child_date
  ON attendance_logs (child_id, date);

-- Authorized pickers (max 3 per child) for gate comparison before release
CREATE TABLE IF NOT EXISTS authorized_pickers (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  photo_url TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_authorized_pickers_child_id
  ON authorized_pickers (child_id);

-- Which holder picked the child at release (added after authorized_pickers exists)
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS picker_id INTEGER REFERENCES authorized_pickers(id) ON DELETE SET NULL;
