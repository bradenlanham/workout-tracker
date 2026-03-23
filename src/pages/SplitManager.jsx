import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'

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

// ── Split card ─────────────────────────────────────────────────────────────────

function SplitCard({ split, isActive, onActivate, onEdit, onCloneAndEdit, onDelete, onExport, theme }) {
  const workoutCount = split.workouts?.length || 0
  const rotationLength = split.rotation?.length || 0

  // Build rotation preview: up to 5 emoji + "..." if longer
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

  return (
    <div
      className={`bg-card rounded-2xl p-4 transition-all overflow-hidden ${
        isActive ? '' : 'active:bg-hover'
      }`}
      style={isActive ? { borderLeft: `4px solid ${theme.hex}` } : { borderLeft: '4px solid transparent' }}
    >
      {/* Header row */}
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
        <div className="flex flex-wrap gap-1.5 mb-3">
          {split.workouts.map(w => (
            <span key={w.id} className="text-xs bg-item text-c-secondary px-2 py-1 rounded-lg">
              {w.emoji} {w.name}
            </span>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        {!isActive && (
          <button
            onClick={onActivate}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${theme.bg} text-white`}
            style={{ color: theme.contrastText }}
          >
            Set Active
          </button>
        )}

        {isActive && (
          <div className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-center ${theme.bgSubtle} ${theme.text}`}>
            Currently Active
          </div>
        )}

        {split.isBuiltIn ? (
          <>
            <button
              onClick={onEdit}
              className="px-3 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary transition-colors hover:bg-hover"
              title="Edit rotation order"
            >
              Edit Order
            </button>
            <button
              onClick={onCloneAndEdit}
              className="px-3 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary transition-colors hover:bg-hover"
              title="Clone and open in editor"
            >
              Clone & Edit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary transition-colors hover:bg-hover"
            >
              Edit
            </button>
            <button
              onClick={onExport}
              className="w-10 flex items-center justify-center rounded-xl bg-item text-c-secondary transition-colors hover:bg-hover"
              title="Export split"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="w-10 flex items-center justify-center rounded-xl bg-item text-red-400 transition-colors hover:bg-red-500/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main SplitManager ──────────────────────────────────────────────────────────

export default function SplitManager() {
  const navigate = useNavigate()
  const {
    splits, activeSplitId,
    setActiveSplit, cloneSplit, deleteSplit, addSplit, settings,
  } = useStore()
  const theme = getTheme(settings.accentColor)

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importError, setImportError] = useState(null)
  const importRef = useRef(null)

  const handleEdit = (split) => {
    if (split.isBuiltIn) {
      navigate('/split')
    } else {
      navigate(`/splits/edit/${split.id}`)
    }
  }

  const handleCloneAndEdit = (id) => {
    const clone = cloneSplit(id)
    if (clone) navigate(`/splits/edit/${clone.id}`)
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
        // Strip the old ID so addSplit generates a fresh one
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

          {/* Import button */}
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
        <p className="text-sm text-c-muted ml-12">
          Tap a split to activate it. Clone built-in splits to customise them.
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

        {/* Hint when only the built-in split exists */}
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
            onCloneAndEdit={() => handleCloneAndEdit(split.id)}
            onDelete={() => setConfirmDelete(split)}
            onExport={() => exportSplit(split)}
          />
        ))}
      </div>

      {/* ── Create new split ────────────────────────────────────────────────── */}
      <div className="px-4 mt-4">
        <button
          onClick={() => navigate('/splits/new')}
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
