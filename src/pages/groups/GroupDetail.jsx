import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useData } from '../../store/DataContext'
import { geocodeAddress, isPollExpired } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'
import { Share2, BarChart3, Calendar, Users, ChevronLeft, Pencil, Trash2, Send, Plus, X, MessageCircle, Check } from 'lucide-react'

export default function GroupDetail() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    groups, membersByGroup, pollsByGroup, optionsByPoll, votesByPoll, commentsByPoll,
    eventsByGroup, participantsByEvent, invitesByGroup,
    refreshPollVotes, refreshPollOptions, refreshPollComments, upsertPoll,
    deletePoll, deleteEvent, updateGroupName, ensureInviteCode
  } = useData()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'polls'
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [visibleComments, setVisibleComments] = useState({})
  const [newCommentText, setNewCommentText] = useState({})

  const [pollEditing, setPollEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editOptions, setEditOptions] = useState([])
  const [editingPollId, setEditingPollId] = useState(null)

  const group = groups.find(g => g.id === groupId)
  const members = membersByGroup[groupId] || []
  const polls = pollsByGroup[groupId] || []
  const events = eventsByGroup[groupId] || []
  const inviteCode = invitesByGroup[groupId]

  useEffect(() => {
    if (group && !inviteCode) ensureInviteCode(groupId, user.id)
  }, [group, inviteCode, groupId, user.id, ensureInviteCode])

  async function copyInviteLink() {
    const link = `${window.location.origin}/join/${inviteCode}`
    if (!inviteCode) return
    if (navigator.share) {
      try {
        await navigator.share({ title: group.name, text: `Unisciti al gruppo "${group.name}" su PlanIn!`, url: link })
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const input = document.createElement('input')
      input.value = link
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    showToast('Link invito copiato', 'success')
  }

  async function handleSaveName() {
    if (!editName.trim() || editName === group.name) { setEditing(false); return }
    await supabase.from('groups').update({ name: editName.trim() }).eq('id', groupId)
    updateGroupName(groupId, editName.trim())
    setEditing(false)
  }

  function toggleComments(pollId) {
    setVisibleComments(prev => ({ ...prev, [pollId]: !prev[pollId] }))
  }

  async function handleEditClick(e, poll) {
    e.stopPropagation()
    setEditingPollId(poll.id)
    setEditTitle(poll.title)
    setEditExpiresAt(new Date(poll.expires_at).toISOString().slice(0, 16))
    const opts = optionsByPoll[poll.id] || []
    setEditOptions(opts.map(o => ({ id: o.id, title: o.title, location: o.location_name })))
    setPollEditing(true)
  }

  function handleCancelEdit() {
    setPollEditing(false)
    setEditingPollId(null)
  }

  function addEditOption() {
    setEditOptions(prev => [...prev, { id: null, title: '', location: '' }])
  }

  function removeEditOption(i) {
    setEditOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateEditOption(i, field, value) {
    setEditOptions(prev => prev.map((opt, idx) => idx === i ? { ...opt, [field]: value } : opt))
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return
    await supabase.from('polls').update({ title: editTitle.trim(), expires_at: editExpiresAt }).eq('id', editingPollId)
    await supabase.from('poll_options').delete().eq('poll_id', editingPollId)
    for (const opt of editOptions) {
      if (!opt.title.trim()) continue
      const coords = opt.location ? await geocodeAddress(opt.location) : null
      await supabase.from('poll_options').insert({
        poll_id: editingPollId,
        title: opt.title,
        location_name: opt.location,
        location_lat: coords?.lat || null,
        location_lng: coords?.lng || null
      })
    }
    setPollEditing(false)
    setEditingPollId(null)
    const { data: updated } = await supabase.from('polls').select('*').eq('id', editingPollId).single()
    if (updated) {
      upsertPoll(updated)
      await refreshPollOptions(editingPollId)
    }
  }

  async function handleDeleteClick(e, pollId) {
    e.stopPropagation()
    if (!window.confirm('Eliminare questo sondaggio?')) return
    await supabase.from('polls').delete().eq('id', pollId)
    deletePoll(pollId)
    if (editingPollId === pollId) { setPollEditing(false); setEditingPollId(null) }
  }

  async function handleDeleteEvent(e, ev) {
    e.stopPropagation()
    if (!window.confirm('Eliminare questo evento?')) return
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) { showToast(error?.message || String(error), 'error'); return }
    deleteEvent(ev.id)
    showToast('Evento eliminato', 'success')
  }

  async function handleVoteClick(pollId, optionId) {
    const poll = polls.find(p => p.id === pollId)
    if (!poll || isPollExpired(poll.expires_at)) return
    const pollVotes = votesByPoll[pollId] || []
    const myVoteIds = pollVotes.filter(v => v.user_id === user.id).map(v => v.option_id)
    const isVoted = myVoteIds.includes(optionId)
    if (isVoted) {
      await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('option_id', optionId).eq('user_id', user.id)
    } else {
      await supabase.from('poll_votes').insert({
        poll_id: pollId, option_id: optionId, user_id: user.id
      })
    }
    await refreshPollVotes(pollId)
  }

  async function handleAddComment(pollId) {
    const text = newCommentText[pollId]
    if (!text?.trim()) return
    await supabase.from('poll_comments').insert({
      poll_id: pollId, user_id: user.id, content: text.trim()
    })
    setNewCommentText(prev => ({ ...prev, [pollId]: '' }))
    await refreshPollComments(pollId)
  }

  if (!group) return <div className="p-4 text-red-500">Gruppo non trovato</div>

  const isAdmin = members.some(m => m.user_id === user.id && m.role === 'admin')
  const eventSourcePolls = new Set(events.filter(e => e.source_poll_id).map(e => e.source_poll_id))

  return (
    <div className="d-flex-1 d-flex flex-col px-4 pt-4 overflow-hidden">
      <div  style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div className="d-flex items-center gap-3 mb-2 flex-1 min-w-0 ">
          <button onClick={() => navigate('/')} className="text-black">
            <ChevronLeft size={30} />
          </button>
          {editing ? (
            <input value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={handleSaveName} onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              className="w-full text-xl font-bold text-accent bg-transparent border-accent outline-none flex-1" autoFocus style={{border:'none'}}/>
          ) : (
            <h1 className="text-xl font-bold text-accent">{group.name}
            {isAdmin && !editing && (
              <button onClick={() => { setEditName(group.name); setEditing(true) }} className="text-gray-400 hover:text-accent ml-2 my-auto">
                <Pencil size={18} />
              </button>
            )}</h1>
          )}
          
        </div>

        <button onClick={copyInviteLink}
          className="w-20 d-flex items-center justify-end gap-2 text-sm text-gray-400 hover:text-accent transition relative">
          {inviteCode && <><Share2 size={22}/></>}
        </button>
      </div>

      <div className="d-flex gap-1 mb-4 mt-4">
        <button onClick={() => setSearchParams({ tab: 'polls' })}
          className={`d-flex-1 justify-center d-flex items-center gap-1 px-4 py-3 rounded text-sm transition ${tab === 'polls' ? 'bg-accent text-black' : 'bg-card text-gray-600'}`}>
          <BarChart3 size={14} /> Sondaggi
        </button>
        <button onClick={() => setSearchParams({ tab: 'events' })}
          className={`d-flex-1 justify-center d-flex items-center gap-1 px-4 py-2 rounded text-sm transition ${tab === 'events' ? 'bg-accent text-black' : 'bg-card text-gray-600'}`}>
          <Calendar size={14} /> Eventi
        </button>
        <button onClick={() => setSearchParams({ tab: 'members' })}
          className={`d-flex-1 justify-center d-flex items-center gap-1 px-4 py-2 rounded text-sm transition ${tab === 'members' ? 'bg-accent text-black' : 'bg-card text-gray-600'}`}>
          <Users size={14} /> Membri
        </button>
      </div>

      {tab === 'polls' && (
        <div className="max-w-lg flex-1 overflow-hidden d-flex flex-col w-full mx-auto">
          <div className="shrink-0 d-flex justify-center mb-6 mt-4">
            <Button text="Nuovo Sondaggio" variant="primary" size="xl" fullWidth onClick={() => navigate(`/groups/${groupId}/polls/new`)} />
          </div>
          {polls.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nessun sondaggio attivo</p>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pb-2">
              {polls.map(poll => {
                const expired = isPollExpired(poll.expires_at)
                const options = optionsByPoll[poll.id] || []
                const votes = votesByPoll[poll.id] || []
                const myVoteIds = votes.filter(v => v.user_id === user.id).map(v => v.option_id)
                const voteCounts = {}
                votes.forEach(v => { voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1 })
                const totalV = votes.length
                const comments = commentsByPoll[poll.id] || []
                const commentCount = (commentsByPoll[poll.id] || []).length

                return (
                  <div key={poll.id} className="bg-card border border-card rounded-lg2 overflow-hidden">

                    <div className="p-4">
                      <div className="d-flex items-center justify-between">
                        <div>
                          <h3 className="d-flex gap-2 font-medium text-black capitalize">
                            {poll.title}
                            {eventSourcePolls.has(poll.id) && (
                              <span className="mt-auto d-flex gap-1 text-xs text-green-500 font-medium ml-2"><Check size={14} /> Evento creato</span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {expired ? 'Scaduto' : `${new Date(poll.expires_at).toLocaleString('it', { dateStyle: 'short', timeStyle: 'short' })}`}
                          </p>
                        </div>
                        <div className="d-flex items-center gap-2 shrink-0 ml-2">
                          {(!pollEditing || editingPollId !== poll.id) && (
                            <button onClick={e => handleEditClick(e, poll)} className="text-gray-400 hover:text-accent p-1">
                              <Pencil size={20} />
                            </button>
                          )}
                          <button onClick={e => handleDeleteClick(e, poll.id)} className="text-gray-400 hover:text-red-400 p-1">
                            <Trash2 size={22} />
                          </button>
                        </div>
                      </div>

                      {pollEditing && editingPollId === poll.id ? (
                        <div className="space-y-3 mt-4 max-w-sm mx-auto">
                          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            className="w-full bg-page border border-light rounded px-3 py-2 text-black outline-none focus:border-accent mt-4"
                            placeholder="Titolo sondaggio" />
                          <div className="d-flex min-w-0"><input type="datetime-local" value={editExpiresAt} onChange={e => setEditExpiresAt(e.target.value)}
                            className="w-full min-w-0 bg-page border border-light rounded px-3 py-2 text-sm text-black outline-none focus:border-accent" /></div>
                          <div className="d-flex items-center justify-between">
                            <span className="text-sm text-gray-600">Opzioni</span>
                            <button type="button" onClick={addEditOption} className="d-flex items-center gap-1 text-xs text-accent-hover">
                              <Plus size={14} /> Aggiungi opzione
                            </button>
                          </div>
                          {editOptions.map((opt, i) => (
                            <div key={i} className="rounded-lg p-3 border border-light bg-page">
                              <div className="d-flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-600">Opzione {i + 1}</span>
                                <button type="button" onClick={() => removeEditOption(i)} className="text-red-400 hover:text-red-300">
                                  <X size={16} />
                                </button>
                              </div>
                              <input value={opt.title} onChange={e => updateEditOption(i, 'title', e.target.value)}
                                placeholder="Nome"
                                className="w-full border border-light rounded px-3 py-2 text-black text-sm outline-none focus:border-accent mb-2" />
                              <input value={opt.location} onChange={e => updateEditOption(i, 'location', e.target.value)}
                                placeholder="Indirizzo del luogo"
                                className="w-full border border-light rounded px-3 py-2 text-black text-sm outline-none focus:border-accent" />
                            </div>
                          ))}
                          <div className="d-flex flex-col gap-3" style={{marginTop:40}}>
                            <Button text="Salva" variant="primary" size="xl" fullWidth onClick={handleSaveEdit} />
                            <Button text="Annulla" variant="secondary" size="xl" fullWidth onClick={handleCancelEdit} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2 mt-4">
                            {options.map(opt => {
                              const voted = myVoteIds.includes(opt.id)
                              const count = voteCounts[opt.id] || 0
                              const pct = totalV > 0 ? Math.round((count / totalV) * 100) : 0
                              const voters = votes.filter(v => v.option_id === opt.id)
                              return (
                                <button key={opt.id} onClick={() => handleVoteClick(poll.id, opt.id)} disabled={expired}
                                  className={`w-full text-left border  rounded-lg2 p-4 transition relative text-black overflow-hidden bg-page ${voted ? 'border-accent-hover' : 'border-light'} ${expired ? 'opacity-60' : ''}`}>
                                  <div style={{
                                    position: 'absolute', top: 0, left: 0, bottom: 0,
                                    width: `${pct}%`,
                                    backgroundColor: 'var(--accent-opacity)',
                                    transition: 'width 0.6s ease-out'
                                  }} />
                                  <div className="d-flex justify-between items-center gap-2 relative" style={{zIndex: 1}}>
                                    <div className="min-w-0">
                                      <span className="font-medium text-sm truncate block capitalize">{opt.title} - {opt.location_name}</span>
                                      <div className="d-flex items-center gap-0.5 mt-1">
                                        {voters.slice(0, 5).map(v => v.profiles ? (
                                          v.profiles.avatar_url ? (
                                            <img key={v.id} src={v.profiles.avatar_url} alt=""
                                              className="w-5 h-5 rounded-full object-cover border" />
                                          ) : (
                                            <div key={v.id}
                                              className="w-5 h-5 rounded-full bg-gray-500 d-flex items-center justify-center font-medium text-black border bg-accent"
                                              style={{borderColor:'var(--accent-hover)'}}>
                                              {(v.profiles.username || '?')[0]}
                                            </div>
                                          )
                                        ) : null)}
                                        {voters.length > 5 && (
                                          <span className="text-[10px] text-gray-500 ml-0.5">+{voters.length - 5}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 mb-auto">
                                      <div className="text-xs text-gray-600">{pct}%{` (${count})`}</div>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          <button onClick={() => toggleComments(poll.id)}
                            className={`d-flex gap-1 mt-4 text-sm transition ${visibleComments[poll.id]? 'text-accent-hover':'text-gray-500'}`} style={{marginLeft:'auto'}}>
                            <MessageCircle size={20} />
                            {commentCount > 0 && <span className="text-xs">({commentCount})</span>}
                          </button>

                          <div style={{
                            maxHeight: visibleComments[poll.id] ? '2000px' : '0',
                            opacity: visibleComments[poll.id] ? 1 : 0,
                            overflow: 'hidden',
                            transition: 'max-height 0.2s ease-out, opacity 0.2s ease-out'
                          }}>
                            <div className="mt-6">
                              {comments.length === 0 && (
                                <p className="text-xs text-gray-500 mb-2">Nessun commento</p>
                              )}
                              <div className="space-y-2 mb-3">
                                {comments.map(c => (
                                  <div key={c.id} className="bg-page border border-light rounded-lg px-2 py-1">
                                    <div className="d-flex items-center gap-2 mb-1">
                                      <span className="text-xs font-medium text-accent-hover">{c.profiles?.username}</span>
                                      <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString('it', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                    <p className="text-sm text-gray-600">{c.content}</p>
                                  </div>
                                ))}
                              </div>

                              {!expired && (
                                <form onSubmit={e => { e.preventDefault(); handleAddComment(poll.id) }} className="d-flex gap-2">
                                  <input value={newCommentText[poll.id] || ''} onChange={e => setNewCommentText(prev => ({ ...prev, [poll.id]: e.target.value }))}
                                    placeholder="Scrivi un commento..."
                                    className="d-flex-1 bg-page border border-light rounded px-3 py-2 text-black text-sm outline-none focus:border-accent" />
                                  <button type="submit" className="text-accent hover:text-accent-hover transition">
                                    <Send size={20} />
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'events' && (
        <div className="max-w-lg flex-1 overflow-hidden d-flex flex-col w-full mx-auto">
          <div className="shrink-0 d-flex justify-center mb-6 mt-4">
            <Button text="Nuovo Evento" variant="primary" size="xl" fullWidth onClick={() => navigate(`/groups/${groupId}/events/new`)} />
          </div>
          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nessun evento pianificato</p>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pb-2">
              {events.map(ev => {
                const evParts = participantsByEvent[ev.id] || []
                const activeCount = evParts.filter(p => p.status !== 'declined').length
                const myStatus = evParts.find(p => p.user_id === user.id)?.status
                return (
                  <div key={ev.id} onClick={() => navigate(`/groups/${groupId}/events/${ev.id}`, { state: { fromTab: tab } })}
                    className="bg-card border border-card rounded-lg2 overflow-hidden p-4 transition active:scale-98">
                    <div className="d-flex items-center justify-between gap-2">
                      <div className="d-flex d-flex-1 justify-between min-w-0 flex-1">
                        <h3 className="font-medium truncate" style={{textTransform:'capitalize'}}>{ev.title}</h3>
                        {myStatus === 'confirmed' && <span className="d-flex gap-1 text-accent-hover font-bold shrink-0" ><Check size={20} /> Partecipo</span>}
                        {myStatus === 'maybe' && <span className="d-flex gap-1 text-gray-600 font-bold shrink-0" >? Forse</span>}
                      </div>
                      <div className="d-flex items-center gap-2 shrink-0">
                        {ev.created_by === user.id && (
                          <button onClick={e => handleDeleteEvent(e, ev)}
                            className="text-gray-400 hover:text-red-400 p-1">
                            <Trash2 size={22} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="d-flex justify-between gap-2 mt-1">
                      <p className="text-sm text-gray-500"><span className="capitalize">{ev.location_name}</span>, {new Date(ev.event_date).toLocaleString('it', { dateStyle: 'short', timeStyle: 'short' })}</p>
                      <span className="text-xs text-gray-500">{activeCount}/{members.length}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="max-w-lg flex-1 overflow-hidden d-flex flex-col w-full mx-auto">
        <div className="pb-2 flex-1 overflow-y-auto space-y-2">
          {members.map(m => (
            <div key={m.user_id} className="d-flex items-center gap-3 bg-card rounded-lg2 p-3">
              <div className="w-8 h-8 rounded-full bg-accent d-flex items-center justify-center text-xs font-bold">
                {m.profiles?.avatar_url
                  ? <img src={m.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : `${m.profiles?.username?.[0] || ''}`
                }
              </div>
              <div className="d-flex-1">
                <p className="text-sm font-medium text-lg">{m.profiles?.username}</p>
                <p className="text-xs text-gray-500">{m.profiles?.first_name} {m.profiles?.last_name}</p>
              </div>
              {m.role === 'admin' && <span className="text-accent-hover text-sm">Admin</span>}
            </div>
          ))}
        </div>
        </div>
      )}

    </div>
  )
}
