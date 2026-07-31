const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function extractCoords(url) {
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

function extractAddressParts(str) {
  const m = str.match(/(\d{5})\s+([A-Za-zÀ-ÿ' -]+?)(?:\s+[A-Z]{2})?$/)
  if (!m) return { postalcode: null, city: null, street: str }
  return {
    postalcode: m[1],
    city: m[2].trim(),
    street: str.slice(0, m.index).replace(/,\s*$/, '').trim()
  }
}

async function nominatimSearch(params) {
  const qs = new URLSearchParams(params)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&${qs}`, {
    headers: { 'Accept-Language': 'it',         'User-Agent': 'planin/1.0' }
  })
  const data = await res.json()
  if (Array.isArray(data) && data.length > 0) {
    const r = data[0]
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), name: r.display_name, addresstype: r.addresstype }
  }
  return null
}

function isSpecific(geo) {
  if (!geo) return false
  const notSpecific = ['town', 'village', 'city', 'county', 'state', 'administrative', 'municipality']
  return !notSpecific.includes(geo.addresstype)
}

async function geocodeQuery(query) {
  const { postalcode, city, street } = extractAddressParts(query)
  const streetSegs = street.split(',').map(s => s.trim()).filter(Boolean)

  // 1) Named POIs: free-text on prefix combos + city (e.g. "Parco Baden Powell, Dueville")
  if (city) {
    for (let i = 0; i < streetSegs.length && i < 3; i++) {
      const q = streetSegs.slice(0, i + 1).join(', ') + `, ${city}`
      const geo = await nominatimSearch({ q, countrycodes: 'it' })
      if (isSpecific(geo)) return geo
    }
  }

  // 2) Full query free-text (queries already containing the city, no street parse)
  const full = await nominatimSearch({ q: query, countrycodes: 'it' })
  if (isSpecific(full)) return full

  // 3) Structured address search (street + city + postalcode)
  if (city) {
    const streetCandidates = []
    for (let i = 0; i < streetSegs.length && i < 3; i++) {
      streetCandidates.push(streetSegs.slice(i).join(', '))
    }
    for (const sc of streetCandidates) {
      const params = { street: sc, countrycodes: 'it' }
      if (city) params.city = city
      if (postalcode) params.postalcode = postalcode
      const geo = await nominatimSearch(params)
      if (geo) return geo
    }
  }

  // 4) Progressive free-text trailing (last resort)
  const parts = query.split(',').map(s => s.trim()).filter(Boolean)
  const freeCandidates = []
  for (let i = 0; i < parts.length && i < 4; i++) freeCandidates.push(parts.slice(i).join(', '))
  for (const c of freeCandidates) {
    const geo = await nominatimSearch({ q: c, countrycodes: 'it' })
    if (isSpecific(geo)) return geo
  }
  return null
}

function extractQueryParam(url) {
  const m = url.match(/[?&]q=([^&]+)/)
  if (!m) return null
  try { return decodeURIComponent(m[1]).replace(/\+/g, ' ') } catch { return m[1].replace(/\+/g, ' ') }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { url } = await req.json()
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Invalid url', coords: null }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const res = await fetch(url, { redirect: 'follow' })
    const finalUrl = res.url || url
    let coords = extractCoords(finalUrl)
    let method = 'direct'
    let name = null

    if (!coords) {
      const q = extractQueryParam(finalUrl)
      if (q) {
        const geo = await geocodeQuery(q)
        if (geo) { coords = { lat: geo.lat, lng: geo.lng }; method = 'geocode'; name = geo.name }
      }
    }

    console.log('[resolve-maps-link]', url, '->', finalUrl, 'coords:', coords, 'method:', method)
    return new Response(JSON.stringify({ coords, finalUrl, method, name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.log('[resolve-maps-link] errore:', e.message)
    return new Response(JSON.stringify({ error: String(e.message || e), coords: null }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
