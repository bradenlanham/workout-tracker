// Sanity check for the V4→V5 drop-set bundling migration. Runs v2 + v3
// migrations first (so the source is in canonical v3 shape), then v5.
// Reports: drop bundling (counts + orphan promotions), PR-flag delta
// (drops should lose their isNewPR flag under decision 3), aggregate
// volume invariance (decision 2 — same number in, same number out),
// and idempotency (re-running v5 on already-bundled data is a no-op).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  migrateSessionsToV2,
  migrateSessionsToV3,
  migrateSessionsToV5,
  calcSessionVolume,
  perSideLoad,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY as BUILT_IN_RAW } from './src/data/exerciseLibrary.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backupPath = path.resolve(__dirname, '../../../debug-backup.json')

const raw = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
const sessions0 = raw.sessions || []

console.log(`Loaded ${sessions0.length} sessions from debug-backup.json\n`)

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

// ── Run v1→v2 then v2→v3 to normalize input shape ────────────────────────
const sessionsV2 = migrateSessionsToV2(sessions0)
const { sessions: sessionsV3 } = migrateSessionsToV3({
  sessions: sessionsV2,
  library:  builtInLibrary,
})

// ── Pre-V5 inventory ──────────────────────────────────────────────────────
function flatSetCounts(sessions) {
  let working = 0, warmup = 0, drop = 0, other = 0
  let dropPRs = 0
  for (const s of sessions) {
    if (!s?.data?.exercises) continue
    for (const ex of s.data.exercises) {
      for (const set of ex.sets || []) {
        if (set.type === 'working')      working++
        else if (set.type === 'warmup')  warmup++
        else if (set.type === 'drop')    { drop++; if (set.isNewPR) dropPRs++ }
        else                              other++
      }
    }
  }
  return { working, warmup, drop, other, dropPRs }
}

function totalPRs(sessions) {
  let n = 0
  for (const s of sessions) {
    if (!s?.data?.exercises) continue
    for (const ex of s.data.exercises) {
      for (const set of ex.sets || []) {
        if (set.isNewPR) n++
        if (Array.isArray(set.drops)) {
          for (const d of set.drops) if (d.isNewPR) n++
        }
      }
    }
  }
  return n
}

function totalVolume(sessions) {
  let v = 0
  for (const s of sessions) {
    if (!s?.data?.exercises) continue
    v += calcSessionVolume(s.data.exercises)
  }
  return v
}

const beforeCounts  = flatSetCounts(sessionsV3)
const beforePRs     = totalPRs(sessionsV3)
const beforeVolume  = totalVolume(sessionsV3)

console.log('── Pre-V5 (flat shape) ──')
console.log(`  Working sets:       ${beforeCounts.working}`)
console.log(`  Warmup sets:        ${beforeCounts.warmup}`)
console.log(`  Drop sets (flat):   ${beforeCounts.drop}`)
console.log(`  Drop sets w/ PR:    ${beforeCounts.dropPRs}`)
console.log(`  Total isNewPR=true: ${beforePRs}`)
console.log(`  Aggregate volume:   ${Math.round(beforeVolume).toLocaleString()} lb-reps\n`)

// ── Run V4→V5 ─────────────────────────────────────────────────────────────
const sessionsV5 = migrateSessionsToV5(sessionsV3)

// ── Post-V5 inventory ─────────────────────────────────────────────────────
function bundledCounts(sessions) {
  let working = 0, warmup = 0, other = 0
  let bundledDrops = 0
  let workingsWithDrops = 0
  let workingPRs = 0
  let stragglerDrops = 0  // drops still at top level (should be 0)
  for (const s of sessions) {
    if (!s?.data?.exercises) continue
    for (const ex of s.data.exercises) {
      for (const set of ex.sets || []) {
        if (set.type === 'working') {
          working++
          if (set.isNewPR) workingPRs++
          if (Array.isArray(set.drops) && set.drops.length > 0) {
            workingsWithDrops++
            bundledDrops += set.drops.length
          }
        } else if (set.type === 'warmup') {
          warmup++
        } else if (set.type === 'drop') {
          stragglerDrops++
        } else {
          other++
        }
      }
    }
  }
  return { working, warmup, bundledDrops, workingsWithDrops, workingPRs, stragglerDrops, other }
}

const afterCounts  = bundledCounts(sessionsV5)
const afterPRs     = totalPRs(sessionsV5)
const afterVolume  = totalVolume(sessionsV5)

console.log('── Post-V5 (bundled shape) ──')
console.log(`  Working sets:         ${afterCounts.working}`)
console.log(`  Warmup sets:          ${afterCounts.warmup}`)
console.log(`  Drops (bundled):      ${afterCounts.bundledDrops}`)
console.log(`  Workings w/ drops:    ${afterCounts.workingsWithDrops}`)
console.log(`  Top-level drops:      ${afterCounts.stragglerDrops} (expected 0)`)
console.log(`  Total isNewPR=true:   ${afterPRs}`)
console.log(`  Working PRs:          ${afterCounts.workingPRs}`)
console.log(`  Aggregate volume:     ${Math.round(afterVolume).toLocaleString()} lb-reps\n`)

// ── Invariants ────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
function check(label, actual, expected) {
  const ok = actual === expected
  console.log(`  ${ok ? '✓' : '✗'} ${label}: actual=${actual} expected=${expected}`)
  if (ok) passed++
  else failed++
}

console.log('── Invariants ──')

// 1. No straggler drops at top level after migration (orphan-promotion worked).
check('No top-level drops remain', afterCounts.stragglerDrops, 0)

