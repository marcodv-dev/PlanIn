-- ============================================================
-- Migration 001: Initial Schema — Hangout Canvas
-- ============================================================
-- Drop esistente per ricreazione pulita (dev fresh)
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS poll_comments CASCADE;
DROP TABLE IF EXISTS poll_votes CASCADE;
DROP TABLE IF EXISTS poll_options CASCADE;
DROP TABLE IF EXISTS polls CASCADE;
DROP TABLE IF EXISTS group_invites CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- +---------------------+
-- | 1. CREATE TABLES    |
-- +---------------------+

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  home_address TEXT NOT NULL,
  home_lat DOUBLE PRECISION,
  home_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  start_location_name TEXT,
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id, option_id, user_id)
);

CREATE TABLE poll_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  source_poll_id UUID REFERENCES polls(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  location_name TEXT NOT NULL,
  maps_link TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  image_url TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'maybe' CHECK (status IN ('confirmed', 'declined', 'maybe')),
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- +---------------------+
-- | 2. ENABLE RLS       |
-- +---------------------+

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- +---------------------+
-- | 3. RLS POLICIES     |
-- +---------------------+

-- profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- groups
CREATE POLICY "Members can read group" ON groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = id AND user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update group" ON groups
  FOR UPDATE USING (auth.uid() = created_by);

-- group_members
CREATE POLICY "Members can read members" ON group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Users can join via invite" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update members" ON group_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete members" ON group_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role = 'admin')
  );

-- group_invites
CREATE POLICY "Members can read invites" ON group_invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_invites.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Members can create invites" ON group_invites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_invites.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Creator can delete invite" ON group_invites
  FOR DELETE USING (auth.uid() = created_by);

-- polls
CREATE POLICY "Members can read polls" ON polls
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = polls.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Members can create polls" ON polls
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = polls.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Creator can update poll" ON polls
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete poll" ON polls
  FOR DELETE USING (auth.uid() = created_by);

-- poll_options
CREATE POLICY "Members can read options" ON poll_options
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members gm JOIN polls p ON p.group_id = gm.group_id
      WHERE p.id = poll_options.poll_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Members can create options" ON poll_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members gm JOIN polls p ON p.group_id = gm.group_id
      WHERE p.id = poll_options.poll_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Creator can delete options" ON poll_options
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM polls WHERE id = poll_options.poll_id AND created_by = auth.uid())
  );

-- poll_votes
CREATE POLICY "Members can read votes" ON poll_votes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members gm JOIN polls p ON p.group_id = gm.group_id
      WHERE p.id = poll_votes.poll_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Members can vote" ON poll_votes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members gm JOIN polls p ON p.group_id = gm.group_id
      WHERE p.id = poll_votes.poll_id AND gm.user_id = auth.uid())
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can delete own vote" ON poll_votes
  FOR DELETE USING (auth.uid() = user_id);

-- poll_comments
CREATE POLICY "Members can read comments" ON poll_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members gm JOIN polls p ON p.group_id = gm.group_id
      WHERE p.id = poll_comments.poll_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Members can create comments" ON poll_comments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members gm JOIN polls p ON p.group_id = gm.group_id
      WHERE p.id = poll_comments.poll_id AND gm.user_id = auth.uid())
    AND auth.uid() = user_id
  );

-- events
CREATE POLICY "Members can read events" ON events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = events.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Members can create events" ON events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = events.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Creator can update event" ON events
  FOR UPDATE USING (auth.uid() = created_by);

-- event_participants
CREATE POLICY "Members can read participants" ON event_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members gm JOIN events e ON e.group_id = gm.group_id
      WHERE e.id = event_participants.event_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Members can participate" ON event_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members gm JOIN events e ON e.group_id = gm.group_id
      WHERE e.id = event_participants.event_id AND gm.user_id = auth.uid())
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update own participation" ON event_participants
  FOR UPDATE USING (auth.uid() = user_id);
