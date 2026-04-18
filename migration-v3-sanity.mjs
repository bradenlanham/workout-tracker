// Sanity check for the V2→V3 migration. Runs migrateSessionsToV2 first
// (since debug-backup.json is in v1/v2 shape) then migrateSessionsToV3,
// and reports what changed: library growth, needsTagging entries,
// canonicalized names, exerciseId assignment, and PR count delta.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  migrateSessionsToV2,
  migrateSessionsToV3,
  normalizeExerciseName,
  getExercisePRs,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY as BUILT_IN_RAW } from './src/data/exerciseLibrary.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backupPath = path.resolve(__dirname, '../../../debug-backup.json')

const raw = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
const sessions0 = raw.sessions || []

console.log(`Loaded ${sessions0.length} sessions\n`)

// ── Build seeded library (mirrors buildBuiltInLibrary in useStore.js) ─────
function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
const builtInLibrary = BUILT_IN_RAW.map(r => ({
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

// ── Run V1→V2 then V2→V3 ──────────────────────────────────────────────────
const sessionsV2 = migrateSessionsToV2(sessions0)
const { sessions: sessionsV3, library: libraryV3 } = migrateSessionsToV3({
  sessions: sessionsV2,
  library:  builtInLibrary,
})

console.log('── Library growth ──')
console.log(`  Built-in seeded:          ${builtInLibrary.length}`)
console.log(`  After v3 migration:       ${libraryV3.length}`)
console.log(`  Added (user-created):     ${libraryV3.length - builtInLibrary.length}`)
console.log(`  Flagged needsTagging:     ${libraryV3.filter(e => e.needsTagging).length}`)

// ── Canonicalization summary ──────────────────────────────────────────────
const allExercisesBefore = sessionsV2.flatMap(s => s?.data?.exercises || [])
const allExercisesAfter  = sessionsV3.flatMap(s => s?.data?.exercises || [])
const namesBeforeSet = new Set(allExercisesBefore.map(e => e.name))
const namesAfterSet  = new Set(allExercisesAfter.map(e => e.name))
const withExerciseId = allExercisesAfter.filter(e => e.exerciseId).length

console.log('\n── Canonicalization ──')
console.log(`  Distinct names before:    ${namesBeforeSet.size}`)
console.log(`  Distinct names after:     ${namesAfterSet.size}`)
console.log(`  LoggedExercises total:    ${allExercisesAfter.length}`)
console.log(`  LoggedExercises with id:  ${withExerciseId}`)
console.log(`  Coverage:                 ${(withExerciseId / allExercisesAfter.length * 100).toFixed(1)}%`)

// Names that got rewritten
const renames = []
for (const s of sessionsV2) {
  for (const ex of s?.data?.exercises || []) {
    const match = sessionsV3
      .find(x => x.id === s.id)?.data?.exercises?.find((_, i) => s.data.exercises.indexOf(ex) === i)
    if (match && match.name !== ex.name) {
      renames.push({ before: ex.name, after: match.name })
    }
  }
}
const uniqueRenames = [...new Map(renames.map(r => [`${r.before}→${r.after}`, r])).values()]
console.log(`\n── Renamed (canonicalized) names ──`)
if (uniqueRenames.length === 0) console.log('  (none)')
for (const r of uniqueRenames) console.log(`  "${r.before}" → "${r.after}"`)

// ── Needs-tagging entries (what the backfill UI will show) ────────────────
const needsTagging = libraryV3.filter(e => e.needsTagging)
console.log(`\n── Needs-tagging entries (n=${needsTagging.length}) ──`)
for (const e of needsTagging) {
  console.log(`  ${e.name.padEnd(36)} id=${e.id}  aliases=[${e.aliases.map(a => `"${a}"`).join(', ')}]`)
}

// ── PR count before/after ─────────────────────────────────────────────────
const prV2 = sessionsV2.flatMap(s => (s?.data?.exercises || []).flatMap(e => (e.sets || []).filter(x => x.isNewPR))).length
const prV3 = sessionsV3.flatMap(s => (s?.data?.exercises || []).flatMap(e => (e.sets || []).filter(x => x.isNewPR))).length
console.log(`\n── PR flags after v3 (keyed by exerciseId) ──`)
console.log(`  v2 baseline:              ${prV2}`)
console.log(`  v3 (post-canonicalize):   ${prV3} (Δ ${prV3 - prV2 >= 0 ? '+' : ''}${prV3 - prV2})`)

// ── Per-exercise spot-check ───────────────────────────────────────────────
const spotChecks = [
  'Pec Dec',
  'Seated Cable Row',
  'Incline DB Press',
  'Single Arm Row',
  'DB Lateral Raises',
  'Lateral DB Raises',
]
console.log('\n── Per-exercise max weight (v3) ──')
for (const name of spotChecks) {
  const libEntry = libraryV3.find(e => e.name === name || (e.aliases || []).includes(name))
  if (!libEntry) {
    console.log(`  ${name.padEnd(30)} — not in library`)
    continue
  }
  const { maxWeight, maxRepsAtMaxWeight } = getExercisePRs(sessionsV3, libEntry.name)
  const setCount = sessionsV3
    .flatMap(s => (s?.data?.exercises || []).filter(e => e.exerciseId === libEntry.id))
    .flatMap(e => e.sets || [])
    .length
  console.log(`  ${libEntry.name.padEnd(30)} ${String(maxWeight).padStart(5)} × ${maxRepsAtMaxWeight}  (${setCount} sets, aliases=[${libEntry.aliases.join(', ')}])`)
}

console.log('\n✅ V3 sanity check complete.')
