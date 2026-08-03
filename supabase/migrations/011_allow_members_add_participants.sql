-- ============================================================
-- Migration 011: Let members create event participants for
-- other voters when creating an event from a poll option.
-- ============================================================
-- The previous INSERT policy required auth.uid() = user_id, so
-- CreateEvent's bulk insert of OTHER voters/members was silently
-- rejected by RLS -> events were created with 0 participants.

DROP POLICY IF EXISTS "Members can participate" ON event_participants;

CREATE POLICY "Members can participate" ON event_participants
  FOR INSERT WITH CHECK (
    public.is_group_member((SELECT group_id FROM events WHERE id = event_participants.event_id))
  );