// Sanity check for Batch 16o fatigue signals.
// Confirms each signal moves the push-mode prescription the expected direction
// and by the expected order of magnitude. Run: node fatigue-sanity.mjs

import { readFileSync } from 'node:fs'
import {
  recommendNextLoad,
  getExerciseHistory,
  buildFatigueSignals,
  gradeMultiplier,
  cardioDamping,
  gapAdjustment,
  migrateSessionsToV2,
  migrateSessionsToV3,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY } from './src/data/exerciseLibrary.js'

function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') }
function buildBuiltInLibrary() {
  return EXERCISE_LIBRARY.map(raw => ({
    id: `ex_${slugify(raw.name)}`,
    name: raw.name, aliases: [],
    primaryMuscles: [raw.muscleGroup], equipment: raw.equipment,
    isBuiltIn: true, defaultUnilateral: false, loadIncrement: 5,
    defaultRepRange: [8, 12],
    progressionClass: raw.muscleGroup === 'Full Body' ? 'compound' : raw.equipment === 'Bodyweight' ? 'bodyweight' : 'isolation',
    needsTagging: false, createdAt: '2026-04-17',
  }))
}

const backup = JSON.parse(readFileSync(new URL('../../../debug-backup.json', import.meta.url)))
const v2 = migrateSessionsToV2(backup.sessions || [])
const { sessions, library } = migrateSessionsToV3({ sessions: v2, library: buildBuiltInLibrary() })
const pecDec = library.find(e => /pec dec/i.test(e.name))
const history = getExerciseHistory(sessions, pecDec.id, pecDec.name)
const last = history[history.length - 1]
const baseOpts = {
  history, targetReps: 10, mode: 'push',
  progressionClass: pecDec.progressionClass || 'isolation',
  loadIncrement: pecDec.loadIncrement || 5,
}

console.log(`━━━ Pec Dec baseline (no fatigue signals) ━━━`)
const baseline = recommendNextLoad(baseOpts)
console.log(`  last=${last.weight}×${last.reps}, e1RM=${baseline.meta.currentE1RM}, prescription=${baseline.prescription.weight}×${baseline.prescription.reps}`)
console.log('')

// ── Grade multiplier sanity ──────────────────────────────────────────────
console.log('━━━ Grade multiplier ━━━')
for (const [grade, expected] of [['A+', 1.10], ['A', 1.05], ['B', 1.00], ['C', 0.95], ['D', 0.90], [null, 1.00]]) {
  const got = gradeMultiplier(grade)
  const pass = Math.abs(got - expected) < 0.001
  console.log(`  ${String(grade).padEnd(4)} → ${got.toFixed(2)} expected ${expected.toFixed(2)} ${pass ? '✓' : '✗'}`)
}
console.log('')

// ── Cardio damping: only 'allout' within 24h ─────────────────────────────
console.log('━━━ Cardio damping (only "allout" within 24h) ━━━')
const cardioCases = [
  [null, 1.00, 'no cardio'],
  [{ intensity: 'easy', hoursAgo: 2 }, 1.00, 'easy 2h ago'],
  [{ intensity: 'moderate', hoursAgo: 2 }, 1.00, 'moderate 2h ago'],
  [{ intensity: 'hard', hoursAgo: 2 }, 1.00, 'hard 2h ago (no effect per user)'],
  [{ intensity: 'allout', hoursAgo: 2 }, 0.98, 'allout 2h ago'],
  [{ intensity: 'allout', hoursAgo: 30 }, 1.00, 'allout 30h ago (>24h, no effect)'],
]
for (const [c, expected, label] of cardioCases) {
  const got = cardioDamping(c)
  const pass = Math.abs(got - expected) < 0.001
  console.log(`  ${label.padEnd(40)} → ${got.toFixed(2)}  expected ${expected.toFixed(2)} ${pass ? '✓' : '✗'}`)
}
console.log('')

// ── Gap adjustment ────────────────────────────────────────────────────────
console.log('━━━ Gap adjustment ━━━')
for (const [d, expectedMult, expectedCap] of [[0, 1.00, Infinity], [7, 1.00, Infinity], [11, 0.95, 2], [14, 0.95, 2], [15, 0.85, 2], [30, 0.85, 2]]) {
  const got = gapAdjustment(d)
  const pass = Math.abs(got.mult - expectedMult) < 0.001 && got.alphaCap === expectedCap
  console.log(`  daysSince=${String(d).padEnd(3)} → mult=${got.mult.toFixed(2)} cap=${got.alphaCap}  expected ${expectedMult.toFixed(2)}/${expectedCap} ${pass ? '✓' : '✗'}`)
}
console.log('')

