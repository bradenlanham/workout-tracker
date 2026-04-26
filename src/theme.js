// ── Accent colour themes ───────────────────────────────────────────────────────
// All Tailwind class strings must appear as full literals here so JIT includes them.

export const THEMES = {
  violet: {
    id: 'violet',
    name: 'Violet',
    bg: 'bg-violet-500',
    bgHover: 'hover:bg-violet-400',
    bgSubtle: 'bg-violet-500/20',
    text: 'text-violet-400',
    border: 'border-violet-500/40',
    ring: 'ring-violet-500/50',
    hex: '#8B5CF6',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  blue: {
    id: 'blue',
    name: 'Ocean',
    bg: 'bg-blue-500',
    bgHover: 'hover:bg-blue-400',
    bgSubtle: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    ring: 'ring-blue-500/50',
    hex: '#3B82F6',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    bg: 'bg-emerald-500',
    bgHover: 'hover:bg-emerald-400',
    bgSubtle: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    ring: 'ring-emerald-500/50',
    hex: '#10B981',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  orange: {
    id: 'orange',
    name: 'Fire',
    bg: 'bg-orange-500',
    bgHover: 'hover:bg-orange-400',
    bgSubtle: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
    ring: 'ring-orange-500/50',
    hex: '#F97316',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    bg: 'bg-rose-500',
    bgHover: 'hover:bg-rose-400',
    bgSubtle: 'bg-rose-500/20',
    text: 'text-rose-400',
    border: 'border-rose-500/40',
    ring: 'ring-rose-500/50',
    hex: '#F43F5E',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyan',
    bg: 'bg-cyan-500',
    bgHover: 'hover:bg-cyan-400',
    bgSubtle: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    border: 'border-cyan-500/40',
    ring: 'ring-cyan-500/50',
    hex: '#06B6D4',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  red: {
    id: 'red',
    name: 'True Red',
    bg: 'bg-red-600',
    bgHover: 'hover:bg-red-500',
    bgSubtle: 'bg-red-600/20',
    text: 'text-red-500',
    border: 'border-red-600/40',
    ring: 'ring-red-600/50',
    hex: '#DC2626',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  pink: {
    id: 'pink',
    name: 'Electric Pink',
    bg: 'bg-[#FF1493]',
    bgHover: 'hover:bg-[#e0117f]',
    bgSubtle: 'bg-[#FF1493]/20',
    text: 'text-[#FF1493]',
    border: 'border-[#FF1493]/40',
    ring: 'ring-[#FF1493]/50',
    hex: '#FF1493',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  // HYROX yellow — matches the brand color used inside the HYROX overlay /
  // round logger / summary surfaces (Batches 41–45). Picking this accent gives
  // the rest of the app the same stark yellow-on-black contrast.
  yellow: {
    id: 'yellow',
    name: 'HYROX',
    bg: 'bg-yellow-500',
    bgHover: 'hover:bg-yellow-400',
    bgSubtle: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
    ring: 'ring-yellow-500/50',
    hex: '#EAB308',
    contrastText: '#1A1A1A',
    textOnBg: 'text-black',
    textOnBgMuted: 'text-black/70',
    textOnBgDim: 'text-black/60',
  },
  white: {
    id: 'white',
    name: 'White',
    bg: 'bg-[#E8E8E8]',
    bgHover: 'hover:bg-[#d0d0d0]',
    bgSubtle: 'bg-[#E8E8E8]/20',
    text: 'text-[#E8E8E8]',
    border: 'border-[#E8E8E8]/40',
    ring: 'ring-[#E8E8E8]/50',
    hex: '#E8E8E8',
    contrastText: '#1A1A1A',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
  black: {
    id: 'black',
    name: 'Black',
    bg: 'bg-[#2D2D2D]',
    bgHover: 'hover:bg-[#3d3d3d]',
    bgSubtle: 'bg-[#2D2D2D]/20',
    text: 'text-[#2D2D2D]',
    border: 'border-[#2D2D2D]/40',
    ring: 'ring-[#2D2D2D]/50',
    hex: '#2D2D2D',
    contrastText: '#FFFFFF',
    textOnBg: 'text-white',
    textOnBgMuted: 'text-white/70',
    textOnBgDim: 'text-white/60',
  },
}

// ── Custom-color helpers ──────────────────────────────────────────────────
// User-picked hex accents flow through getTheme('custom', hex). The named
// presets above use Tailwind class strings (statically discoverable by JIT);
// the custom theme returns shared `accent-*` class names that consume CSS
// variables injected on <html> by applyAccentToRoot. Keeps the named-theme
// path zero-risk while allowing arbitrary hex via runtime variable updates.

const CUSTOM_DEFAULT_HEX = '#EAB308'

// Module-level cache for the user's chosen custom hex. App.jsx primes this
// from settings.customAccentHex on mount and on every change. Keeps the
// getTheme(id) call sites — there are 22 — from having to thread an extra
// arg through every component. Safe because there's exactly one settings
// scope per app instance.
let _customAccentHex = CUSTOM_DEFAULT_HEX
export function setCustomAccentHex(hex) {
  const normalized = normalizeHex(hex)
  if (normalized) _customAccentHex = normalized
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function normalizeHex(input) {
  if (typeof input !== 'string') return null
  let h = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split('').map(c => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return '#' + h.toUpperCase()
}

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r, g, b) {
  const c = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return ('#' + c(r) + c(g) + c(b)).toUpperCase()
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Lightens by mixing toward white. amount: 0 = original, 1 = white.
function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

// Relative luminance per WCAG 2.x — drives contrastText (light hex → dark text,
// dark hex → light text). Threshold 0.55 lines up with the named presets:
// yellow-500 (~0.69 lum) → dark text; everything else → white text.
export function getContrastTextForHex(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#1A1A1A' : '#FFFFFF'
}

function buildCustomTheme(hex) {
  const normalized = normalizeHex(hex) || CUSTOM_DEFAULT_HEX
  const contrastText = getContrastTextForHex(normalized)
  const isLightAccent = contrastText === '#1A1A1A'
  return {
    id: 'custom',
    name: 'Custom',
    bg: 'accent-bg',
    bgHover: 'accent-bg-hover',
    bgSubtle: 'accent-bg-subtle',
    text: 'accent-text',
    border: 'accent-border',
    ring: 'accent-ring',
    hex: normalized,
    contrastText,
    textOnBg: 'accent-text-on-bg',
    textOnBgMuted: 'accent-text-on-bg-muted',
    textOnBgDim: 'accent-text-on-bg-dim',
    _isLightAccent: isLightAccent,
  }
}

export function getTheme(id, customHex) {
  if (id === 'custom') return buildCustomTheme(customHex || _customAccentHex)
  return THEMES[id] || THEMES.violet
}

// Push the custom theme's hex into CSS variables on <html> so the .accent-*
// classes pick them up. No-op for named themes — they paint via their static
// Tailwind class strings, so the custom variables can stay unset (or stale
// from a prior custom session; harmless).
export function applyAccentToRoot(theme) {
  if (typeof document === 'undefined' || !theme) return
  const root = document.documentElement
  if (theme.id !== 'custom') return
  const hex = theme.hex
  const lighter = lightenHex(hex, 0.10)
  const onBgBase = theme._isLightAccent ? 'rgba(0, 0, 0, ' : 'rgba(255, 255, 255, '
  root.style.setProperty('--accent-hex', hex)
  root.style.setProperty('--accent-bg-hover', lighter)
  root.style.setProperty('--accent-bg-subtle', hexToRgba(hex, 0.20))
  root.style.setProperty('--accent-border', hexToRgba(hex, 0.40))
  root.style.setProperty('--accent-ring', hexToRgba(hex, 0.50))
  root.style.setProperty('--accent-text', hex)
  root.style.setProperty('--accent-contrast', theme.contrastText)
  root.style.setProperty('--accent-text-on-bg-muted', onBgBase + '0.7)')
  root.style.setProperty('--accent-text-on-bg-dim', onBgBase + '0.6)')
}

// Batch 18e — safe-color helper for Save buttons. If the user's accent
// color is red, fall back to emerald so the commit action never visually
// collides with destructive-red. Accent-tinted decorative elements
// (SplitManager's active pill / left bar / hero tile) deliberately keep
// red when chosen — those are small thematic surfaces, not primary CTAs.
// Used by SplitCanvas.jsx and WorkoutEditSheet.jsx for their save buttons.
export function getSaveTheme(id, customHex) {
  return getTheme(id === 'red' ? 'emerald' : id, customHex)
}
