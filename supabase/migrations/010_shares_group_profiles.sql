-- ============================================================
-- Migration 010: Allow group members to read each other's profiles
-- ============================================================
-- RLS on profiles only allows SELECT on your OWN row
-- (auth.uid() = id), so any JOIN onto profiles (poll votes,
-- comments, event participants, group members) returns NULL for
-- other users' profiles -> only the current user's avatar shows.
--
-- Fix: SECURITY DEFINER helper that returns true when the caller
-- shares at least one group with the target profile. SECURITY
-- DEFINER (plpgsql, never inlined) bypasses group_members RLS,
-- avoiding the infinite-recursion seen in migration 002.

CREATE OR REPLACE FUNCTION public.shares_group(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members a
    JOIN public.group_members b ON b.group_id = a.group_id
    WHERE a.user_id = target_user_id
      AND b.user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.shares_group(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR public.shares_group(id));