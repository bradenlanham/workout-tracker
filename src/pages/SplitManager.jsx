import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { showToast } from '../components/Toast'

// ── Export helper ──────────────────────────────────────────────────────────────

function exportSplit(split) {
  const payload = {
    type: 'bambam-split-export',
    version: 1,
    split: { ...split },
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `split-${split.name.replace(/\s+/g, '-').toLowerCase()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Confirm delete modal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({ split, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-5" onClick={onCancel}>
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-lg mb-1">Delete split?</p>
        <p className="text-c-dim text-sm mb-5">
          "{split.name}" will be permanently deleted. Your workout history is not affected.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-item text-c-secondary py-3 rounded-xl font-semibold">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500/20 border border-red-500/40 text-red-400 py-3 rounded-xl font-bold">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Import error toast ─────────────────────────────────────────────────────────

function ImportError({ message, onDismiss }) {
  return (
    <div className="fixed bottom-24 inset-x-4 z-50 max-w-lg mx-auto">
      <div className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 flex items-center gap-3">
        <p className="flex-1 text-sm text-red-400 font-medium">{message}</p>
        <button onClick={onDismiss} className="text-red-400/70 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Overflow menu ─────────────────────────────────────────────────────────────
//
// Batch 17c — portal-anchored popover below the ⋯ button. Items are conditional
// on split type (Set Active hidden when already active; Delete hidden for
// built-in splits). Dismiss on outside click or Esc. Same pattern the app
// already uses for PlateConfigPopover — z-60 sits above the page but below
// toast (Step 5 will claim z-290) and below every established sheet/modal.

function OverflowMenu({ anchorRect, items, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    // Close on outside mousedown / touchstart. Deferred to the next tick so
    // the opening click itself doesn't immediately dismiss.
    const timer = setTimeout(() => {
      const onDocDown = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
      }
      document.addEventListener('mousedown', onDocDown)
      document.addEventListener('touchstart', onDocDown)
      menuRef.current._cleanup = () => {
        document.removeEventListener('mousedown', onDocDown)
        document.removeEventListener('touchstart', onDocDown)
      }
    }, 0)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      if (menuRef.current?._cleanup) menuRef.current._cleanup()
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!anchorRect) return null

  // Position: right-edge aligned to the anchor, below it, 6px gap. If it would
  // overflow the viewport right edge, pin to the right with an 8px margin.
  const MENU_W = 176
  const GAP    = 6
  let top  = anchorRect.bottom + GAP
  let left = anchorRect.right - MENU_W
  if (left < 8) left = 8
  if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Split actions"
      className="fixed bg-card border border-subtle rounded-xl p-1 shadow-xl"
      style={{ top, left, width: MENU_W, zIndex: 60 }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          type="button"
          onClick={(e) => { e.stopPropagation(); item.onSelect(); onClose() }}
          disabled={item.disabled}
          className={`w-full px-3 py-2.5 text-sm text-left rounded-lg flex items-center gap-2 transition-colors disabled:opacity-40 ${
            item.destructive
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-c-primary hover:bg-item'
          }`}
        >
          {item.icon && <span aria-hidden="true" className="shrink-0 w-4 h-4 flex items-center justify-center">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}

// Tiny inline SVG icon set — no icon library needed for five items.
const IconStar = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinejoin="round" />
  </svg>
)
const IconPencil = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
  </svg>
)
const IconCopy = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)
const IconExport = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)
const IconTrash = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// ── Split card ─────────────────────────────────────────────────────────────────
//
// Batch 17c — tap-anywhere-on-card activates the split (decision D4). The
// previous inline "Set Active" / "Edit" / Export / Delete buttons are folded
// into a single ⋯ overflow menu. Card root is a div+role="button" so the
// nested ⋯ trigger remains valid HTML.

function SplitCard({ split, isActive, onActivate, onEdit, onDuplicate, onDelete, onExport, theme }) {
  const workoutCount = split.workouts?.length || 0
  const rotationLength = split.rotation?.length || 0

  const [menuAnchor, setMenuAnchor] = useState(null)
  const overflowBtnRef = useRef(null)

  const rotationPreview = split.rotation
    ? (() => {
        const preview = split.rotation.slice(0, 5).map(id => {
          if (id === 'rest') return '😴'
          const w = split.workouts?.find(w => w.id === id)
          return w?.emoji || '🏋️'
        })
        if (split.rotation.length > 5) preview.push('…')
        return preview
      })()
    : []

  const openMenu = (e) => {
    e.stopPropagation()
    const rect = overflowBtnRef.current?.getBoundingClientRect()
    if (rect) setMenuAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right })
  }

  const handleCardActivate = () => { if (!isActive) onActivate() }
  const handleKey = (e) => {
    if (isActive) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() }
  }

  const menuItems = [
    ...(isActive ? [] : [{ label: 'Set Active', icon: IconStar,   onSelect: onActivate }]),
    { label: 'Edit',       icon: IconPencil, onSelect: onEdit       },
    { label: 'Duplicate',  icon: IconCopy,   onSelect: onDuplicate  },
    { label: 'Export',     icon: IconExport, onSelect: onExport     },
    ...(split.isBuiltIn ? [] : [{ label: 'Delete', icon: IconTrash, destructive: true, onSelect: onDelete }]),
  ]

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardActivate}
        onKeyDown={handleKey}
        aria-pressed={isActive}
        aria-label={isActive ? `${split.name}, currently active` : `Activate ${split.name}`}
        className={`bg-card rounded-2xl p-4 transition-all overflow-hidden cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 ${theme.ring} ${
          isActive ? '' : 'active:bg-hover'
        }`}
        style={isActive ? { borderLeft: `4px solid ${theme.hex}` } : { borderLeft: '4px solid transparent' }}
      >
        {/* Header row with ⋯ overflow trigger */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-3xl leading-none mt-0.5">{split.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-base leading-tight">{split.name}</p>
              {isActive && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme.bgSubtle} ${theme.text}`}>
                  Active
                </span>
              )}
              {split.isBuiltIn && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-item text-c-dim">
                  Built-in
                </span>
              )}
            </div>
            <p className="text-xs text-c-muted mt-1">
              {workoutCount} workout{workoutCount !== 1 ? 's' : ''} · {rotationLength}-day rotation
            </p>
          </div>

          {/* Overflow trigger — stopPropagation so card tap doesn't fire */}
          <button
            ref={overflowBtnRef}
            type="button"
            onClick={openMenu}
            aria-label={`More actions for ${split.name}`}
            aria-haspopup="menu"
            aria-expanded={!!menuAnchor}
            className="shrink-0 w-9 h-9 -mt-1 -mr-1 flex items-center justify-center rounded-xl text-c-muted hover:bg-item transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
        </div>

        {/* Rotation preview as emoji chips */}
        {rotationPreview.length > 0 && (
          <div className="flex items-center gap-1 mb-3">
            {rotationPreview.map((em, i) => (
              <span key={i} className="text-base leading-none">{em}</span>
            ))}
            {rotationPreview.length > 1 && (
              <span className="text-xs text-c-faint ml-0.5">rotation</span>
            )}
          </div>
        )}

        {/* Workout chips */}
        {split.workouts && split.workouts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {split.workouts.map(w => (
              <span key={w.id} className="text-xs bg-item text-c-secondary px-2 py-1 rounded-lg">
                {w.emoji} {w.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {menuAnchor && (
        <OverflowMenu
          anchorRect={menuAnchor}
          items={menuItems}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </>
  )
}

// ── Main SplitManager ──────────────────────────────────────────────────────────

export default function SplitManager() {
  const navigate = useNavigate()
  const {
    splits, activeSplitId,
    setActiveSplit, duplicateSplit, removeSplitById, deleteSplit, addSplit, settings,
  } = useStore()
  const theme = getTheme(settings.accentColor)

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importError, setImportError] = useState(null)
  const importRef = useRef(null)

  const handleEdit = (split) => {
    navigate(`/splits/edit/${split.id}`)
  }

  // Duplicate stays on the list view — users see the new "(Copy)" entry
  // appear in place rather than being yanked into the builder. Toast offers
  // a 5s undo window (Batch 17e). If they want to edit the duplicate, that's
  // a tap away via its own overflow menu.
  const handleDuplicate = (split) => {
    const dup = duplicateSplit(split.id)
    if (dup) {
      showToast({
        message: `Duplicated "${split.name}"`,
        undo: () => removeSplitById(dup.id),
      })
    }
  }

  const handleDeleteConfirm = () => {
    if (confirmDelete) {
      deleteSplit(confirmDelete.id)
      setConfirmDelete(null)
    }
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.type !== 'bambam-split-export' || !data.split) {
          setImportError('Invalid file — not a BamBam split export.')
          return
        }
        const { id: _id, ...splitData } = data.split
        addSplit({ ...splitData, isBuiltIn: false })
      } catch {
        setImportError('Could not read file — make sure it\'s a valid JSON export.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen pb-36">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1" style={{ paddingRight: '3.5rem' }}>
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">My Splits</h1>

          <button
            onClick={() => importRef.current?.click()}
            className="ml-auto flex items-center gap-1.5 bg-item text-c-secondary text-sm font-semibold px-3 py-2 rounded-xl hover:bg-hover transition-colors"
            title="Import a split from file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
        {/* Batch 17c — copy updated to match the tap-activates / overflow-edits model. */}
        <p className="text-sm text-c-muted ml-12">
          Tap a split to activate it. Use <span className="font-semibold text-c-secondary">⋯</span> for more actions.
        </p>
      </div>

      {/* ── Split list ──────────────────────────────────────────────────────── */}
      <div className="px-4 space-y-3">
        {splits.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-c-muted text-sm">No splits yet.</p>
          </div>
        )}

        {splits.length === 1 && splits[0]?.isBuiltIn && (
          <div className="bg-card rounded-2xl px-4 py-4 text-sm text-c-muted flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">💡</span>
            <p>You're using BamBam's Blueprint. Create your own split or import one from a coach or friend!</p>
          </div>
        )}

        {splits.map(split => (
          <SplitCard
            key={split.id}
            split={split}
            isActive={split.id === activeSplitId}
            theme={theme}
            onActivate={() => setActiveSplit(split.id)}
            onEdit={() => handleEdit(split)}
            onDuplicate={() => handleDuplicate(split)}
            onDelete={() => setConfirmDelete(split)}
            onExport={() => exportSplit(split)}
          />
        ))}
      </div>

      {/* ── Create new split ────────────────────────────────────────────────── */}
      <div className="px-4 mt-4">
        <button
          onClick={() => navigate('/splits/new/start')}
          className={`w-full py-4 rounded-2xl border-2 border-dashed font-semibold flex items-center justify-center gap-2 transition-colors ${theme.border} ${theme.text} hover:${theme.bgSubtle}`}
        >
          <span className="text-xl leading-none">+</span>
          Create New Split
        </button>
      </div>

      {/* ── Confirm delete modal ────────────────────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDeleteModal
          split={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Import error toast ──────────────────────────────────────────────── */}
      {importError && (
        <ImportError message={importError} onDismiss={() => setImportError(null)} />
      )}
    </div>
  )
}
