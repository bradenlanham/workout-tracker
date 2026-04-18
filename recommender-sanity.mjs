// Sanity check for the v1 recommender engine (Batch 16a). Runs the v2
// then v3 migration against debug-backup.json to get a properly
// canonicalized session list + library, then exercises
// recommendNextLoad + its helpers on the spec's "high-confidence ready"
// exercises (§5) plus a few more.
//
// Expected outcome, per spec §5: Pec Dec, Chest Supported Wide Row, Seated
// Cable Row, Plate Loaded Shoulder Press, Straight Arm Cable Pulldown,
// Single Arm Row, and Overhead DB Extension should have enough history
// (n ≥ 6) with strong fits (R² ≥ 0.9) to hit 'high' confidence. Incline DB
// Press / Squats / DB Lateral Raises should show 'moderate'.
//
// Run from the worktree root:  node recommender-sanity.mjs

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  e1RM,
  percent1RM,
  getExerciseHistory,
  getCurrentE1RM,
  getProgressionRate,
  getRecommendationConfidence,
  recommendNextLoad,
  migrateSessionsToV2,
  migrateSessionsToV3,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY as BUILT_IN_RAW } from './src/data/exerciseLibrary.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backup    = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../debug-backup.json'), 'utf-8'))

// ── Seed built-in library (mirrors buildBuiltInLibrary in useStore.js) ───
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const builtIn = BUILT_IN_RAW.map(r => ({
  id:                `ex_${slug(r.name)}`,
  name:              r.name,
  aliases:           [],
  primaryMuscles:    [r.muscleGroup],
  equipment:         r.equipment,
  isBuiltIn:         true,
  defaultUnilateral: false,
  loadIncrement:     5,
  defaultRepRange:   [8, 12],
  progressionClass:
    r.muscleGroup === 'Full Body' ? 'compound'
    : r.equipment === 'Bodyweight' ? 'bodyweight'
    : 'isolation',
  needsTagging:      false,
  createdAt:         '2026-04-17',
}))

// Migrate the backup so sessions have exerciseId on every LoggedExercise.
const v2   = migrateSessionsToV2(backup.sessions || [])
const { sessions: v3, library } = migrateSessionsToV3({ sessions: v2, library: builtIn })

console.log(`Loaded ${v3.length} sessions, ${library.length} library entries.\n`)

// ── §2.1 sanity: Epley + %1RM curve ──────────────────────────────────────
console.log('── Layer-1 Epley sanity ──')
console.log(`  e1RM(225, 5)  = ${e1RM(225, 5).toFixed(1)}  (expected ~262.5)`)
console.log(`  e1RM(185, 10) = ${e1RM(185, 10).toFixed(1)}  (expected ~246.7)`)
console.log(`  e1RM(100, 1)  = ${e1RM(100, 1).toFixed(1)}  (expected ~103.3)`)

console.log('\n── Layer-2 %1RM table ──')
for (const r of [3, 5, 6, 8, 10, 12, 15]) {
  console.log(`  target ${String(r).padStart(2)} reps → ${(percent1RM(r) * 100).toFixed(0)}%`)
}
console.log(`  target 9 reps → ${(percent1RM(9) * 100).toFixed(1)}% (interp between 8→78% and 10→73%)`)

// ── Per-exercise recommendation report ───────────────────────────────────
const spotChecks = [
  'Pec Dec',
  'Chest Supported Wide Row',
  'Seated Cable Row',
  'Plate Loaded Shoulder Press',
  'Straight Arm Cable Pulldown',
  'Single Arm Row',
  'Overhead DB Extension',
  'Incline DB Press',
  'Squats',
  'DB Lateral Raises',
  'Flat Bench Press',
]

console.log('\n── Per-exercise recommendation (push mode, now = 2026-04-17) ──\n')
const now = new Date('2026-04-17T12:00:00Z').getTime()

