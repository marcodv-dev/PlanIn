-- ============================================================
-- Migration 009: Invite lookup by code for anyone (share links)
-- ============================================================
-- The RLS policy "Members can read invites" only lets group
-- members read group_invites, so a shared invite link opened by
-- a non-member returned no rows ("Link invito non valido o scaduto").
-- Fix: SECURITY DEFINER function that looks up an invite by its
-- secret code, bypassing RLS, without exposing the whole table.

CREATE OR REPLACE FUNCTION public.get_invite_by_code(invite_code TEXT)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  name TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT i.id, i.group_id, i.created_by, i.created_at, i.expires_at, g.name
  FROM public.group_invites i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.code = invite_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_code(TEXT) TO anon, authenticated;
