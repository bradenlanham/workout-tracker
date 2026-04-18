// Sanity check for Batch 16n readiness integration.
// Runs recommendNextLoad against realistic Pec Dec history from debug-backup.json
// across the three readiness bands to confirm aggressivenessMultiplier + goal
// mapping flow end-to-end.
//
//   node readiness-sanity.mjs

import { readFileSync } from 'node:fs'
import {
  recommendNextLoad,
  getExerciseHistory,
  buildReadiness,
  readinessMultiplier,
  READINESS_GOAL_TO_MODE,
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

// Pec Dec — one of the §5 high-confidence-ready exercises.
const pecDec = library.find(e => /pec dec/i.test(e.name))
if (!pecDec) throw new Error('pec dec not in library')

const history = getExerciseHistory(sessions, pecDec.id, pecDec.name)
const last = history[history.length - 1]
console.log('━━━ Pec Dec history ━━━')
console.log(`n=${history.length}, last=${last.weight}×${last.reps} on ${last.date.slice(0, 10)}`)
console.log('')

// ── Readiness band behavior ────────────────────────────────────────────────
const bands = [
  { label: 'low energy + poor sleep', energy: 'low',  sleep: 'poor', goal: 'push' },
  { label: 'ok/ok (default)',         energy: 'ok',   sleep: 'ok',   goal: 'push' },
  { label: 'high energy + good sleep',energy: 'high', sleep: 'good', goal: 'push' },
]

console.log('━━━ Push mode across readiness bands (same history, same goal) ━━━')
for (const b of bands) {
  const r = buildReadiness({ energy: b.energy, sleep: b.sleep, goal: b.goal })
  const rec = recommendNextLoad({
    history, targetReps: 10, mode: 'push',
    progressionClass: pecDec.progressionClass || 'isolation',
    loadIncrement: pecDec.loadIncrement || 5,
    aggressivenessMultiplier: r.aggressivenessMultiplier,
  })
  console.log(`  ${b.label.padEnd(34)} mult=${r.aggressivenessMultiplier.toFixed(2)}  → ${rec.prescription.weight}×${rec.prescription.reps}  nudge=${rec.meta.thisSessionNudgePct.toFixed(2)}%`)
}
console.log('')

// ── Goal → mode mapping ───────────────────────────────────────────────────
console.log('━━━ Goal → mode (ok/ok energy+sleep) ━━━')
for (const goal of ['recover', 'match', 'push']) {
  const r = buildReadiness({ energy: 'ok', sleep: 'ok', goal })
  const rec = recommendNextLoad({
    history, targetReps: 10, mode: r.suggestedMode,
    progressionClass: pecDec.progressionClass || 'isolation',
    loadIncrement: pecDec.loadIncrement || 5,
    aggressivenessMultiplier: r.aggressivenessMultiplier,
  })
  console.log(`  goal=${goal.padEnd(9)} → mode=${r.suggestedMode.padEnd(9)} → ${rec.prescription.weight}×${rec.prescription.reps}  (${rec.reasoning.slice(0, 56)}...)`)
}
console.log('')

// ── Multiplier lookup table sanity ────────────────────────────────────────
console.log('━━━ readinessMultiplier() lookup ━━━')
const mults = [
  ['low',  'poor', 0.85],
  ['low',  'ok',   0.85],
  ['low',  'good', 1.00],
  ['ok',   'poor', 0.85],
  ['ok',   'ok',   1.00],
  ['ok',   'good', 1.15],
  ['high', 'poor', 1.00],
  ['high', 'ok',   1.15],
  ['high', 'good', 1.15],
]
let pass = 0, fail = 0
for (const [e, s, expected] of mults) {
  const got = readinessMultiplier(e, s)
  const ok = Math.abs(got - expected) < 0.001
  if (ok) pass++; else fail++
  console.log(`  ${e.padEnd(4)} + ${s.padEnd(4)} → ${got.toFixed(2)}  expected ${expected.toFixed(2)}  ${ok ? '✓' : '✗'}`)
}
console.log('')
console.log(`━━━ ${pass}/${pass + fail} multiplier lookups correct ━━━`)

// ── Goal → mode lookup table sanity ───────────────────────────────────────
const goalMode = [
  ['recover', 'deload'],
  ['match',   'maintain'],
  ['push',    'push'],
]
let gpass = 0, gfail = 0
for (const [goal, expected] of goalMode) {
  const got = READINESS_GOAL_TO_MODE[goal]
  const ok = got === expected
  if (ok) gpass++; else gfail++
  console.log(`  goal '${goal}' → mode '${got}'  expected '${expected}'  ${ok ? '✓' : '✗'}`)
}
console.log(`━━━ ${gpass}/${gpass + gfail} goal→mode mappings correct ━━━`)
