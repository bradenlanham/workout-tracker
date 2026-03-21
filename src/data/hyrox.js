export const HYROX_STATIONS = [
  { id: 'ski_erg', name: 'Ski Erg', unit: 'm' },
  { id: 'sled_push', name: 'Sled Push', unit: 'm' },
  { id: 'sled_pull', name: 'Sled Pull', unit: 'm' },
  { id: 'burpee_broad_jumps', name: 'Burpee Broad Jumps', unit: 'reps' },
  { id: 'row', name: 'Row', unit: 'm' },
  { id: 'farmers_carry', name: "Farmer's Carry", unit: 'm' },
  { id: 'sandbag_lunges', name: 'Sandbag Lunges', unit: 'm' },
  { id: 'wall_balls', name: 'Wall Balls', unit: 'reps' },
]

// Day of week → session type (0=Sun, 1=Mon, ..., 6=Sat)
export const WEEKLY_SCHEDULE = {
  1: { type: 'long_run', name: 'Long Run', day: 'Monday' },
  2: { type: 'station_skills', name: 'Station Skills / Endurance', day: 'Tuesday' },
  3: { type: 'intervals', name: 'Intervals / Tempo Run', day: 'Wednesday' },
  4: { type: 'sled_strength', name: 'Sled + Strength', day: 'Thursday' },
  5: { type: 'combo', name: 'Combo Session', day: 'Friday' },
  6: { type: 'steady_run', name: 'Steady Run', day: 'Saturday' },
  0: { type: 'rest', name: 'Rest Day', day: 'Sunday' },
}

export const HYROX_PHASES = [
  { startWeek: 1, endWeek: 4, name: 'Base Building', kmTarget: 22, color: '#10B981' },
  { startWeek: 5, endWeek: 8, name: 'Aerobic Development', kmTarget: 32, color: '#3B82F6' },
  { startWeek: 9, endWeek: 13, name: 'Race Specificity', kmTarget: 38, color: '#F59E0B' },
  { startWeek: 14, endWeek: 16, name: 'Taper', kmTarget: 20, color: '#EF4444' },
]

export const SESSION_TYPE_INFO = {
  long_run: { name: 'Long Run', category: 'run', emoji: '🏃', color: '#10B981' },
  steady_run: { name: 'Steady Run', category: 'run', emoji: '🏃', color: '#6EE7B7' },
  tempo_run: { name: 'Tempo Run', category: 'run', emoji: '⚡', color: '#F59E0B' },
  '5k_time_trial': { name: '5K Time Trial', category: 'run', emoji: '🏆', color: '#EF4444' },
  intervals: { name: 'Intervals', category: 'intervals', emoji: '🔥', color: '#F97316' },
  station_skills: { name: 'Station Skills', category: 'station', emoji: '🎯', color: '#8B5CF6' },
  station_endurance: { name: 'Station Endurance', category: 'station', emoji: '💪', color: '#7C3AED' },
  sled_strength: { name: 'Sled + Strength', category: 'sled_strength', emoji: '🛷', color: '#EC4899' },
  combo: { name: 'Combo Session', category: 'combo', emoji: '🔄', color: '#06B6D4' },
}

export const ALL_SESSION_TYPES = Object.entries(SESSION_TYPE_INFO).map(([id, info]) => ({
  id,
  ...info,
}))
