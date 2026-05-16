-- Calendar v2 migration: add emoji + traffic-light status
-- Safe to re-run

-- Add emoji column to calendars (default to calendar emoji)
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📅';

-- Add status column to calendar_entries: '' | 'green' | 'yellow' | 'red'
ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '';

-- Migrate existing completed=true rows to status='green'
UPDATE calendar_entries SET status = 'green' WHERE completed = true AND (status IS NULL OR status = '');

-- Add check constraint (only if it doesn't exist yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_entries_status_check'
  ) THEN
    ALTER TABLE calendar_entries
      ADD CONSTRAINT calendar_entries_status_check
      CHECK (status IN ('', 'green', 'yellow', 'red'));
  END IF;
END$$;
