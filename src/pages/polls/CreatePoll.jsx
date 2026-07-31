import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { geocodeAddress } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'
import { ArrowLeft, ChevronLeft, Plus, Trash2 } from 'lucide-react'

export default function CreatePoll() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [options, setOptions] = useState([{ title: '', location: '' }])
  const [loading, setLoading] = useState(false)

  function addOption() {
    setOptions(prev => [...prev, { title: '', location: '' }])
  }

  function removeOption(i) {
    if (options.length <= 1) return
    setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateOption(i, field, value) {
    setOptions(prev => prev.map((opt, idx) => idx === i ? { ...opt, [field]: value } : opt))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: poll, error: pollErr } = await supabase
        .from('polls')
        .insert({ group_id: groupId, title, expires_at: expiresAt, created_by: user.id })
        .select()
        .single()
      if (pollErr) throw pollErr

      for (const opt of options) {
        const coords = await geocodeAddress(opt.location)
        const { error: optErr } = await supabase.from('poll_options').insert({
          poll_id: poll.id,
          title: opt.title,
          location_name: opt.location,
          location_lat: coords?.lat || null,
          location_lng: coords?.lng || null
        })
        if (optErr) throw optErr
      }

      navigate(`/groups/${groupId}`)
    } catch (err) {
      showToast(err?.message || String(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex-1 d-flex flex-col p-4 overflow-hidden">
      <div className="shrink-0 d-flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-black">
          <ChevronLeft size={30} />
        </button>
        <h1 className="text-xl font-bold text-accent">Nuovo Sondaggio</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg flex-1 overflow-y-auto space-y-4 max-w-sm mx-auto">
        <div>
          <label className="block text-sm mb-1 text-gray-600">Titolo sondaggio</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-600">Data e ora evento</label>
          <div className="d-flex min-w-0"><input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required
            className="w-full min-w-0 border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" /></div>
        </div>

        <div className='mb-8'>
          <div className="d-flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600">Opzioni</label>
            <button type="button" onClick={addOption}
              className="d-flex items-center gap-1 text-xs text-accent-hover">
              <Plus size={14} /> Aggiungi opzione
            </button>
          </div>
          <div className="space-y-3">
            {options.map((opt, i) => (
              <div key={i} className="rounded-lg p-3 border border-card">
                <div className="d-flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600">Opzione {i + 1}</span>
                  {options.length > 1 && (
                    <button type="button" onClick={() => removeOption(i)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <input value={opt.title} onChange={e => updateOption(i, 'title', e.target.value)} required
                  placeholder="Nome"
                  className="w-full border border-card rounded px-3 py-2 text-black text-sm outline-none focus:border-accent mb-2" />
                <input value={opt.location} onChange={e => updateOption(i, 'location', e.target.value)} required
                  placeholder="Indirizzo del luogo"
                  className="w-full border border-card rounded px-3 py-2 text-black text-sm outline-none focus:border-accent" />
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" text={loading ? 'Creazione...' : 'Crea Sondaggio'} variant="primary" size="xl" fullWidth />
      </form>
    </div>
  )
}