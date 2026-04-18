// Sanity check for Batch 16q anomaly detectors (spec §4.5, step 9).
// Confirms detectPlateau / detectRegression / detectSwing fire on synthetic
// scenarios, respect their minSessions + quality gates, and that the
// detectAnomalies aggregator applies the right priority order.
// Run: node anomaly-sanity.mjs (from worktree root)

import { readFileSync } from 'node:fs'
import {
  detectPlateau, detectRegression, detectSwing, detectAnomalies,
  getExerciseHistory,
  migrateSessionsToV2, migrateSessionsToV3,
} from './src/utils/helpers.js'
import { EXERCISE_LIBRARY } from './src/data/exerciseLibrary.js'

function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') }

function buildBuiltInLibrary() {
  return EXERCISE_LIBRARY.map(raw => ({
    id: `ex_${slugify(raw.name)}`,
    name: raw.name, aliases: [],
    primaryMuscles: [raw.muscleGroup], equipment: raw.equipment,
    isBuiltIn: true, defaultUnilateral: false, loadIncrement: 5,
    defaultRepRange: [8, 12],
    progressionClass: raw.muscleGroup === 'Full Body' ? 'compound' : raw.equipment === 'Bodyweight' ? 'bodyweight' : 'isolation',
    needsTagging: false, createdAt: '2026-04-17',
  }))
}

// Helper: construct a synthetic history with given e1RM values. Sessions
// are spaced 2 days apart so getProgressionRate sees a clean x-axis.
function synth(e1RMs) {
  const start = new Date('2026-01-01').getTime()
  return e1RMs.map((e, i) => ({
    date:   new Date(start + i * 2 * 86400000).toISOString(),
    weight: Math.round(e / 1.33 * 10) / 10,      // back out weight from Epley at ~10 reps
    reps:   10,
    e1RM:   e,
  }))
}

let passCount = 0
let failCount = 0
function expect(label, cond, detail = '') {
  const mark = cond ? '✓' : '✗'
  console.log(`  ${label.padEnd(56)} ${mark} ${detail}`)
  if (cond) passCount++
  else failCount++
}

// ── 1. Synthetic scenarios ───────────────────────────────────────────────
console.log('━━━ Synthetic scenarios ━━━')

// Plateau: 6 identical values → plateau fires, regression + swing silent.
{
  const h = synth([200, 200, 200, 200, 200, 200])
  const pl = detectPlateau(h)
  const rg = detectRegression(h)
  const sw = detectSwing(h)
  const agg = detectAnomalies(h)
  expect('Plateau: 6 flat e1RMs → plateau triggers',      pl?.triggered === true, `rate=${pl?.rate?.toFixed(4)}, n=${pl?.n}`)
  expect('Plateau: regression stays silent',              !rg)
  expect('Plateau: swing stays silent',                   !sw)
  expect('Plateau: aggregator returns plateau',           agg?.kind === 'plateau')
}

// Regression: clear downtrend.
{
  const h = synth([200, 195, 190, 185, 180, 175])
  const pl = detectPlateau(h)
  const rg = detectRegression(h)
  const sw = detectSwing(h)
  const agg = detectAnomalies(h)
  expect('Regression: declining → regression triggers',    rg?.triggered === true, `rate=${rg?.rate?.toFixed(4)}, R²=${rg?.rSquared?.toFixed(2)}`)
  expect('Regression: plateau stays silent',               !pl)
  expect('Regression: swing stays silent (5% delta)',      !sw)
  expect('Regression: aggregator returns regression',      agg?.kind === 'regression')
}

// Swing: stable history then big jump up.
{
  const h = synth([180, 180, 180, 180, 180, 250])
  const pl = detectPlateau(h)
  const rg = detectRegression(h)
  const sw = detectSwing(h)
  const agg = detectAnomalies(h)
  expect('Swing: +39% last-over-prev → swing triggers',    sw?.triggered === true, `delta=${(sw?.delta * 100).toFixed(1)}% ${sw?.direction}`)
  expect('Swing: regression stays silent (upward)',        !rg)
  expect('Swing: plateau stays silent (big variance)',     !pl)
  expect('Swing: aggregator returns swing',                agg?.kind === 'swing')
}

