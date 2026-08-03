import { supabase } from './supabase'

export async function geocodeAddress(address) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
    { headers: { 'Accept-Language': 'it' } }
  )
  const data = await response.json()
  if (data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name }
}

export async function reverseGeocode(lat, lng) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { 'Accept-Language': 'it' } }
  )
  const data = await response.json()
  return data.display_name || `${lat}, ${lng}`
}

export function extractCoordsFromMapsLink(url) {
  // Google Maps: @lat,lng  |  /maps/search/lat,+lng  |  !3dlat!4dlng  |  ?q=lat,lng  |  ?ll=lat,lng
  const patterns = [
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /[?/]search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  }
  return null
}

export async function resolveMapsLink(url) {
  const direct = extractCoordsFromMapsLink(url)
  if (direct) { console.log('[resolveMapsLink] estratto da URL diretto:', direct); return direct }
  try {
    const { data, error } = await supabase.functions.invoke('resolve-maps-link', { body: { url } })
    if (error) throw error
    if (data?.coords) {
      console.log('[resolveMapsLink] estratto via edge function:', data.coords, '->', data.finalUrl)
      return data.coords
    }
    console.log('[resolveMapsLink] edge function: nessuna coordinata trovata in:', data?.finalUrl || url)
  } catch (e) {
    console.log('[resolveMapsLink] errore edge function:', e?.message || e)
  }
  return null
}

export function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8)
}

export function isPollExpired(expiresAt) {
  return new Date() > new Date(new Date(expiresAt).getTime() + 24 * 60 * 60 * 1000)
}

export function isEventPast(eventDate) {
  return new Date(eventDate) < new Date()
}
