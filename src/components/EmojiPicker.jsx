import { useState } from 'react'
import { createPortal } from 'react-dom'

// Batch 17g — shared emoji picker per decision D5: curated grid first,
// "paste any emoji" text input as the OS fallback. Avoids launching the
// native emoji picker directly (inconsistent across iOS / Android / desktop)
// while still giving users full access via the system keyboard.
//
// Bottom-sheet portal at z-index 270 (above WorkoutEditSheet's 270 — stacks
// via DOM order when they're peers in document.body).

const CURATED_EMOJIS = [
  '🏋️', '💪', '🦵', '🦿', '🎯', '🔥', '⚡', '🏆',
  '🏃', '🚴', '🏊', '🥊', '🤸', '🧘', '⛹️', '🤾',
  '💥', '💯', '🥇', '🎖️', '⭐', '🌟', '🚀', '🧠',
  '📋', '🎪', '💎', '❤️', '☀️', '🌙', '🍑', '🔙',
]

export default function EmojiPicker({ current, onSelect, onClose }) {
  const [customInput, setCustomInput] = useState('')

  const handleCustom = (value) => {
    const v = (value || '').trim()
    // Emoji can be 1 char (most) or 2 chars (surrogate pairs) or more
    // (ZWJ sequences). Accept anything up to 8 chars — the system keyboard
    // won't produce junk, and typing is short-circuited by onChange anyway.
    if (v.length >= 1 && v.length <= 8) {
      onSelect(v)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 270 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose emoji"
        className="relative bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card px-4 py-3 border-b border-subtle flex items-center">
          <span className="text-sm font-bold flex-1 text-c-primary">Choose emoji</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-c-dim"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 grid grid-cols-6 gap-2">
          {CURATED_EMOJIS.map(em => {
            const isCurrent = em === current
            return (
              <button
                key={em}
                type="button"
                onClick={() => onSelect(em)}
                aria-label={`Emoji ${em}`}
                aria-pressed={isCurrent}
                className={`aspect-square rounded-lg text-3xl flex items-center justify-center transition-all active:scale-95 ${
                  isCurrent ? 'bg-item ring-2 ring-white/50' : 'hover:bg-item'
                }`}
              >
                {em}
              </button>
            )
          })}
        </div>
        <div className="px-4 pb-5">
          <input
            type="text"
            value={customInput}
            onChange={e => {
              setCustomInput(e.target.value)
              handleCustom(e.target.value)
            }}
            placeholder="Or paste any emoji…"
            className="w-full bg-item rounded-lg px-3 py-2.5 text-center text-2xl outline-none placeholder:text-c-muted placeholder:text-sm"
            aria-label="Custom emoji input"
          />
          <p className="text-xs text-c-muted mt-2 text-center">
            On iOS/Android, tap the input and use the emoji keyboard.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
