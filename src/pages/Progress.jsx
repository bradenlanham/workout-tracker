import { useMemo, useState } from 'react'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import {
  getWorkoutStreak,
  getBestStreak,
  toLocalDateStr,
  buildMonthlyCoachingSummary,
  buildStrengthTileData,
  buildVolumeTileData,
  buildAchievementsData,
} from '../utils/helpers'
import ExerciseHistorySheet from '../components/ExerciseHistorySheet'
import VolumeDrillSheet from '../components/VolumeDrillSheet'

// ── Muscle group mapping ──────────────────────────────────────────────────────

function getMuscleGroup(name) {
  const n = name.toLowerCase()
  if (n.includes('tricep') || (n.includes('extension') && !n.includes('pulldown') && !n.includes('lat'))) return 'Arms'
  if (n.includes('curl') || n.includes('bicep')) return 'Arms'
  if (n.includes('delt') || n.includes('lateral raise') || n.includes('military') ||
      n.includes('shoulder') || (n.includes('overhead') && n.includes('press'))) return 'Shoulders'
  if (n.includes('row') || n.includes('pulldown') || n.includes('pull-up') ||
      n.includes('pullup') || n.includes('straight arm') || n.includes('deadlift')) return 'Pull'
  if (n.includes('squat') || n.includes('leg ') || n.includes(' leg') || n.includes('lunge') ||
      n.includes('calf') || n.includes('adduct') || n.includes('glute') ||
      n.includes('hack') || n.includes('romanian')) return 'Legs'
  if (n.includes('plank') || n.includes('crunch') || n.includes('core') || n.includes('sit-up')) return 'Core'
  if (n.includes('press') || n.includes('bench') || n.includes('fly') || n.includes('pec') ||
      n.includes('chest') || n.includes('dip') || n.includes('cable fly')) return 'Push'
  return 'Push'
}

// ── Utility helpers ───────────────────────────────────────────────────────────

// Local wrapper — delegates to the shared toLocalDateStr helper so Progress
// groups sessions by the user's LOCAL date, not UTC (Batch 25 timezone-fix).
function toDateStr(d) {
  return toLocalDateStr(d)
}

function getWeekBounds(weeksAgo) {
  const today = new Date()
  const dow = today.getDay()
  const toMon = dow === 0 ? -6 : 1 - dow
  const mon = new Date(today)
  mon.setDate(today.getDate() + toMon - weeksAgo * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: toDateStr(mon), end: toDateStr(sun) }
}

function sessionVolume(s) {
  // Batch 24 decision 2: walk primary + set.drops[] so bundled-shape volume
  // matches pre-bundling totals. For pre-v5 data, set.drops is undefined and
  // the inner reducer returns 0 (same number either way).
  return (s.data?.exercises || []).reduce((t, ex) =>
    t + ex.sets.reduce((st, set) => {
      const primary = (set.reps || 0) * (set.weight || 0)
      const drops = Array.isArray(set.drops)
        ? set.drops.reduce((d, dst) => d + (dst.reps || 0) * (dst.weight || 0), 0)
        : 0
      return st + primary + drops
    }, 0), 0)
}

function sessionSetCount(s) {
  // Batch 24 decision 1: working primaries only — warmups and nested drops
  // don't inflate the count.
  return (s.data?.exercises || []).reduce((t, ex) =>
    t + (ex.sets || []).filter(st => st.type === 'working').length, 0)
}

function getTypeName(type, splits) {
  for (const sp of splits) {
    const wkt = sp.workouts?.find(w => w.id === type)
    if (wkt) {
      const n = wkt.name || ''
      // "Push — Chest" → "Push", "Legs 1 — Quads" → "Legs 1"
      return n.split(' — ')[0]
    }
  }
  const built = { push: 'Push', legs1: 'Legs 1', pull: 'Pull', push2: 'Push 2', legs2: 'Legs 2' }
  return built[type] || type.slice(0, 8)
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

// Mirrors Dashboard.jsx hexToRgba for hero card gradient wash. The Dashboard
// uses this for its accent-tinted hero card; Progress's StatCard now matches
// the same visual language per user feedback "ideally, the cards could be
// rendered to match the same look and feel as the today home screen".
function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Resolve the surface color for accent-tinted gradients on cards. In daylight
// + light-accent (white / pale yellow / etc.) the user's accent disappears
// against the white card; fall back to a near-black tint so the card still
// has visible depth. Mirrors Dashboard's safeAccent / heroSurfaceColor pattern.
function resolveHeroSurface(theme, settings) {
  const isDark = settings?.backgroundTheme !== 'daylight'
  const hex = (theme?.hex || '#000000').replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const accentIsLight = (0.299 * r + 0.587 * g + 0.114 * b) > 160
  const lightBgWithLightAccent = !isDark && accentIsLight
  return lightBgWithLightAccent ? '#1A1A1A' : (theme?.hex || '#3B82F6')
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SectionLabel({ text }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.09em',
      marginBottom: 6, marginTop: 8,
    }}>{text}</p>
  )
}

