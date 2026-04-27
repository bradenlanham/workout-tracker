// Batch 53 sanity — exercises the ExercisePicker's three-tier search logic
// (substring → token-subset → trigram fuzzy at threshold 0.5) against a
// representative library so we can validate the threshold + token-subset
// pass before they go live.
//
// Mirrors helpers.js findSimilarExercises + the picker's inline tier 1+2
// logic. Run from worktree root: `node picker-search-sanity.mjs`.

import { findSimilarExercises } from './src/utils/helpers.js'

const lib = [
  { id: 'ex_db_lateral_raises',     name: 'DB Lateral Raises' },
  { id: 'ex_lateral_db_raises',     name: 'Lateral DB Raises' },
  { id: 'ex_pec_dec',               name: 'Pec Dec' },
  { id: 'ex_db_hammer_curls',       name: 'DB Hammer Curls' },
  { id: 'ex_leg_press',             name: 'Leg Press' },
  { id: 'ex_bench_press',           name: 'Bench Press' },
  { id: 'ex_incline_bench_press',   name: 'Incline Bench Press' },
  { id: 'ex_hack_squat',            name: 'Hack Squats' },
  { id: 'ex_seated_cable_row',      name: 'Seated Cable Row' },
  { id: 'ex_overhead_db_extension', name: 'Overhead DB Extension' },
  { id: 'ex_skierg',                name: 'SkiErg' },
  { id: 'ex_reverse_pec_dec',       name: 'Reverse Pec Dec' },
]

// Mirror the picker's tier logic
function pickerSearch(query, library) {
  const q = query.trim().toLowerCase()
  if (!q) return { matches: library, tiers: { substring: library.length, tokenSubset: 0, trigram: 0 } }

  const seen = new Set()
  const matches = []
  let substring = 0, tokenSubset = 0, trigram = 0

  // Tier 1: substring
  for (const ex of library) {
    if (ex.name.toLowerCase().includes(q)) {
      matches.push({ ex, tier: 'substring' })
      seen.add(ex.id || ex.name)
      substring++
    }
  }

  // Tier 2: token-subset (multi-word only) with light s-stemming so
  // singular/plural variants compare equal.
  const stem = t => t.replace(/s$/, '')
  const qTokens = q.split(/\s+/).filter(Boolean)
  if (qTokens.length >= 2) {
    const qStems = qTokens.map(stem)
    for (const ex of library) {
      const key = ex.id || ex.name
      if (seen.has(key)) continue
      const exStems = ex.name.toLowerCase().split(/\s+/).filter(Boolean).map(stem)
      if (qStems.every(t => exStems.includes(t))) {
        matches.push({ ex, tier: 'tokenSubset' })
        seen.add(key)
        tokenSubset++
      }
    }
  }

  // Tier 3: trigram fuzzy
  const trigramHits = findSimilarExercises(q, library, { suggestThreshold: 0.5, max: 10 })
  for (const m of trigramHits) {
    const key = m.exercise.id || m.exercise.name
    if (seen.has(key)) continue
    matches.push({ ex: m.exercise, tier: 'trigram' })
    seen.add(key)
    trigram++
  }

  return { matches, tiers: { substring, tokenSubset, trigram } }
}

const cases = [
  { q: 'lateral db',        expectIncludes: 'Lateral DB Raises',    expectTier: 'substring',
    desc: 'Same-order substring beats tokenSubset for "Lateral DB Raises"' },
  { q: 'lateral db',        expectIncludes: 'DB Lateral Raises',    expectTier: 'tokenSubset',
    desc: 'Token-subset catches the reverse-order sibling' },
  { q: 'db lateral',        expectIncludes: 'DB Lateral Raises',    expectTier: 'substring',
    desc: 'Substring catches same-order' },
  { q: 'db lateral',        expectIncludes: 'Lateral DB Raises',    expectTier: 'tokenSubset',
    desc: 'Token-subset catches reverse-order' },
  { q: 'pec deck',          expectIncludes: 'Pec Dec',              expectTier: 'trigram',
    desc: 'Typo "deck" → "Dec" via trigram' },
  { q: 'curl hammer',       expectIncludes: 'DB Hammer Curls',      expectTier: 'tokenSubset',
    desc: 'Reverse word order + s-stem (curl ≈ curls)' },
  { q: 'leg presss',        expectIncludes: 'Leg Press',            expectTier: 'trigram',
    desc: 'Trailing typo via trigram' },
  { q: 'incline bench',     expectIncludes: 'Incline Bench Press',  expectTier: 'substring',
    desc: 'Plain substring' },
  { q: 'cable row',         expectIncludes: 'Seated Cable Row',     expectTier: 'substring',
    desc: 'Substring across whitespace' },
  { q: 'overhead extension',expectIncludes: 'Overhead DB Extension',expectTier: 'tokenSubset',
    desc: 'Word-spread match via Tier 2' },
  { q: 'skierg',            expectIncludes: 'SkiErg',               expectTier: 'substring',
    desc: 'Case-insensitive substring' },
  { q: 'hack squat',        expectIncludes: 'Hack Squats',          expectTier: 'substring',
    desc: 'Substring already catches "hack squat" → "Hack Squats" (contiguous match)' },
  { q: 'banana',            expectIncludes: null,
    desc: 'Unrelated query: no matches at threshold 0.5' },
  { q: 'qwerty zxcvb',      expectIncludes: null,
    desc: 'Random multi-word: no matches' },
]

console.log('Picker tier-search sanity — threshold 0.5\n')
let pass = 0, fail = 0
for (const tc of cases) {
  const { matches } = pickerSearch(tc.q, lib)
  const found = matches.find(m => m.ex.name === tc.expectIncludes)

  let ok
  if (tc.expectIncludes == null) {
    ok = matches.length === 0
  } else {
    ok = !!found && (tc.expectTier ? found.tier === tc.expectTier : true)
  }

  console.log(`${ok ? '  PASS' : '  FAIL'}: ${tc.desc}`)
  console.log(`         Q="${tc.q}" → [${matches.map(m => `${m.ex.name}(${m.tier})`).join(', ')}]`)
  if (!ok && tc.expectIncludes) {
    console.log(`         expected "${tc.expectIncludes}" via ${tc.expectTier || 'any tier'}`)
  }
  ok ? pass++ : fail++
}

console.log(`\n${pass}/${pass + fail} pass`)

// False-positive ceiling sanity — common short queries should not return
// the entire library
const noisyQueries = ['press', 'row', 'curl', 'press']
console.log('\nFalse-positive ceiling check:')
for (const q of noisyQueries) {
  const { matches, tiers } = pickerSearch(q, lib)
  console.log(`  Q="${q}" → ${matches.length} hits (substring=${tiers.substring}, tokenSubset=${tiers.tokenSubset}, trigram=${tiers.trigram})`)
}

process.exit(fail > 0 ? 1 : 0)
