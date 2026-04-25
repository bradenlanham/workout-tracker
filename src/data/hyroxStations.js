// Batch 37 — HYROX 8-station catalog
//
// Closed catalog (per design doc §3). v1 ships these 8 stations exactly;
// users cannot create a 9th in v1. Dimensions are locked per station per
// the official HYROX format. raceStandard captures the canonical race-day
// distance/rep target — used by B42's Start HYROX overlay to seed the
// session's prescribed station value.
//
// IDs use the `sta_` prefix (parallel to `ex_` for weight-training entries)
// so a station entry never collides with a slug-derived weight-training id
// in the library.
//
// Equipment: 'Other'. Stations don't fit the existing EQUIPMENT_TYPES enum
// (Barbell / Dumbbell / Selectorized Machine / etc.) and per-gym variation
// (Hoist SkiErg vs Concept2 SkiErg) is already handled by the equipment
// instance string field (Batch 19, spec §3.4) — same path the rest of the
// app uses for machine variants.
//
// primaryMuscles: ['Full Body']. The 14-muscle taxonomy doesn't really map
// to HYROX work — SkiErg, sled push, burpees are full-body events. Keeping
// the field non-empty preserves the existing addExerciseToLibrary validation
// path if anyone clones a station via that flow.

export const HYROX_STATIONS = [
  {
    id: 'sta_skierg',
    name: 'SkiErg',
    raceStandard: { distanceMeters: 1000 },
    dimensions: [
      { axis: 'distance', required: true, unit: 'm' },
      { axis: 'time',     required: true, unit: 's' },
    ],
  },
  {
    id: 'sta_sled_push',
    name: 'Sled Push',
    raceStandard: { distanceMeters: 50 },
    dimensions: [
      { axis: 'weight',   required: true,  unit: 'lbs' },
      { axis: 'distance', required: true,  unit: 'm'   },
      { axis: 'time',     required: false, unit: 's'   },
    ],
  },
  {
    id: 'sta_sled_pull',
    name: 'Sled Pull',
    raceStandard: { distanceMeters: 50 },
    dimensions: [
      { axis: 'weight',   required: true,  unit: 'lbs' },
      { axis: 'distance', required: true,  unit: 'm'   },
      { axis: 'time',     required: false, unit: 's'   },
    ],
  },
  {
    id: 'sta_burpee_broad',
    name: 'Burpee Broad Jump',
    raceStandard: { distanceMeters: 80 },
    dimensions: [
      { axis: 'reps',     required: true              },
      { axis: 'distance', required: false, unit: 'm'  },
    ],
  },
  {
    id: 'sta_row',
    name: 'Rowing',
    raceStandard: { distanceMeters: 1000 },
    dimensions: [
      { axis: 'distance', required: true, unit: 'm' },
      { axis: 'time',     required: true, unit: 's' },
    ],
  },
  {
    id: 'sta_farmers',
    name: 'Farmers Carry',
    raceStandard: { distanceMeters: 200 },
    dimensions: [
      { axis: 'weight',   required: true,  unit: 'lbs' },
      { axis: 'distance', required: true,  unit: 'm'   },
      { axis: 'time',     required: false, unit: 's'   },
    ],
  },
  {
    id: 'sta_sandbag_lunges',
    name: 'Sandbag Lunges',
    raceStandard: { distanceMeters: 100 },
    dimensions: [
      { axis: 'weight',   required: true,  unit: 'lbs' },
      { axis: 'reps',     required: true              },
      { axis: 'distance', required: false, unit: 'm'  },
    ],
  },
  {
    id: 'sta_wall_balls',
    name: 'Wall Balls',
    raceStandard: { reps: 100 },
    dimensions: [
      { axis: 'weight', required: false, unit: 'lbs' },
      { axis: 'reps',   required: true              },
    ],
  },
]

// Convert a station catalog entry into a full library Exercise record.
// Used by both buildBuiltInLibrary (fresh install) and migrateLibraryToV8
// (returning users on v7 → v8 upgrade).
export function buildHyroxStationLibraryEntry(station) {
  return {
    id:                station.id,
    name:              station.name,
    aliases:           [],
    primaryMuscles:    ['Full Body'],
    equipment:         'Other',
    isBuiltIn:         true,
    defaultUnilateral: false,
    loadIncrement:     5,
    defaultRepRange:   [8, 12],
    repRangeUserSet:   false,
    progressionClass:  'compound',
    needsTagging:      false,
    type:              'hyrox-station',
    dimensions:        station.dimensions.map(d => ({ ...d })),
    raceStandard:      { ...station.raceStandard },
    createdAt:         '2026-04-24',
  }
}
