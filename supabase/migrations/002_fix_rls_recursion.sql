-- ============================================================
-- Migration 002: Fix RLS infinite recursion
-- ============================================================
-- The root cause: policies that subquery group_members trigger
-- group_members RLS, which subqueries itself → infinite loop.
-- Fix: create a SECURITY DEFINER helper that bypasses RLS.

-- +-------------------------------+
-- | 1. Helper function           |
-- +-------------------------------+
CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id
    AND user_id = auth.uid()
  );
$$;

-- +-------------------------------+
-- | 2. Fix recursive policies    |
-- +-------------------------------+

-- groups
DROP POLICY IF EXISTS "Members can read group" ON groups;
CREATE POLICY "Members can read group" ON groups
  FOR SELECT USING (
    public.is_group_member(id) OR created_by = auth.uid()
  );

-- group_members
DROP POLICY IF EXISTS "Members can read members" ON group_members;
CREATE POLICY "Members can read members" ON group_members
  FOR SELECT USING (public.is_group_member(group_id));

-- group_invites
DROP POLICY IF EXISTS "Members can read invites" ON group_invites;
CREATE POLICY "Members can read invites" ON group_invites
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can create invites" ON group_invites;
CREATE POLICY "Members can create invites" ON group_invites
  FOR INSERT WITH CHECK (public.is_group_member(group_id));

-- polls
DROP POLICY IF EXISTS "Members can read polls" ON polls;
CREATE POLICY "Members can read polls" ON polls
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can create polls" ON polls;
CREATE POLICY "Members can create polls" ON polls
  FOR INSERT WITH CHECK (public.is_group_member(group_id));

-- poll_options
DROP POLICY IF EXISTS "Members can read options" ON poll_options;
CREATE POLICY "Members can read options" ON poll_options
  FOR SELECT USING (
    public.is_group_member((SELECT group_id FROM polls WHERE id = poll_options.poll_id))
  );

DROP POLICY IF EXISTS "Members can create options" ON poll_options;
CREATE POLICY "Members can create options" ON poll_options
  FOR INSERT WITH CHECK (
    public.is_group_member((SELECT group_id FROM polls WHERE id = poll_options.poll_id))
  );

-- poll_votes
DROP POLICY IF EXISTS "Members can read votes" ON poll_votes;
CREATE POLICY "Members can read votes" ON poll_votes
  FOR SELECT USING (
    public.is_group_member((SELECT group_id FROM polls WHERE id = poll_votes.poll_id))
  );

DROP POLICY IF EXISTS "Members can vote" ON poll_votes;
CREATE POLICY "Members can vote" ON poll_votes
  FOR INSERT WITH CHECK (
    public.is_group_member((SELECT group_id FROM polls WHERE id = poll_votes.poll_id))
    AND auth.uid() = user_id
  );

-- poll_comments
DROP POLICY IF EXISTS "Members can read comments" ON poll_comments;
CREATE POLICY "Members can read comments" ON poll_comments
  FOR SELECT USING (
    public.is_group_member((SELECT group_id FROM polls WHERE id = poll_comments.poll_id))
  );

DROP POLICY IF EXISTS "Members can create comments" ON poll_comments;
CREATE POLICY "Members can create comments" ON poll_comments
  FOR INSERT WITH CHECK (
    public.is_group_member((SELECT group_id FROM polls WHERE id = poll_comments.poll_id))
    AND auth.uid() = user_id
  );

-- events
DROP POLICY IF EXISTS "Members can read events" ON events;
CREATE POLICY "Members can read events" ON events
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can create events" ON events;
CREATE POLICY "Members can create events" ON events
  FOR INSERT WITH CHECK (public.is_group_member(group_id));

-- event_participants
DROP POLICY IF EXISTS "Members can read participants" ON event_participants;
CREATE POLICY "Members can read participants" ON event_participants
  FOR SELECT USING (
    public.is_group_member((SELECT group_id FROM events WHERE id = event_participants.event_id))
  );

DROP POLICY IF EXISTS "Members can participate" ON event_participants;
CREATE POLICY "Members can participate" ON event_participants
  FOR INSERT WITH CHECK (
    public.is_group_member((SELECT group_id FROM events WHERE id = event_participants.event_id))
    AND auth.uid() = user_id
  );
