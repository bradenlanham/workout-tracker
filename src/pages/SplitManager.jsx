import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'

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

// ── Split card ─────────────────────────────────────────────────────────────────

function SplitCard({ split, isActive, onActivate, onEdit, onClone, onDelete, theme }) {
  const workoutCount = split.workouts?.length || 0
  const rotationLength = split.rotation?.length || 0

  return (
    <div
      className={`bg-card rounded-2xl p-4 transition-all ${
        isActive ? `ring-2 ${theme.ring}` : ''
      }`}
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
          <button
            onClick={onEdit}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary transition-colors hover:bg-hover"
            title="Edit rotation order"
          >
            Edit Order
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary transition-colors hover:bg-hover"
          >
            Edit
          </button>
        )}

        {split.isBuiltIn ? (
          <button
            onClick={onClone}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-item text-c-secondary transition-colors hover:bg-hover"
            title="Clone to create an editable copy"
          >
            Clone
          </button>
        ) : (
          <button
            onClick={onDelete}
            className="w-10 flex items-center justify-center rounded-xl bg-item text-red-400 transition-colors hover:bg-red-500/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
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
    setActiveSplit, cloneSplit, deleteSplit, settings,
  } = useStore()
  const theme = getTheme(settings.accentColor)

  const [confirmDelete, setConfirmDelete] = useState(null) // split object

  const handleActivate = (id) => {
    setActiveSplit(id)
  }

  const handleEdit = (split) => {
    // Built-in split: open the rotation editor
    // User splits: rotation editor (full split builder coming in Phase 2)
    navigate('/split')
  }

  const handleClone = (id) => {
    const clone = cloneSplit(id)
    if (clone) {
      // Optionally activate the clone
    }
  }

  const handleDeleteConfirm = () => {
    if (confirmDelete) {
      deleteSplit(confirmDelete.id)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="min-h-screen pb-36">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">My Splits</h1>
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

        {splits.map(split => (
          <SplitCard
            key={split.id}
            split={split}
            isActive={split.id === activeSplitId}
            theme={theme}
            onActivate={() => handleActivate(split.id)}
            onEdit={() => handleEdit(split)}
            onClone={() => handleClone(split.id)}
            onDelete={() => setConfirmDelete(split)}
          />
        ))}
      </div>

      {/* ── Create new split (Phase 2) ──────────────────────────────────────── */}
      <div className="px-4 mt-4">
        <button
          disabled
          className="w-full py-4 rounded-2xl border-2 border-dashed border-c-base text-c-faint font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
        >
          <span className="text-xl">+</span>
          Create New Split
          <span className="text-xs ml-1">(Phase 2)</span>
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
    </div>
  )
}
