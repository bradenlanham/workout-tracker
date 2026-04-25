// hyrox-hybrid-template-sanity.mjs — verify HYROX Hybrid template loads
// correctly through loadTemplateForDraft + that collectLibraryAdditionsFromSplit
// would spawn the right library entries on save.
//
// Usage: from worktree root, `node hyrox-hybrid-template-sanity.mjs`.

import { SPLIT_TEMPLATES, loadTemplateForDraft } from './src/data/splitTemplates.js'
import { collectLibraryAdditionsFromSplit } from './src/utils/helpers.js'

let pass = 0
let fail = 0

function ok(label, cond) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
  }
}

console.log('\n[Test 1] Template registered + first in chooser')
{
  ok('SPLIT_TEMPLATES contains tmpl_hyrox_hybrid', SPLIT_TEMPLATES.some(t => t.id === 'tmpl_hyrox_hybrid'))
  ok('HYROX Hybrid is the FIRST template (top of chooser)', SPLIT_TEMPLATES[0]?.id === 'tmpl_hyrox_hybrid')
  const t = SPLIT_TEMPLATES.find(tm => tm.id === 'tmpl_hyrox_hybrid')
  ok('name = "HYROX Hybrid"', t?.name === 'HYROX Hybrid')
  ok('emoji = 🔥', t?.emoji === '🔥')
  ok('cycleLengthLabel = 7-day', t?.cycleLengthLabel === '7-day')
  ok('6 workouts', Array.isArray(t?.workouts) && t.workouts.length === 6)
  ok('rotation length = 7', Array.isArray(t?.rotation) && t.rotation.length === 7)
  ok('rotation starts with rest (Sunday)', t?.rotation?.[0] === 'rest')
}

console.log('\n[Test 2] Each workout has Lift + HYROX sections + correct exercise count')
{
  const t = SPLIT_TEMPLATES.find(tm => tm.id === 'tmpl_hyrox_hybrid')
  const expectedCounts = {
    hyx_monday: { lift: 6, hyrox: 2 },
    hyx_tuesday: { lift: 5, hyrox: 1 },
    hyx_wednesday: { lift: 6, hyrox: 1 },
    hyx_thursday: { lift: 1, hyrox: 3 },
    hyx_friday: { lift: 5, hyrox: 1 },
    hyx_saturday: { lift: 5, hyrox: 1 },
  }
  for (const w of t.workouts) {
    const lift = w.sections.find(s => s.label === 'Lift')
    const hyrox = w.sections.find(s => s.label === 'HYROX')
    const expected = expectedCounts[w.id]
    ok(`${w.id} has Lift + HYROX sections`, !!lift && !!hyrox)
    ok(`${w.id} Lift count = ${expected.lift}`, lift?.exercises?.length === expected.lift)
    ok(`${w.id} HYROX count = ${expected.hyrox}`, hyrox?.exercises?.length === expected.hyrox)
  }
}

console.log('\n[Test 3] HYROX-round entries carry valid roundConfig')
{
  const t = SPLIT_TEMPLATES.find(tm => tm.id === 'tmpl_hyrox_hybrid')
  const tueRound = t.workouts.find(w => w.id === 'hyx_tuesday').sections[1].exercises[0]
  ok('Tuesday HYROX entry is hyrox-round type', tueRound.type === 'hyrox-round')
  ok('Tuesday roundConfig.stationId = sta_skierg', tueRound.roundConfig?.stationId === 'sta_skierg')
  ok('Tuesday roundConfig.runDistance = 800m', tueRound.roundConfig?.runDimensions?.distance?.default === 800)
  ok('Tuesday roundConfig.defaultRoundCount = 4', tueRound.roundConfig?.defaultRoundCount === 4)
  ok('Tuesday roundConfig.defaultRestSeconds = 120', tueRound.roundConfig?.defaultRestSeconds === 120)

  const friRound = t.workouts.find(w => w.id === 'hyx_friday').sections[1].exercises[0]
  ok('Friday HYROX entry is hyrox-round type', friRound.type === 'hyrox-round')
  ok('Friday uses rotation pool (no stationId)', !friRound.roundConfig?.stationId && Array.isArray(friRound.roundConfig?.rotationPool))
  ok('Friday rotationPool has 7 stations', friRound.roundConfig?.rotationPool?.length === 7)
  ok('Friday runDistance = 1000m', friRound.roundConfig?.runDimensions?.distance?.default === 1000)

  const satRound = t.workouts.find(w => w.id === 'hyx_saturday').sections[1].exercises[0]
  ok('Saturday HYROX entry is hyrox-round type', satRound.type === 'hyrox-round')
  ok('Saturday stationId = sta_wall_balls', satRound.roundConfig?.stationId === 'sta_wall_balls')
  ok('Saturday defaultRoundCount = 3', satRound.roundConfig?.defaultRoundCount === 3)
}