for (const name of spotChecks) {
  const entry = library.find(e => e.name === name || (e.aliases || []).includes(name))
  if (!entry) {
    console.log(`  ${name} — not in library, skipped`)
    continue
  }

  const history = getExerciseHistory(v3, entry.id, entry.name)
  const nSessions = history.length
  const curE1RM   = getCurrentE1RM(history)
  const fit       = getProgressionRate(history)
  const label     = getRecommendationConfidence(fit.n, fit.rSquared)

  const last    = history[history.length - 1]
  const targetR = entry.defaultRepRange?.[1] || 10   // upper of range

  const rec = recommendNextLoad({
    history,
    targetReps:       targetR,
    mode:             'push',
    progressionClass: entry.progressionClass,
    loadIncrement:    entry.loadIncrement || 5,
    now,
  })

  console.log(`${entry.name}`)
  console.log(`  sessions=${nSessions}  e1RM=${Math.round(curE1RM)}  fit: n=${fit.n} R²=${fit.rSquared.toFixed(3)} rate=${(fit.rate * 100).toFixed(2)}%/wk  label=${label}`)
  if (last) console.log(`  last top set: ${last.weight} × ${last.reps}  (${new Date(last.date).toISOString().slice(0, 10)})`)
  console.log(`  → ${rec.prescription ? `${rec.prescription.weight} × ${rec.prescription.reps}` : '(no prescription)'}   mode=${rec.mode}  conf=${rec.confidence}`)
  console.log(`    ${rec.reasoning}`)
  console.log('')
}

// ── Mode sanity: push vs maintain vs deload for Pec Dec ──────────────────
console.log('── Mode comparison (Pec Dec) ──')
const pecEntry   = library.find(e => e.name === 'Pec Dec')
const pecHistory = pecEntry ? getExerciseHistory(v3, pecEntry.id, pecEntry.name) : []
for (const m of ['push', 'maintain', 'deload']) {
  const r = recommendNextLoad({
    history:          pecHistory,
    targetReps:       10,
    mode:             m,
    progressionClass: 'isolation',
    loadIncrement:    5,
    now,
  })
  console.log(`  ${m.padEnd(9)} → ${r.prescription?.weight ?? '—'} × ${r.prescription?.reps ?? '—'}   ${r.reasoning}`)
}

// ── Cold-start sanity: <3 sessions returns no prescription ───────────────
console.log('\n── Cold-start (n < 3) ──')
for (const count of [0, 1, 2]) {
  const h = Array.from({ length: count }, (_, i) => ({
    date: new Date(2026, 3, 1 + i).toISOString(),
    weight: 100, reps: 8, e1RM: e1RM(100, 8),
  }))
  const r = recommendNextLoad({ history: h, targetReps: 10, loadIncrement: 5, now })
  console.log(`  n=${count} → conf=${r.confidence}  prescription=${r.prescription ? `${r.prescription.weight}×${r.prescription.reps}` : 'null'}  — ${r.reasoning}`)
}

// ── Auto-deload trigger: simulate 2 consecutive 2+ rep misses ───────────
console.log('\n── Auto-deload trigger (missed target by 2+ twice) ──')
const bad = [
  { date: '2026-03-20', weight: 100, reps: 10, e1RM: e1RM(100, 10) },
  { date: '2026-03-25', weight: 105, reps: 10, e1RM: e1RM(105, 10) },
  { date: '2026-03-30', weight: 110, reps: 10, e1RM: e1RM(110, 10) },
  { date: '2026-04-05', weight: 115, reps: 10, e1RM: e1RM(115, 10) },
  { date: '2026-04-10', weight: 115, reps: 7,  e1RM: e1RM(115, 7)  },  // missed by 3
  { date: '2026-04-15', weight: 115, reps: 7,  e1RM: e1RM(115, 7)  },  // missed by 3 again
]
const badRec = recommendNextLoad({ history: bad, targetReps: 10, mode: 'push', loadIncrement: 5, now: new Date('2026-04-18').getTime() })
console.log(`  → ${badRec.prescription.weight} × ${badRec.prescription.reps}   mode=${badRec.mode}`)
console.log(`    ${badRec.reasoning}`)
console.log(`    (expected: ~${Math.round(115 * 0.90)} × 10, mode=deload)`)

console.log('\n✅ Recommender sanity complete.')
