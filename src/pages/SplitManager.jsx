import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import {
  getSplitSessionCount,
  getSplitLastUsedDate,
  formatRelativeDate,
  formatStartDate,
} from '../utils/helpers'
import { showToast } from '../components/Toast'

// Batch 18b — SplitManager redesign. Single brand emoji tile, typographically-led
// card, subtle active treatment with 3px left bar + accent wash + animate-ping dot.
// Topbar "+" is the sole creation entry; dashed bottom CTA removed. See
// split-manager-handoff.md for the authoritative spec.

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
// Portal-anchored popover below the ⋯ button. Items are conditional on split
// type (Set Active hidden when already active; Delete hidden for built-ins).
// Dismiss on outside click or Esc. z-60 sits above page content, below toast.

function OverflowMenu({ anchorRect, items, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
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

// Tiny inline SVG icon set.
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

// ── ActivePill ────────────────────────────────────────────────────────────────
// Tailwind animate-ping gives us the ring-expansion pulse without a custom
// keyframe. Not animate-pulse (that's an opacity fade — wrong effect).

function ActivePill({ theme }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 py-[3px] px-2 rounded-full border text-[10px] font-bold tracking-[0.12em] uppercase shrink-0"
      style={{
        background: `${theme.hex}24`,
        borderColor: `${theme.hex}5c`,
        color: theme.hex,
      }}
    >
      <span className="relative inline-block w-[6px] h-[6px] shrink-0">
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: theme.hex, opacity: 0.6 }}
        />
        <span
          className="relative block w-full h-full rounded-full"
          style={{ background: theme.hex }}
        />
      </span>
      Active
    </span>
  )
}

// ── SplitCard ─────────────────────────────────────────────────────────────────
// Inline-styled where theme.hex-derived alpha is needed; everything else
// Tailwind. Card tap → edit (SplitCanvas). Overflow ⋯ + "Set active ›" both
// stopPropagation.

