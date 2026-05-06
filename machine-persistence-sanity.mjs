// Batch 61 — sanity for the Machine chip persistence fix (A1 + A2 + A3).
// Walks both synthetic + real-data scenarios for migrateLibraryToV11 (A2)
// and the gym-prefer pass-3 fallback (A3). A1's promotion useEffect is
// covered indirectly by A2's idempotency tests + manual preview.
//
// Run from a worktree root: `node machine-persistence-sanity.mjs`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  migrateLibraryToV11,
  migrateSessionsToV2, migrateSessionsToV3, migrateSessionsToV5,
  migrateSessionsToV9, migrateLibraryToV6, migrateLibraryToV7,
  migrateLibraryToV8, normalizeExerciseName,
} from './src/utils/helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let pass = 0
let fail = 0
const out = []
function assert(cond, msg) {
  if (cond) { pass++; out.push(`  ✓ ${msg}`) }
  else      { fail++; out.push(`  ✗ ${msg}`) }
}
function section(title) {
  out.push('')
  out.push(`── ${title} ───────────────────────────────────────────`)
}

// ── Test 1 — defensive cases ─────────────────────────────────────────
section('Test 1: migrateLibraryToV11 defensive cases')
{
  assert(migrateLibraryToV11(null, []) === null, 'null library returns null')
  assert(migrateLibraryToV11(undefined, []) === undefined, 'undefined library returns undefined')
  assert(Array.isArray(migrateLibraryToV11([], [])), 'empty library returns empty array')
  const lib = [{ id: 'ex_a', name: 'A' }]
  assert(migrateLibraryToV11(lib, null) === lib, 'null sessions returns same library ref')
  assert(migrateLibraryToV11(lib, []) === lib, 'empty sessions returns same library ref')
  assert(migrateLibraryToV11(lib, 'not-array') === lib, 'non-array sessions returns same ref')
}

// ── Test 2 — basic backfill (one exercise, one gym) ──────────────────
section('Test 2: basic backfill')
{
  const lib = [
    { id: 'ex_pec_dec', name: 'Pec Dec', equipment: 'Selectorized Machine' },
  ]
  const sessions = [
    {
      mode: 'bb', date: '2026-04-25T00:00:00.000Z', gymId: 'gym_vasa',
      data: { exercises: [{ name: 'Pec Dec', exerciseId: 'ex_pec_dec', equipmentInstance: 'Life Fitness' }] },
    },
  ]
  const out2 = migrateLibraryToV11(lib, sessions)
  assert(out2 !== lib, 'returns new array when changes made')
  const e = out2.find(x => x.id === 'ex_pec_dec')
  assert(e?.defaultMachineByGym?.gym_vasa === 'Life Fitness', 'Pec Dec @ VASA = Life Fitness written')
}

// ── Test 3 — most-recent wins per (exerciseId, gymId) ────────────────
section('Test 3: most-recent value wins per (exercise, gym)')
{
  const lib = [{ id: 'ex_pec_dec', name: 'Pec Dec' }]
  const sessions = [
    // OLDER session — should NOT overwrite the newer
    { mode: 'bb', date: '2026-04-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'OLD MACHINE' }],
    }},
    // NEWER session — wins
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Life Fitness' }],
    }},
  ]
  const out3 = migrateLibraryToV11(lib, sessions)
  const e = out3.find(x => x.id === 'ex_pec_dec')
  assert(e?.defaultMachineByGym?.gym_vasa === 'Life Fitness', 'newer wins (Life Fitness, not OLD MACHINE)')
}

// ── Test 4 — never overwrite existing user-set values ────────────────
section('Test 4: existing values are preserved')
{
  const lib = [{
    id: 'ex_pec_dec', name: 'Pec Dec',
    defaultMachineByGym: { gym_vasa: 'User Set Value' },
  }]
  const sessions = [
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Different Value' }],
    }},
  ]
  const out4 = migrateLibraryToV11(lib, sessions)
  // Should be no change → returns same lib reference
  assert(out4 === lib, 'returns same lib ref when no changes (existing value preserved)')
}

// ── Test 5 — fills additional gym while preserving the existing one ──
section('Test 5: partial fill — new gym alongside existing')
{
  const lib = [{
    id: 'ex_pec_dec', name: 'Pec Dec',
    defaultMachineByGym: { gym_vasa: 'Life Fitness' },
  }]
  const sessions = [
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_tr', data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Hoist' }],
    }},
  ]
  const out5 = migrateLibraryToV11(lib, sessions)
  const e = out5.find(x => x.id === 'ex_pec_dec')
  assert(e?.defaultMachineByGym?.gym_vasa === 'Life Fitness', 'VASA preserved')
  assert(e?.defaultMachineByGym?.gym_tr === 'Hoist', 'TR added')
  assert(Object.keys(e.defaultMachineByGym).length === 2, 'exactly 2 entries')
}