// Batch 58 v2 follow-up — StatCard now mirrors Dashboard's hero card style
// (accent gradient wash + accent-tinted border + soft accent glow + inset
// highlight) per user feedback "ideally, the cards could be rendered to
// match the same look and feel as the today home screen".
//
// Daylight + light-accent fallback: gradients use `safeAccent` (#1A1A1A)
// so the card still reads as a layered surface when the user's accent is
// near-white. Same logic Dashboard.jsx uses (`heroSurfaceColor`).
function StatCard({ children, theme, settings }) {
  const heroAccent = resolveHeroSurface(theme, settings)
  return (
    <div style={{
      borderRadius: 24,
      padding: '20px 18px 18px',
      background: `linear-gradient(135deg, ${hexToRgba(heroAccent, 0.10)} 0%, ${hexToRgba(heroAccent, 0.02)} 70%), var(--bg-card)`,
      border: `1px solid ${hexToRgba(heroAccent, 0.18)}`,
      boxShadow: `0 4px 30px ${hexToRgba(heroAccent, 0.10)}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function Empty({ msg = 'Log more sessions to see data' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110, color: 'var(--text-faint)', fontSize: 13 }}>
      {msg}
    </div>
  )
}

// ── Batch 58: time-range picker + Volume tile + Achievements section ───────

const RANGE_OPTIONS = [
  { id: '1mo', label: '1mo', days: 30 },
  { id: '3mo', label: '3mo', days: 90 },
  { id: '6mo', label: '6mo', days: 180 },
  { id: 'all', label: 'All',  days: null },
]
const DEFAULT_RANGE = '3mo'

function rangeStartTs(rangeId, now = Date.now()) {
  const opt = RANGE_OPTIONS.find(r => r.id === rangeId)
  if (!opt || opt.days == null) return null
  return now - opt.days * 86400000
}
function prevRangeStartTs(rangeId, now = Date.now()) {
  const opt = RANGE_OPTIONS.find(r => r.id === rangeId)
  if (!opt || opt.days == null) return null
  return now - 2 * opt.days * 86400000
}
function rangeLabelFor(rangeId) {
  if (rangeId === '1mo') return 'Last month'
  if (rangeId === '3mo') return 'Last 3 months'
  if (rangeId === '6mo') return 'Last 6 months'
  return 'All sessions'
}

// Batch 58 v2 — Section tabs (Volume / Strength / Consistency / Achievements).
// Sits between the Coach card and the active tab's content. Selected tab uses
// a colored bottom-border underline; unselected uses muted text.
const PROGRESS_TABS = [
  { id: 'volume',       label: 'Volume' },
  { id: 'strength',     label: 'Strength' },
  { id: 'consistency',  label: 'Consistency' },
  { id: 'achievements', label: 'Achievements' },
]

function TabRow({ active, onChange, theme }) {
  return (
    <div
      role="tablist"
      aria-label="Progress sections"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--border-subtle)',
        marginTop: 4,
        marginBottom: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {PROGRESS_TABS.map(tab => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              padding: '10px 8px',
              background: 'transparent',
              border: 'none',
              borderBottom: selected ? `2px solid ${theme.hex}` : '2px solid transparent',
              color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1, // overlap with parent's border-bottom for clean underline
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function RangePicker({ range, onChange, theme }) {
  return (
    <div className="flex items-center gap-1.5 mt-2" role="tablist" aria-label="Time range">
      {RANGE_OPTIONS.map(opt => {
        const selected = opt.id === range
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold tabular-nums transition-colors"
            style={selected
              ? { background: theme.hex, color: theme.contrastText, borderColor: theme.hex }
              : { background: 'var(--bg-item)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function shortVolume(n) {
  const v = Number(n) || 0
  if (v >= 100000) return `${Math.round(v / 1000)}k`
  if (v >= 10000)  return `${(v / 1000).toFixed(1)}k`
  if (v >= 1000)   return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

// Tiny weekly-volume sparkline used inside the Volume tile primary view.
function VolumeSparkline({ series, accentColor }) {
  if (!Array.isArray(series) || series.length < 2) return null
  const W = 80, H = 24, padX = 2, padY = 3
  const values = series.map(p => p.volume || 0)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const spread = Math.max(1, maxV - minV)
  const yMin = minV - spread * 0.1
  const yMax = maxV + spread * 0.1
  const range = Math.max(1, yMax - yMin)
  const xFor = i => padX + (i / (series.length - 1)) * (W - 2 * padX)
  const yFor = v => H - padY - ((v - yMin) / range) * (H - 2 * padY)
  const points = series.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.volume || 0).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <polyline points={points} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function VolumeTile({ data, range, accentHex, onOpenDrill }) {
  const { totalVolume, deltaPct, weeklySeries, sessionCount } = data
  const rangeLabel = rangeLabelFor(range)
  const isAll = range === 'all'

  if (sessionCount === 0) {
    return <Empty msg="Log a few sessions to see volume trends" />
  }

  const deltaColor = deltaPct == null
    ? 'var(--text-muted)'
    : deltaPct >= 0
      ? '#10b981'
      : '#f59e0b'
  const deltaLabel = deltaPct == null
    ? null
    : `${deltaPct >= 0 ? '+' : ''}${deltaPct}% vs prior ${rangeLabel.toLowerCase().replace('last ', '')}`

  return (
    <button
      type="button"
      onClick={onOpenDrill}
      aria-label={`Open volume breakdown for ${rangeLabel}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {shortVolume(totalVolume)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          lb · {sessionCount} session{sessionCount === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        {deltaLabel && (
          <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor, fontVariantNumeric: 'tabular-nums' }}>
            {deltaLabel}
          </span>
        )}
        {!isAll && !deltaLabel && (
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            No prior data to compare
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <VolumeSparkline series={weeklySeries} accentColor={accentHex} />
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
        Tap to see breakdown →
      </div>
    </button>
  )
}

function AchievementsCard({ data }) {
  const { prsThisSplit, totalSessions, bestStreak, badges } = data
  const isEmpty = totalSessions === 0 && (badges?.length || 0) === 0

  if (isEmpty) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>
        Log your first session to start earning achievements.
      </div>
    )
  }

  return (
    <div>
      {/* Three stat tiles row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-item)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            PRs this split
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {prsThisSplit}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-item)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Total sessions
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {totalSessions}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-item)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Best streak
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {bestStreak}
          </div>
        </div>
      </div>

      {/* Badge grid */}
      {badges?.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {badges.map(b => (
            <div
              key={b.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '12px 8px',
                background: 'var(--bg-item)',
                borderRadius: 12,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">{b.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{b.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{b.sub}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '4px 0' }}>
          Keep training to unlock your first badge.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch 53 — Monthly Coaching Summary card
//
// Yellow HYROX-tinted card pinned at the top of /progress. Pure additive —
// existing stat tiles below are untouched. Hidden when the aggregator returns
// null (< 3 bb-mode sessions in the rolling 30-day window).
//
// Visual treatment matches Gains-Design-Mockups.html .coach-card spec exactly.
// Yellow #EAB308 is HYROX-fixed brand color; never themed by user accent.
// ─────────────────────────────────────────────────────────────────────────────

const COACH_BG       = 'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(0,0,0,0.4) 65%)'
const COACH_BORDER   = '1px solid rgba(234,179,8,0.18)'
const COACH_YELLOW   = '#EAB308'
const COACH_SUGGEST_BG     = 'rgba(0,0,0,0.35)'
const COACH_SUGGEST_BORDER = '1px solid rgba(234,179,8,0.25)'

// rangeId → windowDays for buildMonthlyCoachingSummary. Mirrors the picker
// chip mapping; null windowDays means "all time".
function rangeToWindowDays(rangeId) {
  const opt = RANGE_OPTIONS.find(r => r.id === rangeId)
  return opt && opt.days != null ? opt.days : null
}

function MonthlyCoachingCard({ sessions, cardioSessions, restDaySessions, splits, activeSplitId, range, collapsed, onToggleCollapse }) {
  // Picker-aware: window scopes to the user's active range (post-B58 user
  // feedback). Coach card recomputes when picker changes — was hardcoded
  // 30-day in B56, the mismatch with multi-window page felt disconnected.
  const windowDays = rangeToWindowDays(range)
  const summary = useMemo(
    () => buildMonthlyCoachingSummary({
      sessions, cardioSessions, restDaySessions, splits, activeSplitId, windowDays,
    }),
    [sessions, cardioSessions, restDaySessions, splits, activeSplitId, windowDays]
  )

  if (!summary) return null

  return (
    <div
      role="region"
      aria-label="Coaching summary"
      style={{
        marginTop: 4,
        marginBottom: 10,
        borderRadius: 22,
        padding: collapsed ? '14px 18px' : 18,
        background: COACH_BG,
        border: COACH_BORDER,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Toggle row — eyebrow on the left, chevron button on the right */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand coaching summary' : 'Collapse coaching summary'}
        aria-expanded={!collapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          padding: 0,
          marginBottom: collapsed ? 0 : 10,
          cursor: 'pointer',
        }}
      >
        <div style={{
          color: COACH_YELLOW,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>{summary.eyebrow}</div>
        <span style={{
          color: COACH_YELLOW,
          fontSize: 14,
          lineHeight: 1,
          opacity: 0.85,
        }} aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
      </button>

      {collapsed ? (
        // Collapsed state — show the headline alone, truncated. Tap the row
        // (or chevron) to expand. Lets users keep the coach voice within
        // reach without burning fold space on bullets + suggestion.
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: 4,
        }}>{summary.headline}</div>
      ) : (
        <>
          <div style={{
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
            marginBottom: summary.bullets.length > 0 ? 12 : 0,
            color: 'var(--text-primary)',
          }}>{summary.headline}</div>

          {summary.bullets.length > 0 && (
            <div>
              {summary.bullets.map((b, i) => (
                <div
                  key={i}
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    marginBottom: 6,
                    paddingLeft: 16,
                    position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    left: 6,
                    top: 0,
                    color: COACH_YELLOW,
                    fontWeight: 700,
                  }}>·</span>
                  {b}
                </div>
              ))}
            </div>
          )}

          {summary.suggestion && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: COACH_SUGGEST_BG,
              borderRadius: 12,
              border: COACH_SUGGEST_BORDER,
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}>
              {summary.suggestion.kind === 'warning' ? '⚠ ' : '💡 '}{summary.suggestion.text}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual 1 — Weekly Training Load
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyLoadChart({ sessions, splits, accentHex }) {
  const bbSessions = sessions.filter(s => s.mode === 'bb')
  const weeks = [0, 1, 2].map(ago => ({ ago, bounds: getWeekBounds(ago) }))
  const weekSessions = weeks.map(w =>
    bbSessions.filter(s => { const d = toLocalDateStr(s.date); return d >= w.bounds.start && d <= w.bounds.end })
  )
  const allTypes = [...new Set(weekSessions.flat().map(s => s.type))]
  if (!allTypes.length) return <Empty />

  const data = allTypes.map(type => ({
    name: getTypeName(type, splits),
    vols: weekSessions.map(ws => ws.filter(s => s.type === type).reduce((t, s) => t + sessionVolume(s), 0)),
  }))

  const maxVol = Math.max(...data.flatMap(d => d.vols), 1)
  const W = 340, H = 185
  const PL = 42, PR = 8, PT = 12, PB = 50
  const plotW = W - PL - PR, plotH = H - PT - PB
  const groupW = plotW / data.length
  const barW = Math.max(5, (groupW - 12) / 3)
  const weekColors = ['#4ADE80', '#60A5FA', '#F472B6']
  const weekLabels = ['This wk', 'Last wk', '2 wks ago']
  const yTicks = [0, 0.5, 1.0].map(f => ({ val: Math.round(f * maxVol), y: PT + plotH * (1 - f) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="var(--border-subtle)" strokeWidth={0.6} />
          <text x={PL - 4} y={t.y + 3.5} textAnchor="end" fontSize={9} fill="var(--text-faint)">
            {t.val >= 1000 ? `${(t.val / 1000).toFixed(1)}k` : t.val}
          </text>
        </g>
      ))}
      {data.map((d, di) => {
        const gx = PL + di * groupW + (groupW - barW * 3 - 4) / 2
        return (
          <g key={d.name}>
            {d.vols.map((vol, wi) => {
              const bh = Math.max(2, (vol / maxVol) * plotH)
              const x = gx + wi * (barW + 2)
              const y = PT + plotH - bh
              return <rect key={wi} x={x} y={y} width={barW} height={bh} fill={weekColors[wi]} rx={2} />
            })}
            <text x={PL + di * groupW + groupW / 2} y={PT + plotH + 13} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
              {d.name}
            </text>
          </g>
        )
      })}
      {weekLabels.map((lbl, i) => (
        <g key={i} transform={`translate(${PL + i * 98}, ${H - 15})`}>
          <rect width={9} height={9} fill={weekColors[i]} rx={2} />
          <text x={12} y={8.5} fontSize={9} fill="var(--text-muted)">{lbl}</text>
        </g>
      ))}
    </svg>
  )
}

// Batch 58 — DurationChart removed entirely. Time-in-gym is rarely actionable
// info; per Critique §2 the 5→3 tile reframing implicitly drops it.

// ─────────────────────────────────────────────────────────────────────────────
// Visual 3 — Muscle Group Balance Radar
// ─────────────────────────────────────────────────────────────────────────────

const RADAR_AXES = ['Push', 'Pull', 'Legs', 'Shoulders', 'Arms', 'Core']

function RadarChart({ sessions, accentHex, cutoffDate = null }) {
  // Batch 58 — accept an optional cutoffDate from the picker. Falls back to
  // the legacy 30-day default when not provided so any pre-B58 caller (e.g.
  // legacy tests or one-off scripts) still works.
  const cutoff = cutoffDate instanceof Date
    ? cutoffDate
    : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d })()

  const vols = Object.fromEntries(RADAR_AXES.map(k => [k, 0]))
  sessions
    .filter(s => s.mode === 'bb' && new Date(s.date) >= cutoff)
    .forEach(s =>
      (s.data?.exercises || []).forEach(ex => {
        const g = getMuscleGroup(ex.name)
        if (g in vols) {
          // Batch 24 decision 2: drops contribute to muscle-group volume.
          vols[g] += ex.sets.reduce((t, set) => {
            const primary = (set.reps || 0) * (set.weight || 0)
            const drops = Array.isArray(set.drops)
              ? set.drops.reduce((d, dst) => d + (dst.reps || 0) * (dst.weight || 0), 0)
              : 0
            return t + primary + drops
          }, 0)
        }
      })
    )

  const maxVol = Math.max(...Object.values(vols), 1)
  const norm = RADAR_AXES.map(k => vols[k] / maxVol)
  const hasData = norm.some(v => v > 0.01)

  const N = 6
  const CX = 100, CY = 105, R = 65
  const angles = RADAR_AXES.map((_, i) => ((i * 360) / N - 90) * (Math.PI / 180))
  const axPts = angles.map(a => ({ x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }))
  const gridLevels = [0.25, 0.5, 0.75, 1.0]

  const gridPolys = gridLevels.map(lv =>
    angles.map(a =>
      `${(CX + lv * R * Math.cos(a)).toFixed(1)},${(CY + lv * R * Math.sin(a)).toFixed(1)}`
    ).join(' ')
  )

  const dataPts = norm.map((v, i) => ({
    x: CX + v * R * Math.cos(angles[i]),
    y: CY + v * R * Math.sin(angles[i]),
  }))
  const dataPath = dataPts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(' ') + ' Z'

  const W = 340, H = 215

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {gridPolys.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--border-subtle)" strokeWidth={0.8} />
      ))}
      {axPts.map((p, i) => (
        <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--border-subtle)" strokeWidth={0.8} />
      ))}
      {hasData && (
        <>
          <path d={dataPath} fill={accentHex} fillOpacity={0.22} stroke={accentHex} strokeWidth={2} />
          {dataPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={accentHex} />
          ))}
        </>
      )}
      {RADAR_AXES.map((label, i) => {
        const lr = R + 18
        const lx = CX + lr * Math.cos(angles[i])
        const ly = CY + lr * Math.sin(angles[i])
        const anchor = lx < CX - 8 ? 'end' : lx > CX + 8 ? 'start' : 'middle'
        return (
          <text key={i} x={lx} y={ly + 4} textAnchor={anchor} fontSize={10} fontWeight={600} fill="var(--text-secondary)">
            {label}
          </text>
        )
      })}
      {/* Mini bar chart on right */}
      <g transform="translate(205, 26)">
        {RADAR_AXES.map((label, i) => {
          const barColors = ['#4ADE80','#60A5FA','#F472B6','#FBBF24','#A78BFA','#FB923C']
          const barColor = barColors[i % barColors.length]
          return (
            <g key={i} transform={`translate(0, ${i * 30})`}>
              <text x={0} y={9} fontSize={9.5} fill="var(--text-muted)">{label}</text>
              <rect x={0} y={13} width={82} height={5} rx={2} fill="var(--bg-item)" />
              <rect x={0} y={13} width={Math.max(2, norm[i] * 82)} height={5} rx={2} fill={barColor} />
              <text x={86} y={19} textAnchor="start" fontSize={8} fill="var(--text-faint)">
                {Math.round(norm[i] * 100)}%
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual 4 — Strength tile (Batch 57)
//
// Replaces the legacy PR Timeline. Per-exercise sparklines + tap-to-open
// bottom sheet. Sort: progression rate desc. Top 4 with `Show all (N) →`
// inline expansion. Hides cold-start (<2 sessions) entries — sparkline
// returns null below that threshold.
//
// Strength = weight-training only. HYROX rounds + running entries skip the
// tile per the type filter inside buildStrengthTileData.
// ─────────────────────────────────────────────────────────────────────────────

const STRENGTH_TOP_N = 4

function CompactSparkline({ history, accentColor = '#3b82f6' }) {
  if (!Array.isArray(history) || history.length < 2) return null
  const W = 60, H = 24, padX = 2, padY = 3
  const values = history.map(p => p.e1RM || 0)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const spread = Math.max(1, maxV - minV)
  const yMin = minV - spread * 0.1
  const yMax = maxV + spread * 0.1
  const range = Math.max(1, yMax - yMin)
  const xFor = i => padX + (i / (history.length - 1)) * (W - 2 * padX)
  const yFor = v => H - padY - ((v - yMin) / range) * (H - 2 * padY)
  const points = history.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.e1RM || 0).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <polyline points={points} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatRatePctShort(rate) {
  const pct = (Number(rate) || 0) * 100
  if (Math.abs(pct) < 0.1) return 'Flat'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function rateColor(rate) {
  const r = Number(rate) || 0
  if (r >= 0.005) return '#10b981'   // emerald-500
  if (r < 0)     return '#f59e0b'    // amber-500
  return 'var(--text-muted)'
}

function StrengthTile({ sessions, exerciseLibrary, accentHex, onOpenExercise }) {
  const [expanded, setExpanded] = useState(false)

  const data = useMemo(
    () => buildStrengthTileData({ sessions, exerciseLibrary }),
    [sessions, exerciseLibrary]
  )

  if (data.totalCount === 0) {
    return <Empty msg="Log a few sessions to see your strength trends here" />
  }

  const visible = expanded ? data.exercises : data.exercises.slice(0, STRENGTH_TOP_N)
  const hasMore = data.totalCount > STRENGTH_TOP_N

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map(ex => (
          <button
            key={ex.id}
            type="button"
            onClick={() => onOpenExercise(ex)}
            aria-label={`Open ${ex.name} history`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'transparent',
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <span style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {ex.name}
            </span>
            <CompactSparkline history={ex.history} accentColor={accentHex} />
            <span style={{
              fontSize: 11,
              color: rateColor(ex.rate),
              minWidth: 40,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}>
              {formatRatePctShort(ex.rate)}
            </span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            background: 'transparent',
            padding: '6px 0',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {expanded ? 'Show less ←' : `Show all ${data.totalCount} →`}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual 5 — Consistency Heatmap
// ─────────────────────────────────────────────────────────────────────────────

function ConsistencyHeatmap({ sessions, streak, bestStreak, accentHex }) {
  const byDate = {}
  sessions.filter(s => s.mode === 'bb').forEach(s => {
    // Batch 25 timezone-fix: heatmap groups by LOCAL date, not UTC.
    const d = toLocalDateStr(s.date)
    byDate[d] = (byDate[d] || 0) + sessionSetCount(s)
  })
  const maxSets = Math.max(...Object.values(byDate), 1)

  const today = new Date()
  const todayStr = toDateStr(today)
  const start = new Date(today)
  start.setDate(today.getDate() - 90 - today.getDay()) // back to Sunday 13 weeks ago

  const cells = []
  for (let i = 0; i < 91; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const ds = toDateStr(d)
    cells.push({ ds, sets: byDate[ds] || 0, future: ds > todayStr })
  }

  const cellSz = 14, gap = 2, step = cellSz + gap
  const weeks = 13
  const PL = 22, PT = 18
  const W = PL + weeks * step + 8
  const H = PT + 7 * step + 6

  // Batch 58 v2 — every day labeled per user feedback. Was M/W/F sparse;
  // user reported the missing labels made the grid hard to read.
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const monthLabels = []
  for (let w = 0; w < weeks; w++) {
    const d = new Date(start)
    d.setDate(start.getDate() + w * 7)
    if (w === 0 || d.getDate() <= 7) {
      monthLabels.push({ week: w, label: d.toLocaleDateString('en-GB', { month: 'short' }) })
    }
  }

  const { r, g, b } = hexToRgb(accentHex)
  const activeDays = cells.filter(c => !c.future && c.sets > 0).length

  // Batch 58 v2 — monthly session counts row per user feedback "I would
  // like to just quickly see how many sessions did I log last month? This
  // month?". Counts unique active calendar days in the current month and
  // the prior calendar month from the bb-mode session list.
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = now.getMonth()
  const thisMonthStart = new Date(yyyy, mm, 1).getTime()
  const lastMonthStart = new Date(yyyy, mm - 1, 1).getTime()
  const lastMonthEnd   = thisMonthStart - 1
  const thisMonthDays  = new Set()
  const lastMonthDays  = new Set()
  for (const s of sessions) {
    if (s?.mode !== 'bb') continue
    const t = new Date(s.date).getTime()
    if (!Number.isFinite(t)) continue
    const ds = toDateStr(s.date)
    if (t >= thisMonthStart) thisMonthDays.add(ds)
    else if (t >= lastMonthStart && t <= lastMonthEnd) lastMonthDays.add(ds)
  }
  const thisMonthCount = thisMonthDays.size
  const lastMonthCount = lastMonthDays.size
  const monthDelta     = thisMonthCount - lastMonthCount
  const thisMonthLabel = now.toLocaleDateString('en-US', { month: 'long' })
  const lastMonthLabel = new Date(yyyy, mm - 1, 1).toLocaleDateString('en-US', { month: 'long' })

  return (
    <div>
      {/* Monthly session counts — answers "how many sessions did I log
          this month vs last month?" without making the user count cells. */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--bg-item)',
          borderRadius: 12,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            This month
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {thisMonthCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              session{thisMonthCount === 1 ? '' : 's'} · {thisMonthLabel}
            </span>
          </div>
        </div>
        <div style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--bg-item)',
          borderRadius: 12,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Last month
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {lastMonthCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              session{lastMonthCount === 1 ? '' : 's'} · {lastMonthLabel}
            </span>
            {lastMonthCount > 0 && monthDelta !== 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: monthDelta > 0 ? '#10b981' : '#f59e0b',
                fontVariantNumeric: 'tabular-nums',
                marginLeft: 'auto',
              }}>
                {monthDelta > 0 ? '+' : ''}{monthDelta}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Last 13 weeks
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {dayLabels.map((lbl, i) => lbl && (
          <text key={i} x={PL - 4} y={PT + i * step + cellSz - 2} textAnchor="end" fontSize={7.5} fill="var(--text-faint)">
            {lbl}
          </text>
        ))}
        {monthLabels.map((m, i) => (
          <text key={i} x={PL + m.week * step} y={PT - 5} fontSize={7.5} fill="var(--text-faint)">
            {m.label}
          </text>
        ))}
        {cells.map((c, i) => {
          const week = Math.floor(i / 7)
          const dow = i % 7
          const x = PL + week * step
          const y = PT + dow * step
          let fill = 'var(--bg-item)'
          if (!c.future && c.sets > 0) {
            const opacity = 0.25 + (c.sets / maxSets) * 0.75
            fill = `rgba(${r},${g},${b},${opacity.toFixed(2)})`
          }
          return <rect key={i} x={x} y={y} width={cellSz} height={cellSz} rx={2.5} fill={fill} />
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>🔥 {streak}-day streak</span>
        <span style={{ color: 'var(--text-faint)' }}>Best: {bestStreak} days</span>
        <span style={{ color: 'var(--text-faint)' }}>{activeDays} active days in last 13 weeks</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', marginRight: 2 }}>Less</span>
        {[0.1, 0.35, 0.6, 0.85, 1.0].map((op, i) => (
          <div key={i} style={{
            width: 11, height: 11, borderRadius: 3,
            background: `rgba(${r},${g},${b},${op})`,
          }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 2 }}>More</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Progress page
// ─────────────────────────────────────────────────────────────────────────────

export default function Progress() {
  const { sessions, settings, splits, cardioSessions, restDaySessions, activeSplitId } = useStore()
  const exerciseLibrary = useStore(s => s.exerciseLibrary)
  const theme = getTheme(settings.accentColor)
  const accentHex = theme.hex

  const streak     = useMemo(() => getWorkoutStreak(sessions, cardioSessions, restDaySessions), [sessions, cardioSessions, restDaySessions])
  const bestStreak = useMemo(() => getBestStreak(sessions,    cardioSessions, restDaySessions), [sessions, cardioSessions, restDaySessions])

  // Batch 57 — strength drill-down sheet state.
  const [openExercise, setOpenExercise] = useState(null)
  // Batch 58 — picker + Volume drill state.
  const [range, setRange]               = useState(DEFAULT_RANGE)
  const [volumeOpen, setVolumeOpen]     = useState(false)
  // Batch 58 v2 — tab navigation per user feedback ("rather than everything
  // in one long horizontal view, you just see the thing you want to see").
  // Default to Volume — the broadest summary tile. Resets on each visit
  // (not localStorage-persistent — Progress is a destination, not a sticky
  // state).
  const [activeTab, setActiveTab] = useState('volume')
  // Coach card is collapsible per user feedback ("be collapsible"). Default
  // expanded; user choice persists for the visit only.
  const [coachCollapsed, setCoachCollapsed] = useState(false)

  // windowStartTs is null for 'all' (no filter).
  const windowStartTs     = useMemo(() => rangeStartTs(range), [range])
  const prevWindowStartTs = useMemo(() => prevRangeStartTs(range), [range])

  // Sessions filtered to the picker's window. Threaded into Volume + Strength
  // tiles. Consistency / Coaching / Achievements continue to read unfiltered
  // sessions because they own their own windowing semantics.
  const filteredSessions = useMemo(() => {
    if (windowStartTs == null) return sessions
    return sessions.filter(s => {
      const t = new Date(s?.date).getTime()
      return Number.isFinite(t) && t >= windowStartTs
    })
  }, [sessions, windowStartTs])

  const volumeData = useMemo(
    () => buildVolumeTileData({ sessions, windowStartTs, prevWindowStartTs }),
    [sessions, windowStartTs, prevWindowStartTs]
  )

  const achievementsData = useMemo(
    () => buildAchievementsData({ sessions, cardioSessions, restDaySessions, splits, activeSplitId }),
    [sessions, cardioSessions, restDaySessions, splits, activeSplitId]
  )

  // Cutoff Date object passed to RadarChart inside the Volume drill sheet.
  const radarCutoff = windowStartTs == null ? null : new Date(windowStartTs)

  // Workout-id → display name resolver for VolumeDrillSheet's per-type list.
  const resolveTypeName = (type) => getTypeName(type, splits)

  return (
    <div style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div className="sticky top-0 bg-base z-30 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}>
        <h1 className="text-2xl font-bold">Progress</h1>
        <RangePicker range={range} onChange={setRange} theme={theme} />
      </div>
      <div className="px-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Coach card pinned at top — applies to all tabs, picker-aware,
            collapsible per user feedback. */}
        <MonthlyCoachingCard
          sessions={sessions}
          cardioSessions={cardioSessions}
          restDaySessions={restDaySessions}
          splits={splits}
          activeSplitId={activeSplitId}
          range={range}
          collapsed={coachCollapsed}
          onToggleCollapse={() => setCoachCollapsed(c => !c)}
        />

        {/* Tab row — only one section visible at a time per user feedback
            "rather than everything being in one long horizontal view". */}
        <TabRow active={activeTab} onChange={setActiveTab} theme={theme} />

        {activeTab === 'volume' && (
          <StatCard theme={theme} settings={settings}>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
              Total weight moved · {rangeLabelFor(range).toLowerCase()}
            </p>
            <VolumeTile
              data={volumeData}
              range={range}
              accentHex={accentHex}
              onOpenDrill={() => setVolumeOpen(true)}
            />
          </StatCard>
        )}

        {activeTab === 'strength' && (
          <StatCard theme={theme} settings={settings}>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>
              Per-exercise e1RM trend — tap a row for full history
            </p>
            <StrengthTile
              sessions={filteredSessions}
              exerciseLibrary={exerciseLibrary}
              accentHex={accentHex}
              onOpenExercise={setOpenExercise}
            />
          </StatCard>
        )}

        {activeTab === 'consistency' && (
          <StatCard theme={theme} settings={settings}>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
              Sessions per month + 13-week heatmap
            </p>
            <ConsistencyHeatmap sessions={sessions} streak={streak} bestStreak={bestStreak} accentHex={accentHex} />
          </StatCard>
        )}

        {activeTab === 'achievements' && (
          <StatCard theme={theme} settings={settings}>
            <AchievementsCard data={achievementsData} />
          </StatCard>
        )}

      </div>

      <ExerciseHistorySheet
        open={openExercise != null}
        exercise={openExercise}
        sessions={sessions}
        accentColor={accentHex}
        onClose={() => setOpenExercise(null)}
      />

      <VolumeDrillSheet
        open={volumeOpen}
        rangeLabel={rangeLabelFor(range)}
        byWorkoutType={volumeData.byWorkoutType}
        weeklyLoadNode={<WeeklyLoadChart sessions={sessions} splits={splits} accentHex={accentHex} />}
        radarNode={<RadarChart sessions={sessions} accentHex={accentHex} cutoffDate={radarCutoff} />}
        resolveTypeName={resolveTypeName}
        onClose={() => setVolumeOpen(false)}
      />
    </div>
  )
}
