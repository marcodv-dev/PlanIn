-- ============================================================
-- Migration 003: Add start_location_name to event_participants
-- ============================================================

ALTER TABLE event_participants
ADD COLUMN IF NOT EXISTS start_location_name TEXT;
