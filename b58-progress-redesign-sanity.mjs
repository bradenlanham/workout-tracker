// Batch 58 sanity — buildVolumeTileData + buildAchievementsData across
// cold-start, picker-window math, prior-period delta, weekly series, per-
// workout-type breakdown, achievements scoping, and defensive inputs.
// Real-data spot check from workout-backup-2026-04-26.json when available.
//
// Mirrors the existing b57 / b53 sanity patterns.
// Run from worktree root: node b58-progress-redesign-sanity.mjs

import {
  buildVolumeTileData,
  buildAchievementsData,
} from './src/utils/helpers.js'
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
function bbSession(daysAgo, type, exercises = [], opts = {}) {
  return {
    id: `s_${daysAgo}_${type}`,
    date: isoDaysAgo(daysAgo),
    mode: 'bb',
    type,
    duration: 45,
    grade: 'B',
    data: { workoutType: type, exercises },
    ...opts,
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

// ── 1. Volume — cold start / empty cases ─────────────────────────────────
console.log('\n[1] Volume — cold start + empty cases')
ok('empty sessions → totalVolume=0',
   buildVolumeTileData({ sessions: [], windowStartTs: NOW - 30 * MS_PER_DAY, prevWindowStartTs: NOW - 60 * MS_PER_DAY, now: NOW }).totalVolume === 0)
ok('null sessions → empty result',
   buildVolumeTileData({ sessions: null, now: NOW }).sessionCount === 0)
ok('undefined args → empty result',
   buildVolumeTileData().sessionCount === 0)
ok('non-array sessions → empty',
   buildVolumeTileData({ sessions: 'oops', now: NOW }).sessionCount === 0)
ok('only non-bb sessions → 0',
   buildVolumeTileData({
     sessions: [{ mode: 'cardio', date: isoDaysAgo(5), data: {} }],
     windowStartTs: NOW - 30 * MS_PER_DAY, now: NOW,
   }).totalVolume === 0)

// ── 2. Volume — aggregation math (basic) ─────────────────────────────────
console.log('\n[2] Volume — aggregation math')
const basicSessions = [
  bbSession(5,  'push', [ex('Bench Press', [set(135, 10), set(155, 8)])]),
  bbSession(12, 'push', [ex('Bench Press', [set(140, 10), set(160, 8)])]),
  bbSession(20, 'push', [ex('Bench Press', [set(145, 10), set(165, 8)])]),
  bbSession(40, 'push', [ex('Bench Press', [set(135, 10)])]),
  bbSession(60, 'push', [ex('Bench Press', [set(135, 10)])]),
]
// 1mo window — picks up days 5/12/20 only
const r1 = buildVolumeTileData({
  sessions: basicSessions,
  windowStartTs: NOW - 30 * MS_PER_DAY,
  prevWindowStartTs: NOW - 60 * MS_PER_DAY,
  now: NOW,
})
// expected vol days 5/12/20: (135*10+155*8)+(140*10+160*8)+(145*10+165*8)
//                          = 2590 + 2680 + 2770 = 8040
ok('1mo total volume sums correctly', r1.totalVolume === 8040, r1.totalVolume)
ok('1mo session count = 3',           r1.sessionCount === 3)
ok('1mo weeklySeries has entries',    r1.weeklySeries.length >= 1)
// Prior window (days 30-60): days 40 + 60 → (135*10) + (135*10) = 2700
ok('1mo prevTotalVolume = 2700',      r1.prevTotalVolume === 2700, r1.prevTotalVolume)
// delta: (8040-2700)/2700 = 1.978 → 198%
ok('1mo deltaPct ≈ +198',             r1.deltaPct === 198, r1.deltaPct)

// All-range: includes all 5 sessions; prevTotalVolume=0; deltaPct=null
const rAll = buildVolumeTileData({ sessions: basicSessions, windowStartTs: null, prevWindowStartTs: null, now: NOW })
ok('all sessions → 5 sessions',       rAll.sessionCount === 5)
ok('all → prevTotalVolume = 0',       rAll.prevTotalVolume === 0)
ok('all → deltaPct = null',           rAll.deltaPct === null)

// ── 3. Volume — drops contribute ─────────────────────────────────────────
console.log('\n[3] Volume — drops contribute (Batch 22 decision 2)')
const dropSessions = [
  bbSession(5, 'push', [ex('Bench Press', [
    set(225, 5, { drops: [{ weight: 185, reps: 6 }, { weight: 135, reps: 8 }] }),
  ])]),
]
// 225*5 + 185*6 + 135*8 = 1125 + 1110 + 1080 = 3315
const rDrops = buildVolumeTileData({ sessions: dropSessions, windowStartTs: NOW - 30 * MS_PER_DAY, now: NOW })
ok('drops contribute to total',       rDrops.totalVolume === 3315, rDrops.totalVolume)

// ── 4. Volume — by-workout-type breakdown ────────────────────────────────
console.log('\n[4] Volume — byWorkoutType breakdown')
const typeSessions = [
  bbSession(5,  'push',  [ex('Bench', [set(100, 10)])]),
  bbSession(7,  'pull',  [ex('Row',   [set(100, 10)])]),
  bbSession(10, 'push',  [ex('Bench', [set(100, 10)])]),
  bbSession(12, 'pull',  [ex('Row',   [set(100, 10)])]),
  bbSession(15, 'pull',  [ex('Row',   [set(100, 10)])]),
]
const rTypes = buildVolumeTileData({ sessions: typeSessions, windowStartTs: NOW - 30 * MS_PER_DAY, now: NOW })
ok('byWorkoutType has 2 entries',     rTypes.byWorkoutType.length === 2)
ok('pull leads (more sessions)',      rTypes.byWorkoutType[0].type === 'pull')
ok('pull volume = 3000',              rTypes.byWorkoutType[0].volume === 3000)
ok('pull count = 3',                  rTypes.byWorkoutType[0].count === 3)
ok('push count = 2',                  rTypes.byWorkoutType.find(t => t.type === 'push').count === 2)

// ── 5. Volume — weekly series ────────────────────────────────────────────
console.log('\n[5] Volume — weeklySeries integrity')
ok('weeklySeries entries are sorted asc',
   (() => {
     const ws = rAll.weeklySeries
     for (let i = 1; i < ws.length; i++) {
       if (ws[i].weekStart < ws[i - 1].weekStart) return false
     }
     return true
   })())
ok('weeklySeries sums to totalVolume across all',
   rAll.weeklySeries.reduce((s, w) => s + w.volume, 0) === rAll.totalVolume)

// ── 6. Volume — defensive cases ──────────────────────────────────────────
console.log('\n[6] Volume — defensive cases')
ok('malformed session (no data)',
   buildVolumeTileData({
     sessions: [{ mode: 'bb', date: isoDaysAgo(5) }],
     windowStartTs: NOW - 30 * MS_PER_DAY, now: NOW,
   }).sessionCount === 0)
ok('malformed session (bad date)',
   buildVolumeTileData({
     sessions: [{ mode: 'bb', date: 'not-a-date', data: {} }],
     windowStartTs: NOW - 30 * MS_PER_DAY, now: NOW,
   }).sessionCount === 0)
ok('exercise with null sets array',
   buildVolumeTileData({
     sessions: [bbSession(5, 'push', [{ name: 'Bench', sets: null }])],
     windowStartTs: NOW - 30 * MS_PER_DAY, now: NOW,
   }).totalVolume === 0)

// ── 7. Achievements — basic shape ────────────────────────────────────────
console.log('\n[7] Achievements — basic shape')
const achSessions = [
  bbSession(2, 'push', [ex('Bench', [set(100, 10, { isNewPR: true })])]),
  bbSession(5, 'push', [ex('Bench', [set(105, 10, { isNewPR: true })])]),
  bbSession(8, 'pull', [ex('Row',   [set(100, 10, { isNewPR: false })])]),
]
const splits = [{
  id: 'split_test',
  name: 'Test',
  workouts: [{ id: 'push', name: 'Push' }, { id: 'pull', name: 'Pull' }],
}]
const aAll = buildAchievementsData({
  sessions: achSessions,
  cardioSessions: [],
  restDaySessions: [],
  splits,
  activeSplitId: 'split_test',
})
ok('totalSessions = 3',               aAll.totalSessions === 3)
ok('prsThisSplit = 2',                aAll.prsThisSplit === 2)
ok('bestStreak is a number',          typeof aAll.bestStreak === 'number')
ok('badges is an array',              Array.isArray(aAll.badges))
ok('first-session badge present',     aAll.badges.some(b => b.id === 'first'))
ok('first-PR badge present',          aAll.badges.some(b => b.id === 'pr1'))

// ── 8. Achievements — PRs scoped to active split workouts ────────────────
console.log('\n[8] Achievements — PR scoping by active split')
const scopedSessions = [
  bbSession(2, 'push',  [ex('Bench', [set(100, 10, { isNewPR: true })])]),
  bbSession(5, 'orphan',[ex('Mystery', [set(100, 10, { isNewPR: true })])]),
]
const aScoped = buildAchievementsData({
  sessions: scopedSessions, splits, activeSplitId: 'split_test',
})
ok('PR in non-active workout type filtered out',
   aScoped.prsThisSplit === 1, aScoped.prsThisSplit)
ok('totalSessions still counts all',  aScoped.totalSessions === 2)

const aNoSplit = buildAchievementsData({
  sessions: scopedSessions, splits, activeSplitId: null,
})
ok('null activeSplitId → all PRs counted',
   aNoSplit.prsThisSplit === 2)

// ── 9. Achievements — defensive cases ────────────────────────────────────
console.log('\n[9] Achievements — defensive cases')
ok('null sessions → totalSessions=0',
   buildAchievementsData({ sessions: null }).totalSessions === 0)
ok('non-array sessions → 0',
   buildAchievementsData({ sessions: 'oops' }).totalSessions === 0)
ok('undefined args → empty shape',
   (() => {
     const a = buildAchievementsData()
     return a.totalSessions === 0 && a.prsThisSplit === 0 && Array.isArray(a.badges)
   })())
ok('null splits + activeSplitId',
   buildAchievementsData({ sessions: achSessions, splits: null, activeSplitId: 'x' }).prsThisSplit === 2)

// ── 10. Real-data spot check ─────────────────────────────────────────────
console.log('\n[10] Real-data spot check')
const candidates = [
  'workout-backup-2026-04-26.json',
  'workout-backup-2026-04-24.json',
  'debug-backup.json',
]
const found = candidates.find(f => existsSync(resolve(f)))
if (found) {
  const raw = JSON.parse(readFileSync(resolve(found), 'utf8'))
  const realSessions = raw.sessions || []
  const realCardio = raw.cardioSessions || []
  const realRest = raw.restDaySessions || []
  const realSplits = raw.splits || []
  const realActiveId = raw.activeSplitId || null

  const v3mo = buildVolumeTileData({
    sessions: realSessions,
    windowStartTs: Date.now() - 90 * MS_PER_DAY,
    prevWindowStartTs: Date.now() - 180 * MS_PER_DAY,
  })
  const a = buildAchievementsData({
    sessions: realSessions, cardioSessions: realCardio, restDaySessions: realRest,
    splits: realSplits, activeSplitId: realActiveId,
  })
  console.log(`  loaded ${found}: ${realSessions.length} bb sessions, active split = ${realActiveId}`)
  console.log(`  3mo: ${v3mo.sessionCount} sessions, ${v3mo.totalVolume} lb total, delta=${v3mo.deltaPct}%`)
  console.log(`  byWorkoutType:`)
  v3mo.byWorkoutType.forEach(t => console.log(`    ${t.type.padEnd(15)} ${t.volume.toString().padStart(8)} lb · ${t.count} sessions`))
  console.log(`  Achievements: PRs this split=${a.prsThisSplit}, total=${a.totalSessions}, best streak=${a.bestStreak}, badges=${a.badges.length}`)

  ok('real-data: total volume non-negative',  v3mo.totalVolume >= 0)
  ok('real-data: byWorkoutType sorted desc',
     v3mo.byWorkoutType.every((t, i, a) => i === 0 || a[i - 1].volume >= t.volume))
  ok('real-data: prsThisSplit ≥ 0',           a.prsThisSplit >= 0)
  ok('real-data: totalSessions matches input',
     a.totalSessions === realSessions.filter(s => s?.mode === 'bb').length)
  ok('real-data: badges array shape',
     a.badges.every(b => b && typeof b.id === 'string' && typeof b.icon === 'string'))
} else {
  console.log('  (skipped — no backup file found)')
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
