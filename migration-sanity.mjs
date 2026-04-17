// Sanity check: run migrateSessionsToV2 against debug-backup.json and
// compare before/after. Validates the phantom-PR fix and the rawWeight
// backfill against the user's real data.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  migrateSessionsToV2,
  getExercisePRs,
  perSideLoad,
} from './src/utils/helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backupPath = path.resolve(__dirname, '../../../debug-backup.json')

const raw = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
const sessions = raw.sessions || []

console.log(`Loaded ${sessions.length} sessions from ${path.relative(process.cwd(), backupPath)}\n`)

// ── Before migration ─────────────────────────────────────────────────────────
const bbSessionsBefore = sessions.filter(s => s.mode === 'bb')
const allSetsBefore = bbSessionsBefore.flatMap(s =>
  (s.data?.exercises || []).flatMap(ex => ex.sets || [])
)
const prCountBefore = allSetsBefore.filter(set => set.isNewPR).length

const unilateralExesBefore = bbSessionsBefore.flatMap(s =>
  (s.data?.exercises || []).filter(ex => ex.unilateral)
)
const unilateralSetsBefore = unilateralExesBefore.flatMap(ex => ex.sets || [])
const unilateralPRsBefore = unilateralSetsBefore.filter(s => s.isNewPR).length

const setsMissingRawWeight = allSetsBefore.filter(s => s.rawWeight === undefined).length

console.log('── BEFORE migration ──')
console.log(`  BB sessions:                           ${bbSessionsBefore.length}`)
console.log(`  Total sets:                            ${allSetsBefore.length}`)
console.log(`  Sets flagged isNewPR:                  ${prCountBefore}`)
console.log(`  Sets WITHOUT rawWeight field:          ${setsMissingRawWeight}`)
console.log(`  Unilateral exercises:                  ${unilateralExesBefore.length}`)
console.log(`  Unilateral sets flagged isNewPR:       ${unilateralPRsBefore}`)

// ── Run migration ────────────────────────────────────────────────────────────
const migrated = migrateSessionsToV2(sessions)

// ── After migration ──────────────────────────────────────────────────────────
const bbSessionsAfter = migrated.filter(s => s.mode === 'bb')
const allSetsAfter = bbSessionsAfter.flatMap(s =>
  (s.data?.exercises || []).flatMap(ex => ex.sets || [])
)
const prCountAfter = allSetsAfter.filter(set => set.isNewPR).length
const setsMissingRawWeightAfter = allSetsAfter.filter(s => s.rawWeight === undefined).length

const unilateralSetsAfter = bbSessionsAfter.flatMap(s =>
  (s.data?.exercises || []).filter(ex => ex.unilateral).flatMap(ex => ex.sets || [])
)
const unilateralPRsAfter = unilateralSetsAfter.filter(s => s.isNewPR).length

console.log('\n── AFTER migration ──')
console.log(`  BB sessions:                           ${bbSessionsAfter.length}`)
console.log(`  Total sets:                            ${allSetsAfter.length}`)
console.log(`  Sets flagged isNewPR:                  ${prCountAfter}`)
console.log(`  Sets WITHOUT rawWeight field:          ${setsMissingRawWeightAfter}`)
console.log(`  Unilateral sets flagged isNewPR:       ${unilateralPRsAfter}`)

// ── Delta summary ────────────────────────────────────────────────────────────
console.log('\n── DELTA ──')
console.log(`  Session count preserved:               ${bbSessionsBefore.length === bbSessionsAfter.length ? 'yes' : 'NO (bug!)'}`)
console.log(`  Set count preserved:                   ${allSetsBefore.length === allSetsAfter.length ? 'yes' : 'NO (bug!)'}`)
console.log(`  PR flags before → after:               ${prCountBefore} → ${prCountAfter} (${prCountAfter - prCountBefore >= 0 ? '+' : ''}${prCountAfter - prCountBefore})`)
console.log(`  Missing rawWeight before → after:      ${setsMissingRawWeight} → ${setsMissingRawWeightAfter}`)

// ── Per-exercise spot-check ─────────────────────────────────────────────────
const nameSet = new Set()
for (const s of bbSessionsAfter) {
  for (const ex of s.data?.exercises || []) {
    nameSet.add(ex.name)
  }
}

const exercisesToCheck = [
  'Pec Dec',
  'Seated Cable Row',
  'Incline DB Press',
  'Chest Supported Wide Row',
  'DB Lateral Raises',
  'Lateral DB Raises',
  'Flat Bench Press',
  'Single Arm Row',
]

console.log('\n── Per-exercise max weight (perSideLoad, after migration) ──')
for (const name of exercisesToCheck) {
  if (!nameSet.has(name)) {
    console.log(`  ${name.padEnd(30)} — not found in history`)
    continue
  }
  const { maxWeight, maxRepsAtMaxWeight } = getExercisePRs(migrated, name)
  const setCount = bbSessionsAfter
    .flatMap(s => (s.data?.exercises || []).filter(ex => ex.name === name))
    .flatMap(ex => ex.sets || [])
    .length
  console.log(`  ${name.padEnd(30)} ${String(maxWeight).padStart(5)} × ${maxRepsAtMaxWeight}  (${setCount} sets)`)
}

// ── Name collision inventory (preview of step 2 work) ──────────────────────
console.log('\n── Name-collision candidates (for step 2 dedup) ──')
const normalize = n => n.toLowerCase().trim().replace(/\s+/g, ' ')
const buckets = new Map()
for (const name of nameSet) {
  const key = normalize(name)
  if (!buckets.has(key)) buckets.set(key, new Set())
  buckets.get(key).add(name)
}
let collisionCount = 0
for (const [, names] of buckets) {
  if (names.size > 1) {
    collisionCount++
    console.log(`  ${[...names].map(n => `"${n}"`).join('  vs  ')}`)
  }
}
if (collisionCount === 0) console.log('  (none found by case/whitespace normalization)')

console.log('\n✅ Sanity check complete.')
