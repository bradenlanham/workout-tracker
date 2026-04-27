// Batch 55 sanity — rotationMode behavior for getRotationItemOnDate +
// getNextBbWorkout + migrateSplitsToV10. Verifies week mode honors
// day-of-week mapping AND cycle mode preserves session-anchored behavior
// exactly.
//
// Run from worktree root: node batch-55-rotation-sanity.mjs
//
// Mirrors the existing migration-sanity / hybrid-bXX-sanity pattern.

import {
  getRotationItemOnDate,
  getNextBbWorkout,
  migrateSplitsToV10,
} from './src/utils/helpers.js'

let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`) }
  else      { fail++; console.error(`  ✗ ${msg}`) }
}

// ── Test 1: Week-mode getRotationItemOnDate ────────────────────────────────
console.log('\n[1] Week-mode getRotationItemOnDate')

// User's reported scenario: Sun=Push, Mon=Quads, Tue=Run+Core, Wed=Rest,
// Thu=Pull, Fri=Shoulders, Sat=Hamstrings.
const weekRotation = ['push', 'quads', 'run_core', 'rest', 'pull', 'shoulders', 'hamstrings']

// 7 days starting from a known Sunday (Date('2026-04-26') is a Sunday in any
// timezone since we parse as local midnight).
const sundays = [
  '2026-04-26', // Sunday → push
  '2026-04-27', // Monday → quads
  '2026-04-28', // Tuesday → run_core
  '2026-04-29', // Wednesday → rest
  '2026-04-30', // Thursday → pull
  '2026-05-01', // Friday → shoulders
  '2026-05-02', // Saturday → hamstrings
]
const expected = ['push', 'quads', 'run_core', 'rest', 'pull', 'shoulders', 'hamstrings']
sundays.forEach((d, i) => {
  const got = getRotationItemOnDate(d, [], weekRotation, 'week')
  assert(got === expected[i], `${d} → ${expected[i]} (got: ${got})`)
})

// Cross 14 days — week 2 should repeat the pattern, no session anchoring.
const week2 = ['2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09']
week2.forEach((d, i) => {
  const got = getRotationItemOnDate(d, [], weekRotation, 'week')
  assert(got === expected[i], `Week 2 ${d} → ${expected[i]} (got: ${got})`)
})

// User's bug repro: today is Monday. They saved with Sun=push at index 0.
// Pre-fix: cycle mode + no anchor → fallback to rotation[0] = push (WRONG).
// Post-fix: week mode → returns Quads for Monday correctly.
{
  const got = getRotationItemOnDate('2026-04-27', [], weekRotation, 'week')
  assert(got === 'quads', `Monday in WEEK mode returns Quads (was: rotation[0]=push fallback before fix)`)
}

// ── Test 2: Week mode + non-7 rotation falls back to cycle ─────────────────
console.log('\n[2] Defensive: week mode with rotation.length !== 7 falls back to cycle')
{
  // 5-day rotation (BamBam-shape). Pretending it's flagged 'week' shouldn't
  // crash — should fall through to cycle behavior.
  const fiveDay = ['push', 'legs1', 'pull', 'push2', 'legs2']
  // No anchor — cycle behavior returns null when no sessions.
  const got = getRotationItemOnDate('2026-04-27', [], fiveDay, 'week')
  assert(got === null, `5-day rotation in 'week' mode with no sessions → null (cycle fallback)`)
}
{
  // Empty rotation → null regardless of mode.
  const got = getRotationItemOnDate('2026-04-27', [], [], 'week')
  assert(got === null, `Empty rotation → null`)
}

// ── Test 3: Cycle mode preserves legacy behavior ───────────────────────────
console.log('\n[3] Cycle mode — legacy behavior preserved')
{
  // BamBam-shape 5-day rotation, anchored on a session 0 days ago.
  const fiveDay = ['push', 'legs1', 'pull', 'push2', 'legs2']
  const today = '2026-04-27'
  const sessions = [{ mode: 'bb', type: 'push', date: '2026-04-27T10:00:00.000Z' }]
  // Same day as anchor → returns rotation[anchorIdx] = push.
  const got = getRotationItemOnDate(today, sessions, fiveDay, 'cycle')
  assert(got === 'push', `Cycle: same day as 'push' anchor returns 'push' (got: ${got})`)
}
{
  // 1 day after anchor → next item.
  const fiveDay = ['push', 'legs1', 'pull', 'push2', 'legs2']
  const sessions = [{ mode: 'bb', type: 'push', date: '2026-04-26T10:00:00.000Z' }]
  const got = getRotationItemOnDate('2026-04-27', sessions, fiveDay, 'cycle')
  assert(got === 'legs1', `Cycle: 1 day after 'push' anchor returns 'legs1' (got: ${got})`)
}
{
  // Default rotationMode (omitted arg) → cycle.
  const fiveDay = ['push', 'legs1', 'pull', 'push2', 'legs2']
  const sessions = [{ mode: 'bb', type: 'pull', date: '2026-04-26T10:00:00.000Z' }]
  const got = getRotationItemOnDate('2026-04-27', sessions, fiveDay)
  assert(got === 'push2', `Default mode (omitted) behaves as cycle (got: ${got})`)
}

// ── Test 4: Week-mode getNextBbWorkout ─────────────────────────────────────
console.log('\n[4] Week-mode getNextBbWorkout')
{
  // Note: getNextBbWorkout reads new Date() — testing it via the date in a
  // controlled way would require mocking. Instead, verify:
  //   (a) week mode returns the FIRST non-rest day from today's slot forward
  //   (b) when rotation is all rest, returns sequence[0]
  //   (c) defensive non-7-length returns sequence[0] (cycle fallback w/ no sessions)
  const allRest = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest']
  const got = getNextBbWorkout([], allRest, 'week')
  assert(got === undefined, `All-rest 7-day → undefined (sequence is empty)`)
}
{
  // 5-day cycle rotation (non-7 → falls back to cycle behavior with no sessions).
  const fiveDay = ['push', 'legs1', 'pull', 'push2', 'legs2']
  const got = getNextBbWorkout([], fiveDay, 'week')
  assert(got === 'push', `5-day rotation in 'week' mode → cycle fallback returns sequence[0] (got: ${got})`)
}

// ── Test 5: migrateSplitsToV10 ─────────────────────────────────────────────
console.log('\n[5] migrateSplitsToV10')
{
  const v9 = [
    { id: 's1', name: 'Split A', rotation: ['a', 'b', 'c'] },
    { id: 's2', name: 'Split B', rotation: ['x', 'y'], rotationMode: 'week' }, // already set
    { id: 's3', name: 'Split C', rotation: ['m', 'n'] },
  ]
  const out = migrateSplitsToV10(v9)
  assert(out !== v9, `Returns new array when changes were made`)
  assert(out[0].rotationMode === 'cycle', `Split A gets default 'cycle'`)
  assert(out[1].rotationMode === 'week',  `Split B preserves existing 'week'`)
  assert(out[2].rotationMode === 'cycle', `Split C gets default 'cycle'`)
}
{
  // Idempotent — re-running on already-migrated splits returns same reference.
  const v10 = [
    { id: 's1', rotationMode: 'cycle' },
    { id: 's2', rotationMode: 'week' },
  ]
  const out = migrateSplitsToV10(v10)
  assert(out === v10, `Idempotent: same reference when nothing changed`)
}
{
  // Defensive: non-array input passes through.
  assert(migrateSplitsToV10(null)      === null,      `null input → null`)
  assert(migrateSplitsToV10(undefined) === undefined, `undefined → undefined`)
  assert(JSON.stringify(migrateSplitsToV10([])) === JSON.stringify([]), `Empty array → empty (no-op)`)
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} assertions: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
