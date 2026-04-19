// Sanity check for Batch 20 gym tagging data layer (spec §3.5, step 8).
// Validates:
//   1. isExerciseAvailableAtGym — matrix of (no gymId, empty tags,
//      matching tag, non-matching tag, null exercise, missing array).
//   2. shouldSkipGymTagPrompt — reads exercise.skipGymTagPrompt correctly.
//   3. shouldPromptGymTag — composition: fires only when gym set, not
//      already tagged, and not opted out.
//   4. getExerciseHistory with gymId scoping:
//       - null → all sessions (pre-Batch-20 behavior)
//       - matching gym → only that gym's sessions
//       - non-matching / no-sessions gym → empty (caller falls back)
//       - sessions without gymId do NOT match a scoped query
//         (spec §3.5.6: "unspecified" sessions stay that way)
//       - history items echo gymId on each entry
//   5. getInstancesForExercise with gymId: filters the prior-machine
//      list so VASA's Hoist and TR's Cybex don't collide in the picker.
//   6. Composed scoping: gymId + equipmentInstance intersect with AND.
//   7. debug-backup.json baseline: no real sessions have a gymId yet,
//      so unscoped calls match pre-Batch-20 behavior exactly and any
//      scoped call returns empty.
//
// Run from the worktree root:
//   node gym-tags-sanity.mjs

import { readFileSync } from 'node:fs'
import {
  isExerciseAvailableAtGym,
  shouldSkipGymTagPrompt,
  shouldPromptGymTag,
  getExerciseHistory,
  getInstancesForExercise,
  migrateSessionsToV2,
  migrateSessionsToV3,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY } from './src/data/exerciseLibrary.js'