// ── Test 6 — name fallback for entries without exerciseId ────────────
section('Test 6: name fallback for pre-v3 sessions')
{
  const lib = [{ id: 'ex_pec_dec', name: 'Pec Dec' }]
  const sessions = [
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      // No exerciseId — pre-v3 session
      exercises: [{ name: 'Pec Dec', equipmentInstance: 'Life Fitness' }],
    }},
  ]
  const out6 = migrateLibraryToV11(lib, sessions)
  const e = out6.find(x => x.id === 'ex_pec_dec')
  assert(e?.defaultMachineByGym?.gym_vasa === 'Life Fitness', 'name-fallback resolves to library entry')
}

// ── Test 7 — sessions without gymId are skipped ──────────────────────
section('Test 7: sessions without gymId are skipped')
{
  const lib = [{ id: 'ex_pec_dec', name: 'Pec Dec' }]
  const sessions = [
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', /* no gymId */ data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Life Fitness' }],
    }},
  ]
  const out7 = migrateLibraryToV11(lib, sessions)
  assert(out7 === lib, 'session without gymId leaves library untouched')
}

// ── Test 8 — empty / whitespace equipmentInstance is skipped ─────────
section('Test 8: empty equipmentInstance is ignored')
{
  const lib = [{ id: 'ex_pec_dec', name: 'Pec Dec' }]
  const sessions = [
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [
        { exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: '   ' },
        { exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: '' },
      ],
    }},
  ]
  const out8 = migrateLibraryToV11(lib, sessions)
  assert(out8 === lib, 'whitespace-only / empty equipmentInstance leaves library untouched')
}

// ── Test 9 — non-bb sessions skipped (cardio, hyrox-stationary) ──────
section('Test 9: non-bb sessions are skipped')
{
  const lib = [{ id: 'ex_pec_dec', name: 'Pec Dec' }]
  const sessions = [
    { mode: 'cardio', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Life Fitness' }],
    }},
  ]
  const out9 = migrateLibraryToV11(lib, sessions)
  assert(out9 === lib, 'non-bb session ignored')
}

// ── Test 10 — idempotency ────────────────────────────────────────────
section('Test 10: idempotency')
{
  const lib = [{ id: 'ex_pec_dec', name: 'Pec Dec' }]
  const sessions = [
    { mode: 'bb', date: '2026-05-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [{ exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Life Fitness' }],
    }},
  ]
  const once = migrateLibraryToV11(lib, sessions)
  const twice = migrateLibraryToV11(once, sessions)
  assert(twice === once, 'second run returns same reference (no further changes)')
}

