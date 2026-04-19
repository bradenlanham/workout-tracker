// Batch 17f — shared rest-day chip per decision D3: dimmed dashed circle with
// "R" label. Used across Dashboard (weekly strip, monthly grid), the rotation
// palette / list (Step 7's Canvas), and the template preview strip in
// ChooseStartingPoint. Size is tunable; the R scales with it.
//
// Full D3 application across Dashboard + Log surfaces lands in a separate
// small batch — this step only uses it on ChooseStartingPoint's template
// cards and (implicitly) sets up the import path for Step 7.

export default function RestDayChip({ size = 24 }) {
  const fontSize = Math.max(10, Math.round(size * 0.42))
  return (
    <span
      aria-label="Rest day"
      title="Rest day"
      className="inline-flex items-center justify-center rounded-full border border-dashed border-c-muted text-c-muted"
      style={{ width: size, height: size, fontSize, lineHeight: 1, fontWeight: 600 }}
    >
      R
    </span>
  )
}