let pass = 0, fail = 0
function eq(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { pass++; console.log(`  ✓ ${label}`) }
  else         { fail++; console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`) }
}

console.log('\n── 1. isExerciseAvailableAtGym ──')

eq('no gymId → available',                    isExerciseAvailableAtGym({ sessionGymTags: ['gym_tr'] }, null),         true)
eq('null exercise → available (defensive)',   isExerciseAvailableAtGym(null, 'gym_vasa'),                             true)
eq('undefined exercise → available',          isExerciseAvailableAtGym(undefined, 'gym_vasa'),                        true)
eq('missing sessionGymTags → available',      isExerciseAvailableAtGym({ id: 'ex_pec' }, 'gym_vasa'),                 true)
eq('empty sessionGymTags → available',        isExerciseAvailableAtGym({ sessionGymTags: [] }, 'gym_vasa'),           true)
eq('matching tag → available',                isExerciseAvailableAtGym({ sessionGymTags: ['gym_vasa'] }, 'gym_vasa'), true)
eq('multiple tags, one matches → available',  isExerciseAvailableAtGym({ sessionGymTags: ['gym_tr','gym_vasa'] }, 'gym_vasa'), true)
eq('tagged elsewhere only → unavailable',     isExerciseAvailableAtGym({ sessionGymTags: ['gym_tr'] }, 'gym_vasa'),   false)
eq('non-array sessionGymTags → available',    isExerciseAvailableAtGym({ sessionGymTags: 'gym_vasa' }, 'gym_vasa'),   true)

console.log('\n── 2. shouldSkipGymTagPrompt ──')

eq('no exercise → false',                        shouldSkipGymTagPrompt(null, 'gym_vasa'),                              false)
eq('no gymId → false',                           shouldSkipGymTagPrompt({ skipGymTagPrompt: ['gym_vasa'] }, null),      false)
eq('missing skip array → false',                 shouldSkipGymTagPrompt({ id: 'ex' }, 'gym_vasa'),                      false)
eq('empty skip array → false',                   shouldSkipGymTagPrompt({ skipGymTagPrompt: [] }, 'gym_vasa'),          false)
eq('matching skip → true',                       shouldSkipGymTagPrompt({ skipGymTagPrompt: ['gym_vasa'] }, 'gym_vasa'), true)
eq('non-matching skip → false',                  shouldSkipGymTagPrompt({ skipGymTagPrompt: ['gym_tr'] }, 'gym_vasa'),   false)

console.log('\n── 3. shouldPromptGymTag ──')

eq('no gymId → no prompt',                       shouldPromptGymTag({ sessionGymTags: [] }, null),                      false)
eq('no exercise → no prompt',                    shouldPromptGymTag(null, 'gym_vasa'),                                  false)
eq('untagged + not skipped → prompt',            shouldPromptGymTag({ id: 'ex' }, 'gym_vasa'),                          true)
eq('empty tags + not skipped → prompt',          shouldPromptGymTag({ sessionGymTags: [] }, 'gym_vasa'),                true)
eq('already tagged here → no prompt',            shouldPromptGymTag({ sessionGymTags: ['gym_vasa'] }, 'gym_vasa'),      false)
eq('tagged elsewhere, not skipped → prompt',     shouldPromptGymTag({ sessionGymTags: ['gym_tr'] }, 'gym_vasa'),        true)
eq('always-skip set here → no prompt',           shouldPromptGymTag({ sessionGymTags: [], skipGymTagPrompt: ['gym_vasa'] }, 'gym_vasa'), false)
eq('always-skip set elsewhere → prompt here',    shouldPromptGymTag({ sessionGymTags: [], skipGymTagPrompt: ['gym_tr'] }, 'gym_vasa'), true)

// ── Synthetic multi-gym sessions ───────────────────────────────────────
// Same exercise (Pec Dec) at two gyms with different machines, plus one
// pre-Batch-16n session with no gymId at all (the legacy "unspecified" case).

function mkSession({ date, gymId, instance, weight, reps }) {
  const id = `sess_${date}_${gymId || 'none'}_${instance || 'bare'}`
  return {
    id, date, mode: 'bb', type: 'push',
    ...(gymId ? { gymId } : {}),
    data: {
      workoutType: 'push',
      exercises: [{
        name: 'Pec Dec',
        exerciseId: 'ex_pec_dec',
        ...(instance ? { equipmentInstance: instance } : {}),
        sets: [{ type: 'working', weight, reps, rawWeight: weight }],
      }],
    },
  }
}

const synthetic = [
  mkSession({ date: '2026-03-01T12:00:00Z', weight: 160, reps: 10 }),                        // no gymId (legacy)
  mkSession({ date: '2026-03-10T12:00:00Z', gymId: 'gym_vasa', instance: 'Hoist', weight: 170, reps: 10 }),
  mkSession({ date: '2026-03-17T12:00:00Z', gymId: 'gym_vasa', instance: 'Hoist', weight: 175, reps: 10 }),
  mkSession({ date: '2026-03-24T12:00:00Z', gymId: 'gym_vasa', instance: 'Hoist', weight: 180, reps: 10 }),
  mkSession({ date: '2026-03-12T12:00:00Z', gymId: 'gym_tr',   instance: 'Cybex', weight: 200, reps: 8 }),
  mkSession({ date: '2026-03-19T12:00:00Z', gymId: 'gym_tr',   instance: 'Cybex', weight: 205, reps: 8 }),
]

console.log('\n── 4. getExerciseHistory gym scoping ──')

const hAll = getExerciseHistory(synthetic, 'ex_pec_dec')
eq('no gymId → all sessions with sets', hAll.length, 6)
eq('history items echo gymId when set', hAll.map(h => h.gymId), [
  null, 'gym_vasa', 'gym_tr', 'gym_vasa', 'gym_tr', 'gym_vasa',
])

const hVasa = getExerciseHistory(synthetic, 'ex_pec_dec', null, null, 'gym_vasa')
eq('gym_vasa scoped → 3 sessions',             hVasa.length, 3)
eq('gym_vasa scoped → only VASA gymIds',       new Set(hVasa.map(h => h.gymId)).size === 1 && hVasa[0].gymId, 'gym_vasa')
eq('legacy-no-gymId excluded from scoped',     hVasa.every(h => h.gymId === 'gym_vasa'), true)

const hTr = getExerciseHistory(synthetic, 'ex_pec_dec', null, null, 'gym_tr')
eq('gym_tr scoped → 2 sessions',               hTr.length, 2)
eq('gym_tr top-set weights',                   hTr.map(h => h.weight), [200, 205])

const hUnknown = getExerciseHistory(synthetic, 'ex_pec_dec', null, null, 'gym_home')
eq('gym with no sessions → empty',             hUnknown, [])

const hEmptyGym = getExerciseHistory(synthetic, 'ex_pec_dec', null, null, '')
eq("empty-string gymId → unscoped (same as null)", hEmptyGym.length, 6)

const hWhitespaceGym = getExerciseHistory(synthetic, 'ex_pec_dec', null, null, '   ')
eq('whitespace-only gymId → unscoped',         hWhitespaceGym.length, 6)

console.log('\n── 5. getInstancesForExercise gym scoping ──')

const instAll = getInstancesForExercise(synthetic, 'ex_pec_dec')
eq('no gymId → both instances newest-first', instAll, ['Hoist', 'Cybex'])

const instVasa = getInstancesForExercise(synthetic, 'ex_pec_dec', null, 'gym_vasa')
eq('gym_vasa → only Hoist', instVasa, ['Hoist'])

const instTr = getInstancesForExercise(synthetic, 'ex_pec_dec', null, 'gym_tr')
eq('gym_tr → only Cybex', instTr, ['Cybex'])

const instUnknown = getInstancesForExercise(synthetic, 'ex_pec_dec', null, 'gym_home')
eq('unknown gym → empty instance list', instUnknown, [])

console.log('\n── 6. Composed instance + gym scoping ──')

// Same machine name at two gyms (imagine the user uses "Hoist" at both gyms
// for distinct models) — gym+instance should intersect with AND.
const crossBrand = [
  mkSession({ date: '2026-03-05T12:00:00Z', gymId: 'gym_vasa', instance: 'Hoist', weight: 150, reps: 10 }),
  mkSession({ date: '2026-03-12T12:00:00Z', gymId: 'gym_vasa', instance: 'Hoist', weight: 155, reps: 10 }),
  mkSession({ date: '2026-03-08T12:00:00Z', gymId: 'gym_tr',   instance: 'Hoist', weight: 210, reps: 8 }),
  mkSession({ date: '2026-03-15T12:00:00Z', gymId: 'gym_tr',   instance: 'Hoist', weight: 215, reps: 8 }),
]

const hoistAll      = getExerciseHistory(crossBrand, 'ex_pec_dec', null, 'Hoist', null)
const hoistAtVasa   = getExerciseHistory(crossBrand, 'ex_pec_dec', null, 'Hoist', 'gym_vasa')
const hoistAtTr     = getExerciseHistory(crossBrand, 'ex_pec_dec', null, 'Hoist', 'gym_tr')

eq('Hoist unscoped → 4 sessions',        hoistAll.length, 4)
eq('Hoist @ VASA only → 2 sessions',     hoistAtVasa.length, 2)
eq('Hoist @ VASA weights',               hoistAtVasa.map(h => h.weight), [150, 155])
eq('Hoist @ TR only → 2 sessions',       hoistAtTr.length, 2)
eq('Hoist @ TR weights',                 hoistAtTr.map(h => h.weight), [210, 215])

// Case-insensitive instance match still composes with gym filter
const hoistLowerAtVasa = getExerciseHistory(crossBrand, 'ex_pec_dec', null, 'hoist', 'gym_vasa')
eq('lowercase "hoist" @ VASA → 2 sessions', hoistLowerAtVasa.length, 2)

console.log('\n── 7. debug-backup.json baseline ──')

const backupPath = new URL('../../../debug-backup.json', import.meta.url)
let backup
try {
  backup = JSON.parse(readFileSync(backupPath, 'utf8'))
} catch (e) {
  console.log(`  ⚠ couldn't load debug-backup.json (${e.message}) — skipping baseline`)
  process.exit(fail > 0 ? 1 : 0)
}

// Slim state shape — migrations need sessions + library
function slugify(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') }
const library = EXERCISE_LIBRARY.map(raw => ({
  id: `ex_${slugify(raw.name)}`, name: raw.name, aliases: [],
  primaryMuscles: [raw.muscleGroup], equipment: raw.equipment,
  isBuiltIn: true, defaultUnilateral: false, loadIncrement: 5,
  defaultRepRange: [8, 12],
  progressionClass: raw.muscleGroup === 'Full Body' ? 'compound' : raw.equipment === 'Bodyweight' ? 'bodyweight' : 'isolation',
  needsTagging: false, createdAt: '2026-04-17',
}))

const v2 = migrateSessionsToV2(backup.sessions)
const { sessions } = migrateSessionsToV3({ sessions: v2, library })

const sessionsWithGymId = sessions.filter(s => typeof s.gymId === 'string' && s.gymId)
eq('real backup has 0 gymId tags (pre-16n data)', sessionsWithGymId.length, 0)

// Pick an exercise with the most history for a meaningful comparison
const counts = new Map()
for (const s of sessions) {
  if (s.mode !== 'bb') continue
  for (const ex of (s.data?.exercises || [])) {
    if (!ex.exerciseId) continue
    counts.set(ex.exerciseId, (counts.get(ex.exerciseId) || 0) + 1)
  }
}
const [topId, topN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ['ex_pec_dec', 0]
console.log(`  (exercising ${topId} — ${topN} sessions in backup)`)

const pre20 = getExerciseHistory(sessions, topId)
const post20NoGym = getExerciseHistory(sessions, topId, null, null, null)
eq('null gymId matches pre-Batch-20 (all sessions)',  post20NoGym.length, pre20.length)
eq('null gymId e1RMs unchanged',                      post20NoGym.map(h => h.e1RM), pre20.map(h => h.e1RM))

const scopedSynthetic = getExerciseHistory(sessions, topId, null, null, 'gym_any')
eq('scoped by synthetic gymId → empty (no tagged sessions)', scopedSynthetic, [])

const instPre20  = getInstancesForExercise(sessions, topId)
const instPost20 = getInstancesForExercise(sessions, topId, null, null)
eq('getInstancesForExercise with null gymId matches pre-20', instPost20, instPre20)

const instScoped = getInstancesForExercise(sessions, topId, null, 'gym_any')
eq('getInstancesForExercise scoped by synthetic gymId → empty', instScoped, [])

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✓' : '✗'} ${pass}/${pass + fail} assertions passed`)
process.exit(fail > 0 ? 1 : 0)
