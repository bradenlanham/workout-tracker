export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Traps', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes',
  'Biceps', 'Triceps', 'Abs', 'Core', 'Calves', 'Forearms', 'Full Body',
]

// Batch 27: replaced generic 'Machine' with two specifics so users can
// distinguish selectorized (pin-select weight stack) from plate-loaded
// (Hammer-Strength / Smith / hack-squat style). Legacy 'Machine' values on
// existing library entries migrate to 'Selectorized Machine' via the v5→v6
// persist migration (see useStore.js). Picker UIs (Backfill, ExerciseEditSheet,
// ExercisePicker, CreateExerciseModal) all consume this array as the single
// source of truth so they pick up the split automatically.
export const EQUIPMENT_TYPES = [
  'Barbell', 'Dumbbell', 'Selectorized Machine', 'Plate-loaded Machine',
  'Cable', 'Bodyweight', 'Kettlebell', 'Other',
]

export const EXERCISE_LIBRARY = [
  // Chest
  { name: 'Bench Press',                  muscleGroup: 'Chest',      equipment: 'Barbell'    },
  { name: 'Flat Bench Press',             muscleGroup: 'Chest',      equipment: 'Barbell'    },
  { name: 'Incline Bench Press',          muscleGroup: 'Chest',      equipment: 'Barbell'    },
  { name: 'Decline Bench Press',          muscleGroup: 'Chest',      equipment: 'Barbell'    },
  { name: 'Incline DB Press',             muscleGroup: 'Chest',      equipment: 'Dumbbell'   },
  { name: 'Incline Dumbbell Press',       muscleGroup: 'Chest',      equipment: 'Dumbbell'   },
  { name: 'Incline Smith Machine Press',  muscleGroup: 'Chest',      equipment: 'Plate-loaded Machine' },
  { name: 'Any Plate-loaded Press',       muscleGroup: 'Chest',      equipment: 'Plate-loaded Machine' },
  { name: 'Pec Dec',                      muscleGroup: 'Chest',      equipment: 'Selectorized Machine' },
  { name: 'Cable Fly',                    muscleGroup: 'Chest',      equipment: 'Cable'      },
  { name: 'Chest Fly',                    muscleGroup: 'Chest',      equipment: 'Dumbbell'   },
  { name: 'Dips',                         muscleGroup: 'Chest',      equipment: 'Bodyweight' },

  // Back
  { name: 'Pull-ups',                     muscleGroup: 'Back',       equipment: 'Bodyweight' },
  { name: 'Chin-ups',                     muscleGroup: 'Back',       equipment: 'Bodyweight' },
  { name: 'Barbell Row',                  muscleGroup: 'Back',       equipment: 'Barbell'    },
  { name: 'Single Arm Row',               muscleGroup: 'Back',       equipment: 'Dumbbell'   },
  { name: 'Single Arm Lat Pulldown',      muscleGroup: 'Back',       equipment: 'Cable'      },
  { name: 'Lat Pulldown',                 muscleGroup: 'Back',       equipment: 'Cable'      },
  { name: 'Cable Row',                    muscleGroup: 'Back',       equipment: 'Cable'      },
  { name: 'Chest Supported Wide Row',     muscleGroup: 'Back',       equipment: 'Selectorized Machine' },
  { name: 'Straight Arm Cable Pulldown',  muscleGroup: 'Back',       equipment: 'Cable'      },
  { name: 'Reverse Pec Dec',              muscleGroup: 'Back',       equipment: 'Selectorized Machine' },
  { name: 'Face Pulls',                   muscleGroup: 'Back',       equipment: 'Cable'      },
  { name: 'T-Bar Row',                    muscleGroup: 'Back',       equipment: 'Barbell'    },

  // Shoulders
  { name: 'Military Press',               muscleGroup: 'Shoulders',  equipment: 'Barbell'    },
  { name: 'DB Shoulder Press',            muscleGroup: 'Shoulders',  equipment: 'Dumbbell'   },
  { name: 'Arnold Press',                 muscleGroup: 'Shoulders',  equipment: 'Dumbbell'   },
  { name: 'DB Lateral Raises',            muscleGroup: 'Shoulders',  equipment: 'Dumbbell'   },
  { name: 'Lateral DB Raises',            muscleGroup: 'Shoulders',  equipment: 'Dumbbell'   },
  { name: 'Forward DB Raises',            muscleGroup: 'Shoulders',  equipment: 'Dumbbell'   },
  { name: 'Rear Delts',                   muscleGroup: 'Shoulders',  equipment: 'Cable'      },
  { name: 'DB Shrug',                     muscleGroup: 'Shoulders',  equipment: 'Dumbbell'   },
  { name: 'Barbell Shrug',                muscleGroup: 'Shoulders',  equipment: 'Barbell'    },

  // Quads
  { name: 'Squat',                        muscleGroup: 'Quads',      equipment: 'Barbell'    },
  { name: 'Squats or Smith Machine Squat',muscleGroup: 'Quads',      equipment: 'Plate-loaded Machine' },
  { name: 'Hack Squats',                  muscleGroup: 'Quads',      equipment: 'Plate-loaded Machine' },
  { name: 'Leg Press',                    muscleGroup: 'Quads',      equipment: 'Plate-loaded Machine' },
  { name: 'Belt Squat',                   muscleGroup: 'Quads',      equipment: 'Plate-loaded Machine' },
  { name: 'Leg Extensions',               muscleGroup: 'Quads',      equipment: 'Selectorized Machine' },
  { name: 'Lunges',                       muscleGroup: 'Quads',      equipment: 'Dumbbell'   },

  // Hamstrings
  { name: 'Leg Curls',                    muscleGroup: 'Hamstrings', equipment: 'Selectorized Machine' },
  { name: 'Seated Leg Curl',              muscleGroup: 'Hamstrings', equipment: 'Selectorized Machine' },
  { name: 'Lying Leg Curl',               muscleGroup: 'Hamstrings', equipment: 'Selectorized Machine' },
  { name: 'DB Romanian Deadlifts',        muscleGroup: 'Hamstrings', equipment: 'Dumbbell'   },
  { name: 'Romanian Deadlift',            muscleGroup: 'Hamstrings', equipment: 'Barbell'    },
  { name: 'Sumo Deadlift',                muscleGroup: 'Hamstrings', equipment: 'Barbell'    },
  { name: 'Nordic Curl',                  muscleGroup: 'Hamstrings', equipment: 'Bodyweight' },

  // Glutes
  { name: 'Hip Thrust',                   muscleGroup: 'Glutes',     equipment: 'Barbell'    },
  { name: 'Glute Bridge',                 muscleGroup: 'Glutes',     equipment: 'Bodyweight' },
  { name: 'Cable Kickbacks',              muscleGroup: 'Glutes',     equipment: 'Cable'      },
  { name: 'Bulgarian Split Squat',        muscleGroup: 'Glutes',     equipment: 'Dumbbell'   },
  { name: 'Adductors',                    muscleGroup: 'Glutes',     equipment: 'Selectorized Machine' },
  { name: 'Abductors',                    muscleGroup: 'Glutes',     equipment: 'Selectorized Machine' },
  { name: 'Step-ups',                     muscleGroup: 'Glutes',     equipment: 'Dumbbell'   },

  // Biceps
  { name: 'Barbell Curl',                 muscleGroup: 'Biceps',     equipment: 'Barbell'    },
  { name: 'Dumbbell Curl',                muscleGroup: 'Biceps',     equipment: 'Dumbbell'   },
  { name: 'DB Curls on Incline Bench',    muscleGroup: 'Biceps',     equipment: 'Dumbbell'   },
  { name: 'Incline Curl',                 muscleGroup: 'Biceps',     equipment: 'Dumbbell'   },
  { name: 'Hammer Curls',                 muscleGroup: 'Biceps',     equipment: 'Dumbbell'   },
  { name: 'Hammer Curls / Forearm Curls', muscleGroup: 'Biceps',     equipment: 'Dumbbell'   },
  { name: 'Reverse Grip Curls',           muscleGroup: 'Biceps',     equipment: 'Barbell'    },
  { name: 'Spider Curls',                 muscleGroup: 'Biceps',     equipment: 'Dumbbell'   },
  { name: 'Preacher Curl',                muscleGroup: 'Biceps',     equipment: 'Barbell'    },
  { name: 'Single Arm High Cable Curl',   muscleGroup: 'Biceps',     equipment: 'Cable'      },
  { name: 'Cable Curl',                   muscleGroup: 'Biceps',     equipment: 'Cable'      },

  // Triceps
  { name: 'Close Grip Bench Press',       muscleGroup: 'Triceps',    equipment: 'Barbell'    },
  { name: 'Skull Crushers',               muscleGroup: 'Triceps',    equipment: 'Barbell'    },
  { name: 'Overhead DB Extension',        muscleGroup: 'Triceps',    equipment: 'Dumbbell'   },
  { name: 'Single Arm Tricep Extension',  muscleGroup: 'Triceps',    equipment: 'Cable'      },
  { name: 'Tricep Pushdown',              muscleGroup: 'Triceps',    equipment: 'Cable'      },
  { name: 'Rope Pushdown',                muscleGroup: 'Triceps',    equipment: 'Cable'      },
  { name: 'Diamond Push-ups',             muscleGroup: 'Triceps',    equipment: 'Bodyweight' },

  // Core
  { name: 'Plank',                        muscleGroup: 'Core',       equipment: 'Bodyweight' },
  { name: 'Crunches',                     muscleGroup: 'Core',       equipment: 'Bodyweight' },
  { name: 'Hanging Leg Raise',            muscleGroup: 'Core',       equipment: 'Bodyweight' },
  { name: 'Ab Wheel',                     muscleGroup: 'Core',       equipment: 'Other'      },
  { name: 'Cable Crunch',                 muscleGroup: 'Core',       equipment: 'Cable'      },
  { name: 'Russian Twist',                muscleGroup: 'Core',       equipment: 'Other'      },

  // Calves
  { name: 'Calf Raises',                  muscleGroup: 'Calves',     equipment: 'Selectorized Machine' },
  { name: 'Standing Calf Raise',          muscleGroup: 'Calves',     equipment: 'Selectorized Machine' },
  { name: 'Seated Calf Raise',            muscleGroup: 'Calves',     equipment: 'Selectorized Machine' },
  { name: 'Donkey Calf Raise',            muscleGroup: 'Calves',     equipment: 'Plate-loaded Machine' },

  // Forearms
  { name: 'Wrist Curls',                  muscleGroup: 'Forearms',   equipment: 'Barbell'    },
  { name: 'Reverse Wrist Curls',          muscleGroup: 'Forearms',   equipment: 'Barbell'    },
  { name: 'Farmer\'s Carry',              muscleGroup: 'Forearms',   equipment: 'Dumbbell'   },

  // Full Body
  { name: 'Deadlift',                     muscleGroup: 'Full Body',  equipment: 'Barbell'    },
  { name: 'Power Clean',                  muscleGroup: 'Full Body',  equipment: 'Barbell'    },
  { name: 'Kettlebell Swing',             muscleGroup: 'Full Body',  equipment: 'Kettlebell' },
  { name: 'Burpees',                      muscleGroup: 'Full Body',  equipment: 'Bodyweight' },
  { name: 'Thrusters',                    muscleGroup: 'Full Body',  equipment: 'Barbell'    },
]