function SplitCard({
  split, isActive, theme,
  sessionCount, lastUsedIso,
  onOpen, onSetActive, onOverflow,
}) {
  const overflowBtnRef = useRef(null)

  const meta = `${split.workouts.length} workout${split.workouts.length === 1 ? '' : 's'} · ${split.rotation.length}-day rotation`
  const usage = sessionCount === 0
    ? 'Not yet used'
    : `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'} · ${formatRelativeDate(lastUsedIso)}`
  const provenanceLabel = sessionCount === 0 ? 'Created' : 'Started'
  const provenanceDate = formatStartDate(split.createdAt)
  const provenance = provenanceDate ? `${provenanceLabel} ${provenanceDate}` : ''

  const activeCardStyle = isActive ? {
    background: `linear-gradient(135deg, ${theme.hex}14 0%, ${theme.hex}00 55%), var(--bg-card, #141417)`,
    borderColor: `${theme.hex}40`,
    boxShadow: `0 1px 0 rgba(255,255,255,0.02) inset, 0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px ${theme.hex}2e`,
  } : {}

  const activeTileStyle = isActive ? {
    background: `linear-gradient(145deg, ${theme.hex}2e, ${theme.hex}0a)`,
    borderColor: `${theme.hex}5c`,
  } : {}

  const activeBorderTopStyle = isActive ? { borderTopColor: `${theme.hex}26` } : {}

  const openMenu = (e) => {
    e.stopPropagation()
    const rect = overflowBtnRef.current?.getBoundingClientRect()
    if (rect) onOverflow(split.id, rect)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(split.id) }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(split.id)}
      onKeyDown={handleKey}
      aria-label={isActive ? `${split.name}, currently active. Tap to edit.` : `Edit ${split.name}`}
      className="relative bg-card border border-subtle rounded-[18px] px-[18px] pt-[16px] pb-[14px] mb-[10px] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2"
      style={{ ...activeCardStyle, ...(isActive ? {} : { boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.1))' }) }}
    >
      {/* Left accent bar — active only */}
      {isActive && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r"
          style={{ background: theme.hex }}
        />
      )}

      {/* Top row: tile + identity + overflow */}
      <div className="flex items-start gap-3">
        <div
          className="w-[38px] h-[38px] rounded-[10px] bg-item border border-subtle flex items-center justify-center text-[19px] shrink-0"
          style={activeTileStyle}
          aria-hidden="true"
        >
          {split.emoji}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-bold tracking-[-0.02em] text-c-primary leading-[1.15] truncate">
                {split.name}
              </div>
              <div className="text-[12.5px] text-c-dim mt-0.5 tabular-nums leading-[1.2]">
                {meta}
              </div>
            </div>
            {split.isBuiltIn && (
              <span
                aria-label="Built-in template"
                className="shrink-0 self-start mt-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-c-faint"
              >
                Built-in
              </span>
            )}
            <button
              ref={overflowBtnRef}
              type="button"
              onClick={openMenu}
              aria-label={`More actions for ${split.name}`}
              aria-haspopup="menu"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-c-muted text-base -mt-0.5 shrink-0 hover:bg-item transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                <circle cx="5"  cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom block */}
      <div
        className="mt-[10px] pt-[9px] border-t border-subtle flex flex-col"
        style={activeBorderTopStyle}
      >
        <div className="flex items-center justify-between gap-2.5 leading-[1.2]">
          <span className="text-[12px] text-c-dim tabular-nums truncate">{usage}</span>
          {isActive
            ? <ActivePill theme={theme} />
            : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSetActive(split.id) }}
                className="text-[12px] text-c-muted font-medium shrink-0 hover:text-c-secondary transition-colors"
              >
                Set active ›
              </button>
            )
          }
        </div>
        {provenance && isActive && (
          <div className="text-[11px] text-c-muted tabular-nums leading-[1.2] mt-px">
            {provenance}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main SplitManager ──────────────────────────────────────────────────────────

export default function SplitManager() {
  const navigate = useNavigate()
  const splits           = useStore(s => s.splits)
  const sessions         = useStore(s => s.sessions)
  const activeSplitId    = useStore(s => s.activeSplitId)
  const setActiveSplit   = useStore(s => s.setActiveSplit)
  const duplicateSplit   = useStore(s => s.duplicateSplit)
  const removeSplitById  = useStore(s => s.removeSplitById)
  const deleteSplit      = useStore(s => s.deleteSplit)
  const addSplit         = useStore(s => s.addSplit)
  const importSplitWithLibrary = useStore(s => s.importSplitWithLibrary)
  const settings         = useStore(s => s.settings)
  const theme            = getTheme(settings.accentColor)

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importError, setImportError]     = useState(null)
  const [menuFor, setMenuFor]             = useState(null) // { splitId, rect }
  const importRef = useRef(null)

  // Precompute usage per split once per render.
  const usageBySplitId = useMemo(() => {
    const map = {}
    for (const split of splits) {
      map[split.id] = {
        sessionCount: getSplitSessionCount(sessions, split),
        lastUsedIso:  getSplitLastUsedDate(sessions, split),
      }
    }
    return map
  }, [splits, sessions])

  const handleOpen       = (id) => navigate(`/splits/edit/${id}`)
  const handleSetActive  = (id) => setActiveSplit(id)

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
        const result = importSplitWithLibrary(data)
        if (result.errors && result.errors.length) {
          console.warn('Split import warnings:', result.errors)
        }
      } catch {
        setImportError('Could not read file — make sure it\'s a valid JSON export.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const openMenu = (splitId, rect) => setMenuFor({ splitId, rect })
  const closeMenu = () => setMenuFor(null)

  const menuSplit = menuFor ? splits.find(s => s.id === menuFor.splitId) : null
  const menuItems = menuSplit ? [
    ...(menuSplit.id === activeSplitId ? [] : [{ label: 'Set Active', icon: IconStar, onSelect: () => setActiveSplit(menuSplit.id) }]),
    { label: 'Edit',      icon: IconPencil, onSelect: () => navigate(`/splits/edit/${menuSplit.id}`) },
    { label: 'Duplicate', icon: IconCopy,   onSelect: () => handleDuplicate(menuSplit) },
    { label: 'Export',    icon: IconExport, onSelect: () => exportSplit(menuSplit) },
    ...(menuSplit.isBuiltIn ? [] : [{ label: 'Delete', icon: IconTrash, destructive: true, onSelect: () => setConfirmDelete(menuSplit) }]),
  ] : []

  return (
    <div className="min-h-screen pb-36">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 bg-base z-30 px-5 pb-2"
        style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top, 3.5rem))' }}
      >
        <div className="flex items-center justify-between gap-3 pb-2.5">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-item border border-subtle text-c-secondary text-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold tracking-[-0.01em]">My Splits</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => importRef.current?.click()}
              aria-label="Import a split from file"
              className="w-9 h-9 rounded-[10px] bg-item border border-subtle flex items-center justify-center text-c-secondary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <Link
              to="/splits/new/start"
              aria-label="New split"
              className="w-9 h-9 rounded-[10px] bg-item border border-subtle flex items-center justify-center text-[20px] font-medium"
              style={{ color: theme.hex }}
            >
              +
            </Link>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {/* ── Subtitle ─────────────────────────────────────────────────────── */}
      <div className="pt-1 px-5 pb-3">
        <p className="text-[11.5px] text-c-dim leading-[1.5] whitespace-nowrap">
          Your active split drives the rotation on the dashboard.
        </p>
      </div>

      {/* ── Split list ──────────────────────────────────────────────────────── */}
      <div className="px-5">
        {splits.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-c-muted text-sm">No splits yet.</p>
          </div>
        )}

        {splits.map(split => {
          const usage = usageBySplitId[split.id] || { sessionCount: 0, lastUsedIso: null }
          return (
            <SplitCard
              key={split.id}
              split={split}
              isActive={split.id === activeSplitId}
              theme={theme}
              sessionCount={usage.sessionCount}
              lastUsedIso={usage.lastUsedIso}
              onOpen={handleOpen}
              onSetActive={handleSetActive}
              onOverflow={openMenu}
            />
          )
        })}
      </div>

      {/* ── Overflow menu ────────────────────────────────────────────────────── */}
      {menuFor && (
        <OverflowMenu
          anchorRect={menuFor.rect}
          items={menuItems}
          onClose={closeMenu}
        />
      )}

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
