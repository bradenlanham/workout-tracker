// Batch 20a — session gym pill (spec §3.5.2 / §9.6 Option D).
//
// Compact chip rendered below the workout title in BbLogger's sticky header.
// Tells the user which gym is feeding the recommender / Machine chip auto-fills
// so the AI inferences from Batch 19 + the incoming 20b prompts are visible,
// not hidden. Tap opens a portal popover (z-240) with the existing gym list +
// an inline add-new input.
//
// Hidden entirely when the user has never added a gym (settings.gyms.length === 0) —
// no point showing an affordance for a list that can't be filtered.
// When gyms exist but no gymId is set for this session, renders as a muted
// "+ Set gym" prompt so the user can opt in mid-session.
//
// gymId persists via BbLogger's existing saveActiveSession useEffect; this
// component is a pure controlled input.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../../store/useStore'

export default function SessionGymPill({ gymId, onChange, theme }) {
  const gyms            = useStore(s => s.settings.gyms        || [])
  const addGym          = useStore(s => s.addGym)
  const setDefaultGymId = useStore(s => s.setDefaultGymId)

  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const [newGymDraft,  setNewGymDraft]  = useState('')
  const chipRef   = useRef(null)
  const panelRef  = useRef(null)

  // If the user hasn't set up any gyms at all, nothing to pick from. Hide the
  // chip entirely — the readiness overlay is the only place to add the first
  // one until 20d's Settings UI lands.
  if (!gyms.length) return null

  const selectedGym = gyms.find(g => g.id === gymId) || null

  const openPicker = () => {
    if (chipRef.current) {
      setAnchorRect(chipRef.current.getBoundingClientRect())
    }
    setOpen(true)
  }

  // Outside-click + Escape dismiss, 0ms setTimeout so the opening tap itself
  // doesn't immediately close. Mirrors PlateConfigPopover / EquipmentInstancePopover.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (panelRef.current?.contains(e.target)) return
      if (chipRef.current?.contains(e.target))  return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('touchstart', onDoc)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (id) => {
    if (id !== gymId) onChange(id)
    if (id) setDefaultGymId(id)
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setOpen(false)
  }

  const handleAddGym = () => {
    const clean = newGymDraft.trim()
    if (!clean) return
    const id = addGym(clean)
    if (id) {
      onChange(id)
      setDefaultGymId(id)
    }
    setNewGymDraft('')
    setOpen(false)
  }

  // Panel position: anchor bottom-left, 6px gap, clamped 8px from viewport edges.
  const PANEL_WIDTH = 260
  const panelStyle = anchorRect ? (() => {
    const vw = window.innerWidth
    const rawLeft = anchorRect.left
    const left = Math.max(8, Math.min(rawLeft, vw - PANEL_WIDTH - 8))
    return {
      position: 'fixed',
      top:  anchorRect.bottom + 6,
      left,
      width: PANEL_WIDTH,
      zIndex: 240,
    }
  })() : null

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        onClick={openPicker}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors max-w-full"
        style={selectedGym ? {
          background:  `${theme.hex}1a`,
          border:      `1px solid ${theme.hex}40`,
          color:       theme.hex,
        } : {
          background:  'var(--bg-item)',
          border:      '1px dashed var(--border-base)',
          color:       'var(--text-muted)',
        }}
        aria-label={selectedGym ? `Change gym (currently ${selectedGym.label})` : 'Set gym'}
      >
        {selectedGym ? (
          <>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" />
            </svg>
            <span className="truncate">{selectedGym.label}</span>
            <svg className="w-2.5 h-2.5 shrink-0 opacity-70" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5l3 3 3-3H3z" /></svg>
          </>
        ) : (
          <>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
            </svg>
            <span>Set gym</span>
          </>
        )}
      </button>

      {open && panelStyle && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="rounded-xl shadow-2xl bg-card border border-base p-2 text-left"
        >
          <div className="text-[10px] uppercase tracking-wider text-c-faint px-1 pt-1 pb-1.5 font-bold">
            Where are you lifting?
          </div>

          <div className="space-y-0.5 mb-1.5 max-h-56 overflow-y-auto">
            {gyms.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleSelect(g.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                style={g.id === gymId ? {
                  background: `${theme.hex}1a`,
                  color:      theme.hex,
                  fontWeight: 600,
                } : {
                  background: 'transparent',
                  color:      'var(--text-secondary)',
                }}
              >
                <span className="truncate">{g.label}</span>
                {g.id === gymId && <span className="shrink-0 ml-2 text-xs">✓</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={newGymDraft}
              onChange={e => setNewGymDraft(e.target.value.slice(0, 40))}
              onKeyDown={e => {
                if (e.key === 'Enter')  { e.preventDefault(); handleAddGym() }
                if (e.key === 'Escape') { e.preventDefault(); setNewGymDraft(''); setOpen(false) }
              }}
              placeholder="Add a new gym…"
              maxLength={40}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-item text-sm text-c-primary placeholder-c-faint outline-none border border-subtle focus:border-base"
            />
            <button
              type="button"
              onClick={handleAddGym}
              disabled={!newGymDraft.trim()}
              className="px-2.5 py-1.5 rounded-lg text-sm font-semibold disabled:cursor-not-allowed transition-opacity"
              style={newGymDraft.trim() ? {
                background: theme.hex,
                color:      theme.contrastText,
              } : {
                background: 'var(--bg-item)',
                color:      'var(--text-faint)',
              }}
            >
              Add
            </button>
          </div>

          {selectedGym && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full px-3 py-1.5 rounded-lg text-xs text-c-muted hover:bg-item transition-colors"
            >
              Clear gym for this session
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
