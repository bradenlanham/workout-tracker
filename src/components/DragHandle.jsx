// Batch 18c — shared decorative drag-handle glyph.
// Renders a 10×18 two-column dot grid. Purely visual for now — signals the
// row is reorderable, but the actual drag-and-drop plumbing lands in a
// future batch. Meanwhile, the overflow menu's Move Up / Move Down items
// cover keyboard + tap reordering. `pointer-events-none` keeps it from
// intercepting taps on the surrounding button.
//
// Scheduled to be re-exported from this same path in Batch 18e alongside
// RowOverflowMenu — no rename, no breaking change.

export default function DragHandle({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 w-3 flex items-center justify-center text-c-faint pointer-events-none ${className}`}
    >
      <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor">
        <circle cx="2" cy="2"  r="1.4" />
        <circle cx="8" cy="2"  r="1.4" />
        <circle cx="2" cy="9"  r="1.4" />
        <circle cx="8" cy="9"  r="1.4" />
        <circle cx="2" cy="16" r="1.4" />
        <circle cx="8" cy="16" r="1.4" />
      </svg>
    </span>
  )
}
