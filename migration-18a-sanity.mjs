// Sanity check for Batch 18a's normalizeExerciseEntry helper.
//
// Walks every split's workouts' sections' exercises in debug-backup.json,
// counts entries by shape category, and reports:
//   - Per-shape histogram of what's actually in the store.
//   - Entries the Batch 17g normalizer would drop that 18a preserves.
//   - Entries 18a also drops (truly nameless — these should be zero for
//     clean data).
//
// Usage: `node migration-18a-sanity.mjs` from the worktree root.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeExerciseEntry } from './src/utils/helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolve the backup from the repo root (three parents up from a worktree).
const candidates = [
  path.resolve(__dirname, 'debug-backup.json'),
  path.resolve(__dirname, '../../../debug-backup.json'),
]
const backupPath = candidates.find(p => fs.existsSync(p))
if (!backupPath) {
  console.error('Could not find debug-backup.json. Tried:')
  candidates.forEach(p => console.error(`  ${p}`))
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
// The backup is a zustand persist blob; the splits live under .state.splits
// for a post-v3 export, or at the top level for older ones.
const splits = raw?.state?.splits ?? raw?.splits ?? []

console.log(`Loaded ${splits.length} splits from ${path.relative(process.cwd(), backupPath)}\n`)

// Batch 17g normalizer, reproduced verbatim — what we're comparing against.
function normalize17g(ex) {
  if (typeof ex === 'string') return ex
  if (ex?.name) return ex.rec ? { name: ex.name, rec: ex.rec } : ex.name
  return null
}

// Categorize an entry so we can see what's in the data.
function classify(ex) {
  if (ex == null) return 'null/undefined'
  if (typeof ex === 'string') return ex.trim() ? 'string' : 'empty-string'
  if (typeof ex !== 'object') return `primitive:${typeof ex}`
  const hasName = typeof ex.name === 'string' && ex.name.trim().length > 0
  const rec = ex.rec
  if (hasName && rec == null)                        return '{name}'
  if (hasName && typeof rec === 'string')            return '{name, rec:string}'
  if (hasName && typeof rec === 'object')            return '{name, rec:object}'
  if (!hasName && ex.exercise)                       return '{exercise fallback}'
  return 'malformed (no recoverable name)'
}

const shapes = new Map()
const drops17gPreserve18a = []
const drops18a            = []
let totalEntries = 0

for (const split of splits) {
  for (const workout of split.workouts || []) {
    for (const section of workout.sections || []) {
      for (const ex of section.exercises || []) {
        totalEntries++
        const cat = classify(ex)
        shapes.set(cat, (shapes.get(cat) || 0) + 1)

        const r17 = normalize17g(ex)
        const r18 = normalizeExerciseEntry(ex)

        if (r17 == null && r18 != null) {
          drops17gPreserve18a.push({
            split: split.name,
            workout: workout.name,
            section: section.label,
            entry: ex,
            preserved: r18,
          })
        }
        if (r18 == null && r17 != null) {
          // 18a drops something 17g preserved — would be a regression.
          drops18a.push({
            split: split.name,
            workout: workout.name,
            section: section.label,
            entry: ex,
            previouslyPreserved: r17,
          })
        }
      }
    }
  }
}

console.log(`Total exercise entries scanned: ${totalEntries}\n`)

console.log('── Shape histogram ──')
const sorted = Array.from(shapes.entries()).sort((a, b) => b[1] - a[1])
for (const [cat, count] of sorted) {
  console.log(`  ${cat.padEnd(32)} ${count}`)
}

console.log()
console.log('── Batch 18a recovery ──')
console.log(`  Entries 17g would drop, 18a preserves: ${drops17gPreserve18a.length}`)
for (const d of drops17gPreserve18a.slice(0, 10)) {
  console.log(`    ${d.split} → ${d.workout} → ${d.section}: ${JSON.stringify(d.entry)} → ${JSON.stringify(d.preserved)}`)
}
if (drops17gPreserve18a.length > 10) {
  console.log(`    …and ${drops17gPreserve18a.length - 10} more`)
}

console.log()
console.log('── Regressions ──')
console.log(`  Entries 17g preserved that 18a drops: ${drops18a.length}`)
if (drops18a.length > 0) {
  console.error('  REGRESSION — 18a is stricter than 17g on these entries:')
  for (const d of drops18a) {
    console.error(`    ${d.split} → ${d.workout} → ${d.section}: ${JSON.stringify(d.entry)}`)
  }
  process.exit(1)
}

console.log('\n✓ 18a preserves every entry 17g preserved. Zero regressions.\n')
