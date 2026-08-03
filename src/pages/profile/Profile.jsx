import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { geocodeAddress } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import { applyAccent, getAccentOptions } from '../../lib/accent'
import Button from '../../components/ui/Button'
import { LogOut, Check } from 'lucide-react'

export default function Profile() {
  const { user, profile, signOut, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', home_address: '' })
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarSrc, setAvatarSrc] = useState(null)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerClosing, setPickerClosing] = useState(false)
  const fileInputRef = useRef()
  const closeTimerRef = useRef()
  const navigate = useNavigate()

  const accentOptions = useMemo(() => getAccentOptions(), [])
  const currentKey = profile?.accent_color
  const currentOpt = accentOptions.find(o => o.key === currentKey) || accentOptions[0]

  function closePicker() {
    if (!pickerOpen && !pickerClosing) return
    setPickerClosing(true)
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setPickerOpen(false)
      setPickerClosing(false)
    }, 150)
  }

  function togglePicker() {
    if (pickerOpen || pickerClosing) {
      closePicker()
    } else {
      setPickerOpen(true)
    }
  }

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  async function handleSelectColor(key) {
    applyAccent(key)
    localStorage.setItem('hc_accent', key)
    const { error } = await updateProfile({ accent_color: key })
    if (error) {
      applyAccent(profile?.accent_color)
      showToast(error?.message || String(error), 'error')
      return
    }
    closePicker()
    showToast('Colore aggiornato', 'success')
  }

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        username: profile.username || '',
        home_address: profile.home_address || ''
      })
    }
  }, [profile])

  useEffect(() => {
    setAvatarFailed(false)
    setAvatarSrc(profile?.avatar_url || null)
  }, [profile?.avatar_url])

  function handleAvatarError() {
    if (avatarSrc && avatarSrc !== profile?.avatar_url) {
      setAvatarFailed(true)
    } else {
      setAvatarSrc(`${profile.avatar_url}?t=${Date.now()}`)
    }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      let updates = { ...form }
      const coords = await geocodeAddress(form.home_address)
      if (coords) {
        updates.home_lat = coords.lat
        updates.home_lng = coords.lng
      }
      if (avatar) {
        const ext = avatar.name.split('.').pop()
        const filePath = `${user.id}/avatar.${ext}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, avatar, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
        updates.avatar_url = publicUrl
      }
      const { error: err } = await updateProfile(updates)
      if (err) throw err
      showToast('Profilo aggiornato', 'success')
    } catch (err) {
      showToast(err?.message || String(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="pt-4 px-4 flex-1 overflow-hidden d-flex flex-col">
      <div className="d-flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-accent">Profilo</h1>
        <div style={{ position: 'relative' }}>
          <button onClick={togglePicker}
            className="d-flex items-center justify-center rounded-full shrink-0"
            style={{ width: 32, height: 32, background: currentOpt?.accent, border: '2px solid rgba(0,0,0,0.15)' }}
            aria-label="Cambia colore tema" />
          {pickerOpen && (
            <>
              <div className={pickerClosing ? 'popover-exit' : 'popover-enter'}
                style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, zIndex: 40 }} onClick={closePicker}></div>
              <div className={`bg-card rounded-lg2 p-3 d-flex flex-between flex-col ${pickerClosing ? 'popover-exit' : 'popover-enter'}`} 
                style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, gap: 5, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                {accentOptions.map(opt => (
                  <button key={opt.key} onClick={() => handleSelectColor(opt.key)}
                    className="d-flex items-center justify-center rounded-full"
                    style={{ width: '110%', aspectRatio:1, background: opt.accent, border: currentKey === opt.key ? '3px solid var(--text-black)' : '3px solid transparent' }}>
                    {currentKey === opt.key && <Check size={18} color="#000" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className='flex-1 overflow-y-auto'>

        <div className="wide-grid mx-auto w-full">
          <div className="wide-avatar d-flex d-flex-col items-center mb-6">
          <div onClick={() => fileInputRef.current?.click()}
            className="mx-auto rounded-full border-2 border-accent d-flex items-center justify-center overflow-hidden mb-2 cursor-pointer hover:opacity-80 transition relative"
            style={{width:'50%',aspectRatio:1, maxWidth:'200px'}}>
            {avatarPreview
              ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              : avatarSrc && !avatarFailed
                ? <img src={avatarSrc} alt="" onError={handleAvatarError} className="w-full h-full object-cover" />
                : <span className="text-accent font-bold" style={{fontSize:60}}>{profile?.username?.[0]}</span>
            }
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                setAvatar(file)
                setAvatarPreview(URL.createObjectURL(file))
              }
            }} />
        </div>

        <form onSubmit={handleSubmit} className="wide-form space-y-3">
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
          <div className='mb-8'>
            <label className="block text-sm mb-1 text-gray-600">Indirizzo di casa</label>
            <input name="home_address" value={form.home_address} onChange={handleChange} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
          </div>
          <Button type="submit" text={loading ? 'Salvataggio...' : 'Salva Profilo'} variant="primary" size="xl" fullWidth />
        </form>

        <button onClick={handleLogout} className="wide-logout d-flex items-center justify-center gap-2 mt-6 mb-4 py-1 px-2 mx-auto border border-danger/50 text-red-400 rounded hover:bg-danger/10 transition">
          <LogOut size={18} /> Esci
        </button>
        </div>
      </div>
    </div>
  )
}
