-- Enable Realtime for collaborative tables
alter publication supabase_realtime add table
  public.groups,
  public.group_members,
  public.group_invites,
  public.polls,
  public.poll_options,
  public.poll_votes,
  public.poll_comments,
  public.events,
  public.event_participants;
