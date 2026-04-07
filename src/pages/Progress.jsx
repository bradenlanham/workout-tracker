import { useMemo } from 'react'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getWorkoutStreak } from '../utils/helpers'

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

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  return (s.data?.exercises || []).reduce((t, ex) =>
    t + ex.sets.reduce((st, set) => st + (set.reps || 0) * (set.weight || 0), 0), 0)
}

function sessionSetCount(s) {
  return (s.data?.exercises || []).reduce((t, ex) => t + ex.sets.length, 0)
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

function StatCard({ children }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '14px 14px 12px' }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// Visual 1 — Weekly Training Load
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyLoadChart({ sessions, splits, accentHex }) {
  const bbSessions = sessions.filter(s => s.mode === 'bb')
  const weeks = [0, 1, 2].map(ago => ({ ago, bounds: getWeekBounds(ago) }))
  const weekSessions = weeks.map(w =>
    bbSessions.filter(s => { const d = s.date.split('T')[0]; return d >= w.bounds.start && d <= w.bounds.end })
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

// ─────────────────────────────────────────────────────────────────────────────
// Visual 2 — Time in the Gym (duration trend)
// ─────────────────────────────────────────────────────────────────────────────

function DurationChart({ sessions, accentHex }) {
  const sorted = [...sessions]
    .filter(s => s.mode === 'bb' && (s.duration || 0) > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-14)

  if (sorted.length < 2) return <Empty msg="Log more sessions to see duration trends" />

  const durs = sorted.map(s => s.duration || 0)
  const maxDur = Math.max(...durs, 1)
  const yTop = Math.ceil(maxDur / 15) * 15

  const rollingAvg = durs.map((_, i) => {
    const slice = durs.slice(Math.max(0, i - 6), i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })

  const W = 340, H = 175
  const PL = 38, PR = 8, PT = 10, PB = 30
  const plotW = W - PL - PR, plotH = H - PT - PB
  const n = durs.length
  const barW = Math.max(8, plotW / n - 3)
  const toX = i => PL + (i + 0.5) * (plotW / n)
  const toY = v => PT + plotH * (1 - Math.min(v, yTop) / yTop)

  const avgPath = rollingAvg.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  const yTicks = [0, yTop * 0.5, yTop].map(v => ({ val: v, y: toY(v) }))

  function fmtDur(m) {
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ''}` : `${m}m`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="var(--border-subtle)" strokeWidth={0.6} />
          <text x={PL - 4} y={t.y + 3.5} textAnchor="end" fontSize={9} fill="var(--text-faint)">
            {Math.round(t.val)}m
          </text>
        </g>
      ))}
      {durs.map((d, i) => {
        const bh = Math.max(2, (d / yTop) * plotH)
        const x = toX(i) - barW / 2
        const y = toY(d)
        const isRecent = i >= n - 3
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} fill={accentHex} fillOpacity={0.65} rx={2} />
            {isRecent && (
              <text x={toX(i)} y={y - 3} textAnchor="middle" fontSize={7.5} fill="var(--text-secondary)">
                {fmtDur(d)}
              </text>
            )}
          </g>
        )
      })}
      <path d={avgPath} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeDasharray="4 2" />
      {sorted.map((s, i) => {
        const step = Math.max(1, Math.floor(n / 4))
        if (i % step !== 0) return null
        const d = new Date(s.date)
        return (
          <text key={i} x={toX(i)} y={H - 2} textAnchor="middle" fontSize={7.5} fill="var(--text-faint)">
            {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </text>
        )
      })}
      <g transform={`translate(${W - 86}, ${H - 20})`}>
        <line x1={0} y1={5} x2={12} y2={5} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={15} y={9} fontSize={8} fill="var(--text-faint)">7-session avg</text>
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual 3 — Muscle Group Balance Radar
// ─────────────────────────────────────────────────────────────────────────────

const RADAR_AXES = ['Push', 'Pull', 'Legs', 'Shoulders', 'Arms', 'Core']

function RadarChart({ sessions, accentHex }) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const vols = Object.fromEntries(RADAR_AXES.map(k => [k, 0]))
  sessions
    .filter(s => s.mode === 'bb' && new Date(s.date) >= cutoff)
    .forEach(s =>
      (s.data?.exercises || []).forEach(ex => {
        const g = getMuscleGroup(ex.name)
        if (g in vols) {
          vols[g] += ex.sets.reduce((t, set) => t + (set.reps || 0) * (set.weight || 0), 0)
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
// Visual 4 — Personal Records Timeline
// ─────────────────────────────────────────────────────────────────────────────

const PR_COLORS = ['#4ADE80','#60A5FA','#F472B6','#FBBF24','#A78BFA','#FB923C']

function PRTimeline({ sessions, accentHex }) {
  // Collect PRs, deduplicated to best per exercise per session date
  const prMap = {}
  sessions
    .filter(s => s.mode === 'bb')
    .forEach(s =>
      (s.data?.exercises || []).forEach(ex =>
        ex.sets.forEach(set => {
          if (set.isNewPR) {
            const key = `${ex.name}|${s.date.split('T')[0]}`
            if (!prMap[key] || (set.weight || 0) > prMap[key].weight) {
              prMap[key] = { exercise: ex.name, date: s.date.split('T')[0], weight: set.weight || 0, reps: set.reps || 0 }
            }
          }
        })
      )
    )
  const prEvents = Object.values(prMap)

  if (!prEvents.length) return <Empty msg="Log more sessions to see PRs here" />

  const freq = {}
  prEvents.forEach(e => { freq[e.exercise] = (freq[e.exercise] || 0) + 1 })
  const topExes = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n)
  const filtered = prEvents.filter(e => topExes.includes(e.exercise)).sort((a, b) => a.date.localeCompare(b.date))

  const dates = filtered.map(e => e.date)
  const minDate = new Date(dates[0])
  const maxDate = new Date(dates[dates.length - 1])
  const rangeMs = Math.max(maxDate - minDate, 86400000 * 14)

  const W = 340
  const PL = 90, PR = 12, PT = 8, PB = 16
  const plotW = W - PL - PR
  const rowH = 34
  const H = PT + topExes.length * rowH + PB

  const toX = dateStr => PL + ((new Date(dateStr) - minDate) / rangeMs) * plotW

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {topExes.map((ex, i) => {
        const y = PT + i * rowH + rowH / 2
        const short = ex.length > 14 ? ex.slice(0, 13) + '…' : ex
        const prs = filtered.filter(e => e.exercise === ex)
        const dotColor = PR_COLORS[i % PR_COLORS.length]
        return (
          <g key={ex}>
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize={8.5} fill="var(--text-muted)">{short}</text>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border-subtle)" strokeWidth={0.5} strokeDasharray="3 3" />
            {prs.map((pr, j) => (
              <g key={j}>
                <circle cx={toX(pr.date)} cy={y} r={7} fill={dotColor} fillOpacity={0.88} />
                <text x={toX(pr.date)} y={y + 3.5} textAnchor="middle" fontSize={6.5} fill="white" fontWeight={700}>
                  {pr.weight > 0 ? pr.weight : '✓'}
                </text>
              </g>
            ))}
          </g>
        )
      })}
      {/* Date axis at bottom */}
      <text x={PL} y={H - 1} fontSize={7.5} fill="var(--text-faint)">
        {new Date(minDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
      </text>
      <text x={W - PR} y={H - 1} textAnchor="end" fontSize={7.5} fill="var(--text-faint)">
        {new Date(maxDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual 5 — Consistency Heatmap
// ─────────────────────────────────────────────────────────────────────────────

function ConsistencyHeatmap({ sessions, streak, accentHex }) {
  const byDate = {}
  sessions.filter(s => s.mode === 'bb').forEach(s => {
    const d = s.date.split('T')[0]
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

  const dayLabels = [null, 'M', null, 'W', null, 'F', null]
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

  // Best streak (simple consecutive days with sessions)
  let bestStreak = 0, cur = 0
  Object.keys(byDate).sort().forEach((d, i, arr) => {
    if (i === 0) { cur = 1; bestStreak = 1; return }
    const prev = new Date(arr[i - 1])
    const curr = new Date(d)
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) { cur++; if (cur > bestStreak) bestStreak = cur }
    else cur = 1
  })

  return (
    <div>
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
        <span style={{ color: 'var(--text-faint)' }}>{activeDays} active days (13 wks)</span>
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
  const { sessions, settings, splits, activeSplitId } = useStore()
  const theme = getTheme(settings.accentColor)
  const accentHex = theme.hex

  const activeSplit = splits.find(sp => sp.id === activeSplitId)
  const rotation = activeSplit?.rotation || []
  const streak = useMemo(() => getWorkoutStreak(sessions, rotation), [sessions, rotation])

  return (
    <div style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div className="sticky top-0 bg-base z-30 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}>
        <h1 className="text-2xl font-bold">Progress</h1>
      </div>
      <div className="px-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        <SectionLabel text="Weekly Training Load" />
        <StatCard>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
            Volume (sets × reps × weight) by workout type
          </p>
          <WeeklyLoadChart sessions={sessions} splits={splits} accentHex={accentHex} />
        </StatCard>

        <SectionLabel text="Time in the Gym" />
        <StatCard>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
            Session duration — last 14 sessions
          </p>
          <DurationChart sessions={sessions} accentHex={accentHex} />
        </StatCard>

        <SectionLabel text="Muscle Group Balance" />
        <StatCard>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
            Relative volume by muscle group — last 30 days
          </p>
          <RadarChart sessions={sessions} accentHex={accentHex} />
        </StatCard>

        <SectionLabel text="Personal Records Timeline" />
        <StatCard>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
            Top exercises by PR frequency — dot = new record (number = weight logged)
          </p>
          <PRTimeline sessions={sessions} accentHex={accentHex} />
        </StatCard>

        <SectionLabel text="Consistency" />
        <StatCard>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
            13-week training calendar — intensity reflects sets logged
          </p>
          <ConsistencyHeatmap sessions={sessions} streak={streak} accentHex={accentHex} />
        </StatCard>

      </div>
    </div>
  )
}
