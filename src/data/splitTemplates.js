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

export const SPLIT_TEMPLATES = [
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
// as the user edits.
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
        exercises: [...(s.exercises || [])],
      })),
    })),
    rotation: [...t.rotation],
  }
}
