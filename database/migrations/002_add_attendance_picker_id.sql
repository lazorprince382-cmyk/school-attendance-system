-- Record which holder (authorized_picker) picked the child at release
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS picker_id INTEGER REFERENCES authorized_pickers(id) ON DELETE SET NULL;
