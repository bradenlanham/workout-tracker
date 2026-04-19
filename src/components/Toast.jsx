import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Batch 17e — lightweight undo-toast. Module-level event bus so any component
// in the tree can call `showToast({ message, undo })` without prop threading.
// Single toast at a time — a new call replaces any active one. Matches the
// 5-second undo window the spec calls for (spec §Step 5).
//
// z-index 290 per the global stack in the handoff — above every established
// sheet / modal / popover so the undo is always reachable.

let toastState = { visible: false, message: '', undo: null }
let listeners  = []

function notify() { listeners.forEach(l => l(toastState)) }

let dismissTimer = null
function scheduleDismiss(duration) {
  clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    toastState = { visible: false, message: '', undo: null }
    notify()
  }, duration)
}

export function showToast({ message, undo, duration = 5000 }) {
  toastState = { visible: true, message, undo }
  notify()
  scheduleDismiss(duration)
}

export function dismissToast() {
  clearTimeout(dismissTimer)
  toastState = { visible: false, message: '', undo: null }
  notify()
}

export default function Toast() {
  const [state, setState] = useState(toastState)

  useEffect(() => {
    listeners.push(setState)
    return () => { listeners = listeners.filter(l => l !== setState) }
  }, [])

  if (!state.visible) return null

  const handleUndo = () => {
    try { state.undo?.() } catch {}
    dismissToast()
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{ zIndex: 290 }}
      className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-card border border-subtle rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 max-w-[92%]"
    >
      <span className="text-sm text-c-primary truncate">{state.message}</span>
      {state.undo && (
        <button
          type="button"
          onClick={handleUndo}
          className="text-xs font-bold uppercase tracking-wider text-amber-300 hover:text-amber-200 shrink-0"
        >
          Undo
        </button>
      )}
    </div>,
    document.body
  )
}
