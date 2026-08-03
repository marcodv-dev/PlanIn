import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [membersByGroup, setMembersByGroup] = useState({})
  const [pollsByGroup, setPollsByGroup] = useState({})
  const [optionsByPoll, setOptionsByPoll] = useState({})
  const [votesByPoll, setVotesByPoll] = useState({})
  const [commentsByPoll, setCommentsByPoll] = useState({})
  const [eventsByGroup, setEventsByGroup] = useState({})
  const [participantsByEvent, setParticipantsByEvent] = useState({})
  const [invitesByGroup, setInvitesByGroup] = useState({})

  const stateRef = useRef({ groups, pollsByGroup, eventsByGroup })
  stateRef.current = { groups, pollsByGroup, eventsByGroup }

  const refreshPollOptions = useCallback(async (pollId) => {
    const { data } = await supabase.from('poll_options').select('*').eq('poll_id', pollId)
    setOptionsByPoll(prev => ({ ...prev, [pollId]: data || [] }))
  }, [])

  const refreshPollVotes = useCallback(async (pollId) => {
    const { data } = await supabase
      .from('poll_votes')
      .select('*, profiles(first_name, last_name, avatar_url, username)')
      .eq('poll_id', pollId)
    setVotesByPoll(prev => ({ ...prev, [pollId]: data || [] }))
  }, [])

  const refreshPollComments = useCallback(async (pollId) => {
    const { data } = await supabase
      .from('poll_comments')
      .select('*, profiles(first_name, last_name, avatar_url)')
      .eq('poll_id', pollId)
      .order('created_at', { ascending: true })
    setCommentsByPoll(prev => ({ ...prev, [pollId]: data || [] }))
  }, [])

  const refreshEventParticipants = useCallback(async (eventId) => {
    const { data } = await supabase
      .from('event_participants')
      .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
      .eq('event_id', eventId)
    setParticipantsByEvent(prev => ({ ...prev, [eventId]: data || [] }))
    return data || []
  }, [])

  const refreshGroup = useCallback(async (groupId) => {
    const [g, m, p, e, inv] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('*, profiles(*)').eq('group_id', groupId),
      supabase.from('polls').select('*').eq('group_id', groupId),
      supabase.from('events').select('*').eq('group_id', groupId),
      supabase.from('group_invites').select('code').eq('group_id', groupId).limit(1).maybeSingle()
    ])

    setMembersByGroup(prev => ({ ...prev, [groupId]: m.data || [] }))
    setEventsByGroup(prev => ({ ...prev, [groupId]: e.data || [] }))
    setInvitesByGroup(prev => ({ ...prev, [groupId]: inv.data?.code }))

    const allPolls = p.data || []
    setPollsByGroup(prev => ({ ...prev, [groupId]: allPolls }))

    const pollIds = allPolls.map(x => x.id)
    if (pollIds.length > 0) {
      const [optsRes, votesRes, commentsRes] = await Promise.all([
        supabase.from('poll_options').select('*').in('poll_id', pollIds),
        supabase.from('poll_votes').select('*, profiles(first_name, last_name, avatar_url, username)').in('poll_id', pollIds),
        supabase.from('poll_comments').select('*, profiles(first_name, last_name, avatar_url)').in('poll_id', pollIds)
      ])
      const opts = {}
      ;(optsRes.data || []).forEach(o => {
        if (!opts[o.poll_id]) opts[o.poll_id] = []
        opts[o.poll_id].push(o)
      })
      const vts = {}
      ;(votesRes.data || []).forEach(v => {
        if (!vts[v.poll_id]) vts[v.poll_id] = []
        vts[v.poll_id].push(v)
      })
      const cmts = {}
      ;(commentsRes.data || []).forEach(c => {
        if (!cmts[c.poll_id]) cmts[c.poll_id] = []
        cmts[c.poll_id].push(c)
      })
      setOptionsByPoll(prev => {
        const next = { ...prev }
        pollIds.forEach(id => delete next[id])
        return { ...next, ...opts }
      })
      setVotesByPoll(prev => {
        const next = { ...prev }
        pollIds.forEach(id => delete next[id])
        return { ...next, ...vts }
      })
      setCommentsByPoll(prev => {
        const next = { ...prev }
        pollIds.forEach(id => delete next[id])
        return { ...next, ...cmts }
      })
    }

    const eventIds = (e.data || []).map(ev => ev.id)
    if (eventIds.length > 0) {
      const { data: parts } = await supabase
        .from('event_participants')
        .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
        .in('event_id', eventIds)
      const grouped = {}
      ;(parts || []).forEach(pt => {
        if (!grouped[pt.event_id]) grouped[pt.event_id] = []
        grouped[pt.event_id].push(pt)
      })
      setParticipantsByEvent(prev => {
        const next = { ...prev }
        eventIds.forEach(id => delete next[id])
        return { ...next, ...grouped }
      })
    }

    return { group: g.data }
  }, [])

  useEffect(() => {
    if (!user) {
      setGroups([])
      setMembersByGroup({})
      setPollsByGroup({})
      setOptionsByPoll({})
      setVotesByPoll({})
      setCommentsByPoll({})
      setEventsByGroup({})
      setParticipantsByEvent({})
      setInvitesByGroup({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', user.id)
      if (cancelled) return
      const myGroups = (data || []).map(d => d.groups).filter(Boolean)
      setGroups(myGroups)
      await Promise.all(myGroups.map(g => refreshGroup(g.id)))
      if (!cancelled) setLoading(false)
    })()

    return () => { cancelled = true }
  }, [user, refreshGroup])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('data-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, (payload) => {
        const pollId = payload.new?.poll_id ?? payload.old?.poll_id
        if (pollId) refreshPollVotes(pollId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_comments' }, (payload) => {
        const pollId = payload.new?.poll_id ?? payload.old?.poll_id
        if (pollId) refreshPollComments(pollId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants' }, (payload) => {
        const eventId = payload.new?.event_id ?? payload.old?.event_id
        if (eventId) refreshEventParticipants(eventId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, (payload) => {
        const groupId = payload.new?.group_id ?? payload.old?.group_id
        if (groupId) refreshGroup(groupId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, (payload) => {
        const pollId = payload.new?.poll_id ?? payload.old?.poll_id
        if (pollId) refreshPollOptions(pollId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        const groupId = payload.new?.group_id ?? payload.old?.group_id
        if (groupId) refreshGroup(groupId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, (payload) => {
        const groupId = payload.new?.group_id ?? payload.old?.group_id
        if (groupId) refreshGroup(groupId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, refreshGroup, refreshPollOptions, refreshPollVotes, refreshPollComments, refreshEventParticipants])

  const deleteGroup = useCallback((groupId) => {
    const { pollsByGroup: pbg, eventsByGroup: ebg } = stateRef.current
    const pollIds = (pbg[groupId] || []).map(p => p.id)
    const eventIds = (ebg[groupId] || []).map(ev => ev.id)
    setGroups(prev => prev.filter(g => g.id !== groupId))
    setMembersByGroup(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setPollsByGroup(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setEventsByGroup(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setInvitesByGroup(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setOptionsByPoll(prev => { const n = { ...prev }; pollIds.forEach(id => delete n[id]); return n })
    setVotesByPoll(prev => { const n = { ...prev }; pollIds.forEach(id => delete n[id]); return n })
    setCommentsByPoll(prev => { const n = { ...prev }; pollIds.forEach(id => delete n[id]); return n })
    setParticipantsByEvent(prev => { const n = { ...prev }; eventIds.forEach(id => delete n[id]); return n })
  }, [])

  const deletePoll = useCallback((pollId) => {
    setPollsByGroup(prev => {
      const next = {}
      for (const [gid, polls] of Object.entries(prev)) next[gid] = polls.filter(p => p.id !== pollId)
      return next
    })
    setOptionsByPoll(prev => { const n = { ...prev }; delete n[pollId]; return n })
    setVotesByPoll(prev => { const n = { ...prev }; delete n[pollId]; return n })
    setCommentsByPoll(prev => { const n = { ...prev }; delete n[pollId]; return n })
  }, [])

  const deleteEvent = useCallback((eventId) => {
    setEventsByGroup(prev => {
      const next = {}
      for (const [gid, events] of Object.entries(prev)) next[gid] = events.filter(ev => ev.id !== eventId)
      return next
    })
    setParticipantsByEvent(prev => { const n = { ...prev }; delete n[eventId]; return n })
  }, [])

  const upsertGroup = useCallback((group) => {
    setGroups(prev => prev.some(g => g.id === group.id) ? prev.map(g => g.id === group.id ? group : g) : [...prev, group])
  }, [])

  const upsertPoll = useCallback((poll) => {
    setPollsByGroup(prev => {
      const current = prev[poll.group_id] || []
      const exists = current.some(p => p.id === poll.id)
      return { ...prev, [poll.group_id]: exists ? current.map(p => p.id === poll.id ? poll : p) : [...current, poll] }
    })
  }, [])

  const upsertEvent = useCallback((event) => {
    setEventsByGroup(prev => {
      const current = prev[event.group_id] || []
      const exists = current.some(ev => ev.id === event.id)
      return { ...prev, [event.group_id]: exists ? current.map(ev => ev.id === event.id ? event : ev) : [...current, event] }
    })
  }, [])

  const updateGroupName = useCallback((groupId, name) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g))
  }, [])

  const setInviteCode = useCallback((groupId, code) => {
    setInvitesByGroup(prev => ({ ...prev, [groupId]: code }))
  }, [])

  const ensureInviteCode = useCallback(async (groupId, userId) => {
    const { data: inv } = await supabase.from('group_invites').select('code').eq('group_id', groupId).limit(1).maybeSingle()
    if (inv) {
      setInvitesByGroup(prev => ({ ...prev, [groupId]: inv.code }))
      return inv.code
    }
    const code = Math.random().toString(36).substring(2, 8)
    await supabase.from('group_invites').insert({ group_id: groupId, code, created_by: userId })
    setInvitesByGroup(prev => ({ ...prev, [groupId]: code }))
    return code
  }, [])

  const joinGroup = useCallback(async (groupId) => {
    const { group } = await refreshGroup(groupId)
    if (group) upsertGroup(group)
  }, [refreshGroup, upsertGroup])

  return (
    <DataContext.Provider value={{
      loading, groups,
      membersByGroup, pollsByGroup, optionsByPoll, votesByPoll, commentsByPoll,
      eventsByGroup, participantsByEvent, invitesByGroup,
      refreshGroup, refreshPollOptions, refreshPollVotes, refreshPollComments, refreshEventParticipants,
      deleteGroup, deletePoll, deleteEvent, upsertGroup, upsertPoll, upsertEvent, updateGroupName,
      setInviteCode, ensureInviteCode, joinGroup
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
