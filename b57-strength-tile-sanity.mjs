// Batch 57 sanity — buildStrengthTileData across cold-start, sort order,
// type filter (weight-training only), history window, drop-set bundling,
// and defensive inputs. Real-data spot check from
// workout-backup-2026-04-26.json when available.
//
// Mirrors the existing hybrid-b*-sanity.mjs / b53-*-sanity.mjs pattern.
// Run from worktree root: node b57-strength-tile-sanity.mjs

import { buildStrengthTileData } from './src/utils/helpers.js'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const MS_PER_DAY = 86400000
const NOW = Date.UTC(2026, 3, 28, 12, 0, 0) // 2026-04-28 noon UTC

let pass = 0
let fail = 0
function ok(label, cond, detail = null) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else      { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + JSON.stringify(detail) : ''}`) }
}

// ── Synthesis helpers ────────────────────────────────────────────────────
function isoDaysAgo(days) {
  return new Date(NOW - days * MS_PER_DAY).toISOString()
}
function bbSession(daysAgo, type, exercises = []) {
  return {
    id: `s_${daysAgo}_${type}`,
    date: isoDaysAgo(daysAgo),
    mode: 'bb',
    type,
    duration: 45,
    data: { workoutType: type, exercises },
  }
}
function ex(name, sets, opts = {}) {
  return {
    name,
    exerciseId: opts.id || `ex_${name.toLowerCase().replace(/\s+/g, '_')}`,
    sets,
    ...opts,
  }
}
function set(weight, reps, opts = {}) {
  return { type: 'working', weight, reps, ...opts }
}

const lib = (id, name, type = 'weight-training') => ({
  id, name, type, primaryMuscles: ['Chest'], equipment: 'Barbell',
  isBuiltIn: true, defaultUnilateral: false, loadIncrement: 5,
  defaultRepRange: [6, 10], progressionClass: 'compound',
})

// ── 1. Cold-start gate ───────────────────────────────────────────────────
console.log('\n[1] Cold-start gate')
ok('empty sessions → empty result',
   JSON.stringify(buildStrengthTileData({ sessions: [], exerciseLibrary: [lib('ex_a', 'A')] }))
     === JSON.stringify({ exercises: [], totalCount: 0 }))

ok('null sessions → empty result',
   buildStrengthTileData({ sessions: null, exerciseLibrary: [lib('ex_a', 'A')] }).totalCount === 0)

ok('1 session for an exercise → drops below ≥2 floor',
   buildStrengthTileData({
     sessions: [bbSession(5, 'push', [ex('A', [set(135, 8)], { id: 'ex_a' })])],
     exerciseLibrary: [lib('ex_a', 'A')],
   }).totalCount === 0)

ok('2 sessions for an exercise → 1 row',
   buildStrengthTileData({
     sessions: [
       bbSession(10, 'push', [ex('A', [set(135, 8)], { id: 'ex_a' })]),
       bbSession(5,  'push', [ex('A', [set(140, 8)], { id: 'ex_a' })]),
     ],
     exerciseLibrary: [lib('ex_a', 'A')],
   }).totalCount === 1)

// ── 2. Sort order — by progression rate desc ─────────────────────────────
console.log('\n[2] Sort order — by rate descending')
const sortLib = [
  lib('ex_growing',     'Growing'),
  lib('ex_steady',      'Steady'),
  lib('ex_regressing',  'Regressing'),
]
// Three exercises across 3 sessions over 21 days each:
//   Growing:    100 → 110 → 120 (~7%/wk)
//   Steady:     100 → 100 → 100 (flat)
//   Regressing: 120 → 110 → 100 (negative)
const sortSessions = []
for (let i = 0; i < 3; i++) {
  const daysAgo = 21 - i * 7
  sortSessions.push(bbSession(daysAgo, 'push', [
    ex('Growing',    [set(100 + i * 10, 8)], { id: 'ex_growing' }),
    ex('Steady',     [set(100,           8)], { id: 'ex_steady' }),
    ex('Regressing', [set(120 - i * 10, 8)], { id: 'ex_regressing' }),
  ]))
}
const sortResult = buildStrengthTileData({
  sessions: sortSessions, exerciseLibrary: sortLib,
})
ok('3 rows surface',         sortResult.totalCount === 3)
ok('Growing comes first',    sortResult.exercises[0]?.name === 'Growing')
ok('Steady or Regressing 2nd', ['Steady', 'Regressing'].includes(sortResult.exercises[1]?.name))
ok('Growing rate > 0',       sortResult.exercises[0]?.rate > 0)
ok('Regressing rate < 0',
   sortResult.exercises.find(e => e.name === 'Regressing')?.rate < 0)
ok('Growing > Steady',       sortResult.exercises[0]?.rate > sortResult.exercises.find(e => e.name === 'Steady')?.rate)
ok('Steady ≥ Regressing',    sortResult.exercises.find(e => e.name === 'Steady')?.rate >= sortResult.exercises.find(e => e.name === 'Regressing')?.rate)

// ── 3. Type filter — weight-training only ────────────────────────────────
console.log('\n[3] Type filter — weight-training only')
const typeLib = [
  lib('ex_bench', 'Bench Press', 'weight-training'),
  lib('sta_skierg', 'SkiErg', 'hyrox-station'),
  lib('ex_run',  'Easy Run', 'running'),
  lib('ex_round', 'HYROX Run + SkiErg Round', 'hyrox-round'),
]
const typeSessions = [
  bbSession(20, 'push', [
    ex('Bench Press', [set(135, 8)], { id: 'ex_bench' }),
    ex('SkiErg',      [set(0,   0, { distanceMeters: 1000, timeSec: 360 })], { id: 'sta_skierg' }),
    ex('Easy Run',    [set(0,   0, { distanceMiles: 3, timeSec: 1800 })],   { id: 'ex_run' }),
    ex('HYROX Run + SkiErg Round', [], { id: 'ex_round', rounds: [] }),
  ]),
  bbSession(13, 'push', [
    ex('Bench Press', [set(140, 8)], { id: 'ex_bench' }),
    ex('SkiErg',      [set(0,   0, { distanceMeters: 1000, timeSec: 350 })], { id: 'sta_skierg' }),
    ex('Easy Run',    [set(0,   0, { distanceMiles: 3, timeSec: 1750 })],   { id: 'ex_run' }),
  ]),
  bbSession(6,  'push', [
    ex('Bench Press', [set(145, 8)], { id: 'ex_bench' }),
    ex('SkiErg',      [set(0,   0, { distanceMeters: 1000, timeSec: 340 })], { id: 'sta_skierg' }),
  ]),
]
const typeResult = buildStrengthTileData({
  sessions: typeSessions, exerciseLibrary: typeLib,
})
ok('only Bench Press surfaces', typeResult.totalCount === 1 && typeResult.exercises[0].name === 'Bench Press',
   typeResult.exercises.map(e => `${e.name} (${e.libraryEntry?.type})`))
ok('SkiErg (hyrox-station) excluded',
   !typeResult.exercises.some(e => e.libraryEntry?.type === 'hyrox-station'))
ok('Easy Run (running) excluded',
   !typeResult.exercises.some(e => e.libraryEntry?.type === 'running'))
ok('HYROX round excluded',
   !typeResult.exercises.some(e => e.libraryEntry?.type === 'hyrox-round'))

// Legacy / pre-v8 entries with no `type` field default to weight-training.
console.log('\n[3b] Legacy untyped library entries default to weight-training')
const legacyLib = [{ id: 'ex_squat', name: 'Squat', primaryMuscles: ['Legs'], equipment: 'Barbell' }]
const legacySessions = [
  bbSession(20, 'push', [ex('Squat', [set(225, 5)], { id: 'ex_squat' })]),
  bbSession(10, 'push', [ex('Squat', [set(235, 5)], { id: 'ex_squat' })]),
]
const legacyResult = buildStrengthTileData({
  sessions: legacySessions, exerciseLibrary: legacyLib,
})
ok('untyped entry surfaces (treated as weight-training)',
   legacyResult.totalCount === 1 && legacyResult.exercises[0].name === 'Squat')

// ── 4. History window — last 6 entries by default ────────────────────────
console.log('\n[4] History window — slice(-6)')
const winLib = [lib('ex_pec', 'Pec Dec')]
const winSessions = []
for (let i = 0; i < 10; i++) {
  winSessions.push(bbSession(40 - i * 4, 'push',
    [ex('Pec Dec', [set(150 + i, 10)], { id: 'ex_pec' })]))
}
const winResult = buildStrengthTileData({
  sessions: winSessions, exerciseLibrary: winLib,
})
ok('1 row',                     winResult.totalCount === 1)
ok('history.length === 6',      winResult.exercises[0].history.length === 6)
ok('fullHistory.length === 10', winResult.exercises[0].fullHistory.length === 10)
ok('history is the last 6',
   winResult.exercises[0].history[0].weight === 154 && winResult.exercises[0].history[5].weight === 159)
ok('totalSessions === 10',      winResult.exercises[0].totalSessions === 10)
ok('latestDate is most recent', winResult.exercises[0].latestDate === winSessions[winSessions.length - 1].date)

// ── 5. Drop-set bundling — primary contributes ONE entry ─────────────────
console.log('\n[5] Drop-set bundling — primary only, drops nested')
const dropLib = [lib('ex_bench', 'Bench Press')]
const dropSessions = [
  bbSession(20, 'push', [ex('Bench Press', [
    set(135, 8),
    set(225, 5, { drops: [{ weight: 185, reps: 6 }, { weight: 135, reps: 8 }] }),
  ], { id: 'ex_bench' })]),
  bbSession(10, 'push', [ex('Bench Press', [
    set(135, 8),
    set(230, 5, { drops: [{ weight: 185, reps: 6 }] }),
  ], { id: 'ex_bench' })]),
]
const dropResult = buildStrengthTileData({
  sessions: dropSessions, exerciseLibrary: dropLib,
})
ok('1 row',                            dropResult.totalCount === 1)
ok('history.length === 2 (one per session, not three)',
   dropResult.exercises[0].history.length === 2)
ok('top set is the heaviest working',
   dropResult.exercises[0].history[1].weight === 230)

// ── 6. Defensive cases ───────────────────────────────────────────────────
console.log('\n[6] Defensive cases')
ok('null library → empty',
   buildStrengthTileData({ sessions: [bbSession(5, 'push', [])], exerciseLibrary: null }).totalCount === 0)
ok('non-array library → empty',
   buildStrengthTileData({ sessions: [bbSession(5, 'push', [])], exerciseLibrary: 'oops' }).totalCount === 0)
ok('non-array sessions → empty',
   buildStrengthTileData({ sessions: 'oops', exerciseLibrary: [] }).totalCount === 0)
ok('undefined args → empty',
   buildStrengthTileData().totalCount === 0)
ok('exercise without exerciseId resolves by name',
   (() => {
     const sessions = [
       bbSession(20, 'push', [{ name: 'Bench Press', sets: [set(135, 8)] }]),
       bbSession(10, 'push', [{ name: 'Bench Press', sets: [set(140, 8)] }]),
     ]
     const result = buildStrengthTileData({
       sessions, exerciseLibrary: [lib('ex_bench', 'Bench Press')],
     })
     return result.totalCount === 1 && result.exercises[0].name === 'Bench Press'
   })())
ok('non-bb-mode sessions ignored',
   (() => {
     const sessions = [
       { id: 'c1', date: isoDaysAgo(20), mode: 'cardio', type: 'run' },
       { id: 'c2', date: isoDaysAgo(10), mode: 'cardio', type: 'run' },
     ]
     return buildStrengthTileData({ sessions, exerciseLibrary: [lib('ex_a', 'A')] }).totalCount === 0
   })())
ok('malformed exercise (no name, no id) skipped',
   (() => {
     const sessions = [
       bbSession(20, 'push', [{ sets: [set(100, 8)] }, ex('A', [set(100, 8)], { id: 'ex_a' })]),
       bbSession(10, 'push', [{ sets: [set(100, 8)] }, ex('A', [set(105, 8)], { id: 'ex_a' })]),
     ]
     const result = buildStrengthTileData({ sessions, exerciseLibrary: [lib('ex_a', 'A')] })
     return result.totalCount === 1
   })())

// ── 7. Window override via options ───────────────────────────────────────
console.log('\n[7] Custom windowSize')
const overrideResult = buildStrengthTileData({
  sessions: winSessions, exerciseLibrary: winLib, windowSize: 3,
})
ok('windowSize=3 → history.length===3',
   overrideResult.exercises[0].history.length === 3)
ok('windowSize=0 falls back to default 6',
   buildStrengthTileData({
     sessions: winSessions, exerciseLibrary: winLib, windowSize: 0,
   }).exercises[0].history.length === 6)

// ── 8. Real-data spot check ──────────────────────────────────────────────
console.log('\n[8] Real-data spot check')
const candidates = [
  'workout-backup-2026-04-26.json',
  'workout-backup-2026-04-24.json',
  'debug-backup.json',
]
const found = candidates.find(f => existsSync(resolve(f)))
if (found) {
  const raw = JSON.parse(readFileSync(resolve(found), 'utf8'))
  const sessions = raw.sessions || []
  const exerciseLibrary = raw.exerciseLibrary || []
  const result = buildStrengthTileData({ sessions, exerciseLibrary })
  console.log(`  loaded ${found}: ${sessions.length} sessions, ${exerciseLibrary.length} library entries`)
  console.log(`  → ${result.totalCount} qualifying rows`)
  if (result.totalCount > 0) {
    console.log('  Top 5:')
    result.exercises.slice(0, 5).forEach(e => {
      console.log(`    ${e.name.padEnd(30)} ${(e.rate * 100).toFixed(1).padStart(6)}%/wk · ${e.totalSessions} sessions`)
    })
    ok('real-data: rates are sorted descending',
       result.exercises.every((e, i, a) => i === 0 || a[i - 1].rate >= e.rate))
    ok('real-data: every row has ≥2 sessions',
       result.exercises.every(e => e.totalSessions >= 2))
    ok('real-data: every row has fullHistory non-empty',
       result.exercises.every(e => Array.isArray(e.fullHistory) && e.fullHistory.length >= 2))
    ok('real-data: no hyrox-round / hyrox-station / running entries surface',
       result.exercises.every(e => !e.libraryEntry || (e.libraryEntry.type || 'weight-training') === 'weight-training'))
  } else {
    ok('real-data: empty result is a valid outcome', true)
  }
} else {
  console.log('  (skipped — no backup file found)')
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
