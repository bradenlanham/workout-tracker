export const BB_WORKOUT_SEQUENCE = ['push', 'legs1', 'pull', 'push2', 'legs2']

export const BB_WORKOUT_NAMES = {
  push:   'Push — Chest',
  legs1:  'Legs 1 — Quads',
  pull:   'Pull — Back',
  push2:  'Push 2 — Shoulders & Arms',
  legs2:  'Legs 2 — Hams',
  custom: 'Custom',
}

export const BB_WORKOUT_EMOJI = {
  push:   '🏋️',
  legs1:  '🦵',
  pull:   '💪',
  push2:  '🎯',
  legs2:  '🦿',
  custom: '✏️',
}

// ── Grouped structure — drives sub-headers and exercise order ──────────────────
// Labels: 'Primary' | 'Choose 1' | 'If You Have Time'

export const BB_EXERCISE_GROUPS = {
  push: [
    {
      label: 'Primary',
      exercises: ['Pec Dec', 'Incline DB Press', 'Flat Bench Press'],
    },
    {
      label: 'Choose 1',
      exercises: ['Incline Bench Press', 'Incline Smith Machine Press', 'Any Plate-loaded Press'],
    },
    {
      label: 'If You Have Time',
      exercises: ['Cable Fly', 'Lateral DB Raises', 'Single Arm Tricep Extension', 'Overhead DB Extension', 'Dips'],
    },
  ],
  legs1: [
    {
      label: 'Primary',
      exercises: ['Leg Curls', 'Leg Extensions'],
    },
    {
      label: 'Choose 1',
      exercises: ['Squats or Smith Machine Squat', 'Belt Squat', 'Hack Squats', 'Leg Press'],
    },
    {
      label: 'If You Have Time',
      exercises: ['Adductors', 'Calf Raises'],
    },
  ],
  pull: [
    {
      label: 'Primary',
      exercises: ['Single Arm Lat Pulldown', 'Single Arm Row', 'Chest Supported Wide Row'],
    },
    {
      label: 'Choose 1',
      exercises: ['Straight Arm Cable Pulldown', 'Reverse Pec Dec'],
    },
    {
      label: 'If You Have Time',
      exercises: ['DB Curls on Incline Bench', 'Reverse Grip Curls', 'Hammer Curls / Forearm Curls'],
    },
  ],
  push2: [
    {
      label: 'Primary',
      exercises: ['Rear Delts', 'DB Lateral Raises', 'Military Press'],
    },
    {
      label: 'Choose 1',
      exercises: ['Forward DB Raises', 'DB Shrug'],
    },
    {
      label: 'If You Have Time',
      exercises: ['Single Arm Tricep Extension', 'Overhead DB Extension', 'Spider Curls', 'Single Arm High Cable Curl'],
    },
  ],
  legs2: [
    {
      label: 'Primary',
      exercises: ['Seated Leg Curl', 'DB Romanian Deadlifts'],
    },
    {
      label: 'Choose 1',
      exercises: ['Lying Leg Curl', 'Bulgarian Split Squat', 'Leg Extensions'],
    },
    {
      label: 'If You Have Time',
      exercises: ['Abductors', 'Cable Kickbacks', 'Calf Raises'],
    },
  ],
  custom: [],
}

// ── Flat array (backward compat) ───────────────────────────────────────────────
export const BB_EXERCISES = Object.fromEntries(
  Object.entries(BB_EXERCISE_GROUPS).map(([key, groups]) => [
    key,
    Array.isArray(groups) ? groups.flatMap(g => g.exercises) : [],
  ])
)
