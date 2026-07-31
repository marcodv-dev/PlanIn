import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { geocodeAddress, reverseGeocode, extractCoordsFromMapsLink } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'
import { MapPin } from 'lucide-react'

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', username: '', home_address: '' })
  const [savedCoords, setSavedCoords] = useState(null)
  const [loading, setLoading] = useState(false)
  const addressRef = useRef(null)
  const { signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (e.target.name === 'home_address') setSavedCoords(null)
  }

  async function handleGpsClick() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      const name = await reverseGeocode(lat, lng)
      setForm(prev => ({ ...prev, home_address: name }))
      setSavedCoords({ lat, lng })
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const newUser = await signUp(form.email, form.password)

      let lat = savedCoords?.lat || null
      let lng = savedCoords?.lng || null
      let displayAddress = form.home_address

      if (!savedCoords && form.home_address) {
        const mapsCoords = extractCoordsFromMapsLink(form.home_address)
        if (mapsCoords) {
          lat = mapsCoords.lat
          lng = mapsCoords.lng
        } else {
          const geo = await geocodeAddress(form.home_address)
          if (geo) {
            lat = geo.lat
            lng = geo.lng
            displayAddress = geo.displayName
          }
        }
      }

      await supabase.from('profiles').upsert({
        id: newUser.id,
        username: form.username,
        first_name: form.first_name,
        last_name: form.last_name,
        home_address: displayAddress,
        home_lat: lat,
        home_lng: lng
      })
      navigate('/')
    } catch (err) {
      showToast(err?.message || String(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen d-flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-accent">PlanIn</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">Crea il tuo account</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="d-flex gap-2">
            <div className="d-flex-1">
              <label className="block text-sm mb-1 text-gray-600">Nome</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} required
                className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
            </div>
            <div className="d-flex-1">
              <label className="block text-sm mb-1 text-gray-600">Cognome</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} required
                className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">Username</label>
            <input name="username" value={form.username} onChange={handleChange} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">Password</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6}
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
          </div>
          <div style={{marginBottom:40}}>
            <label className="block text-sm mb-1 text-gray-600">Indirizzo di casa</label>
            <div className="d-flex gap-1">
              <input ref={addressRef} name="home_address" value={form.home_address} onChange={handleChange} required
                className="d-flex-1 border border-card rounded px-3 py-2 text-black outline-none focus:border-accent"
                placeholder="Indirizzo o link Google Maps" />
              <button type="button" onClick={handleGpsClick}
                className="border border-card rounded px-3 py-2 text-gray-500 hover:text-accent hover:border-accent transition">
                <MapPin size={18}/>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Clicca l'icona per usare la posizione GPS</p>
          </div>
          <Button type="submit" text={loading ? 'Registrazione...' : 'Registrati'} variant="primary" size="xl" fullWidth />
        </form>
        <p className="text-center mt-4 text-sm text-gray-500">
          Hai già un account? <Link to="/login" className="text-accent hover:underline">Accedi</Link>
        </p>
      </div>
    </div>
  )
}