// ── End-to-end signal effects on Pec Dec recommendation ──────────────────
console.log(`━━━ End-to-end: push-mode prescription vs baseline (${baseline.prescription.weight}) ━━━`)
const scenarios = [
  { label: 'D-grade last session',       signals: { priorGrade: 'D' } },
  { label: 'A+ last session',            signals: { priorGrade: 'A+' } },
  { label: 'All-out cardio 2h ago',      signals: { cardioRecent: { intensity: 'allout', hoursAgo: 2 } } },
  { label: 'Rested yesterday',           signals: { restedYesterday: true } },
  { label: 'A+ AND rest day',            signals: { priorGrade: 'A+', restedYesterday: true } },
  { label: 'D grade AND all-out cardio', signals: { priorGrade: 'D', cardioRecent: { intensity: 'allout', hoursAgo: 6 } } },
]
for (const { label, signals } of scenarios) {
  const r = recommendNextLoad({ ...baseOpts, fatigueSignals: signals })
  const delta = r.prescription.weight - baseline.prescription.weight
  const sign = delta === 0 ? '=' : (delta > 0 ? '+' : '')
  console.log(`  ${label.padEnd(30)} → ${r.prescription.weight}×${r.prescription.reps} (${sign}${delta}) | ${r.reasoning.slice(0, 90)}`)
}
console.log('')

// ── Uncapped test: synthetic slow-progression history so multipliers bite ──
// Pec Dec hits the 3% weekly cap (rate=+7%/wk), making multipliers invisible
// in the prescription. A 1%/wk trend lets the math flow through.
console.log('━━━ Slow-progression scenario (synthetic +1%/wk) ━━━')
// Build 6 synthetic sessions with slow linear growth, 7 days apart, last = 150×10.
const slowHistory = []
const todayMs = Date.now()
for (let i = 5; i >= 0; i--) {
  const daysAgo = i * 7
  const w = Math.round(150 - i * 1.5)
  const r = 10
  slowHistory.push({
    date: new Date(todayMs - daysAgo * 86400000).toISOString(),
    weight: w, reps: r, e1RM: w * (1 + r / 30), rpe: null,
  })
}
const slowOpts = { history: slowHistory, targetReps: 10, mode: 'push', progressionClass: 'isolation', loadIncrement: 5 }
// Advance history time so daysSince ~= 7 (new session due). Use a future now so alpha=1.
const futureNow = todayMs + 7 * 86400000
const baselineSlow = recommendNextLoad({ ...slowOpts, now: futureNow })
console.log(`  baseline:     ${baselineSlow.prescription.weight}×${baselineSlow.prescription.reps}  nudge=${baselineSlow.meta.thisSessionNudgePct.toFixed(2)}%  floor=${baselineSlow.meta.layer2Weight}`)
for (const { label, signals } of [
  { label: 'D grade',                  signals: { priorGrade: 'D' } },
  { label: 'A+ grade',                 signals: { priorGrade: 'A+' } },
  { label: 'All-out cardio 2h ago',    signals: { cardioRecent: { intensity: 'allout', hoursAgo: 2 } } },
  { label: 'Rested yesterday',         signals: { restedYesterday: true } },
]) {
  const r = recommendNextLoad({ ...slowOpts, fatigueSignals: signals, now: futureNow })
  const delta = r.prescription.weight - baselineSlow.prescription.weight
  const sign = delta === 0 ? '=' : (delta > 0 ? '+' : '')
  console.log(`  ${label.padEnd(24)} ${r.prescription.weight}×${r.prescription.reps} (${sign}${delta})  nudge=${r.meta.thisSessionNudgePct.toFixed(2)}%`)
}
console.log('')

// ── Long gap test: force alpha cap + gap multiplier to bite ──────────────
console.log('━━━ Long-gap scenario (21 days since last session) ━━━')
const gapNow = todayMs + 21 * 86400000
const gapResult = recommendNextLoad({ ...slowOpts, now: gapNow })
console.log(`  21-day gap:   ${gapResult.prescription.weight}×${gapResult.prescription.reps}  daysSince=${gapResult.meta.daysSince}  | ${gapResult.reasoning.slice(0, 100)}`)
console.log('')

// ── buildFatigueSignals from raw slices ──────────────────────────────────
console.log('━━━ buildFatigueSignals end-to-end ━━━')
const now = Date.now()
const built = buildFatigueSignals({
  sessions: [{ mode: 'bb', date: new Date(now - 22 * 3600000).toISOString(), grade: 'A' }],
  cardioSessions: [{ createdAt: new Date(now - 4 * 3600000).toISOString(), intensity: 'allout' }],
  restDaySessions: [{ date: new Date(now - 28 * 3600000).toISOString() }],
  now,
})
console.log(`  priorGrade=${built.priorGrade} (expected 'A')`)
console.log(`  cardioRecent.intensity=${built.cardioRecent?.intensity} hoursAgo=${built.cardioRecent?.hoursAgo?.toFixed(1)} (expected 'allout', ~4h)`)
console.log(`  restedYesterday=${built.restedYesterday} (expected true)`)
console.log('')

console.log('━━━ done ━━━')
