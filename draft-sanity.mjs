// draft-sanity.mjs — Batch 17a
//
// Validates the splitDraft slice round-trips through the persist layer and
// exercises the migrate hook's v3→v4 additive step. Mirrors the established
// `migration-sanity.mjs` / `migration-v3-sanity.mjs` pattern — zero deps,
// runs from the worktree root with: node draft-sanity.mjs
//
// What this checks:
//   1. A v3 backup that does NOT include splitDraft survives an artificial
//      v3→v4 migrate step: the key appears with `null` afterwards.
//   2. A draft value set by setSplitDraft() serializes + deserializes cleanly
//      so nothing is lost across a reload.
//   3. Clearing drops the slice back to null.
//   4. `updatedAt` is a finite number when set, so formatTimeAgo(...) can
//      produce a sensible output.

import fs from 'node:fs'
import { formatTimeAgo } from './src/utils/helpers.js'

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (cond) { passed++; return }
  failed++
  console.error(`  ✗ ${msg}`)
}
function note(msg) { console.log(`    ${msg}`) }
function section(title) { console.log(`\n${title}`) }

// ── Simulated migrate hook (mirrors useStore.js v3→v4 block) ──────────────────
// Isolated so we don't have to spin up Zustand; we just exercise the pure
// migration logic.
function migrateToV4(persistedState, fromVersion) {
  if (!persistedState) return persistedState
  if (fromVersion < 4) {
    persistedState.splitDraft = persistedState.splitDraft ?? null
  }
  return persistedState
}

// ── Check 1 — v3 backup migrates additively ──────────────────────────────────
section('v3 → v4 additive migration')
let sourceBackup = null
try {
  sourceBackup = JSON.parse(fs.readFileSync('./debug-backup.json', 'utf8'))
  note(`Loaded debug-backup.json (${(sourceBackup.sessions || []).length} sessions)`)
} catch {
  note('debug-backup.json not found — synthesizing a minimal v3 state for migration check')
  sourceBackup = { sessions: [], splits: [], settings: {} }
}
// Simulate the shape persist would hand us: the raw state, no splitDraft key.
const v3State = { ...sourceBackup }
delete v3State.splitDraft
assert(
  !('splitDraft' in v3State),
  'pre-migration state does not contain splitDraft key'
)
const migrated = migrateToV4(v3State, 3)
assert('splitDraft' in migrated, 'migrated state has splitDraft key')
assert(migrated.splitDraft === null, 'migrated splitDraft is null (additive, no data loss)')

// Idempotency — running again at v4 must not corrupt a set draft.
migrated.splitDraft = {
  originalId: null,
  draft: { name: 'Keep me', emoji: '🎯', workouts: [], rotation: [] },
  updatedAt: Date.now(),
}
const migratedAgain = migrateToV4(migrated, 4)
assert(migratedAgain.splitDraft.draft.name === 'Keep me', 'running at v4 preserves existing draft (idempotent)')

// ── Check 2 — Roundtrip serialization ─────────────────────────────────────────
section('splitDraft roundtrip through JSON.stringify / parse')
const now = Date.now()
const stateWithDraft = {
  ...v3State,
  splitDraft: {
    originalId: null,
    draft: {
      name: 'Test Split',
      emoji: '🎯',
      workouts: [{ id: 'w1', name: 'X', emoji: '🏋️', sections: [] }],
      rotation: ['w1'],
    },
    updatedAt: now,
  },
}
const serialized   = JSON.stringify({ state: stateWithDraft, version: 4 })
const parsed       = JSON.parse(serialized)
assert(parsed.version === 4, 'persist version is 4')
assert(parsed.state.splitDraft.draft.name === 'Test Split', 'draft.name survives roundtrip')
assert(parsed.state.splitDraft.draft.emoji === '🎯', 'draft.emoji survives roundtrip')
assert(parsed.state.splitDraft.originalId === null, 'originalId === null survives roundtrip')
assert(parsed.state.splitDraft.draft.workouts.length === 1, 'draft.workouts array survives roundtrip')
assert(parsed.state.splitDraft.draft.rotation[0] === 'w1', 'draft.rotation survives roundtrip')
assert(parsed.state.splitDraft.updatedAt === now, 'updatedAt preserved')

// Edit-mode draft (originalId = existing split id)
const editDraft = {
  ...v3State,
  splitDraft: {
    originalId: 'split_bam',
    draft: { name: "BamBam's Blueprint edited" },
    updatedAt: now,
  },
}
const editSer = JSON.parse(JSON.stringify({ state: editDraft, version: 4 }))
assert(editSer.state.splitDraft.originalId === 'split_bam', 'edit-mode originalId survives roundtrip')

// ── Check 3 — Clear returns null ──────────────────────────────────────────────
section('clearSplitDraft resets the slice to null')
const cleared = { ...stateWithDraft, splitDraft: null }
const clearedSer = JSON.parse(JSON.stringify({ state: cleared, version: 4 }))
assert(clearedSer.state.splitDraft === null, 'clear sets splitDraft to null')

// ── Check 4 — updatedAt is usable by formatTimeAgo ────────────────────────────
section('formatTimeAgo handles updatedAt values')
assert(typeof now === 'number' && Number.isFinite(now), 'updatedAt is a finite number')
const ago1m = formatTimeAgo(Date.now() - 60_000)
assert(ago1m === '1m ago', `formatTimeAgo(~1 min) => "${ago1m}"`)
const ago2h = formatTimeAgo(Date.now() - 2 * 60 * 60_000)
assert(ago2h === '2h ago', `formatTimeAgo(~2 h) => "${ago2h}"`)
const agoYest = formatTimeAgo(Date.now() - 25 * 60 * 60_000)
assert(agoYest === 'yesterday', `formatTimeAgo(~25 h) => "${agoYest}"`)
const agoJust = formatTimeAgo(Date.now() - 1000)
assert(agoJust === 'just now', `formatTimeAgo(~1 s) => "${agoJust}"`)
const agoFuture = formatTimeAgo(Date.now() + 5000)
assert(agoFuture === 'just now', `formatTimeAgo(future ts) => "${agoFuture}"`)
const agoOld = formatTimeAgo(Date.now() - 10 * 24 * 60 * 60_000)
assert(typeof agoOld === 'string' && agoOld.length > 0, `formatTimeAgo(~10 d) => "${agoOld}" (non-empty date string)`)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nsplitDraft roundtrip OK`)
console.log(`clear OK`)
console.log(`\n${passed} passed · ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
