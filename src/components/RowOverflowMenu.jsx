import { useEffect, useRef, useState } from 'react'

// Batch 18e — shared row-level ⋯ overflow menu.
// Consolidates the three near-identical inline implementations introduced by
// the 18b/18c/18d redesigns:
//   - SplitCanvas's WorkoutCardMenu
//   - WorkoutEditSheet's section-level ⋯ popover
//   - WorkoutEditSheet's exercise-row ⋯ popover
//
// Props:
//   items       — [{ label, onSelect, destructive?, icon? }]
//                 onSelect must be a function to render the item; null/undefined
//                 entries are filtered out so callers can inline the boundary
//                 logic (`isFirst ? null : () => move(-1)`).
//   ariaLabel   — trigger button's aria-label (default "More actions").
//   anchorClass — trigger button extra classes (e.g. `hover:bg-card` when
//                 nested inside a bg-item region).
//
// Dismiss: outside-click (mousedown + touchstart) + Escape. Timer-deferred
// attach so the opening click doesn't immediately close the menu. z-20 is
// local to the row — the SplitManager page's full-portal menu lives at
// z-60 and has its own positioning logic; this one is for row-level menus
// where position-absolute inside the row is sufficient.

export default function RowOverflowMenu({ items, ariaLabel = 'More actions', anchorClass = 'hover:bg-item' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const onDocDown = (e) => {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      }
      document.addEventListener('mousedown', onDocDown)
      document.addEventListener('touchstart', onDocDown)
      ref.current._cleanup = () => {
        document.removeEventListener('mousedown', onDocDown)
        document.removeEventListener('touchstart', onDocDown)
      }
    }, 0)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      if (ref.current?._cleanup) ref.current._cleanup()
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = (items || []).filter(it => typeof it.onSelect === 'function')
  if (visible.length === 0) return null

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-10 h-10 flex items-center justify-center text-c-muted rounded-xl ${anchorClass}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <circle cx="12" cy="5"  r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 bg-card border border-subtle rounded-xl p-1 shadow-xl z-20 min-w-[160px]"
        >
          {visible.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => { it.onSelect(); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-sm text-left rounded-lg flex items-center gap-2 ${
                it.destructive
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-c-primary hover:bg-item'
              }`}
            >
              {it.icon && <span className="shrink-0 w-4 h-4 flex items-center justify-center">{it.icon}</span>}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
