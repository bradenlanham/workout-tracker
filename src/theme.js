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
  },
}

export function getTheme(id) {
  return THEMES[id] || THEMES.violet
}
