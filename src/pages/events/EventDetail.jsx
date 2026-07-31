import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { reverseGeocode, resolveMapsLink, geocodeAddress } from '../../lib/utils'
import { ChevronLeft, MapPin, Users, RotateCcw } from 'lucide-react'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
})

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
})

const grayIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
})

export default function EventDetail() {
  const { groupId, eventId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [myParticipation, setMyParticipation] = useState(null)
  const [startLocationText, setStartLocationText] = useState('')
  const [isLocationModified, setIsLocationModified] = useState(false)
  const [loading, setLoading] = useState(true)
  const autoCreatedRef = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).single()
      setEvent(ev)

      const { data: parts } = await supabase
        .from('event_participants')
        .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
        .eq('event_id', eventId)
      setParticipants(parts || [])

      const my = parts?.find(p => p.user_id === user.id)
      setMyParticipation(my || null)

      // Auto-create 'declined' on first visit for group members
      if (!my && ev && !autoCreatedRef.current) {
        autoCreatedRef.current = true
        await supabase.from('event_participants').insert({
          event_id: eventId, user_id: user.id, status: 'declined'
        })
        const { data: parts2 } = await supabase
          .from('event_participants')
          .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
          .eq('event_id', eventId)
        setParticipants(parts2 || [])
        const my2 = parts2?.find(p => p.user_id === user.id)
        setMyParticipation(my2 || null)
        if (my2?.start_location_name) {
          setStartLocationText(my2.start_location_name)
        } else if (profile?.home_address) {
          setStartLocationText(profile.home_address)
        }
      } else {
        if (my?.start_location_name) {
          setStartLocationText(my.start_location_name)
        } else if (profile?.home_address) {
          setStartLocationText(profile.home_address)
        }
      }

      setLoading(false)
    }
    load()
  }, [eventId, user.id, profile?.home_address])

  async function resolveLocation() {
    const text = startLocationText?.trim()
    if (text) {
      const mapsCoords = await resolveMapsLink(text)
      if (mapsCoords) {
        console.log('[EventDetail] coordinate da maps link:', mapsCoords)
        const name = await reverseGeocode(mapsCoords.lat, mapsCoords.lng)
        return { lat: mapsCoords.lat, lng: mapsCoords.lng, name }
      }
      try {
        const geo = await geocodeAddress(text)
        if (geo) return { lat: geo.lat, lng: geo.lng, name: geo.displayName }
      } catch {}
      // Geocoding failed — if equals profile address, use profile coords
      if (text === profile?.home_address && profile?.home_lat) {
        return { lat: profile.home_lat, lng: profile.home_lng, name: profile.home_address }
      }
    }
    return null
  }

  async function setStatus(status) {
    if (myParticipation) {
      const updateData = { status, updated_at: new Date().toISOString() }
      if (status === 'confirmed' && !myParticipation.start_lat) {
        const loc = await resolveLocation()
        if (loc) {
          updateData.start_lat = loc.lat
          updateData.start_lng = loc.lng
        }
      }
      await supabase.from('event_participants').update(updateData).eq('id', myParticipation.id)
    } else {
      const insertData = { event_id: eventId, user_id: user.id, status }
      if (status === 'confirmed') {
        const loc = await resolveLocation()
        if (loc) {
          insertData.start_lat = loc.lat
          insertData.start_lng = loc.lng
        }
      }
      await supabase.from('event_participants').insert(insertData)
    }
    // Reload
    const { data: parts } = await supabase
      .from('event_participants')
      .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
      .eq('event_id', eventId)
    setParticipants(parts || [])
    const my = parts?.find(p => p.user_id === user.id)
    setMyParticipation(my || null)
    if (my?.start_location_name) {
      setStartLocationText(my.start_location_name)
    } else if (profile?.home_address) {
      setStartLocationText(profile.home_address)
    }
  }

  async function handleSaveStartLocation() {
    if (!startLocationText.trim() || !myParticipation) return

    const loc = await resolveLocation()
    const name = loc?.name ?? startLocationText.trim()

    await supabase.from('event_participants').update({
      start_lat: loc?.lat ?? null,
      start_lng: loc?.lng ?? null,
      updated_at: new Date().toISOString()
    }).eq('id', myParticipation.id)

    setStartLocationText(name)
    setIsLocationModified(name !== profile?.home_address)

    // Reload
    const { data: parts } = await supabase
      .from('event_participants')
      .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
      .eq('event_id', eventId)
    setParticipants(parts || [])
  }

  async function handleResetLocation() {
    if (!myParticipation) return
    await supabase.from('event_participants').update({
      start_lat: profile.home_lat,
      start_lng: profile.home_lng,
      updated_at: new Date().toISOString()
    }).eq('id', myParticipation.id)

    setStartLocationText(profile.home_address || '')
    setIsLocationModified(false)

    // Reload
    const { data: parts } = await supabase
      .from('event_participants')
      .select('*, profiles(first_name, last_name, avatar_url, username, home_lat, home_lng)')
      .eq('event_id', eventId)
    setParticipants(parts || [])
  }

  if (loading) return <div className="d-flex items-center justify-center h-64 text-gray-500">Caricamento...</div>
  if (!event) return <div className="p-4 text-red-500">Evento non trovato</div>

  const activeParticipants = participants.filter(p => p.status !== 'declined')
  const hasCoords = event.location_lat && event.location_lng
  const mapCenter = hasCoords ? [event.location_lat, event.location_lng] : [41.9, 12.5]

  return (
    <div className="d-flex-1 d-flex flex-col px-4 pt-4 overflow-hidden">
      <div className="d-flex items-center gap-3 mb-4">
        <button onClick={() => navigate(`/groups/${groupId}?tab=${location.state?.fromTab || 'polls'}`)} className="text-black">
          <ChevronLeft size={30} />
        </button>
        <div className="d-flex gap-2 my-auto">
          <h1 className="text-xl font-bold text-accent capitalize ">{event.title}</h1>
          <p className="text-sm text-gray-400 my-auto capitalize">{event.location_name}</p>
        </div>
      </div>

      {/* Participation buttons - fixed */}
      <div className="d-flex gap-2 mb-4">
        <button onClick={() => setStatus('confirmed')}
          className={`d-flex-1 py-2 rounded text-sm font-medium transition ${myParticipation?.status === 'confirmed' ? 'bg-accent text-black' : 'bg-card text-gray-600 hover:border-accent'}`}>
          Partecipo
        </button>
        <button onClick={() => setStatus('maybe')}
          className={`d-flex-1 py-2 rounded text-sm font-medium transition ${myParticipation?.status === 'maybe' ? 'bg-yellow-500 text-black' : 'bg-card text-gray-600 hover:border-yellow-500'}`}>
          Forse
        </button>
        <button onClick={() => setStatus('declined')}
          className={`d-flex-1 py-2 rounded text-sm font-medium transition ${myParticipation?.status === 'declined' ? 'bg-danger text-white' : 'bg-card text-gray-600 hover:border-danger'}`}>
          Non posso
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {event.image_url && (
          <img src={event.image_url} alt="" className="w-full h-48 object-cover rounded-lg mb-4" />
        )}

        <div className="event-wide">
        <div className="event-left">
        <div className="bg-card rounded-lg p-4 mb-4">
          <p className="text-sm"><span className="text-gray-500">Data:</span> {new Date(event.event_date).toLocaleString('it', { dateStyle: 'short', timeStyle: 'short' })}</p>
          {event.maps_link && (
            <a href={event.maps_link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-accent-hover hover:underline block mt-1">
              Apri in Google Maps
            </a>
          )}
        </div>

      {myParticipation && myParticipation.status !== 'declined' && (
        <div className="d-flex items-center gap-2 mb-4">
          <MapPin size={14} className="text-gray-400 shrink-0" />
          <input value={startLocationText}
            onChange={e => setStartLocationText(e.target.value)}
            onBlur={handleSaveStartLocation}
            onKeyDown={e => e.key === 'Enter' && handleSaveStartLocation()}
            placeholder="Indirizzo o link Google Maps"
            className="d-flex-1 bg-page border border-light rounded px-3 py-2 text-sm text-black outline-none focus:border-accent" />
          {isLocationModified && (
            <button onClick={handleResetLocation}
              className="text-gray-400 hover:text-accent shrink-0">
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      )}

      {hasCoords && (
      <div className="h-64 rounded-lg overflow-hidden border border-card mb-4">
        <MapContainer center={mapCenter} zoom={10} className="map-container">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {hasCoords && (
            <Marker position={[event.location_lat, event.location_lng]} icon={blueIcon}>
              <Popup>
                <strong>{event.title}</strong><br /><span className="capitalize">{event.location_name}</span>
              </Popup>
            </Marker>
          )}
          {participants.filter(p => {
            const lat = p.start_lat ?? p.profiles?.home_lat
            const lng = p.start_lng ?? p.profiles?.home_lng
            return lat && lng && p.status !== 'declined'
          }).map(p => {
            const lat = p.start_lat ?? p.profiles?.home_lat
            const lng = p.start_lng ?? p.profiles?.home_lng
            return (
            <Marker key={p.id} position={[lat, lng]} icon={p.status === 'confirmed' ? greenIcon : grayIcon}>
              <Popup>
                <div className="d-flex items-center gap-2">
                  {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full" />}
                  <span>{p.profiles?.first_name} {p.profiles?.last_name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${p.status === 'confirmed' ? 'bg-accent/20 text-accent-hover' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {p.status === 'confirmed' ? 'Confermato' : 'Forse'}
                  </span>
                </div>
                {!p.start_lat && <p className="text-xs text-gray-500 mt-1">Casa</p>}
              </Popup>
            </Marker>
          )})}
        </MapContainer>
      </div>
      )}
      </div>

      <div className="event-right">
      {/* Participants list */}
      <h2 className="text-lg font-medium mb-3 d-flex items-center gap-2 text-gray-600">
        <Users size={18} /> Partecipanti ({activeParticipants.length})
      </h2>
      <div className="space-y-2">
        {participants.filter(p => p.status !== 'declined').map(p => (
          <div key={p.id} className="d-flex items-center gap-3 bg-card rounded-lg2 p-3">
            <div className="w-8 h-8 rounded-full bg-accent d-flex items-center justify-center text-xs font-bold overflow-hidden">
              {p.profiles?.avatar_url
                ? <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                : `${p.profiles?.username?.[0] || '?'}`
              }
            </div>
            <div className="d-flex-1">
              <p className="text-sm font-medium">{p.profiles?.username}</p>
              <p className="text-xs text-gray-500">{p.profiles?.first_name} {p.profiles?.last_name}</p>
            </div>
            <span className={`text-sm px-2 py-1 rounded ${
              p.status === 'confirmed' ? 'bg-accent/20 text-accent-hover' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {p.status === 'confirmed' ? 'Confermato' : 'Forse'}
            </span>
          </div>
        ))}
      </div>
      </div>
      </div>
      </div>

    </div>
  )
}
