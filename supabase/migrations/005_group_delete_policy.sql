-- ============================================================
-- Migration 005: Allow creator to delete a group
-- Deleting the group row cascades to group_members, group_invites,
-- polls (+ poll_options/poll_votes/poll_comments) and events
-- (+ event_participants) thanks to ON DELETE CASCADE.
-- ============================================================

CREATE POLICY "Creator can delete group" ON groups
  FOR DELETE USING (auth.uid() = created_by);