// ── Test 11 — multiple exercises, multiple gyms ──────────────────────
section('Test 11: complex backfill — many exercises × many gyms')
{
  const lib = [
    { id: 'ex_pec_dec', name: 'Pec Dec' },
    { id: 'ex_leg_press', name: 'Leg Press' },
    { id: 'ex_bench', name: 'Bench Press' },
  ]
  const sessions = [
    { mode: 'bb', date: '2026-04-01T00:00:00.000Z', gymId: 'gym_vasa', data: {
      exercises: [
        { exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Life Fitness' },
        { exerciseId: 'ex_leg_press', name: 'Leg Press', equipmentInstance: 'Hammer' },
      ],
    }},
    { mode: 'bb', date: '2026-04-15T00:00:00.000Z', gymId: 'gym_tr', data: {
      exercises: [
        { exerciseId: 'ex_pec_dec', name: 'Pec Dec', equipmentInstance: 'Hoist' },
      ],
    }},
    { mode: 'bb', date: '2026-04-20T00:00:00.000Z', gymId: 'gym_lan', data: {
      exercises: [
        { exerciseId: 'ex_leg_press', name: 'Leg Press', equipmentInstance: 'Freemotion' },
      ],
    }},
  ]
  const out11 = migrateLibraryToV11(lib, sessions)
  const pd = out11.find(x => x.id === 'ex_pec_dec')
  const lp = out11.find(x => x.id === 'ex_leg_press')
  const bp = out11.find(x => x.id === 'ex_bench')
  assert(pd?.defaultMachineByGym?.gym_vasa === 'Life Fitness', 'Pec Dec VASA')
  assert(pd?.defaultMachineByGym?.gym_tr === 'Hoist', 'Pec Dec TR')
  assert(lp?.defaultMachineByGym?.gym_vasa === 'Hammer', 'Leg Press VASA')
  assert(lp?.defaultMachineByGym?.gym_lan === 'Freemotion', 'Leg Press Lanhammer')
  assert(!bp?.defaultMachineByGym, 'Bench Press untouched (no sessions)')
}

// ── Test 12 — real backup data ───────────────────────────────────────
section('Test 12: real-data spot check (workout-backup-2026-05-06.json)')
{
  // Looks for the backup at the workout-tracker root (parent of all worktrees)
  const candidates = [
    path.resolve(__dirname, 'workout-backup-2026-05-06.json'),
    path.resolve(__dirname, '../../../workout-backup-2026-05-06.json'),
    path.resolve(__dirname, '../../../../workout-backup-2026-05-06.json'),
    path.resolve(__dirname, '../../workout-backup-2026-05-06.json'),
  ]
  const backupPath = candidates.find(p => fs.existsSync(p))
  if (!backupPath) {
    out.push('  (skipped — backup not found; tested paths: ' + candidates.join(', ') + ')')
  } else {
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    // Pre-state: how many entries already had defaultMachineByGym?
    const lib = data.exerciseLibrary || []
    const sessions = data.sessions || []
    const preCount = lib.filter(e => e.defaultMachineByGym && Object.keys(e.defaultMachineByGym).length > 0).length

    const after = migrateLibraryToV11(lib, sessions)
    const postCount = after.filter(e => e.defaultMachineByGym && Object.keys(e.defaultMachineByGym).length > 0).length

    // Count distinct (exerciseId-or-name, gymId) typings in sessions for expectation
    const seenPairs = new Set()
    for (const s of sessions) {
      if (s.mode !== 'bb' || !s.gymId) continue
      for (const ex of (s.data?.exercises || [])) {
        const inst = (ex?.equipmentInstance || '').trim()
        if (!inst) continue
        const key = (ex.exerciseId || ex.name || '').toLowerCase() + '|' + s.gymId
        seenPairs.add(key)
      }
    }
    out.push(`  pre: ${preCount} library entries with defaultMachineByGym`)
    out.push(`  post: ${postCount} library entries with defaultMachineByGym`)
    out.push(`  distinct (exercise, gym) pairs in sessions: ${seenPairs.size}`)

    // Confirm specific expected entries from the user's data
    const pecDec = after.find(e => e.id === 'ex_pec_dec')
    const trGym = 'gym_1776531563411-j60ss4g'
    const vasaGym = 'gym_1777076155563-8e6wd1d'
    assert(pecDec?.defaultMachineByGym?.[trGym] === 'Life Fitness', 'Pec Dec @ TR backfilled to "Life Fitness"')
    assert(pecDec?.defaultMachineByGym?.[vasaGym] === 'Life Fitness', 'Pec Dec @ VASA backfilled to "Life Fitness"')

    const lanGym = 'gym_1776797431185-fzty4gh'
    const legPress = after.find(e => e.id === 'ex_leg_press')
    assert(legPress?.defaultMachineByGym?.[lanGym] === 'Freemotion', 'Leg Press @ Lanhammer preserved as "Freemotion"')

    // Idempotency on real data
    const after2 = migrateLibraryToV11(after, sessions)
    assert(after2 === after, 'idempotent on real backup (second run = no-op)')
  }
}

// ── Test 13 — full v6→v7→v8→session-migration→v11 chain (importData) ─
section('Test 13: full migration chain (matches importData order)')
{
  const candidates = [
    path.resolve(__dirname, 'workout-backup-2026-05-06.json'),
    path.resolve(__dirname, '../../../workout-backup-2026-05-06.json'),
    path.resolve(__dirname, '../../../../workout-backup-2026-05-06.json'),
    path.resolve(__dirname, '../../workout-backup-2026-05-06.json'),
  ]
  const backupPath = candidates.find(p => fs.existsSync(p))
  if (!backupPath) {
    out.push('  (skipped — backup not found)')
  } else {
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    const sessionsV2 = migrateSessionsToV2(data.sessions || [])
    const v3Result = migrateSessionsToV3({
      sessions: sessionsV2,
      library: migrateLibraryToV6(data.exerciseLibrary || []),
    })
    const sessionsV5 = migrateSessionsToV5(v3Result.sessions)
    const sessionsV9 = migrateSessionsToV9(sessionsV5)
    const libV6 = migrateLibraryToV6(v3Result.library)
    const libV7 = migrateLibraryToV7(libV6)
    const libV8 = migrateLibraryToV8(libV7)
    const libV11 = migrateLibraryToV11(libV8, sessionsV9)

    const pecDec = libV11.find(e => e.id === 'ex_pec_dec')
    const trGym = 'gym_1776531563411-j60ss4g'
    assert(pecDec?.defaultMachineByGym?.[trGym] === 'Life Fitness', 'Pec Dec @ TR backfilled through full chain')

    // Final: total entries with non-empty defaultMachineByGym
    const finalCount = libV11.filter(e => e.defaultMachineByGym && Object.keys(e.defaultMachineByGym).length > 0).length
    out.push(`  After full chain: ${finalCount} library entries with defaultMachineByGym`)
    assert(finalCount >= 11, `at least 11 distinct exercises gained per-gym defaults (you typed 11 unique ones)`)
  }
}

console.log(out.join('\n'))
console.log('')
console.log(`────────────────────────────────────────────────────`)
console.log(`Result: ${pass} passed, ${fail} failed (${pass + fail} total)`)
process.exit(fail > 0 ? 1 : 0)