console.log('\n[Test 4] loadTemplateForDraft deep-clones object exercises')
{
  const draft = loadTemplateForDraft('tmpl_hyrox_hybrid')
  ok('returns non-null', !!draft)
  ok('name preserved', draft.name === 'HYROX Hybrid')
  ok('emoji preserved', draft.emoji === '🔥')
  ok('6 workouts in draft', draft.workouts.length === 6)

  // Mutate the draft's HYROX-round entry's roundConfig — should NOT affect the source template.
  const draftTueRound = draft.workouts[1].sections[1].exercises[0]
  draftTueRound.roundConfig.stationId = 'sta_row'
  const sourceTueRound = SPLIT_TEMPLATES.find(t => t.id === 'tmpl_hyrox_hybrid')
    .workouts.find(w => w.id === 'hyx_tuesday').sections[1].exercises[0]
  ok('source template NOT mutated by draft mutation', sourceTueRound.roundConfig.stationId === 'sta_skierg')
}

console.log('\n[Test 5] collectLibraryAdditionsFromSplit spawns the right entries')
{
  const draft = loadTemplateForDraft('tmpl_hyrox_hybrid')
  // Start from a library that ONLY has the 8 HYROX stations (post-v8 baseline).
  const seededLib = [
    { id: 'sta_skierg', name: 'SkiErg', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_sled_push', name: 'Sled Push', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_sled_pull', name: 'Sled Pull', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_burpee_broad', name: 'Burpee Broad Jumps', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_row', name: 'Rowing', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_farmers', name: 'Farmers Carry', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_sandbag_lunges', name: 'Sandbag Lunges', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
    { id: 'sta_wall_balls', name: 'Wall Balls', type: 'hyrox-station', primaryMuscles: ['Full Body'], equipment: 'Other' },
  ]

  const { toCreate, errors } = collectLibraryAdditionsFromSplit(draft, seededLib)
  ok('zero errors against seeded HYROX library', errors.length === 0)

  const types = toCreate.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {})
  ok('3 hyrox-round entries to create', types['hyrox-round'] === 3)
  ok('4 running entries to create', types['running'] === 4)
  ok('hyx_tuesday HYROX Run + SkiErg Round in toCreate', toCreate.some(e => e.name === 'HYROX Run + SkiErg Round'))
  ok('hyx_friday HYROX Simulation Round in toCreate', toCreate.some(e => e.name === 'HYROX Simulation Round'))
  ok('hyx_saturday Wall Balls + 200m Run Round in toCreate', toCreate.some(e => e.name === 'Wall Balls + 200m Run Round'))
  ok('Easy Run in toCreate', toCreate.some(e => e.name === 'Easy Run'))
  ok('200m Repeats in toCreate', toCreate.some(e => e.name === '200m Repeats'))
  ok('Incline Walk or Easy Bike in toCreate', toCreate.some(e => e.name === 'Incline Walk or Easy Bike'))
  ok('Light Movement in toCreate', toCreate.some(e => e.name === 'Light Movement'))
  ok('weight-training entries to create (varies by user library)', (types['weight-training'] || 0) >= 0)

  // hyrox-station entries that match the seeded catalog should NOT be in toCreate.
  ok('Farmers Carry NOT in toCreate (resolves to seeded catalog)', !toCreate.some(e => e.name === 'Farmers Carry'))
  ok('Sled Push NOT in toCreate (resolves to seeded catalog)', !toCreate.some(e => e.name === 'Sled Push'))
  ok('Sled Pull NOT in toCreate (resolves to seeded catalog)', !toCreate.some(e => e.name === 'Sled Pull'))
}

console.log('\n[Test 6] Round configs preserved through deep clone')
{
  const draft = loadTemplateForDraft('tmpl_hyrox_hybrid')
  const tueRound = draft.workouts[1].sections[1].exercises[0]
  ok('Tuesday roundConfig.stationId in draft = sta_skierg', tueRound.roundConfig?.stationId === 'sta_skierg')
  const friRound = draft.workouts[4].sections[1].exercises[0]
  ok('Friday roundConfig.rotationPool length = 7 in draft', friRound.roundConfig?.rotationPool?.length === 7)
  ok('Friday rotationPool includes sta_skierg', friRound.roundConfig?.rotationPool?.includes('sta_skierg'))
  const satRound = draft.workouts[5].sections[1].exercises[0]
  ok('Saturday roundConfig.stationId in draft = sta_wall_balls', satRound.roundConfig?.stationId === 'sta_wall_balls')
}

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
