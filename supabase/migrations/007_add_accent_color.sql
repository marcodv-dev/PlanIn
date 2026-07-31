-- ============================================================
-- Migration 007: Per-account accent color choice
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color TEXT;
