import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useData } from '../../store/DataContext'
import { reverseGeocode, geocodeAddress, isPollExpired } from '../../lib/utils'
import Button from '../../components/ui/Button'
import { ArrowLeft, Send, Pencil, Trash2, Plus, X } from 'lucide-react'

export default function PollDetail() {
  const { groupId, pollId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    pollsByGroup, optionsByPoll, votesByPoll, commentsByPoll,
    refreshPollVotes, refreshPollComments, refreshPollOptions, upsertPoll, deletePoll
  } = useData()
  const [newComment, setNewComment] = useState('')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [pendingOptionId, setPendingOptionId] = useState(null)
  const [startLocation, setStartLocation] = useState({ name: '', lat: null, lng: null })
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editOptions, setEditOptions] = useState([])

  const poll = (pollsByGroup[groupId] || []).find(p => p.id === pollId)
  const options = optionsByPoll[pollId] || []
  const votes = votesByPoll[pollId] || []
  const comments = commentsByPoll[pollId] || []

  const myVotes = votes.filter(v => v.user_id === user.id).map(v => v.option_id)
  const voteCounts = {}
  votes.forEach(v => { voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1 })
  const totalVotes = votes.length

  const expired = poll ? isPollExpired(poll.expires_at) : false

  function handleStartEdit() {
    if (!poll) return
    setEditTitle(poll.title)
    setEditExpiresAt(new Date(poll.expires_at).toISOString().slice(0, 16))
    setEditOptions(options.map(o => ({ id: o.id, title: o.title, location: o.location_name })))
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
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
    await supabase.from('polls').update({ title: editTitle.trim(), expires_at: editExpiresAt }).eq('id', pollId)

    await supabase.from('poll_options').delete().eq('poll_id', pollId)

    for (const opt of editOptions) {
      if (!opt.title.trim()) continue
      const coords = opt.location ? await geocodeAddress(opt.location) : null
      await supabase.from('poll_options').insert({
        poll_id: pollId,
        title: opt.title,
        location_name: opt.location,
        location_lat: coords?.lat || null,
        location_lng: coords?.lng || null
      })
    }

    setEditing(false)
    const { data: updated } = await supabase.from('polls').select('*').eq('id', pollId).single()
    if (updated) upsertPoll(updated)
    await refreshPollOptions(pollId)
  }

  async function handleDelete() {
    if (!window.confirm('Eliminare questo sondaggio?')) return
    await supabase.from('polls').delete().eq('id', pollId)
    deletePoll(pollId)
    navigate(`/groups/${groupId}`)
  }

  async function handleVoteClick(optionId) {
    if (expired) return
    const isVoted = myVotes.includes(optionId)
    if (isVoted) {
      await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('option_id', optionId).eq('user_id', user.id)
    } else {
      setPendingOptionId(optionId)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          await supabase.from('poll_votes').insert({
            poll_id: pollId, option_id: optionId, user_id: user.id,
            start_location_name: name,
            start_lat: pos.coords.latitude,
            start_lng: pos.coords.longitude
          })
          await refreshPollVotes(pollId)
        }, () => setShowLocationModal(true))
      } else {
        setShowLocationModal(true)
      }
    }
    if (isVoted) await refreshPollVotes(pollId)
  }

  async function submitVoteWithManualLocation() {
    const coords = { lat: null, lng: null }
    if (startLocation.name) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(startLocation.name)}&limit=1`)
        const data = await res.json()
        if (data.length > 0) {
          coords.lat = parseFloat(data[0].lat)
          coords.lng = parseFloat(data[0].lon)
        }
      } catch {}
    }
    await supabase.from('poll_votes').insert({
      poll_id: pollId, option_id: pendingOptionId, user_id: user.id,
      start_location_name: startLocation.name || null,
      start_lat: coords.lat,
      start_lng: coords.lng
    })
    setShowLocationModal(false)
    setStartLocation({ name: '', lat: null, lng: null })
    await refreshPollVotes(pollId)
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    await supabase.from('poll_comments').insert({
      poll_id: pollId, user_id: user.id, content: newComment.trim()
    })
    setNewComment('')
    await refreshPollComments(pollId)
  }

  if (!poll) return <div className="p-4 text-red-500">Sondaggio non trovato</div>

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="d-flex items-center gap-3 mb-4">
        <button onClick={() => navigate(`/groups/${groupId}`)} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>

        {editing ? (
          <div className="d-flex-1">
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="w-full text-xl font-bold bg-transparent border-b border-accent text-black outline-none mb-1"
              placeholder="Titolo sondaggio" />
            <input type="datetime-local" value={editExpiresAt} onChange={e => setEditExpiresAt(e.target.value)}
              className="text-xs bg-transparent border-b border-accent text-gray-600 outline-none" />
          </div>
        ) : (
          <div className="d-flex-1">
            <h1 className="text-xl font-bold">{poll.title}</h1>
            <p className="text-xs text-gray-500">
              {expired ? 'Scaduto' : `Scade il ${new Date(poll.expires_at).toLocaleString('it', { dateStyle: 'short', timeStyle: 'short' })}`}
            </p>
          </div>
        )}

        <div className="d-flex items-center gap-2">
          {editing ? (
            <>
              <Button text="Annulla" variant="secondary" size="sm" onClick={handleCancelEdit} />
              <Button text="Salva" variant="primary" size="sm" onClick={handleSaveEdit} />
            </>
          ) : (
            <>
              <button onClick={handleStartEdit} className="text-gray-400 hover:text-accent">
                <Pencil size={16} />
              </button>
              <button onClick={handleDelete} className="text-gray-400 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 mb-8">
          <div className="d-flex items-center justify-between">
            <span className="text-sm text-gray-600">Opzioni</span>
            <button type="button" onClick={addEditOption}
              className="d-flex items-center gap-1 text-xs text-accent-hover">
              <Plus size={14} /> Aggiungi opzione
            </button>
          </div>
          {editOptions.map((opt, i) => (
            <div key={i} className="rounded-lg p-3 border border-light bg-page">
              <div className="d-flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">Opzione {i + 1}</span>
                <button type="button" onClick={() => removeEditOption(i)} className="text-red-400 hover:text-red-300">
                  <X size={14} />
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
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {options.map(opt => {
            const voted = myVotes.includes(opt.id)
            const count = voteCounts[opt.id] || 0
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            return (
              <button key={opt.id} onClick={() => handleVoteClick(opt.id)} disabled={expired}
                className={`w-full text-left border rounded-lg p-4 transition ${voted ? 'border-accent-hover' : 'border-light'} ${expired ? 'opacity-60' : ''}`}
                style={{
                  background: `linear-gradient(to right, rgba(0,195,255,0.6) 0%, rgba(0,195,255,0.6) ${pct}%, var(--bg-page) ${pct}%, var(--bg-page) 100%)`
                }}>
                <div className="d-flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 d-flex items-center justify-center shrink-0 ${voted ? 'border-accent-hover bg-accent' : 'border-gray-500'}`}>
                    {voted && <div className="w-2 h-2 bg-black rounded-sm" />}
                  </div>
                  <div className="d-flex-1 min-w-0">
                    <div className="d-flex justify-between items-center gap-2">
                      <span className="font-medium truncate">{opt.title}</span>
                      <span className="text-sm text-gray-500 shrink-0">{count} voto{count !== 1 ? 'i' : ''}</span>
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <h2 className="text-lg font-bold mb-3 text-gray-600">Commenti</h2>
      <div className="space-y-3 mb-4">
        {comments.map(c => (
          <div key={c.id} className="bg-page border border-light rounded-lg p-3">
            <div className="d-flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-accent">{c.profiles?.first_name} {c.profiles?.last_name}</span>
              <span className="text-xs text-gray-600">{new Date(c.created_at).toLocaleString('it', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <p className="text-sm text-gray-600">{c.content}</p>
          </div>
        ))}
      </div>

      {!expired && (
        <form onSubmit={handleAddComment} className="d-flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            placeholder="Scrivi un commento..."
            className="d-flex-1 bg-page border border-light rounded px-3 py-2 text-black text-sm outline-none focus:border-accent" />
          <button type="submit" className="text-accent hover:text-accent-hover transition">
            <Send size={20} />
          </button>
        </form>
      )}

      {showLocationModal && (
        <div className="pos-fixed inset-0 bg-black\/70 d-flex items-center justify-center p-4 z-50">
          <div className="bg-page rounded-lg p-6 w-full max-w-sm border border-light">
            <h3 className="font-bold mb-4 text-black">Posizione di partenza</h3>
            <p className="text-sm text-gray-500 mb-3">Dove parti per questo evento?</p>
            <input value={startLocation.name} onChange={e => setStartLocation(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Inserisci un indirizzo"
              className="w-full bg-page border border-light rounded px-3 py-2 text-black text-sm outline-none focus:border-accent mb-4" />
            <div className="d-flex gap-2">
              <Button text="Salta" variant="secondary" size="md" onClick={() => { setShowLocationModal(false); submitVoteWithManualLocation() }} />
              <Button text="Conferma" variant="primary" size="md" fullWidth onClick={submitVoteWithManualLocation} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
