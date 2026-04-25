// Batch 17f — curated split templates for the new Starting Point landing.
// 6 opinionated templates + a Blank slate handled separately in the UI.
// Decision D2: all 6 ship in the initial batch.
//
// Workout ids are namespaced per template ('fb_a', 'upper_a', 'ppl_push') so
// we never collide across templates. When a user saves a split created from
// a template, `addSplit` keeps these ids verbatim — that's fine because the
// store only cares about uniqueness within a split, not across splits.
//
// Exercise names are best-effort-matched against the canonical library
// (`data/exerciseLibrary.js`). Any name not in the library creates a
// `needsTagging: true` entry via the existing v3 migration path on first use;
// the Backfill UI catches it up later.

import {
  BB_WORKOUT_NAMES,
  BB_WORKOUT_EMOJI,
  BB_EXERCISE_GROUPS,
  BB_WORKOUT_SEQUENCE,
} from './exercises.js'

// Build BamBam's Blueprint workouts from the canonical data so the template
// stays in sync with any future tweaks to the built-in split.
const BAMBAM_WORKOUTS = ['push', 'legs1', 'pull', 'push2', 'legs2'].map(id => ({
  id,
  name: BB_WORKOUT_NAMES[id],
  emoji: BB_WORKOUT_EMOJI[id],
  sections: BB_EXERCISE_GROUPS[id],
}))

// Shared PPL workouts — reused by both the 3-day and 6-day PPL templates.
const PPL_WORKOUTS = [
  {
    id: 'ppl_push',
    name: 'Push',
    emoji: '🏋️',
    sections: [
      { label: 'Chest', exercises: ['Bench Press', 'Incline DB Press', 'Pec Dec'] },
      { label: 'Shoulders / Triceps', exercises: ['Overhead Press', 'Lateral Raises', 'Tricep Extension'] },
    ],
  },
  {
    id: 'ppl_pull',
    name: 'Pull',
    emoji: '💪',
    sections: [
      { label: 'Back', exercises: ['Deadlift', 'Pull-up', 'Barbell Row'] },
      { label: 'Biceps / Rear delts', exercises: ['Barbell Curl', 'Face Pull'] },
    ],
  },
  {
    id: 'ppl_legs',
    name: 'Legs',
    emoji: '🦵',
    sections: [
      { label: 'Quads', exercises: ['Back Squat', 'Leg Extension'] },
      { label: 'Posterior chain', exercises: ['Romanian Deadlift', 'Leg Curl'] },
      { label: 'Calves', exercises: ['Calf Raise'] },
    ],
  },
]

