const DEFAULT_KEY = 'black'

function hexToHue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return Math.round((h * 60 + 360) % 360)
}

export function getAccentOptions() {
  const cs = getComputedStyle(document.documentElement)
  const options = []
  for (const prop of cs) {
    if (!prop.startsWith('--accent-')) continue
    if (prop.endsWith('-hover') || prop.endsWith('-opacity') || prop.endsWith('-bg') || prop.endsWith('-btn') || prop.endsWith('-bg-2') || prop.endsWith('-btn-2')) continue
    const key = prop.replace('--accent-', '')
    const accent = cs.getPropertyValue(prop).trim()
    const hover = cs.getPropertyValue(`--accent-${key}-hover`).trim() || accent
    const opacity = cs.getPropertyValue(`--accent-${key}-opacity`).trim() || `${accent}33`
    const bg = cs.getPropertyValue(`--accent-${key}-bg`).trim() || accent
    const bg2 = cs.getPropertyValue(`--accent-${key}-bg-2`).trim() || bg
    const btn = cs.getPropertyValue(`--accent-${key}-btn`).trim() || accent
    const btn2 = cs.getPropertyValue(`--accent-${key}-btn-2`).trim() || btn
    options.push({ key, accent, hover, opacity, bg, bg2, btn, btn2 })
  }
  return options.sort((a, b) => hexToHue(a.accent) - hexToHue(b.accent))
}

export function applyAccent(key) {
  const options = getAccentOptions()
  const opt = options.find(o => o.key === key) || options.find(o => o.key === DEFAULT_KEY) || options[0]
  if (!opt) return
  const root = document.documentElement
  root.style.setProperty('--accent', opt.accent)
  root.style.setProperty('--accent-hover', opt.hover)
  root.style.setProperty('--accent-opacity', opt.opacity)
  root.style.setProperty('--accent-bg', opt.bg)
  root.style.setProperty('--accent-bg-2', opt.bg2)
  root.style.setProperty('--accent-btn', opt.btn)
  root.style.setProperty('--accent-btn-2', opt.btn2)
}
