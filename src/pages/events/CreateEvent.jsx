import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { geocodeAddress, resolveMapsLink } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'
import { ArrowLeft, ChevronLeft } from 'lucide-react'

export default function CreateEvent() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [activeOptions, setActiveOptions] = useState([])
  const [selectedOption, setSelectedOption] = useState('')
  const [title, setTitle] = useState('')
  const [locationName, setLocationName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()
  const [selectedOptData, setSelectedOptData] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, title, expires_at')
        .eq('group_id', groupId)
        .gte('expires_at', new Date(Date.now() - 86400000).toISOString())

      if (!polls) return
      const activePolls = polls.filter(p => new Date(new Date(p.expires_at).getTime() + 86400000) > new Date())
      if (activePolls.length === 0) return

      const pollIds = activePolls.map(p => p.id)
      const { data: opts } = await supabase
        .from('poll_options')
        .select('*, polls!inner(title)')
        .in('poll_id', pollIds)

      setActiveOptions(opts?.map(o => ({
        ...o,
        pollTitle: o.polls?.title || ''
      })) || [])
    }
    load()
  }, [groupId])

  function handleOptionSelect(optionId) {
    setSelectedOption(optionId)
    if (!optionId) {
      setSelectedOptData(null)
      return
    }
    const opt = activeOptions.find(o => o.id === optionId)
    if (opt) {
      setSelectedOptData(opt)
      setTitle(opt.title)
      setLocationName(opt.location_name)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      let imageUrl = null
      if (image) {
        const ext = image.name.split('.').pop()
        const filePath = `${groupId}/${Date.now()}.${ext}`
        await supabase.storage.from('event-images').upload(filePath, image)
        const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(filePath)
        imageUrl = publicUrl
      }

      let lat = null, lng = null
      if (locationName && !selectedOptData) {
        const coords = await geocodeAddress(locationName)
        if (coords) { lat = coords.lat; lng = coords.lng }
      } else if (selectedOptData) {
        lat = selectedOptData.location_lat
        lng = selectedOptData.location_lng
      }

      if (mapsLink) {
        const mapsCoords = await resolveMapsLink(mapsLink)
        if (mapsCoords) { lat = mapsCoords.lat; lng = mapsCoords.lng; console.log('[CreateEvent] coordinate sovrascritte da mapsLink:', mapsCoords) }
      }

      const { data: event, error: evErr } = await supabase
        .from('events')
        .insert({
          group_id: groupId,
          source_poll_id: selectedOptData?.poll_id || null,
          title,
          location_name: locationName,
          maps_link: mapsLink || null,
          location_lat: lat,
          location_lng: lng,
          image_url: imageUrl,
          event_date: eventDate,
          created_by: user.id
        })
        .select()
        .single()
      if (evErr) throw evErr

      // Add participants if from poll option
      if (selectedOptData) {
        const { data: voters } = await supabase
          .from('poll_votes')
          .select('user_id, start_lat, start_lng')
          .eq('option_id', selectedOptData.id)

        const voterIds = new Set(voters?.map(v => v.user_id) || [])
        const participants = (voters || []).map(v => ({
          event_id: event.id,
          user_id: v.user_id,
          status: 'confirmed',
          start_lat: v.start_lat,
          start_lng: v.start_lng
        }))

        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId)

        if (members) {
          members.forEach(m => {
            if (!voterIds.has(m.user_id)) {
              participants.push({
                event_id: event.id,
                user_id: m.user_id,
                status: 'declined'
              })
            }
          })
        }

        if (participants.length > 0) {
          await supabase.from('event_participants').insert(participants)
        }
      }

      navigate(`/groups/${groupId}/events/${event.id}`)
    } catch (err) {
      showToast(err?.message || String(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <div className="d-flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-black">
          <ChevronLeft size={30} />
        </button>
        <h1 className="text-xl font-bold text-accent">Nuovo Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 mx-auto">
        {activeOptions.length > 0 && (
          <div>
            <label className="block text-sm mb-1 text-gray-600">Metodo compilazione</label>
            <select value={selectedOption} onChange={e => handleOptionSelect(e.target.value)}
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent capitalize">
              <option value="">Manuale</option>
              {activeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.pollTitle} - {opt.title}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm mb-1 text-gray-600">Titolo evento</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-600">Luogo / Indirizzo</label>
          <input value={locationName} onChange={e => setLocationName(e.target.value)} required
            className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-600">Link mappa (opzionale)</label>
          <input value={mapsLink} onChange={e => setMapsLink(e.target.value)} placeholder="https://maps.google.com/..."
            className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-600">Data e ora evento</label>
          <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} required
            className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
        </div>
        <div className='mb-8'>
          <label className="block text-sm mb-1 text-gray-600">Foto evento (opzionale)</label>
          <input type="file" ref={fileRef} accept="image/*" onChange={e => setImage(e.target.files[0])}
            className="w-full text-gray-600 text-sm" />
        </div>

        <Button type="submit" text={loading ? 'Creazione...' : 'Crea Evento'} variant="primary" size="xl" fullWidth />
      </form>
    </div>
  )
}
