// Batch 43 — Gym-clock digital timer per design doc §17.
//
// Three rectangular digit boxes — HRS / MIN / SEC — separated by colon
// glyphs, all wrapped in a black surround with yellow inset glow + label
// eyebrow. Counts UP by default (round in progress); set `mode='rest'` to
// shift the eyebrow + softer wash for the rest-between-rounds takeover
// (B44 wires the actual countdown — parent computes remaining seconds and
// passes via `elapsedSec`). Pure presentational — parent owns the elapsedSec
// state + interval; this component only renders.
//
// B44: in `mode='rest'`, the final 5 seconds bump the digit color to a
// brighter amber so the user gets a visual "almost done" cue. No animation,
// just a color swap — keeps the visual language calm.
//
// Design doc §17.1: monospace 38px digits in #FEF08A (yellow-200), 56px min
// box width so 3-digit second values fit, 8px border radius, 0.3 yellow
// border + 8% bg, 8px×10px padding. Three boxes flex row gap 6px. Colon is
// 32px monospace yellow at 50%, top-aligned to the digits.
//
// §17.2: 100ms tick (parent's responsibility) — this component just reads
// `elapsedSec` on each render. Strict-mode-safe (no side effects).
//
// §17.3: counting-up state uses bright yellow numerals + glow. The 'rest'
// mode swaps the wrapper bg to a more subdued tint so users perceive the
// shift to a different mental clock.

import { formatDuration } from '../utils/helpers'

const YELLOW_500 = '#EAB308'
const YELLOW_200 = '#FEF08A'
const AMBER_300 = '#FCD34D'  // brighter / warmer for the final seconds

// Batch 46 — `size` prop adds a 'lg' variant for the round logger /
// rest screen / summary so the clock dominates the screen as the
// brand-anchor hero element. 'md' (default) keeps the original §17.1 spec.
const SIZE_CONFIG = {
  md: { fontSize: 38, minWidth: 56, padding: '8px 10px', colonSize: 32, colonMarginTop: 8, gap: 6, eyebrow: 10, eyebrowMargin: 10, wrapperPad: '16px 18px 14px 18px' },
  // Batch 46 — lg sized to fit comfortably inside a 375px mobile viewport
  // (375px - 32px parent padding = 343px). Total: 3 boxes * 70 + 2 colons +
  // 4 gaps + wrapper padding = ~330px.
  lg: { fontSize: 50, minWidth: 70, padding: '10px 8px', colonSize: 38, colonMarginTop: 10, gap: 4, eyebrow: 11, eyebrowMargin: 12, wrapperPad: '16px 14px 14px 14px' },
}

function DigitBox({ value, label, digitColor = YELLOW_200, sizeConfig }) {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        background: 'rgba(234, 179, 8, 0.08)',
        border: `1px solid rgba(234, 179, 8, 0.3)`,
        borderRadius: 10,
        padding: sizeConfig.padding,
        minWidth: sizeConfig.minWidth,
      }}
    >
      <span
        className="tabular-nums"
        style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          fontSize: sizeConfig.fontSize,
          fontWeight: 500,
          letterSpacing: '-0.04em',
          color: digitColor,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 8,
          letterSpacing: '0.1em',
          color: 'rgba(234, 179, 8, 0.7)',
          fontWeight: 700,
          marginTop: 4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function Colon({ sizeConfig }) {
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        fontSize: sizeConfig.colonSize,
        color: 'rgba(234, 179, 8, 0.5)',
        alignSelf: 'flex-start',
        lineHeight: 1,
        // Compensates for the smaller font vs the digits so colons
        // visually align with the digits' top edge per §17.1.
        marginTop: sizeConfig.colonMarginTop,
      }}
    >
      :
    </span>
  )
}

// `eyebrowOverride` lets the round logger label this 'STATION CLOCK' /
// 'ROUND CLOCK' explicitly. Defaults derived from `mode` per §17.3.
// Batch 46 — `size` prop ('md' default | 'lg') configures digit + box scale.
export default function GymClock({
  elapsedSec = 0,
  mode = 'up',          // 'up' (round) | 'rest' (count-down)
  eyebrowOverride = null,
  size = 'md',          // 'md' (§17.1 default) | 'lg' (Batch 46 hero size)
}) {
  const total = Math.max(0, Math.round(typeof elapsedSec === 'number' ? elapsedSec : 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  const eyebrow = eyebrowOverride
    || (mode === 'rest' ? 'REST' : 'ROUND CLOCK')

  // §17.3 — softer wash on rest mode.
  const wrapperBg = mode === 'rest' ? 'rgba(234, 179, 8, 0.04)' : '#000'

  // B44 — final-5s warmer color in rest mode so users feel the urgency
  // without animation. Other modes always use the standard yellow-200.
  const digitColor =
    mode === 'rest' && total > 0 && total <= 5 ? AMBER_300 : YELLOW_200

  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.md

  return (
    <div
      role="timer"
      aria-label={`${eyebrow.toLowerCase()}: ${formatDuration(total)}`}
      className="flex flex-col items-center"
      style={{
        background: wrapperBg,
        border: `2px solid rgba(234, 179, 8, 0.5)`,
        borderRadius: 16,
        boxShadow: 'inset 0 0 60px rgba(234, 179, 8, 0.12)',
        padding: sizeConfig.wrapperPad,
        // Batch 46 — large variant fills the available width up to a cap.
        width: size === 'lg' ? '100%' : undefined,
        maxWidth: size === 'lg' ? 380 : undefined,
      }}
    >
      <span
        className="tabular-nums"
        style={{
          fontSize: sizeConfig.eyebrow,
          letterSpacing: '0.2em',
          color: YELLOW_500,
          fontWeight: 700,
          marginBottom: sizeConfig.eyebrowMargin,
        }}
      >
        {eyebrow}
      </span>
      <div className="flex items-start" style={{ gap: sizeConfig.gap }}>
        <DigitBox value={String(h).padStart(2, '0')} label="HRS" digitColor={digitColor} sizeConfig={sizeConfig} />
        <Colon sizeConfig={sizeConfig} />
        <DigitBox value={String(m).padStart(2, '0')} label="MIN" digitColor={digitColor} sizeConfig={sizeConfig} />
        <Colon sizeConfig={sizeConfig} />
        <DigitBox value={String(s).padStart(2, '0')} label="SEC" digitColor={digitColor} sizeConfig={sizeConfig} />
      </div>
    </div>
  )
}