// Swing downward: big drop last session.
{
  const h = synth([200, 200, 200, 200, 200, 130])
  const sw = detectSwing(h)
  expect('Swing (down): -35% → swing triggers',             sw?.triggered === true, `delta=${(sw?.delta * 100).toFixed(1)}% ${sw?.direction}`)
}

// Mixed: regression AND swing both fire → regression wins priority.
{
  const h = synth([200, 185, 170, 155, 140, 90])
  const rg = detectRegression(h)
  const sw = detectSwing(h)
  const agg = detectAnomalies(h)
  expect('Priority: regression + swing both fire',          rg?.triggered && sw?.triggered)
  expect('Priority: aggregator returns regression first',   agg?.kind === 'regression')
}

// Small positive trend → nothing should fire.
{
  const h = synth([180, 185, 188, 190, 192, 194])
  const agg = detectAnomalies(h)
  expect('Healthy gains: nothing fires',                    agg == null, `(agg=${agg?.kind || 'null'})`)
}

console.log('')

// ── 2. Edge cases ────────────────────────────────────────────────────────
console.log('━━━ Edge cases ━━━')

expect('Empty history: detectAnomalies → null',           detectAnomalies([]) == null)
expect('n=1: detectAnomalies → null',                     detectAnomalies(synth([200])) == null)
expect('n=2 flat: plateau NOT triggered (needs 6)',       detectPlateau(synth([200, 200])) == null)
expect('n=2 flat: swing NOT triggered (0% delta)',        detectSwing(synth([200, 200])) == null)
expect('n=3 flat: plateau NOT triggered (needs 6)',       detectPlateau(synth([200, 200, 200])) == null)
expect('n=5 flat: plateau NOT triggered (needs 6)',       detectPlateau(synth([200, 200, 200, 200, 200])) == null)
expect('n=2 big swing: swing triggers',                   detectSwing(synth([200, 300]))?.triggered === true)
expect('Null input: detectAnomalies → null',              detectAnomalies(null) == null)

// Noisy scatter with slightly negative mean shouldn't fire regression.
{
  const h = synth([200, 180, 210, 170, 200, 185])   // noisy, no clear trend
  const rg = detectRegression(h)
  expect('Noisy history: regression silent (low R²)',     !rg?.triggered)
}

console.log('')

// ── 3. Real data ─────────────────────────────────────────────────────────
console.log('━━━ Real data from debug-backup.json ━━━')

try {
  const backup = JSON.parse(readFileSync(new URL('../../../debug-backup.json', import.meta.url)))
  const v2 = migrateSessionsToV2(backup.sessions || [])
  const { sessions, library } = migrateSessionsToV3({ sessions: v2, library: buildBuiltInLibrary() })

  console.log(`Loaded ${sessions.length} sessions, ${library.length} library entries.`)

  const targets = ['Pec Dec', 'Chest Supported Wide Row', 'Seated Cable Row', 'Incline DB Press', 'Flat Bench Press']
  for (const name of targets) {
    const entry = library.find(e => e.name.toLowerCase() === name.toLowerCase()) || library.find(e => new RegExp(name, 'i').test(e.name))
    if (!entry) { console.log(`  ${name.padEnd(30)} → not found in library`); continue }
    const h = getExerciseHistory(sessions, entry.id, entry.name)
    const agg = detectAnomalies(h)
    if (!h.length) {
      console.log(`  ${entry.name.padEnd(30)} → no history`)
      continue
    }
    const summary = agg
      ? `${agg.kind} — ${JSON.stringify(agg).slice(0, 120)}`
      : 'nothing fires'
    console.log(`  ${entry.name.padEnd(30)} n=${String(h.length).padEnd(3)} last e1RM=${Math.round(h[h.length - 1].e1RM)}  → ${summary}`)
  }
} catch (err) {
  console.log(`  (skipped real-data pass — ${err.message})`)
}

console.log('')
console.log(`━━━ ${passCount} pass, ${failCount} fail ━━━`)
process.exit(failCount === 0 ? 0 : 1)
