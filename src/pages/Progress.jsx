import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getWeekKmTarget, secondsToMmSs } from '../utils/helpers'
import { BB_WORKOUT_NAMES } from '../data/exercises'

// ── Shared chart theme ─────────────────────────────────────────────────────────

const CHART_COLORS = {
  blue:   '#3B82F6',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
  purple: '#8B5CF6',
  gray:   '#6B7280',
}

const tooltipStyle = {
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: '12px',
  color: '#F9FAFB',
  fontSize: '13px',
}

const axisStyle = { fill: '#9CA3AF', fontSize: 11 }

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-4">
      <p className="text-sm font-semibold text-gray-300 mb-0.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {empty ? (
        <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
          Not enough data yet
        </div>
      ) : (
        <div className="h-48">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Grade → score mapping ──────────────────────────────────────────────────────

const GRADE_SCORE = { 'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 }

function gradeScoreToLabel(v) {
  if (v >= 4.5) return 'A+'
  if (v >= 3.5) return 'A'
  if (v >= 2.5) return 'B'
  if (v >= 1.5) return 'C'
  if (v > 0)    return 'D'
  return '—'
}

function gradeScoreToColor(v) {
  if (v >= 4.5) return '#8B5CF6'   // A+ — violet
  if (v >= 3.5) return '#10B981'   // A  — green
  if (v >= 2.5) return '#F59E0B'   // B  — amber
  if (v >= 1.5) return '#EF4444'   // C  — red
  if (v > 0)    return '#7F1D1D'   // D  — dark red
  return '#374151'
}

// ── HYROX Charts ───────────────────────────────────────────────────────────────

function HyroxCharts({ sessions, settings }) {
  const hyroxSessions = useMemo(() =>
    sessions.filter(s => s.mode === 'hyrox').sort((a, b) => new Date(a.date) - new Date(b.date)),
    [sessions]
  )

  const weeklyKmData = useMemo(() => {
    const weeks = {}
    const startDate = settings.hyroxStartDate ? new Date(settings.hyroxStartDate) : null
    hyroxSessions.forEach(s => {
      if (!startDate) return
      const diffDays   = Math.floor((new Date(s.date) - startDate) / (1000 * 60 * 60 * 24))
      const sessionWeek = Math.max(1, Math.floor(diffDays / 7) + 1)
      if (!weeks[sessionWeek]) weeks[sessionWeek] = { week: sessionWeek, km: 0 }
      const d = s.data || {}
      if (d.distance)         weeks[sessionWeek].km += parseFloat(d.distance)         || 0
      if (d.totalRunDistance) weeks[sessionWeek].km += parseFloat(d.totalRunDistance) || 0
    })
    return Object.values(weeks)
      .sort((a, b) => a.week - b.week)
      .map(w => ({ ...w, km: Math.round(w.km * 10) / 10, target: getWeekKmTarget(w.week), label: `Wk${w.week}` }))
  }, [hyroxSessions, settings.hyroxStartDate])

  const longRunData = useMemo(() => hyroxSessions
    .filter(s => s.type === 'long_run' && s.data?.distance)
    .map(s => ({
      date: new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      km:   parseFloat(s.data.distance),
    })), [hyroxSessions])

  const intervalData = useMemo(() => hyroxSessions
    .filter(s => s.type === 'intervals' && s.data?.repDistanceM === 1000 && s.data?.avgSplit)
    .map(s => {
      const [mm, ss] = s.data.avgSplit.split(':').map(Number)
      return {
        date:       new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        splitSec:   mm * 60 + (ss || 0),
        splitLabel: s.data.avgSplit,
      }
    }), [hyroxSessions])

  const timeTrialData = useMemo(() => hyroxSessions
    .filter(s => s.type === '5k_time_trial' && s.data?.time)
    .map(s => {
      const [mm, ss] = s.data.time.split(':').map(Number)
      return {
        date:    new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        seconds: mm * 60 + (ss || 0),
        label:   s.data.time,
      }
    }), [hyroxSessions])

  const CustomTooltipKm = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={tooltipStyle} className="p-3 rounded-xl">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-blue-400">{payload[0]?.value} km done</p>
        {payload[1] && <p className="text-gray-400">Target: {payload[1]?.value} km</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ChartCard title="Weekly Running KM" empty={weeklyKmData.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyKmData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltipKm />} />
            <Bar dataKey="km" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            <Line dataKey="target" stroke={CHART_COLORS.amber} strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Long Run Distance Trend" empty={longRunData.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={longRunData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} unit=" km" />
            <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} km`, 'Distance']} />
            <Line dataKey="km" stroke={CHART_COLORS.green} strokeWidth={2.5} dot={{ fill: CHART_COLORS.green, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="1km Interval Split Improvement" empty={intervalData.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={intervalData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={s => secondsToMmSs(s)} reversed />
            <Tooltip contentStyle={tooltipStyle} formatter={v => [secondsToMmSs(v), 'Split']} />
            <Line dataKey="splitSec" stroke={CHART_COLORS.amber} strokeWidth={2.5} dot={{ fill: CHART_COLORS.amber, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="5K Time Trial History" empty={timeTrialData.length < 1}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeTrialData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={s => secondsToMmSs(s)} reversed />
            <Tooltip contentStyle={tooltipStyle} formatter={v => [secondsToMmSs(v), '5K Time']} />
            <Line dataKey="seconds" stroke={CHART_COLORS.red} strokeWidth={2.5} dot={{ fill: CHART_COLORS.red, r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── BB Charts ──────────────────────────────────────────────────────────────────

function BbCharts({ sessions }) {
  const { settings } = useStore()
  const theme = getTheme(settings.accentColor)

  const bbSessions = useMemo(() =>
    sessions.filter(s => s.mode === 'bb').sort((a, b) => new Date(a.date) - new Date(b.date)),
    [sessions]
  )

  // ── Exercise history ────────────────────────────────────────────────────
  const allExercises = useMemo(() => {
    const names = new Set()
    bbSessions.forEach(s => s.data?.exercises?.forEach(ex => names.add(ex.name)))
    return [...names].sort()
  }, [bbSessions])

  const [selectedExercise, setSelectedExercise] = useState(allExercises[0] || '')

  const exerciseData = useMemo(() => {
    if (!selectedExercise) return []
    return bbSessions
      .filter(s => s.data?.exercises?.some(e => e.name === selectedExercise))
      .map(s => {
        const ex          = s.data.exercises.find(e => e.name === selectedExercise)
        const workingSets = ex?.sets.filter(st => st.type === 'working' && (st.weight || st.reps)) || []
        const maxWeight   = Math.max(...workingSets.map(st => st.weight || 0), 0)
        const maxReps     = workingSets.length > 0
          ? Math.max(...workingSets.filter(st => st.weight === maxWeight).map(st => st.reps || 0), 0)
          : 0
        return {
          date:   new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          weight: maxWeight || null,
          reps:   maxReps   || null,
        }
      })
      .filter(d => d.weight || d.reps)
  }, [bbSessions, selectedExercise])

  // ── Session volume ──────────────────────────────────────────────────────
  const volumeData = useMemo(() => bbSessions.slice(-15).map(s => {
    const volume = s.data?.exercises?.reduce((t, ex) =>
      t + ex.sets.reduce((tt, st) => tt + (st.reps || 0) * (st.weight || 0), 0), 0) || 0
    return {
      date:   new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      type:   BB_WORKOUT_NAMES[s.type]?.split(' — ')[0] || s.type,
      volume: Math.round(volume),
    }
  }), [bbSessions])

  // ── Intensity by day of week ────────────────────────────────────────────
  // Grade scores: D=1, C=2, B=3, A=4, A+=5
  // Ordered Mon → Sun
  const DOW_NAMES  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const DOW_INDEX  = [1, 2, 3, 4, 5, 6, 0]   // getDay() values for Mon…Sun

  const intensityDowData = useMemo(() => {
    return DOW_INDEX.map((dayIndex, i) => {
      const scores = bbSessions
        .filter(s => new Date(s.date).getDay() === dayIndex && s.grade && GRADE_SCORE[s.grade])
        .map(s => GRADE_SCORE[s.grade])
      const avg = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0
      return { day: DOW_NAMES[i], intensity: avg || null, sessions: scores.length }
    })
  }, [bbSessions])

  const hasIntensityData = intensityDowData.some(d => d.intensity)

  const CustomIntensityTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length || !payload[0].value) return null
    const val   = payload[0].value
    const grade = gradeScoreToLabel(val)
    const count = payload[0].payload.sessions
    return (
      <div style={tooltipStyle} className="p-3 rounded-xl">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-gray-200">{val.toFixed(1)} avg ≈ <span className="font-bold">{grade}</span></p>
        <p className="text-gray-500 text-xs mt-0.5">{count} session{count !== 1 ? 's' : ''}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Intensity by day of week */}
      <ChartCard
        title="Workout Intensity by Day of Week"
        subtitle="Average session grade per day (D=1 → A+=5)"
        empty={!hasIntensityData}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={intensityDowData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="day" tick={axisStyle} />
            <YAxis
              tick={axisStyle}
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tickFormatter={v => ({ 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'A+' }[v] || '')}
            />
            <Tooltip content={<CustomIntensityTooltip />} />
            <Bar dataKey="intensity" radius={[4, 4, 0, 0]}>
              {intensityDowData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.intensity ? gradeScoreToColor(entry.intensity) : '#374151'}
                  fillOpacity={entry.intensity ? 0.9 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Exercise history */}
      <div className="bg-gray-800 rounded-2xl p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Exercise History</p>
        {allExercises.length === 0 ? (
          <p className="text-gray-600 text-sm">No exercises logged yet</p>
        ) : (
          <select
            value={selectedExercise}
            onChange={e => setSelectedExercise(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-base mb-4"
          >
            {allExercises.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}

        {selectedExercise && exerciseData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exerciseData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={axisStyle} />
                <YAxis yAxisId="weight" tick={axisStyle} />
                <YAxis yAxisId="reps" orientation="right" tick={axisStyle} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [name === 'weight' ? `${v} lbs` : `${v} reps`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                <Line yAxisId="weight" dataKey="weight" stroke={CHART_COLORS.blue}  strokeWidth={2.5} dot={{ fill: CHART_COLORS.blue,  r: 4 }} name="weight" connectNulls />
                <Line yAxisId="reps"   dataKey="reps"   stroke={CHART_COLORS.green} strokeWidth={2}   dot={{ fill: CHART_COLORS.green, r: 3 }} name="reps"   connectNulls strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {selectedExercise && exerciseData.length < 2 && allExercises.length > 0 && (
          <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
            Log more sessions to see trends
          </div>
        )}
      </div>

      {/* Session volume */}
      <ChartCard title="Session Volume (last 15 sessions)" empty={volumeData.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volumeData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, _, p) => [`${v.toLocaleString()} lbs`, p.payload.type]}
            />
            <Bar dataKey="volume" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  )
}

// ── Main Progress ──────────────────────────────────────────────────────────────

export default function Progress() {
  const { sessions, settings } = useStore()
  const theme = getTheme(settings.accentColor)
  const [tab, setTab] = useState('bb')

  return (
    <div className="pb-10 min-h-screen">
      <div className="sticky top-0 bg-gray-900 z-30 px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold mb-4">Progress</h1>
        <div className="flex bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setTab('bb')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              tab === 'bb' ? `${theme.bg} text-white` : 'text-gray-400'
            }`}
          >
            🏋️ Bodybuilding
          </button>
          <button
            onClick={() => setTab('hyrox')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              tab === 'hyrox' ? `${theme.bg} text-white` : 'text-gray-400'
            }`}
          >
            🏃 HYROX
          </button>
        </div>
      </div>

      <div className="px-4">
        {tab === 'bb' ? (
          <BbCharts sessions={sessions} />
        ) : (
          <HyroxCharts sessions={sessions} settings={settings} />
        )}
      </div>
    </div>
  )
}