// 2. Working count may INCREASE due to orphan promotion — but by ≤ original drops.
const workingDelta = afterCounts.working - beforeCounts.working
console.log(`  Promoted drops (orphans): ${workingDelta}`)
if (workingDelta < 0) {
  console.log('  ✗ Working count DECREASED — should never happen')
  failed++
} else {
  console.log('  ✓ Working count non-decreasing')
  passed++
}

// 3. Warmup count is unchanged (warmups are never bundled).
check('Warmup count unchanged', afterCounts.warmup, beforeCounts.warmup)

// 4. Bundled drops + promoted drops equals original flat drops.
const accountedFor = afterCounts.bundledDrops + workingDelta
check('Drops accounted for (bundled+promoted)', accountedFor, beforeCounts.drop)

// 5. Volume is preserved (decision 2).
const volumeMatches = Math.abs(afterVolume - beforeVolume) < 0.01
console.log(`  ${volumeMatches ? '✓' : '✗'} Aggregate volume preserved: before=${Math.round(beforeVolume)} after=${Math.round(afterVolume)}`)
if (volumeMatches) passed++
else failed++

// 6. Drop-level PR flags are cleared (decision 3).
// Since we strip isNewPR from drops entirely, drops with isNewPR after = 0.
let dropPRsAfter = 0
for (const s of sessionsV5) {
  if (!s?.data?.exercises) continue
  for (const ex of s.data.exercises) {
    for (const set of ex.sets || []) {
      if (Array.isArray(set.drops)) {
        for (const d of set.drops) if (d.isNewPR) dropPRsAfter++
      }
    }
  }
}
check('No drop stages flagged as PR', dropPRsAfter, 0)

// 7. Idempotency — re-running v5 on already-bundled data is a no-op.
const sessionsV5Rerun = migrateSessionsToV5(sessionsV5)
const rerunCounts = bundledCounts(sessionsV5Rerun)
const rerunVolume = totalVolume(sessionsV5Rerun)
check('Idempotency: working count', rerunCounts.working, afterCounts.working)
check('Idempotency: bundled drops', rerunCounts.bundledDrops, afterCounts.bundledDrops)
const volumeStillMatches = Math.abs(rerunVolume - afterVolume) < 0.01
console.log(`  ${volumeStillMatches ? '✓' : '✗'} Idempotency: volume unchanged on re-run`)
if (volumeStillMatches) passed++
else failed++

// ── Per-exercise spot-checks (top-3 by working-set count) ────────────────
console.log('\n── Per-exercise spot-check (top 3 by frequency) ──')
const byEx = new Map()
for (const s of sessionsV5) {
  if (!s?.data?.exercises) continue
  for (const ex of s.data.exercises) {
    const key = ex.exerciseId || ex.name
    if (!byEx.has(key)) byEx.set(key, { name: ex.name, workingSets: 0, drops: 0, volume: 0 })
    const agg = byEx.get(key)
    for (const set of ex.sets || []) {
      if (set.type === 'working') {
        agg.workingSets++
        agg.volume += (set.reps || 0) * (set.weight || 0)
        if (Array.isArray(set.drops)) {
          for (const d of set.drops) {
            agg.drops++
            agg.volume += (d.reps || 0) * (d.weight || 0)
          }
        }
      } else if (set.type === 'warmup') {
        agg.volume += (set.reps || 0) * (set.weight || 0)
      }
    }
  }
}
const top3 = [...byEx.values()].sort((a, b) => b.workingSets - a.workingSets).slice(0, 3)
for (const ex of top3) {
  console.log(`  ${ex.name}: ${ex.workingSets} working sets, ${ex.drops} drop stages, ${Math.round(ex.volume).toLocaleString()} lb-reps`)
}

// ── Synthetic orphan test ────────────────────────────────────────────────
// Construct a session with a drop-first sequence to confirm promotion logic.
console.log('\n── Synthetic orphan-promotion test ──')
const synth = [{
  id: 'synth', date: '2026-04-20T12:00:00.000Z', mode: 'bb',
  data: { workoutType: 'push', exercises: [
    { name: 'Synth Exercise', exerciseId: 'ex_synth', sets: [
      { type: 'drop',    reps: 8, weight: 135 },  // orphan → promote
      { type: 'drop',    reps: 6, weight: 95  },  // bundle under promoted
      { type: 'warmup',  reps: 10, weight: 45 },  // break chain
      { type: 'working', reps: 10, weight: 185 },
      { type: 'drop',    reps: 8, weight: 135 },  // bundle under working
    ]},
  ]},
}]
const synthV5 = migrateSessionsToV5(synth)
const synthSets = synthV5[0].data.exercises[0].sets
console.log(`  Original flat sets: 5`)
console.log(`  After migration:    ${synthSets.length} top-level entries`)
const expected = [
  { type: 'working', weight: 135, dropCount: 1 },  // promoted drop w/ 1 drop stage
  { type: 'warmup',  weight: 45,  dropCount: 0 },
  { type: 'working', weight: 185, dropCount: 1 },
]
let synthOk = synthSets.length === expected.length
for (let i = 0; synthOk && i < expected.length; i++) {
  const got = synthSets[i]
  const exp = expected[i]
  if (got.type !== exp.type || got.weight !== exp.weight) synthOk = false
  const dropCount = Array.isArray(got.drops) ? got.drops.length : 0
  if (dropCount !== exp.dropCount) synthOk = false
}
console.log(`  ${synthOk ? '✓' : '✗'} Structure matches expected [promoted/warmup/working w/ drop]`)
if (synthOk) passed++
else failed++

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`)
console.log(`Passed: ${passed}  Failed: ${failed}`)
process.exit(failed > 0 ? 1 : 0)
