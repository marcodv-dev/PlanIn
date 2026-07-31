-- ============================================================
-- Migration 006: Allow the event creator to delete an event.
-- Deleting an event cascades to its event_participants rows.
-- ============================================================

CREATE POLICY "Creator can delete event" ON events
  FOR DELETE USING (auth.uid() = created_by);