// HYROX Hybrid template — Brooke's 6-day mixed lift + HYROX program. Object-
// shape exercises with `type` and (for HYROX rounds) `roundConfig` flow
// through `loadTemplateForDraft`'s deep-clone untouched. When the user saves
// the resulting split via SplitCanvas, the `addSplitWithLibrary` store
// action spawns the necessary library entries (3 hyrox-round templates +
// 4 running entries) so the HYROX section preview, round logger, and
// summary all resolve correctly.
const HYROX_HYBRID_WORKOUTS = [
  {
    id: 'hyx_monday',
    name: 'Glutes & Light Run',
    emoji: '🍑',
    sections: [
      {
        label: 'Lift',
        exercises: [
          { name: 'Hip Abductor Machine', type: 'weight-training', rec: { sets: 4, reps: '10–10–10', note: 'Drop set' } },
          { name: 'Hip Thrust Machine', type: 'weight-training', rec: { sets: 4, reps: '20, 18, 15, 12', note: 'Drop weight each set' } },
          { name: 'Reverse Hack Squat', type: 'weight-training', rec: { sets: 4, reps: 12 } },
          { name: 'Smith Machine RDL', type: 'weight-training', rec: { sets: 4, reps: 12 } },
          { name: 'Dumbbell Bulgarian Split Squat', type: 'weight-training', rec: { sets: 4, reps: '15 each leg' } },
          { name: 'Donkey Kickbacks', type: 'weight-training', rec: { sets: 4, reps: 15 } },
        ],
      },
      {
        label: 'HYROX',
        exercises: [
          { name: 'Easy Run', type: 'running', rec: { note: 'Choose 1 — 10–15 min, conversational pace' } },
          { name: '200m Repeats', type: 'running', rec: { sets: 5, reps: '200m (~⅛ mi)', note: 'Choose 1 — moderate effort, 60s rest. Not a sprint.' } },
        ],
      },
    ],
  },
  {
    id: 'hyx_tuesday',
    name: 'Shoulders & HYROX Intervals',
    emoji: '🏋️‍♀️',
    sections: [
      {
        label: 'Lift',
        exercises: [
          { name: 'Cable Lateral Raise', type: 'weight-training', rec: { sets: 3, reps: 20, note: 'Warm-up' } },
          { name: 'Shoulder Press', type: 'weight-training', rec: { sets: 4, reps: 12, note: 'Machine or dumbbells' } },
          { name: 'DB Lateral Raise', type: 'weight-training', rec: { sets: 3, reps: '10–10–10', note: 'Drop set, 3 rounds' } },
          { name: 'Incline Bench Front Raise', type: 'weight-training', rec: { sets: 4, reps: 12, note: '45° incline' } },
          { name: 'Reverse Flies', type: 'weight-training', rec: { sets: 4, reps: 15 } },
        ],
      },
      {
        label: 'HYROX',
        exercises: [
          {
            name: 'HYROX Run + SkiErg Round',
            type: 'hyrox-round',
            rec: { sets: 4, reps: '800m run (~½ mi) + 500m SkiErg', note: '4 rounds. 2 min rest between rounds.' },
            roundConfig: {
              runDimensions: { distance: { default: 800, unit: 'm' } },
              stationId: 'sta_skierg',
              defaultRoundCount: 4,
              defaultRestSeconds: 120,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'hyx_wednesday',
    name: 'Hamstrings, Glutes & Recovery',
    emoji: '🦵',
    sections: [
      {
        label: 'Lift',
        exercises: [
          { name: 'Walking Lunges', type: 'weight-training', rec: { reps: '60 total steps', note: 'Bodyweight or weighted' } },
          { name: 'Seated Hamstring Curl', type: 'weight-training', rec: { sets: 4, reps: '10–10–10', note: 'Drop set' } },
          { name: 'Barbell RDL', type: 'weight-training', rec: { sets: 4, reps: 12 } },
          { name: 'Lying Hamstring Curl', type: 'weight-training', rec: { sets: 4, reps: '20, 18, 15, 12', note: 'Drop weight each set' } },
          { name: 'Hip Thrust', type: 'weight-training', rec: { sets: 4, reps: 15 } },
          { name: 'Glute Kickbacks', type: 'weight-training', rec: { sets: 4, reps: '10–10–10', note: 'Drop set' } },
        ],
      },
      {
        label: 'HYROX',
        exercises: [
          { name: 'Incline Walk or Easy Bike', type: 'running', rec: { note: '10–15 min — keep this EASY' } },
        ],
      },
    ],
  },
  {
    id: 'hyx_thursday',
    name: 'Active Rest & Light Skill',
    emoji: '🚶‍♀️',
    sections: [
      {
        label: 'Primary',
        exercises: [
          { name: 'Light Movement', type: 'running', rec: { note: '20–30 min walk, incline, or bike' } },
        ],
      },
      {
        label: 'Optional',
        exercises: [
          { name: 'Sled Push', type: 'hyrox-station', rec: { note: 'Light only — technique focus' } },
          { name: 'Sled Pull', type: 'hyrox-station', rec: { note: 'Light only — technique focus' } },
          { name: 'Farmers Carry', type: 'hyrox-station', rec: { note: 'Light only — recovery, no intensity.' } },
        ],
      },
    ],
  },
  {
    id: 'hyx_friday',
    name: 'Back & HYROX Simulation',
    emoji: '🔥',
    sections: [
      {
        label: 'Lift',
        exercises: [
          { name: 'Close Grip Triangle Row', type: 'weight-training', rec: { sets: 4, reps: 15 } },
          { name: 'Seated Close Grip Triangle Row', type: 'weight-training', rec: { sets: 4, reps: 15 } },
          { name: 'Pull-ups', type: 'weight-training', rec: { sets: 4, reps: 15, note: 'Assisted if needed' } },
          { name: 'Standing DB Row', type: 'weight-training', rec: { sets: 4, reps: 15 } },
          { name: 'Lat Pulldown', type: 'weight-training', rec: { sets: 4, reps: '10–10–10', note: 'Open grip drop set' } },
        ],
      },
      {
        label: 'HYROX',
        exercises: [
          {
            name: 'HYROX Simulation Round',
            type: 'hyrox-round',
            rec: { sets: '4 → 8 rounds', reps: '1000m run (~⅝ mi) + 1 station', note: 'Wks 1–3: 4 rounds. Wks 4–6: 5–6 rounds. By Aug: 6–8 rounds. Station rotates weekly.' },
            roundConfig: {
              runDimensions: { distance: { default: 1000, unit: 'm' } },
              rotationPool: [
                'sta_skierg',
                'sta_row',
                'sta_sled_push',
                'sta_sled_pull',
                'sta_farmers',
                'sta_sandbag_lunges',
                'sta_wall_balls',
              ],
              defaultRoundCount: 4,
              defaultRestSeconds: 90,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'hyx_saturday',
    name: 'Heavy Glutes & Finisher',
    emoji: '💎',
    sections: [
      {
        label: 'Lift',
        exercises: [
          { name: 'Barbell Hip Thrust', type: 'weight-training', rec: { sets: 4, reps: 10, note: 'Heavy' } },
          { name: 'Hyperextensions', type: 'weight-training', rec: { sets: 4, reps: '15 + 10 BW', note: '15 weighted + 10 bodyweight' } },
          { name: 'Smith Donkey Kickbacks', type: 'weight-training', rec: { sets: 4, reps: 15 } },
          { name: 'Single-Leg Hip Thrust Machine', type: 'weight-training', rec: { sets: 4, reps: '15 each leg' } },
          { name: 'Cable Kickbacks', type: 'weight-training', rec: { sets: 4, reps: '12 + 12', note: 'Standing + incline' } },
        ],
      },
      {
        label: 'HYROX',
        exercises: [
          {
            name: 'Wall Balls + 200m Run Round',
            type: 'hyrox-round',
            rec: { sets: '2–3 rounds', reps: '15–20 wall balls + 200m run (~⅛ mi)', note: 'Keep controlled. Do NOT turn this into a cardio day.' },
            roundConfig: {
              runDimensions: { distance: { default: 200, unit: 'm' } },
              stationId: 'sta_wall_balls',
              defaultRoundCount: 3,
              defaultRestSeconds: 60,
            },
          },
        ],
      },
    ],
  },
]

export const SPLIT_TEMPLATES = [
  {
    id: 'tmpl_hyrox_hybrid',
    name: 'HYROX Hybrid',
    emoji: '🔥',
    description: 'Brooke\'s 6-day program. Lift sessions paired with HYROX intervals + simulation rounds. Rest Sunday.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['rest', '🍑', '🏋️‍♀️', '🦵', '🚶‍♀️', '🔥', '💎'],
    workouts: HYROX_HYBRID_WORKOUTS,
    rotation: ['rest', 'hyx_monday', 'hyx_tuesday', 'hyx_wednesday', 'hyx_thursday', 'hyx_friday', 'hyx_saturday'],
  },
  {
    id: 'tmpl_bam',
    name: "BamBam's Blueprint",
    emoji: '🏋️',
    description: "Braden's 5-day rotation. Push, legs, pull, shoulders, hams.",
    cycleLengthLabel: '5-day',
    previewEmojis: ['🏋️', '🦵', '💪', '🎯', '🦿'],
    workouts: BAMBAM_WORKOUTS,
    rotation: [...BB_WORKOUT_SEQUENCE],
  },
  {
    id: 'tmpl_fullbody_3',
    name: 'Full Body × 3/week',
    emoji: '🏋️',
    description: 'Three full-body sessions a week. Great for beginners or busy schedules.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['🏋️', 'rest', '🏋️', 'rest', '🏋️', 'rest', 'rest'],
    workouts: [
      {
        id: 'fb_a',
        name: 'Full Body A',
        emoji: '🏋️',
        sections: [
          { label: 'Compound', exercises: ['Back Squat', 'Bench Press', 'Barbell Row'] },
          { label: 'Accessories', exercises: ['Romanian Deadlift', 'Overhead Press', 'Face Pull'] },
        ],
      },
      {
        id: 'fb_b',
        name: 'Full Body B',
        emoji: '🏋️',
        sections: [
          { label: 'Compound', exercises: ['Deadlift', 'Incline DB Press', 'Pull-up'] },
          { label: 'Accessories', exercises: ['Leg Press', 'Lateral Raises', 'Barbell Curl'] },
        ],
      },
      {
        id: 'fb_c',
        name: 'Full Body C',
        emoji: '🏋️',
        sections: [
          { label: 'Compound', exercises: ['Front Squat', 'Flat DB Press', 'Seated Cable Row'] },
          { label: 'Accessories', exercises: ['Leg Curl', 'Cable Lateral Raise', 'Tricep Pushdown'] },
        ],
      },
    ],
    rotation: ['fb_a', 'rest', 'fb_b', 'rest', 'fb_c', 'rest', 'rest'],
  },
  {
    id: 'tmpl_upper_lower_4',
    name: 'Upper / Lower × 4/week',
    emoji: '💪',
    description: 'Classic 4-day intermediate split. Two upper, two lower.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['💪', '🦵', 'rest', '💪', '🦵', 'rest', 'rest'],
    workouts: [
      {
        id: 'upper_a',
        name: 'Upper A',
        emoji: '💪',
        sections: [
          { label: 'Primary', exercises: ['Bench Press', 'Barbell Row', 'Overhead Press'] },
          { label: 'Accessories', exercises: ['Pull-up', 'DB Curl', 'Tricep Extension'] },
        ],
      },
      {
        id: 'lower_a',
        name: 'Lower A',
        emoji: '🦵',
        sections: [
          { label: 'Primary', exercises: ['Back Squat', 'Romanian Deadlift'] },
          { label: 'Accessories', exercises: ['Leg Curl', 'Leg Press', 'Calf Raise'] },
        ],
      },
      {
        id: 'upper_b',
        name: 'Upper B',
        emoji: '💪',
        sections: [
          { label: 'Primary', exercises: ['Incline DB Press', 'Lat Pulldown', 'Arnold Press'] },
          { label: 'Accessories', exercises: ['Cable Row', 'Lateral Raises', 'Hammer Curl'] },
        ],
      },
      {
        id: 'lower_b',
        name: 'Lower B',
        emoji: '🦵',
        sections: [
          { label: 'Primary', exercises: ['Deadlift', 'Front Squat'] },
          { label: 'Accessories', exercises: ['Leg Extension', 'Bulgarian Split Squat', 'Seated Calf Raise'] },
        ],
      },
    ],
    rotation: ['upper_a', 'lower_a', 'rest', 'upper_b', 'lower_b', 'rest', 'rest'],
  },
  {
    id: 'tmpl_ppl_3',
    name: 'Push / Pull / Legs × 3/week',
    emoji: '🎯',
    description: 'Classic PPL rotation, one cycle per week. Scalable to 6 days later.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['🏋️', '💪', '🦵', 'rest', '🏋️', '💪', '🦵'],
    workouts: PPL_WORKOUTS,
    rotation: ['ppl_push', 'ppl_pull', 'ppl_legs', 'rest', 'ppl_push', 'ppl_pull', 'ppl_legs'],
  },
  {
    id: 'tmpl_ppl_6',
    name: 'Push / Pull / Legs × 6/week',
    emoji: '🔥',
    description: 'Hammer version. PPL twice a week, one rest day.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['🏋️', '💪', '🦵', '🏋️', '💪', '🦵', 'rest'],
    workouts: PPL_WORKOUTS,
    rotation: ['ppl_push', 'ppl_pull', 'ppl_legs', 'ppl_push', 'ppl_pull', 'ppl_legs', 'rest'],
  },
  {
    id: 'tmpl_bro',
    name: 'Bro Split',
    emoji: '🏆',
    description: 'Classic bodybuilder split. One muscle per day.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['🏋️', '💪', '🦵', '🎯', '💥', 'rest', 'rest'],
    workouts: [
      {
        id: 'bro_chest', name: 'Chest', emoji: '🏋️',
        sections: [{ label: 'Primary', exercises: ['Bench Press', 'Incline DB Press', 'Flat DB Fly', 'Pec Dec'] }],
      },
      {
        id: 'bro_back', name: 'Back', emoji: '💪',
        sections: [{ label: 'Primary', exercises: ['Deadlift', 'Pull-up', 'Barbell Row', 'Lat Pulldown'] }],
      },
      {
        id: 'bro_legs', name: 'Legs', emoji: '🦵',
        sections: [{ label: 'Primary', exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'] }],
      },
      {
        id: 'bro_shoulders', name: 'Shoulders', emoji: '🎯',
        sections: [{ label: 'Primary', exercises: ['Overhead Press', 'Lateral Raises', 'Rear Delt Fly', 'Face Pull'] }],
      },
      {
        id: 'bro_arms', name: 'Arms', emoji: '💥',
        sections: [
          { label: 'Biceps', exercises: ['Barbell Curl', 'Hammer Curl'] },
          { label: 'Triceps', exercises: ['Skullcrusher', 'Tricep Pushdown'] },
        ],
      },
    ],
    rotation: ['bro_chest', 'bro_back', 'bro_legs', 'bro_shoulders', 'bro_arms', 'rest', 'rest'],
  },
  {
    id: 'tmpl_5x5',
    name: '5x5 Strength',
    emoji: '⚡',
    description: 'Barbell-heavy A/B rotation built around the big lifts.',
    cycleLengthLabel: '7-day',
    previewEmojis: ['⚡', 'rest', '⚡', 'rest', '⚡', 'rest', 'rest'],
    workouts: [
      {
        id: 'x5_a',
        name: 'Workout A',
        emoji: '⚡',
        sections: [
          { label: 'Main Lifts', exercises: ['Back Squat', 'Bench Press', 'Barbell Row'] },
        ],
      },
      {
        id: 'x5_b',
        name: 'Workout B',
        emoji: '⚡',
        sections: [
          { label: 'Main Lifts', exercises: ['Back Squat', 'Overhead Press', 'Deadlift'] },
        ],
      },
    ],
    rotation: ['x5_a', 'rest', 'x5_b', 'rest', 'x5_a', 'rest', 'rest'],
  },
]

// Returns a deep-cloned partial split shape ready to seed `splitDraft`.
// New object refs all the way down so the template itself is never mutated
// as the user edits. Object-shape exercises (HYROX rounds carrying
// roundConfig, running entries with rec objects) are JSON-cloned so a user
// editing roundConfig in one draft doesn't mutate the template literal.
export function loadTemplateForDraft(templateId) {
  const t = SPLIT_TEMPLATES.find(tm => tm.id === templateId)
  if (!t) return null
  return {
    name: t.name,
    emoji: t.emoji,
    workouts: t.workouts.map(w => ({
      ...w,
      sections: (w.sections || []).map(s => ({
        ...s,
        exercises: (s.exercises || []).map(e =>
          typeof e === 'string' ? e : JSON.parse(JSON.stringify(e))
        ),
      })),
    })),
    rotation: [...t.rotation],
  }
}
