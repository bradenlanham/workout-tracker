// hybrid-b40-sanity.mjs — Batch 40 split-import sanity check.
//
// Validates:
//   1. brooke-hybrid-split.json v3 parses + every hyrox-round has a valid
//      roundConfig + every hyrox-station name resolves to the 8-catalog.
//   2. importLibraryEntryFromSplit decision matrix across 8 input shapes.
//   3. collectLibraryAdditionsFromSplit dedup + aggregation.
//   4. End-to-end synthetic import: empty user library (no v8 migration run)
//      + Brooke's split → expected library additions counted.
//   5. End-to-end realistic import: user has 8 catalog stations seeded
//      + Brooke's split → only the new entries (rounds + running + custom
//      lifts) get added, stations resolve to existingId.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  importLibraryEntryFromSplit,
  collectLibraryAdditionsFromSplit,
  classifyType,
  defaultDimensionsForType,
} from './src/utils/helpers.js'
import { HYROX_STATIONS, buildHyroxStationLibraryEntry } from './src/data/hyroxStations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let pass = 0
let fail = 0
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`) }
}

// ── 1. Brooke JSON v3 parses and shape is correct ──────────────────────────
console.log('\n[1] brooke-hybrid-split.json v3 shape')

const brookePath = path.join(__dirname, 'brooke-hybrid-split.json')
const brooke = JSON.parse(fs.readFileSync(brookePath, 'utf-8'))

check('top-level type=bambam-split-export', brooke.type === 'bambam-split-export')
check('version === 3', brooke.version === 3)
check('split.workouts is an array of 6', Array.isArray(brooke.split.workouts) && brooke.split.workouts.length === 6)
check('rotation has 7 entries (sun-sat)', brooke.split.rotation?.length === 7)

const stationIds = new Set(HYROX_STATIONS.map(s => s.id))
const stationNamesNormalized = new Set(HYROX_STATIONS.map(s => s.name.toLowerCase()))

let hyroxStationCount = 0
let hyroxRoundCount = 0
let runningCount = 0
let weightTrainingCount = 0

for (const workout of brooke.split.workouts) {
  for (const section of workout.sections) {
    for (const ex of section.exercises) {
      if (!ex || typeof ex !== 'object') continue
      const t = ex.type
      if (t === 'hyrox-station') {
        hyroxStationCount++
        check(
          `Thursday "${ex.name}" matches a catalog station`,
          stationNamesNormalized.has(ex.name.toLowerCase()),
          `not found in [${[...stationNamesNormalized].join(', ')}]`
        )
      } else if (t === 'hyrox-round') {
        hyroxRoundCount++
        check(
          `${workout.name} → "${ex.name}" has roundConfig`,
          !!ex.roundConfig
        )
        const rc = ex.roundConfig || {}
        const hasStation = typeof rc.stationId === 'string' && rc.stationId
        const hasPool = Array.isArray(rc.rotationPool) && rc.rotationPool.length > 0
        check(
          `${ex.name} roundConfig has stationId or rotationPool`,
          hasStation || hasPool
        )
        if (hasStation) {
          check(`${ex.name} stationId "${rc.stationId}" exists in catalog`, stationIds.has(rc.stationId))
        }
        if (hasPool) {
          for (const sid of rc.rotationPool) {
            check(`${ex.name} rotationPool entry "${sid}" exists in catalog`, stationIds.has(sid))
          }
        }
        check(
          `${ex.name} has runDimensions.distance.default > 0`,
          typeof rc.runDimensions?.distance?.default === 'number' && rc.runDimensions.distance.default > 0
        )
        check(
          `${ex.name} has defaultRoundCount > 0`,
          typeof rc.defaultRoundCount === 'number' && rc.defaultRoundCount > 0
        )
        check(
          `${ex.name} has defaultRestSeconds >= 0`,
          typeof rc.defaultRestSeconds === 'number' && rc.defaultRestSeconds >= 0
        )
      } else if (t === 'running') {
        runningCount++
      } else if (t === 'weight-training') {
        weightTrainingCount++
      }
    }
  }
}

check(`exactly 3 hyrox-station entries (Thursday: Farmers + Sled Push + Sled Pull)`, hyroxStationCount === 3, `got ${hyroxStationCount}`)
check(`exactly 3 hyrox-round entries (Tue + Fri + Sat)`, hyroxRoundCount === 3, `got ${hyroxRoundCount}`)
check(`exactly 4 running entries`, runningCount === 4, `got ${runningCount}`)
check(`weight-training count > 20`, weightTrainingCount > 20, `got ${weightTrainingCount}`)

// ── 2. importLibraryEntryFromSplit decision matrix ─────────────────────────
console.log('\n[2] importLibraryEntryFromSplit decision matrix')

const stationLibrary = HYROX_STATIONS.map(buildHyroxStationLibraryEntry)

// 2a — existing match
const r1 = importLibraryEntryFromSplit(
  { name: 'SkiErg', type: 'hyrox-station' },
  stationLibrary
)
check('existing hyrox-station resolves to existingId', r1.existingId === 'sta_skierg')

// 2b — case-insensitive match
const r2 = importLibraryEntryFromSplit(
  { name: 'sled push', type: 'hyrox-station' },
  stationLibrary
)
check('case-insensitive station name resolves', r2.existingId === 'sta_sled_push')

// 2c — hyrox-station not in catalog → error
const r3 = importLibraryEntryFromSplit(
  { name: 'Custom Sled Variant', type: 'hyrox-station' },
  stationLibrary
)
check('unknown hyrox-station name errors', !!r3.error)

// 2d — valid hyrox-round → create
const r4 = importLibraryEntryFromSplit(
  {
    name: 'Test Round',
    type: 'hyrox-round',
    roundConfig: {
      runDimensions: { distance: { default: 800, unit: 'm' } },
      stationId: 'sta_skierg',
      defaultRoundCount: 4,
      defaultRestSeconds: 120,
    },
  },
  stationLibrary
)
check('valid hyrox-round produces create entry', !!r4.create && r4.create.type === 'hyrox-round')
check('hyrox-round create carries roundConfig', !!r4.create?.roundConfig?.stationId)

// 2e — hyrox-round missing roundConfig → error
const r5 = importLibraryEntryFromSplit(
  { name: 'Bad Round', type: 'hyrox-round' },
  stationLibrary
)
check('hyrox-round w/o roundConfig errors', !!r5.error)

// 2f — running → create
const r6 = importLibraryEntryFromSplit(
  { name: 'Easy Run', type: 'running' },
  stationLibrary
)
check('running produces create entry', !!r6.create && r6.create.type === 'running')

// 2g — weight-training without library match → create with needsTagging
const r7 = importLibraryEntryFromSplit(
  { name: 'Reverse Hack Squat', type: 'weight-training' },
  stationLibrary
)
check('weight-training new entry is needsTagging', !!r7.create && r7.create.needsTagging === true)

// 2h — no type → skip
const r8 = importLibraryEntryFromSplit(
  { name: 'Legacy Entry' },
  stationLibrary
)
check('untyped entry skips', r8.skip === true)

// ── 3. collectLibraryAdditionsFromSplit dedup ──────────────────────────────
console.log('\n[3] collectLibraryAdditionsFromSplit dedup')

const dupSplit = {
  workouts: [
    {
      sections: [
        {
          exercises: [
            { name: 'Easy Run', type: 'running' },
            { name: 'Easy Run', type: 'running' }, // duplicate within payload
            { name: 'easy run', type: 'running' }, // case-insensitive duplicate
          ],
        },
      ],
    },
  ],
}
const { toCreate: dupCreate } = collectLibraryAdditionsFromSplit(dupSplit, [])
check('duplicate Easy Run dedupes to 1 create', dupCreate.length === 1)

const malformedSplit = {
  workouts: [
    {
      sections: [
        {
          exercises: [
            { name: 'Bad Station', type: 'hyrox-station' },
            { name: 'Good Run', type: 'running' },
          ],
        },
      ],
    },
  ],
}
const { toCreate: mixCreate, errors: mixErrors } = collectLibraryAdditionsFromSplit(malformedSplit, stationLibrary)
check('malformed entry produces error', mixErrors.length === 1)
check('valid entry still produces a create', mixCreate.length === 1 && mixCreate[0].type === 'running')

// ── 4. End-to-end import — Brooke against empty library ────────────────────
console.log('\n[4] Brooke JSON against empty library (pre-v8 user)')

const { toCreate: emptyCreate, errors: emptyErrors } = collectLibraryAdditionsFromSplit(brooke.split, [])
// Without seeded stations, the 3 hyrox-station entries surface as errors.
check('3 hyrox-station entries error against empty lib', emptyErrors.length === 3, `got ${emptyErrors.length}`)
// 3 rounds + 4 running + 27 unique weight-training names = 34 creates
const emptyCreateTypes = emptyCreate.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc }, {})
check('empty-lib import: 3 hyrox-rounds queued', emptyCreateTypes['hyrox-round'] === 3, `got ${emptyCreateTypes['hyrox-round']}`)
check('empty-lib import: 4 running queued', emptyCreateTypes['running'] === 4, `got ${emptyCreateTypes['running']}`)
check('empty-lib import: weight-training count >= 20', (emptyCreateTypes['weight-training'] || 0) >= 20, `got ${emptyCreateTypes['weight-training']}`)

// ── 5. End-to-end import — Brooke against seeded stations ──────────────────
console.log('\n[5] Brooke JSON against catalog-seeded library (post-v8 user)')

const { toCreate: realCreate, errors: realErrors } = collectLibraryAdditionsFromSplit(brooke.split, stationLibrary)
check('zero errors against seeded library', realErrors.length === 0, `errors: ${JSON.stringify(realErrors)}`)
const realCreateTypes = realCreate.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc }, {})
check('seeded-lib import: 3 hyrox-rounds queued', realCreateTypes['hyrox-round'] === 3)
check('seeded-lib import: 4 running queued', realCreateTypes['running'] === 4)
check('seeded-lib import: 0 hyrox-station queued (resolved to catalog)', !realCreateTypes['hyrox-station'])

// Verify the round configs preserve their stationIds / pools through the import
const tuesdayRound = realCreate.find(e => e.name === 'HYROX Run + SkiErg Round')
check('Tuesday round preserves stationId=sta_skierg', tuesdayRound?.roundConfig?.stationId === 'sta_skierg')
check('Tuesday round preserves runDistance=800', tuesdayRound?.roundConfig?.runDimensions?.distance?.default === 800)
check('Tuesday round preserves defaultRoundCount=4', tuesdayRound?.roundConfig?.defaultRoundCount === 4)
check('Tuesday round preserves defaultRestSeconds=120', tuesdayRound?.roundConfig?.defaultRestSeconds === 120)

const fridayRound = realCreate.find(e => e.name === 'HYROX Simulation Round')
check('Friday round uses rotationPool (not stationId)', !fridayRound?.roundConfig?.stationId && Array.isArray(fridayRound?.roundConfig?.rotationPool))
check('Friday round rotationPool has 7 stations', fridayRound?.roundConfig?.rotationPool?.length === 7)
check('Friday round runDistance=1000', fridayRound?.roundConfig?.runDimensions?.distance?.default === 1000)

const saturdayRound = realCreate.find(e => e.name === 'Wall Balls + 200m Run Round')
check('Saturday round stationId=sta_wall_balls', saturdayRound?.roundConfig?.stationId === 'sta_wall_balls')
check('Saturday round runDistance=200', saturdayRound?.roundConfig?.runDimensions?.distance?.default === 200)
check('Saturday round defaultRoundCount=3', saturdayRound?.roundConfig?.defaultRoundCount === 3)

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} pass`)
if (fail > 0) {
  console.log(`${fail} FAIL`)
  process.exit(1)
}
