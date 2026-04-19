import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Batch 18e — shared row-level ⋯ overflow menu.
// Batch 18f — now portals the panel to document.body with position:fixed so
// it can't be clipped by an ancestor `overflow-hidden` (which the
// WorkoutEditSheet section cards need for their rounded corners). Trigger
// button still lives in the row layout; only the popover panel portals.
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
// z-index 285 — above WorkoutEditSheet (270) and RecEditor (275), below the
// discard modal (280) and toast (290). Safe across all three call sites
// (SplitCanvas WorkoutCard, WorkoutEditSheet section header, exercise row).

const MENU_W  = 160
const Z_INDEX = 285

export default function RowOverflowMenu({ items, ariaLabel = 'More actions', anchorClass = 'hover:bg-item' }) {
  const [anchorRect, setAnchorRect] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const open = anchorRect !== null

  const close = () => setAnchorRect(null)

  const toggle = () => {
    if (open) { close(); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setAnchorRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
  }

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const onDocDown = (e) => {
        const t = e.target
        if (menuRef.current && menuRef.current.contains(t)) return
        if (btnRef.current && btnRef.current.contains(t)) return
        close()
      }
      document.addEventListener('mousedown', onDocDown)
      document.addEventListener('touchstart', onDocDown)
      menuRef.current && (menuRef.current._cleanup = () => {
        document.removeEventListener('mousedown', onDocDown)
        document.removeEventListener('touchstart', onDocDown)
      })
    }, 0)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      if (menuRef.current?._cleanup) menuRef.current._cleanup()
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = (items || []).filter(it => typeof it.onSelect === 'function')
  if (visible.length === 0) return null

  // Right-edge aligned to the anchor, 6px below. Viewport-edge clamp at 8px.
  // If the menu would overflow the bottom of the viewport, flip it ABOVE the
  // anchor so long menus stay on screen.
  let menuTop  = 0
  let menuLeft = 0
  let flipped  = false
  if (anchorRect) {
    const approxH = visible.length * 40 + 10  // rough row height + padding
    menuLeft = anchorRect.right - MENU_W
    if (menuLeft < 8) menuLeft = 8
    if (menuLeft + MENU_W > window.innerWidth - 8) menuLeft = window.innerWidth - MENU_W - 8
    if (anchorRect.bottom + 6 + approxH > window.innerHeight - 8) {
      menuTop = anchorRect.top - 6 - approxH
      flipped = true
    } else {
      menuTop = anchorRect.bottom + 6
    }
    if (menuTop < 8) menuTop = 8
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`shrink-0 w-10 h-10 flex items-center justify-center text-c-muted rounded-xl ${anchorClass}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <circle cx="12" cy="5"  r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed bg-card border border-subtle rounded-xl p-1 shadow-xl"
          style={{ top: menuTop, left: menuLeft, width: MENU_W, zIndex: Z_INDEX }}
          data-flipped={flipped || undefined}
        >
          {visible.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => { it.onSelect(); close() }}
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
        </div>,
        document.body
      )}
    </>
  )
}
