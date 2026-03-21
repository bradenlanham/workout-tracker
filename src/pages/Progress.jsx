import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { BB_WORKOUT_NAMES } from '../data/exercises'

const axisStyle = { fill: '#9CA3AF', fontSize: 11 }

// ── Session Volume Chart ────────────────────────────────────────────────────────

function BbCharts({ sessions, settings }) {
  const theme = getTheme(settings.accentColor)
  const isDaylight = settings.backgroundTheme === 'daylight'

  const tooltipStyle = {
    backgroundColor: isDaylight ? '#ffffff' : '#1F2937',
    border: `1px solid ${isDaylight ? '#d0d0d0' : '#374151'}`,
    borderRadius: '12px',
    color: isDaylight ? '#1a1a1a' : '#F9FAFB',
    fontSize: '13px',
  }

  const chartAxisStyle = { fill: isDaylight ? '#777777' : '#9CA3AF', fontSize: 11 }
  const gridStroke = isDaylight ? '#e0e0e0' : '#374151'

  const bbSessions = useMemo(() =>
    sessions.filter(s => s.mode === 'bb').sort((a, b) => new Date(a.date) - new Date(b.date)),
    [sessions]
  )

  const volumeData = useMemo(() => bbSessions.slice(-15).map(s => {
    const volume = s.data?.exercises?.reduce((t, ex) =>
      t + ex.sets.reduce((tt, st) => tt + (st.reps || 0) * (st.weight || 0), 0), 0) || 0
    return {
      date:   new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      type:   BB_WORKOUT_NAMES[s.type]?.split(' — ')[0] || s.type,
      volume: Math.round(volume),
    }
  }), [bbSessions])

  return (
    <div className="bg-card rounded-2xl p-4">
      <p className="text-sm font-semibold text-c-secondary mb-0.5">Session Volume</p>
      <p className="text-xs text-c-muted mb-3">Last 15 sessions</p>
      {volumeData.length < 2 ? (
        <div className="flex items-center justify-center h-40 text-c-faint text-sm">
          Not enough data yet
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={chartAxisStyle} />
              <YAxis tick={chartAxisStyle} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, _, p) => [`${v.toLocaleString()} lbs`, p.payload.type]}
              />
              <Bar dataKey="volume" fill={theme.hex} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Main Progress ──────────────────────────────────────────────────────────────

export default function Progress() {
  const { sessions, settings } = useStore()

  return (
    <div className="pb-10 min-h-screen">
      <div className="sticky top-0 bg-base z-30 px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold mb-4">Progress</h1>
      </div>
      <div className="px-4">
        <BbCharts sessions={sessions} settings={settings} />
      </div>
    </div>
  )
}
