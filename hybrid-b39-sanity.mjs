// hybrid-b39-sanity.mjs — Batch 39 validation
//
// Validates type display helpers (getTypeColor / getTypeLabel /
// getTypeFilterBucket / formatLastSetSummary) and the predictExerciseMeta
// type-prediction integration. Run from the worktree root:
//   node hybrid-b39-sanity.mjs
//
// Mirrors the existing rep-range / hybrid-b37 / hybrid-b38 patterns.

import {
  getTypeColor, getTypeLabel, getTypeFilterBucket, formatLastSetSummary,
  predictExerciseMeta, classifyType,
} from './src/utils/helpers.js'

let pass = 0, fail = 0
function t(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else    { fail++; console.log(`  ✗ ${label}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`) }
}
function tOk(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else      { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`) }
}

console.log('\n── getTypeColor ───────────────────────────────────────────')
t('weight-training → blue', getTypeColor('weight-training'), '#60A5FA')
t('running → green',         getTypeColor('running'),         '#34D399')
t('hyrox-station → yellow',  getTypeColor('hyrox-station'),   '#EAB308')
t('hyrox-round → yellow',    getTypeColor('hyrox-round'),     '#EAB308')
t('null → blue (default)',   getTypeColor(null),              '#60A5FA')
t('unknown → blue (default)', getTypeColor('garbage'),        '#60A5FA')

console.log('\n── getTypeLabel ───────────────────────────────────────────')
t('weight-training → WEIGHT', getTypeLabel('weight-training'), 'WEIGHT')
t('running → RUN',            getTypeLabel('running'),         'RUN')
t('hyrox-station → HYROX',    getTypeLabel('hyrox-station'),   'HYROX')
t('hyrox-round → HYROX',      getTypeLabel('hyrox-round'),     'HYROX')
t('undefined → WEIGHT',       getTypeLabel(undefined),         'WEIGHT')

console.log('\n── getTypeFilterBucket ────────────────────────────────────')
t('weight-training → lift',  getTypeFilterBucket('weight-training'), 'lift')
t('running → run',           getTypeFilterBucket('running'),         'run')
t('hyrox-station → hyrox',   getTypeFilterBucket('hyrox-station'),   'hyrox')
t('hyrox-round → hyrox',     getTypeFilterBucket('hyrox-round'),     'hyrox')
t('null → lift (default)',   getTypeFilterBucket(null),              'lift')

console.log('\n── formatLastSetSummary — weight-training ─────────────────')
t('185 × 10', formatLastSetSummary({ weight: 185, reps: 10, type: 'working' }, 'weight-training'), '185 × 10')
t('unilateral 50/100 × 12 (perSide)', formatLastSetSummary({ weight: 100, rawWeight: 50, reps: 12, type: 'working' }, 'weight-training'), '50 × 12')
t('reps only',  formatLastSetSummary({ weight: 0, reps: 8 }, 'weight-training'), '8 reps')
t('weight only', formatLastSetSummary({ weight: 95, reps: 0 }, 'weight-training'), '95 lb')
t('null set → null', formatLastSetSummary(null, 'weight-training'), null)
t('empty set → null', formatLastSetSummary({}, 'weight-training'), null)

console.log('\n── formatLastSetSummary — running ─────────────────────────')
t('1.2 mi · 12:30', formatLastSetSummary({ distanceMiles: 1.2, timeSec: 750 }, 'running'), '1.2 mi · 12:30')
t('miles only',     formatLastSetSummary({ distanceMiles: 3.1 }, 'running'), '3.1 mi')
t('time only',      formatLastSetSummary({ timeSec: 1800 }, 'running'), '30:00')
t('hour-long time', formatLastSetSummary({ timeSec: 3725 }, 'running'), '1:02:05')
t('empty → null',   formatLastSetSummary({}, 'running'), null)
t('null set → null', formatLastSetSummary(null, 'running'), null)

console.log('\n── formatLastSetSummary — hyrox-station ───────────────────')
t('SkiErg 500m · 2:22', formatLastSetSummary({ distanceMeters: 500, timeSec: 142 }, 'hyrox-station'), '500m · 2:22')
t('Wall Balls 100 reps', formatLastSetSummary({ reps: 100, weight: null }, 'hyrox-station'), '100 reps')
t('Sled Push 100lb · 50m', formatLastSetSummary({ weight: 100, distanceMeters: 50 }, 'hyrox-station'), '100 lb · 50m')
t('Wall Balls 6kg ball + 100 reps', formatLastSetSummary({ weight: 13, reps: 100 }, 'hyrox-station'), '13 lb · 100 reps')
t('empty → null', formatLastSetSummary({}, 'hyrox-station'), null)

console.log('\n── formatLastSetSummary — hyrox-round ─────────────────────')
t('round entry → null (rounds[] not in flat set)', formatLastSetSummary({ weight: 100 }, 'hyrox-round'), null)

console.log('\n── classifyType + predictExerciseMeta integration ─────────')
// These already have coverage in hybrid-b37-sanity.mjs; we re-spot-check
// the key cases to confirm the modal's auto-predict will fire correctly.
t('Bench Press → weight-training', classifyType('Bench Press'), 'weight-training')
t('Easy Run → running',            classifyType('Easy Run'),    'running')
t('SkiErg → hyrox-station',        classifyType('SkiErg'),      'hyrox-station')
t('HYROX Simulation Round → hyrox-round',
  classifyType('HYROX Simulation Round'), 'hyrox-round')

const benchPred = predictExerciseMeta('Bench Press')
tOk('Bench Press prediction has type=weight-training', benchPred?.type === 'weight-training')
tOk('Bench Press prediction has primaryMuscles', Array.isArray(benchPred?.primaryMuscles) && benchPred.primaryMuscles.length > 0)
tOk('Bench Press prediction has equipment',      typeof benchPred?.equipment === 'string')

const skiergPred = predictExerciseMeta('SkiErg')
tOk('SkiErg prediction has type=hyrox-station',  skiergPred?.type === 'hyrox-station')
tOk('SkiErg prediction has Full Body muscle',    skiergPred?.primaryMuscles?.includes('Full Body'))

const easyRunPred = predictExerciseMeta('Easy Run')
tOk('Easy Run prediction has type=running',  easyRunPred?.type === 'running')

const totallyUnknownPred = predictExerciseMeta('Totally Unknown Move')
tOk('Unknown name → null prediction', totallyUnknownPred === null)

console.log(`\n── Result: ${pass} passed, ${fail} failed ─────────────────────\n`)
process.exit(fail > 0 ? 1 : 0)
