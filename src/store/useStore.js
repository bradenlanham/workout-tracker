import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId, migrateSessionsToV2, migrateSessionsToV3, migrateSessionsToV5, migrateSessionsToV9, migrateCardioSessionsToV9, migrateLibraryToV6, migrateLibraryToV7, migrateLibraryToV8, defaultDimensionsForType, classifyRepRange, toLocalDateStr, collectLibraryAdditionsFromSplit } from '../utils/helpers'
import {
  BB_WORKOUT_SEQUENCE,
  BB_WORKOUT_NAMES,
  BB_WORKOUT_EMOJI,
  BB_EXERCISE_GROUPS,
} from '../data/exercises'
import { EXERCISE_LIBRARY as BUILT_IN_RAW } from '../data/exerciseLibrary'
import { HYROX_STATIONS, buildHyroxStationLibraryEntry } from '../data/hyroxStations'
import { loadTemplateForDraft } from '../data/splitTemplates'

// ── Exercise library seeding ───────────────────────────────────────────────────
// Transforms the raw { name, muscleGroup, equipment } shape from
// data/exerciseLibrary.js into the canonical Exercise entity used by the
// recommender, backfill UI, and dedup matching. IDs are slug-derived so
// they stay stable across runs.

function slugifyExerciseName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Exposed for the v2→v3 migration (step 2b) and the library dedup pass.
export function builtInExerciseIdForName(name) {
  return `ex_${slugifyExerciseName(name)}`
}

function buildBuiltInLibrary() {
  const lifts = BUILT_IN_RAW.map(raw => ({
    id:                builtInExerciseIdForName(raw.name),
    name:              raw.name,
    aliases:           [],
    primaryMuscles:    [raw.muscleGroup],
    equipment:         raw.equipment,
    isBuiltIn:         true,
    defaultUnilateral: false,
    loadIncrement:     5,
    // Batch 30: per-exercise rep range replaces the uniform [8, 12] seed.
    // classifyRepRange uses the name + equipment + muscle to pick a sensible
    // default (compound barbell → [5,8]; DB/machine press/row/pulldown → [6,10];
    // side/rear delts/calves/forearms → [10,15]; otherwise [8,12]). User can
    // override via ExerciseEditSheet; override flips repRangeUserSet to true.
    defaultRepRange:   classifyRepRange(raw.name, raw.equipment, [raw.muscleGroup]),
    repRangeUserSet:   false,
    progressionClass:
      raw.muscleGroup === 'Full Body' ? 'compound'
      : raw.equipment === 'Bodyweight' ? 'bodyweight'
      : 'isolation',
    needsTagging:      false,
    // Batch 37: type + dimensions on every entry. Existing built-ins are all
    // weight-training; the 8 HYROX stations are appended below.
    type:              'weight-training',
    dimensions:        defaultDimensionsForType('weight-training'),
    createdAt:         '2026-04-17',
  }))
  // Batch 37: seed the 8 HYROX stations as built-in entries. Locked dimensions
  // per station (see src/data/hyroxStations.js); type='hyrox-station'.
  const stations = HYROX_STATIONS.map(buildHyroxStationLibraryEntry)
  return [...lifts, ...stations]
}

// ── Built-in split factory ─────────────────────────────────────────────────────

function buildBuiltInSplit(rotation) {
  return {
    id: 'split_bam',
    name: "BamBam's Blueprint",
    emoji: '🏋️',
    isBuiltIn: true,
    workouts: [
      { id: 'push',  name: BB_WORKOUT_NAMES.push,  emoji: BB_WORKOUT_EMOJI.push,  sections: BB_EXERCISE_GROUPS.push  },
      { id: 'legs1', name: BB_WORKOUT_NAMES.legs1, emoji: BB_WORKOUT_EMOJI.legs1, sections: BB_EXERCISE_GROUPS.legs1 },
      { id: 'pull',  name: BB_WORKOUT_NAMES.pull,  emoji: BB_WORKOUT_EMOJI.pull,  sections: BB_EXERCISE_GROUPS.pull  },
      { id: 'push2', name: BB_WORKOUT_NAMES.push2, emoji: BB_WORKOUT_EMOJI.push2, sections: BB_EXERCISE_GROUPS.push2 },
      { id: 'legs2', name: BB_WORKOUT_NAMES.legs2, emoji: BB_WORKOUT_EMOJI.legs2, sections: BB_EXERCISE_GROUPS.legs2 },
    ],
    rotation: rotation || BB_WORKOUT_SEQUENCE,
    createdAt: '2026-03-22',
  }
}

const useStore = create(
  persist(
    (set, get) => ({
      sessions: [],
      settings: {
        restTimerDuration: 90,
        accentColor: 'violet',
        // Batch 49 — user-picked custom accent hex. Only consumed when
        // accentColor === 'custom'. Default is HYROX yellow so a user who
        // picks Custom without typing a hex gets a sensible starting point.
        customAccentHex: '#EAB308',
        backgroundTheme: 'obsidian',
        userName: '',
        autoStartRest: true,
        defaultFirstSetType: 'warmup',
        restTimerChime: true,
        hasSeenTutorial: false,
        // Batch 16i — AI coaching recommender UI toggle. When false, the
        // RecommendationChip and RecommendationSheet don't render; the
        // engine still computes invisibly so flipping it back on is
        // instant. Session data collection is unaffected either way.
        enableAiCoaching: true,
        // Batch 16i — visibility of the per-exercise blue REC pill (the
        // coach's free-text prescription slot added in Batch 13). Some
        // users never use it; hide it to reclaim header space.
        showRecPill:      true,
        // Batch 16n — gym list for the readiness check-in chip (spec §9.6
        // Option D). Empty by default — users add gyms inline the first
        // time they open the overlay. defaultGymId seeds the chip on
        // subsequent sessions; last-used wins via setDefaultGymId on save.
        gyms:             [],   // [{ id, label }]
        defaultGymId:     null,
        // Batch 16q — per-exercise anomaly dismissal map (spec §4.5 + §9.3).
        // Shape: { [exerciseKey]: sessionId }. Set by dismissAnomaly when
        // the user taps the X on the anomaly banner; cleared naturally as
        // the startTimestamp changes each new session. Stale entries are
        // harmless — the check compares against the current session id.
        dismissedAnomalies: {},
        // Batch 20b — per-(exercise, gym) auto-tag-prompt dismissal map
        // (spec §3.5.4, "Not this time" branch). Shape:
        // { [`${exerciseId}:${gymId}`]: sessionId }. Mirrors
        // dismissedAnomalies — session-scoped, stale entries self-invalidate
        // via startTimestamp change. The "Always skip" branch writes to
        // Exercise.skipGymTagPrompt instead (persists across sessions).
        dismissedGymPrompts: {},
        // Batch 31.3 — per-exercise below-floor advisory dismissal map.
        // Shape: { [exerciseKey]: sessionId }. Mirrors dismissedAnomalies:
        // session-scoped so the advisory reappears next session if the
        // below-floor streak (2 consecutive sessions under min-reps) still
        // fires.
        dismissedBelowFloorAdvisories: {},
        // Batch 42 — last-shown index in the HYROX_HEADLINES bank (design
        // doc §13.2). Persisted so the same headline stays stable across
        // re-opens of the same Start HYROX overlay; only NEW Start HYROX
        // events draw a fresh headline. -1 = none yet (any index is fair).
        lastHyroxHeadlineIndex: -1,
      },
      // In-progress workout session — survives app backgrounding / page reload
      activeSession: null,
      // First-launch onboarding flag — once true, Welcome screen is never shown again
      hasCompletedOnboarding: false,
      // User-created workout templates
      customTemplates: [],
      // BB workout rotation order — null means use default BB_WORKOUT_SEQUENCE
      workoutSequence: null,
      // Timestamp (ms) when the rest timer should expire — null if not running
      restEndTimestamp: null,

      // ── Splits ─────────────────────────────────────────────────────────────
      splits: [],
      activeSplitId: null,
      // Batch 17a — in-progress split draft (wizard / future Canvas). Persists
      // across reload + backgrounding so a mid-build split survives an
      // accidental tab brush or OS kill. One draft at a time; starting a new
      // create overwrites any prior create-draft, and starting an edit
      // overwrites any prior edit-draft for that same split id. Stale drafts
      // (>7 days old) are auto-cleared on SplitCanvas mount.
      // Shape: { originalId: string | null, draft: PartialSplit, updatedAt: number } | null
      splitDraft: null,
      // Canonical exercise library. Seeded from data/exerciseLibrary.js on
      // first app mount via initLibrary() (and extended by the v2→v3 persist
      // migration with any user-created names found in session history).
      // Every entry has a stable slug-derived `id`; entries with
      // `needsTagging: true` are waiting on muscle-group/equipment backfill
      // from the user. See Batch 15.
      exerciseLibrary: [],

      // ── Cardio ─────────────────────────────────────────────────────────────
      cardioSessions: [],
      customCardioTypes: [],
      activeCardioSession: null,

      // ── Rest days ──────────────────────────────────────────────────────────
      restDaySessions: [],

      // ── Split init (call on app mount) ────────────────────────────────────
      // Auto-creates the built-in split from hardcoded data if splits is empty.
      // Preserves any workoutSequence the user may have saved previously.

      initSplits: () => {
        const state = get()
        if (state.splits && state.splits.length > 0) return

        const rotation = (state.workoutSequence && state.workoutSequence.length)
          ? state.workoutSequence
          : BB_WORKOUT_SEQUENCE

        set({ splits: [buildBuiltInSplit(rotation)], activeSplitId: 'split_bam' })
      },

      // ── Exercise library init + CRUD ──────────────────────────────────────
      // initLibrary() seeds from built-in data on fresh installs. Returning
      // users post-v3 already have a populated library from the migration, so
      // this is a no-op for them. Idempotent.

      initLibrary: () => {
        const state = get()
        if (state.exerciseLibrary && state.exerciseLibrary.length > 0) return
        set({ exerciseLibrary: buildBuiltInLibrary() })
      },

      addExerciseToLibrary: (exercise) => {
        // §3.2.1 requires primaryMuscles ≥ 1 and an equipment value for a fully
        // tagged entry. Batch 17j (Step 11) introduces the Skip-for-now path:
        // when the caller passes `needsTagging: true` we accept empty muscles
        // and the 'Other' equipment sentinel, producing the same shape the v3
        // migration flags for the Backfill UI to finish later.
        if (!exercise?.name?.trim()) {
          throw new Error('addExerciseToLibrary: name required')
        }
        // Batch 39 — type-aware validation. Default to 'weight-training' when
        // the caller doesn't specify (back-compat for pre-Batch-37 callers).
        const type = (typeof exercise.type === 'string' && exercise.type) || 'weight-training'
        const validTypes = ['weight-training', 'running', 'hyrox-station', 'hyrox-round']
        if (!validTypes.includes(type)) {
          throw new Error(`addExerciseToLibrary: invalid type "${type}"`)
        }
        // Per spec + B39 plan: hyrox-station entries cannot be created
        // freely — the 8-station catalog is closed. The catalog is auto-seeded
        // on v8 migration, so users can only edit what's already there.
        if (type === 'hyrox-station') {
          throw new Error('addExerciseToLibrary: hyrox-station entries are seeded from the catalog and cannot be created custom in v1')
        }
        // hyrox-round entries need a roundConfig with at minimum a station
        // (single OR rotationPool) and a runDimensions block. Other shapes
        // are caught at edit time by the form, but we guard at the store too.
        if (type === 'hyrox-round') {
          const rc = exercise.roundConfig
          if (!rc || typeof rc !== 'object') {
            throw new Error('addExerciseToLibrary: hyrox-round requires roundConfig')
          }
          const hasStation = typeof rc.stationId === 'string' && rc.stationId
          const hasPool    = Array.isArray(rc.rotationPool) && rc.rotationPool.length > 0
          if (!hasStation && !hasPool) {
            throw new Error('addExerciseToLibrary: hyrox-round roundConfig needs stationId or rotationPool')
          }
        }
        const skipTagging = exercise.needsTagging === true
        // weight-training + running types still go through §3.2.1 validation.
        // hyrox-round bypasses muscle/equipment requirements (they don't apply).
        const requiresTagging = type === 'weight-training' || type === 'running'
        if (!skipTagging && requiresTagging) {
          if (!Array.isArray(exercise.primaryMuscles) || exercise.primaryMuscles.length === 0) {
            throw new Error('addExerciseToLibrary: at least one primaryMuscles value required')
          }
          if (!exercise.equipment) {
            throw new Error('addExerciseToLibrary: equipment required')
          }
        }
        const newEx = {
          id:                `ex_${generateId()}`,
          name:              exercise.name.trim(),
          aliases:           exercise.aliases || [],
          primaryMuscles:    Array.isArray(exercise.primaryMuscles)
                               ? exercise.primaryMuscles
                               : (type === 'hyrox-round' ? ['Full Body'] : []),
          equipment:         exercise.equipment || 'Other',
          isBuiltIn:         false,
          defaultUnilateral: !!exercise.defaultUnilateral,
          loadIncrement:     exercise.loadIncrement    || 5,
          defaultRepRange:   exercise.defaultRepRange  || [8, 12],
          progressionClass:  exercise.progressionClass || 'isolation',
          needsTagging:      skipTagging,
          // Batch 37 — type + dimensions on every entry; default per type.
          type,
          dimensions:        Array.isArray(exercise.dimensions) ? exercise.dimensions : null,
          // Batch 39 — hyrox-round carries roundConfig {runDimensions,
          // stationId | rotationPool, defaultRoundCount, defaultRestSeconds}.
          ...(type === 'hyrox-round' && exercise.roundConfig
            ? { roundConfig: { ...exercise.roundConfig } }
            : {}),
          createdAt:         new Date().toISOString(),
          ...(Array.isArray(exercise.sessionGymTags) && exercise.sessionGymTags.length
            ? { sessionGymTags: [...exercise.sessionGymTags] } : {}),
          ...(Array.isArray(exercise.skipGymTagPrompt) && exercise.skipGymTagPrompt.length
            ? { skipGymTagPrompt: [...exercise.skipGymTagPrompt] } : {}),
        }
        // Backfill dimensions from defaultDimensionsForType if caller didn't
        // supply (most callers won't — type implies the dimension shape).
        if (!Array.isArray(newEx.dimensions)) {
          newEx.dimensions = defaultDimensionsForType(type)
        }
        set(state => ({ exerciseLibrary: [...state.exerciseLibrary, newEx] }))
        return newEx
      },

      // ── Gym tagging on Exercise records (Batch 20, spec §3.5) ──────────────
      //
      // Two sibling fields on each Exercise:
      //   sessionGymTags:    gymIds where this exercise IS available
      //   skipGymTagPrompt:  gymIds where the user chose "Always skip"
      //                      so the auto-tag-on-use prompt stays quiet
      //
      // Both stored as arrays of gymId strings (matching session.gymId),
      // not labels, so renaming a gym in Settings doesn't break tags.
      // Empty or missing sessionGymTags means "universally available /
      // unspecified" per §3.5.3.

      addExerciseGymTag: (exerciseId, gymId) => {
        if (!exerciseId || !gymId) return
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = Array.isArray(ex.sessionGymTags) ? ex.sessionGymTags : []
            if (current.includes(gymId)) return ex
            return { ...ex, sessionGymTags: [...current, gymId] }
          }),
        }))
      },

      removeExerciseGymTag: (exerciseId, gymId) => {
        if (!exerciseId || !gymId) return
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = Array.isArray(ex.sessionGymTags) ? ex.sessionGymTags : []
            if (!current.includes(gymId)) return ex
            const next = current.filter(g => g !== gymId)
            // Drop the field entirely when empty so the exercise reverts to
            // "universally available / unspecified" rather than tracking an
            // explicit empty list (which §3.5.3 treats the same way, but
            // keeping the shape minimal avoids ambiguity in migrations/exports).
            if (next.length === 0) {
              const { sessionGymTags, ...rest } = ex
              return rest
            }
            return { ...ex, sessionGymTags: next }
          }),
        }))
      },

      addSkipGymTagPrompt: (exerciseId, gymId) => {
        if (!exerciseId || !gymId) return
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = Array.isArray(ex.skipGymTagPrompt) ? ex.skipGymTagPrompt : []
            if (current.includes(gymId)) return ex
            return { ...ex, skipGymTagPrompt: [...current, gymId] }
          }),
        }))
      },

      // Batch 28: hiddenAtGyms — explicit per-gym hide list. Exercises with
      // the current session's gymId in this list are filtered out of the
      // logger's exercise list. Empty/missing means "visible everywhere".
      addHiddenAtGym: (exerciseId, gymId) => {
        if (!exerciseId || !gymId) return
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = Array.isArray(ex.hiddenAtGyms) ? ex.hiddenAtGyms : []
            if (current.includes(gymId)) return ex
            return { ...ex, hiddenAtGyms: [...current, gymId] }
          }),
        }))
      },

      removeHiddenAtGym: (exerciseId, gymId) => {
        if (!exerciseId || !gymId) return
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = Array.isArray(ex.hiddenAtGyms) ? ex.hiddenAtGyms : []
            if (!current.includes(gymId)) return ex
            const next = current.filter(g => g !== gymId)
            if (next.length === 0) {
              const { hiddenAtGyms, ...rest } = ex
              return rest
            }
            return { ...ex, hiddenAtGyms: next }
          }),
        }))
      },

      removeSkipGymTagPrompt: (exerciseId, gymId) => {
        if (!exerciseId || !gymId) return
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = Array.isArray(ex.skipGymTagPrompt) ? ex.skipGymTagPrompt : []
            if (!current.includes(gymId)) return ex
            const next = current.filter(g => g !== gymId)
            if (next.length === 0) {
              const { skipGymTagPrompt, ...rest } = ex
              return rest
            }
            return { ...ex, skipGymTagPrompt: next }
          }),
        }))
      },

      // Per-gym default machine instance. Shape:
      //   defaultMachineByGym?: { [gymId]: string }
      // Set from ExerciseEditSheet's "Gyms" section so users no longer need
      // to type the machine mid-session via the Machine chip popover. When
      // the seed pass in BbLogger looks up equipmentInstance for a session
      // at gymId, this map wins over historical session values — explicit
      // user intent beats inferred history.
      //
      // Passing an empty/whitespace instance removes that gymId from the
      // map; emptying the map drops the field entirely (shape stays minimal).
      setDefaultMachineByGym: (exerciseId, gymId, instance) => {
        if (!exerciseId || !gymId) return
        const trimmed = typeof instance === 'string' ? instance.trim().slice(0, 40) : ''
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== exerciseId) return ex
            const current = (ex.defaultMachineByGym && typeof ex.defaultMachineByGym === 'object')
              ? { ...ex.defaultMachineByGym }
              : {}
            if (!trimmed) {
              if (!(gymId in current)) return ex
              delete current[gymId]
              if (Object.keys(current).length === 0) {
                const { defaultMachineByGym, ...rest } = ex
                return rest
              }
              return { ...ex, defaultMachineByGym: current }
            }
            if (current[gymId] === trimmed) return ex
            current[gymId] = trimmed
            return { ...ex, defaultMachineByGym: current }
          }),
        }))
      },

      updateExerciseInLibrary: (id, patch) => {
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex =>
            ex.id === id ? { ...ex, ...patch } : ex
          ),
        }))
      },

      // Atomic tag action for the backfill UI. Merges patch then recomputes
      // needsTagging from the merged state — avoids the stale-closure bug
      // you hit if you try to compute completion inside a component callback
      // that reads exerciseLibrary via useStore() (each click fires against
      // the prior render's snapshot, so back-to-back pill taps lose info).
      tagExercise: (id, patch) => {
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.map(ex => {
            if (ex.id !== id) return ex
            const merged = { ...ex, ...patch }
            const done =
              Array.isArray(merged.primaryMuscles)
              && merged.primaryMuscles.length > 0
              && merged.equipment
              && merged.equipment !== 'Other'
            return { ...merged, needsTagging: !done }
          }),
        }))
      },

      deleteExerciseFromLibrary: (id) => {
        set(state => ({
          exerciseLibrary: state.exerciseLibrary.filter(ex => ex.id !== id),
        }))
      },

      // Merge one or more exercises INTO keepId. Rewrites every session's
      // exerciseId references from any mergeIds → keepId, then removes the
      // merged entries from the library. Used by the v2→v3 migration's
      // dedup pass and by the user-facing merge UI (future).
      mergeExercises: (keepId, mergeIds) => {
        if (!keepId || !Array.isArray(mergeIds) || mergeIds.length === 0) return
        const mergeSet = new Set(mergeIds.filter(id => id !== keepId))
        if (mergeSet.size === 0) return
        set(state => {
          const newSessions = (state.sessions || []).map(s => {
            if (!s?.data?.exercises) return s
            return {
              ...s,
              data: {
                ...s.data,
                exercises: s.data.exercises.map(ex =>
                  ex.exerciseId && mergeSet.has(ex.exerciseId)
                    ? { ...ex, exerciseId: keepId }
                    : ex
                ),
              },
            }
          })
          const newLibrary = state.exerciseLibrary.filter(ex => !mergeSet.has(ex.id))
          return { sessions: newSessions, exerciseLibrary: newLibrary }
        })
      },

      // ── Split CRUD ────────────────────────────────────────────────────────

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      setActiveSplit: (id) => set({ activeSplitId: id }),

      addSplit: (split) => {
        const newSplit = { ...split, id: generateId(), createdAt: toLocalDateStr() }
        set(state => ({ splits: [...state.splits, newSplit] }))
        return newSplit
      },

      // Batch 40 — import-path extension. Wraps addSplit so imported JSON v3
      // payloads create their referenced library entries (hyrox-round w/
      // roundConfig, running, untagged weight-training) before the split
      // itself lands. Library failures get caught per-entry so a single bad
      // exercise doesn't abort the whole import. Returns:
      //   { ok: false, reason: 'invalid-format' } when payload shape is wrong
      //   { ok: true, split, libraryAdded, errors } on success
      importSplitWithLibrary: (data) => {
        if (!data || data.type !== 'bambam-split-export' || !data.split) {
          return { ok: false, reason: 'invalid-format' }
        }
        const lib = get().exerciseLibrary
        const { toCreate, errors } = collectLibraryAdditionsFromSplit(data.split, lib)
        const addEntry = get().addExerciseToLibrary
        let added = 0
        for (const entry of toCreate) {
          try {
            addEntry(entry)
            added += 1
          } catch (e) {
            errors.push(`addExerciseToLibrary("${entry.name}"): ${e.message}`)
          }
        }
        const { id: _id, ...splitData } = data.split
        const newSplit = get().addSplit({ ...splitData, isBuiltIn: false })
        return { ok: true, split: newSplit, libraryAdded: added, errors }
      },

      // Like addSplit, but also spawns library entries for any HYROX-round
      // / running / weight-training entries in the split that don't already
      // exist in the library. Used by SplitCanvas's create path so a split
      // built from a template (like HYROX Hybrid) gets its supporting
      // library entries auto-created when the user taps Save. Symmetric to
      // importSplitWithLibrary but takes a raw split object directly
      // instead of the file-import wrapper. Returns the created split (so
      // callers that need the id for activate-on-save still work).
      addSplitWithLibrary: (splitData) => {
        const lib = get().exerciseLibrary
        const { toCreate } = collectLibraryAdditionsFromSplit(splitData, lib)
        const addEntry = get().addExerciseToLibrary
        for (const entry of toCreate) {
          try {
            addEntry(entry)
          } catch (e) {
            // Per-entry failures are non-fatal — keep going so the split
            // still saves even if one library entry hits the strict v3.2.1
            // validator. The user can clean up via /backfill or /exercises.
            console.warn(`addExerciseToLibrary("${entry?.name}"): ${e.message}`)
          }
        }
        return get().addSplit(splitData)
      },

      updateSplit: (id, updates) => {
        set(state => ({
          splits: state.splits.map(s => s.id === id ? { ...s, ...updates } : s),
        }))
      },

      deleteSplit: (id) => {
        set(state => {
          const remaining = state.splits.filter(s => s.id !== id)
          const newActiveId = state.activeSplitId === id
            ? (remaining[0]?.id || null)
            : state.activeSplitId
          return { splits: remaining, activeSplitId: newActiveId }
        })
      },

      cloneSplit: (id) => {
        const state = get()
        const original = state.splits.find(s => s.id === id)
        if (!original) return null
        const clone = {
          ...original,
          id: generateId(),
          name: `${original.name} (Copy)`,
          isBuiltIn: false,
          createdAt: toLocalDateStr(),
        }
        set(prev => ({ splits: [...prev.splits, clone] }))
        return clone
      },

      // Batch 17e — proper deep-clone duplicate that regenerates workout ids
      // and remaps the rotation accordingly. `cloneSplit` above is a shallow
      // copy that shares workout object references with the source (editing
      // one mutates both). `duplicateSplit` is the correct path for the
      // overflow-menu Duplicate action in SplitManager. Returns the dup so the
      // caller can surface an undo toast.
      duplicateSplit: (id) => {
        const state = get()
        const src = state.splits.find(sp => sp.id === id)
        if (!src) return null
        // Build id map old → new so we can rewrite the rotation after the
        // workouts get fresh ids. `'rest'` is a sentinel, not a workout id, so
        // it passes through unchanged.
        const idMap = {}
        const newWorkouts = (src.workouts || []).map(w => {
          const newId = generateId()
          idMap[w.id] = newId
          return {
            ...w,
            id: newId,
            sections: (w.sections || []).map(sec => ({
              ...sec,
              exercises: (sec.exercises || []).map(ex => {
                if (typeof ex === 'string') return ex
                // {name, rec} is the structured shape. Deep-copy rec if it's
                // an object (Step 9's structured rec lands later); string recs
                // are scalar and pass through.
                const copiedRec = ex.rec && typeof ex.rec === 'object'
                  ? { ...ex.rec }
                  : ex.rec
                return { ...ex, ...(copiedRec !== undefined ? { rec: copiedRec } : {}) }
              }),
            })),
          }
        })
        const newRotation = (src.rotation || []).map(r =>
          r === 'rest' ? 'rest' : (idMap[r] || r)
        )
        const dup = {
          ...src,
          id: generateId(),
          name: `${src.name} (Copy)`,
          isBuiltIn: false,
          workouts: newWorkouts,
          rotation: newRotation,
          createdAt: toLocalDateStr(),
        }
        set(prev => ({ splits: [...prev.splits, dup] }))
        return dup
      },

      // Batch 17e — used by the undo toast flow to back out a just-created
      // duplicate. Symmetric with duplicateSplit. deleteSplit already exists
      // but mis-fires if the user happens to have activated the duplicate
      // in the window — this preserves the original's active state.
      removeSplitById: (id) => {
        set(state => {
          const remaining = state.splits.filter(s => s.id !== id)
          const newActiveId = state.activeSplitId === id
            ? (remaining[0]?.id || null)
            : state.activeSplitId
          return { splits: remaining, activeSplitId: newActiveId }
        })
      },

      // ── Split draft (Batch 17a) ───────────────────────────────────────────
      // Auto-save plumbing for the wizard / Canvas. The UI is responsible for
      // debouncing writes (500ms is plenty); the store just holds the latest
      // snapshot. Contains whatever the user has entered so far — partial is
      // fine. `originalId` is null for create, a split id for edit.

      setSplitDraft: (payload) =>
        set({ splitDraft: { ...payload, updatedAt: Date.now() } }),

      clearSplitDraft: () => set({ splitDraft: null }),

      // Batch 17f — seed a fresh create-mode draft from a split template
      // (used by ChooseStartingPoint when the user taps a template card).
      // Returns true if the template id resolved, false otherwise.
      //
      // Batch 45 followup #2 — `silent: true` marks this draft as
      // template-seeded so SplitCanvas's mount effect knows there's
      // nothing to "restore" on first paint. The flag is naturally
      // dropped on the user's first auto-save (setSplitDraft writes
      // a payload without silent), so a subsequent return visit after
      // real edits will surface the banner correctly.
      loadTemplate: (templateId) => {
        const draft = loadTemplateForDraft(templateId)
        if (!draft) return false
        set({
          splitDraft: {
            originalId: null,
            draft,
            updatedAt: Date.now(),
            silent: true,
          },
        })
        return true
      },

      // ── Cardio actions ────────────────────────────────────────────────────────────────

      addCardioSession: (session) => {
        const newSession = {
          ...session,
          id: `cardio_${generateId()}`,
          createdAt: new Date().toISOString(),
        }
        set(state => ({ cardioSessions: [...state.cardioSessions, newSession] }))
        return newSession
      },

      updateCardioSession: (id, updates) => {
        set(state => ({
          cardioSessions: state.cardioSessions.map(s => s.id === id ? { ...s, ...updates } : s),
        }))
      },

      deleteCardioSession: (id) => {
        set(state => ({ cardioSessions: state.cardioSessions.filter(s => s.id !== id) }))
      },

      saveActiveCardioSession: (session) => set({ activeCardioSession: session }),
      clearActiveCardioSession: () => set({ activeCardioSession: null }),

      addCustomCardioType: (typeStr) => {
        set(state => {
          if (state.customCardioTypes.includes(typeStr)) return {}
          return { customCardioTypes: [...state.customCardioTypes, typeStr] }
        })
      },

      // ── Rest day actions ──────────────────────────────────────────────────

      addRestDaySession: (dateStr) => {
        const newEntry = {
          id: `rest_${generateId()}`,
          date: dateStr || new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
        set(state => ({ restDaySessions: [...state.restDaySessions, newEntry] }))
        return newEntry
      },

      deleteRestDaySession: (id) => {
        set(state => ({ restDaySessions: state.restDaySessions.filter(r => r.id !== id) }))
      },

      attachCardioToSession: (cardioId, sessionId) => {
        set(state => ({
          cardioSessions: state.cardioSessions.map(s =>
            s.id === cardioId ? { ...s, attachedToSessionId: sessionId } : s
          ),
        }))
      },

      // ── Session actions ───────────────────────────────────────────────────────────────

      addSession: (session) => {
        const newSession = {
          ...session,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set(state => ({ sessions: [...state.sessions, newSession] }))
        return newSession
      },

      deleteSession: (id) => {
        set(state => ({ sessions: state.sessions.filter(s => s.id !== id) }))
      },

      updateSession: (id, updates) => {
        set(state => ({
          sessions: state.sessions.map(s => s.id === id ? { ...s, ...updates } : s)
        }))
      },

      // ── Active session (in-progress workout) ──────────────────────────────────────────

      saveActiveSession: (session) => set({ activeSession: session }),
      clearActiveSession: () => set({ activeSession: null }),

      // ── Rest timer (timestamp-based for background survival) ──────────────────────────

      setRestEndTimestamp: (ts) => set({ restEndTimestamp: ts }),

      // ── Settings actions ──────────────────────────────────────────────────────────────

      updateSettings: (updates) => {
        set(state => ({ settings: { ...state.settings, ...updates } }))
      },

      // ── Gyms (lives under settings so export/import/merge ride along) ──

      addGym: (label) => {
        const clean = (label || '').trim()
        if (!clean) return null
        const id = `gym_${generateId()}`
        set(state => {
          const existing = (state.settings.gyms || []).find(
            g => g.label.toLowerCase() === clean.toLowerCase()
          )
          if (existing) return {}
          const gyms = [...(state.settings.gyms || []), { id, label: clean }]
          const defaultGymId = state.settings.defaultGymId || id
          return { settings: { ...state.settings, gyms, defaultGymId } }
        })
        return id
      },

      // Batch 20d: removeGym now strips the deleted gymId from every
      // Exercise.sessionGymTags / skipGymTagPrompt array so no dangling
      // references remain. Sessions' historical gymId values are preserved
      // — they're a record of past truth and shouldn't be rewritten.
      removeGym: (id) => {
        if (!id) return
        set(state => {
          const gyms = (state.settings.gyms || []).filter(g => g.id !== id)
          const defaultGymId = state.settings.defaultGymId === id
            ? (gyms[0]?.id || null)
            : state.settings.defaultGymId
          const exerciseLibrary = (state.exerciseLibrary || []).map(ex => {
            const hasTag  = Array.isArray(ex.sessionGymTags)    && ex.sessionGymTags.includes(id)
            const hasSkip = Array.isArray(ex.skipGymTagPrompt) && ex.skipGymTagPrompt.includes(id)
            if (!hasTag && !hasSkip) return ex
            const next = { ...ex }
            if (hasTag) {
              const filtered = ex.sessionGymTags.filter(g => g !== id)
              if (filtered.length) next.sessionGymTags = filtered
              else delete next.sessionGymTags
            }
            if (hasSkip) {
              const filtered = ex.skipGymTagPrompt.filter(g => g !== id)
              if (filtered.length) next.skipGymTagPrompt = filtered
              else delete next.skipGymTagPrompt
            }
            return next
          })
          return {
            settings: { ...state.settings, gyms, defaultGymId },
            exerciseLibrary,
          }
        })
      },

      // Batch 20d: case-insensitive dedupe against other gyms. Returns true
      // if the rename committed, false if it was rejected (duplicate label,
      // missing id, or empty label after trim).
      renameGym: (id, newLabel) => {
        const clean = (newLabel || '').trim()
        if (!id || !clean) return false
        let committed = false
        set(state => {
          const gyms = state.settings.gyms || []
          const current = gyms.find(g => g.id === id)
          if (!current) return {}
          if (current.label === clean) { committed = true; return {} }
          const conflict = gyms.find(g => g.id !== id && g.label.toLowerCase() === clean.toLowerCase())
          if (conflict) return {}
          const next = gyms.map(g => g.id === id ? { ...g, label: clean } : g)
          committed = true
          return { settings: { ...state.settings, gyms: next } }
        })
        return committed
      },

      setDefaultGymId: (id) => {
        set(state => ({ settings: { ...state.settings, defaultGymId: id } }))
      },

      // Batch 42 — persists the index returned by `pickHeadline` so the same
      // line stays stable across re-opens of the same Start HYROX overlay.
      setLastHyroxHeadlineIndex: (idx) => {
        if (typeof idx !== 'number' || !Number.isFinite(idx)) return
        set(state => ({
          settings: { ...state.settings, lastHyroxHeadlineIndex: idx },
        }))
      },

      // ── Anomaly dismissals (Batch 16q, step 9) ──────────────────────
      // Stamp the current active session's startTimestamp against the
      // exercise key so the AnomalyBanner knows to stay hidden for the
      // rest of this session. When the next session starts, startTimestamp
      // changes and the stored value no longer matches — banner returns
      // automatically if the underlying detector still fires.
      dismissAnomaly: (exerciseKey) => {
        if (!exerciseKey) return
        const activeId = get().activeSession?.startTimestamp || 'no-session'
        set(state => ({
          settings: {
            ...state.settings,
            dismissedAnomalies: {
              ...(state.settings.dismissedAnomalies || {}),
              [exerciseKey]: activeId,
            },
          },
        }))
      },

      // Batch 31.3 — Below-floor advisory dismissal. Same session-scoped
      // pattern as dismissAnomaly: stamp the activeSession.startTimestamp
      // against the exercise key, advisory re-appears next session if the
      // streak still fires. No UI to un-dismiss; the streak breaks naturally
      // when the user hits a session at or above their floor.
      dismissBelowFloorAdvisory: (exerciseKey) => {
        if (!exerciseKey) return
        const activeId = get().activeSession?.startTimestamp || 'no-session'
        set(state => ({
          settings: {
            ...state.settings,
            dismissedBelowFloorAdvisories: {
              ...(state.settings.dismissedBelowFloorAdvisories || {}),
              [exerciseKey]: activeId,
            },
          },
        }))
      },

      // ── Gym-tag prompt "Not this time" dismissal (Batch 20b, §3.5.4) ──
      // Stamps the current activeSession.startTimestamp against an
      // (exerciseKey, gymId) pair so the auto-tag prompt stays hidden for
      // the rest of this session. Next session a new startTimestamp means
      // the check misses and the prompt returns (unless the user chose
      // "Always skip" instead, which writes to Exercise.skipGymTagPrompt
      // via addSkipGymTagPrompt and persists indefinitely).
      dismissGymPrompt: (exerciseKey, gymId) => {
        if (!exerciseKey || !gymId) return
        const activeId = get().activeSession?.startTimestamp || 'no-session'
        const mapKey = `${exerciseKey}:${gymId}`
        set(state => ({
          settings: {
            ...state.settings,
            dismissedGymPrompts: {
              ...(state.settings.dismissedGymPrompts || {}),
              [mapKey]: activeId,
            },
          },
        }))
      },

      // ── Custom templates ──────────────────────────────────────────────────────────────

      addCustomTemplate: (template) => {
        const newTemplate = { ...template, id: generateId() }
        set(state => ({ customTemplates: [...state.customTemplates, newTemplate] }))
        return newTemplate
      },

      updateCustomTemplate: (id, updates) => {
        set(state => ({
          customTemplates: state.customTemplates.map(t =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }))
      },

      deleteCustomTemplate: (id) => {
        set(state => ({
          customTemplates: state.customTemplates.filter(t => t.id !== id),
        }))
      },

      // ── Workout sequence (split order) ────────────────────────────────────────────────
      // Legacy action from the pre-splits era. Kept because the built-in
      // split's rotation derives from it on first load; if any old callsite
      // still updates the workoutSequence we also sync the active built-in
      // split's rotation to match.

      updateWorkoutSequence: (sequence) => {
        set(state => {
          const updates = { workoutSequence: sequence }
          const activeSplit = state.splits.find(s => s.id === state.activeSplitId)
          if (activeSplit?.isBuiltIn) {
            updates.splits = state.splits.map(s =>
              s.id === state.activeSplitId ? { ...s, rotation: sequence } : s
            )
          }
          return updates
        })
      },

      // ── Export ────────────────────────────────────────────────────────────────────────

      exportData: () => {
        const state = get()
        const payload = {
          exportedAt: new Date().toISOString(),
          sessions: state.sessions,
          settings: state.settings,
          customTemplates: state.customTemplates,
          workoutSequence: state.workoutSequence,
          splits: state.splits,
          activeSplitId: state.activeSplitId,
          exerciseLibrary: state.exerciseLibrary,
          cardioSessions: state.cardioSessions,
          customCardioTypes: state.customCardioTypes,
          restDaySessions: state.restDaySessions,
        }
        const json = JSON.stringify(payload, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `workout-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      },

      // ── Import ────────────────────────────────────────────────────────────────────────

      importData: (json) => {
        try {
          const data = JSON.parse(json)
          if (data.sessions && Array.isArray(data.sessions)) {
            // Run the v5 bundling migration on imported sessions so a backup
            // from a pre-v5 install lands in the current schema. Idempotent
            // on already-bundled data, so re-imports + v5 backups are safe.
            const sessionsV5 = migrateSessionsToV5(data.sessions)
            // Batch 38: chain v9 on imported sessions so pre-v9 backups
            // gain derived weightKg / rawWeightKg. Idempotent.
            const migratedSessions = migrateSessionsToV9(sessionsV5)
            // Batch 30: run v6 + v7 library migrations on imported library
            // so pre-v7 backups land in the current schema (per-exercise
            // defaultRepRange + repRangeUserSet flag). Idempotent.
            // Batch 37: chain v8 to add type + dimensions + seed the 8
            // HYROX stations on imported libraries. Idempotent.
            const libV6 = migrateLibraryToV6(data.exerciseLibrary || [])
            const libV7 = migrateLibraryToV7(libV6)
            const migratedLibrary = migrateLibraryToV8(libV7)
            // Batch 38: derive distanceMiles / distanceMeters on imported
            // cardio sessions where distanceUnit === 'miles'. Idempotent.
            const migratedCardio = migrateCardioSessionsToV9(data.cardioSessions || [])
            set({
              sessions: migratedSessions,
              settings: data.settings || get().settings,
              customTemplates: data.customTemplates || [],
              workoutSequence: data.workoutSequence || null,
              splits: data.splits || [],
              activeSplitId: data.activeSplitId || null,
              exerciseLibrary: migratedLibrary,
              cardioSessions: migratedCardio,
              customCardioTypes: data.customCardioTypes || [],
              restDaySessions: data.restDaySessions || [],
            })
            return true
          }
          return false
        } catch {
          return false
        }
      },
    }),
    {
      name: 'workout-tracker-v1',
      version: 9,
      // Versioned persist migrations. Each block runs in order; they modify
      // persistedState in place and pass it along.
      //   V1→V2 (Batch 14): backfill rawWeight on every set and recompute
      //   every isNewPR against per-side load.
      //   V2→V3 (Batch 15b): seed exerciseLibrary if empty, assign stable
      //   exerciseId + canonical name to every LoggedExercise, flag
      //   unresolved session names as needsTagging, and re-run the PR
      //   recompute keyed by exerciseId so dedup'd names share history.
      //   V3→V4 (Batch 17a): additive — ensure the splitDraft slot exists
      //   (null is a valid value). Pre-v4 users simply don't have a draft,
      //   which is the correct initial state.
      //   V4→V5 (Batch 22): bundle flat drop-set entries into their
      //   preceding working set's drops[] array. PR flags recomputed
      //   chronologically under the new "working-primaries-only" rule
      //   (drop stages no longer qualify). Orphan drops (before any
      //   working in the same exercise) are promoted to working.
      //   V5→V6 (Batch 27): rewrite legacy `equipment: 'Machine'` library
      //   entries to `'Selectorized Machine'` (the safer default at
      //   commercial gyms). Plate-loaded machines users own will need
      //   one-tap re-tagging via /exercises. User-created custom machine
      //   entries and persisted built-ins both sweep.
      //   V6→V7 (Batch 30): re-seed per-exercise defaultRepRange via
      //   classifyRepRange (pre-v7 had uniform [8,12]) and add
      //   repRangeUserSet:false on every entry. Entries already carrying
      //   repRangeUserSet=true keep their current range — they're user
      //   overrides. Recommender subsequently reads either the override
      //   or inferRepRange(history, classificationDefault).
      //   V7→V8 (Batch 37): additive — every library entry gains `type`
      //   (default 'weight-training') and `dimensions` (default per type).
      //   The 8 HYROX stations are seeded as built-in entries unless their
      //   canonical ids are already present (user's manual creation wins).
      //   Foundation for the hybrid training v1 workstream — no UI changes
      //   ship in this batch; B38 / B39 / B41+ build on top of this schema.
      //   V8→V9 (Batch 38): additive — every weight-training set (top-level
      //   + nested drops) gains derived `weightKg` / `rawWeightKg` alongside
      //   the existing lbs fields. Cardio sessions with `distanceUnit:'miles'`
      //   gain derived `distanceMiles` + `distanceMeters`. No HYROX rounds
      //   exist pre-v9 so no backfill there. Idempotent — sets that already
      //   carry weightKg are skipped.
      migrate: (persistedState, version) => {
        if (!persistedState) return persistedState
        if (version < 2 && Array.isArray(persistedState.sessions)) {
          persistedState.sessions = migrateSessionsToV2(persistedState.sessions)
        }
        if (version < 3) {
          const seededLibrary =
            (Array.isArray(persistedState.exerciseLibrary) && persistedState.exerciseLibrary.length > 0)
              ? persistedState.exerciseLibrary
              : buildBuiltInLibrary()
          const result = migrateSessionsToV3({
            sessions: persistedState.sessions || [],
            library:  seededLibrary,
          })
          persistedState.exerciseLibrary = result.library
          persistedState.sessions        = result.sessions
        }
        if (version < 4) {
          persistedState.splitDraft = persistedState.splitDraft ?? null
        }
        if (version < 5 && Array.isArray(persistedState.sessions)) {
          persistedState.sessions = migrateSessionsToV5(persistedState.sessions)
        }
        if (version < 6 && Array.isArray(persistedState.exerciseLibrary)) {
          persistedState.exerciseLibrary = migrateLibraryToV6(persistedState.exerciseLibrary)
        }
        if (version < 7 && Array.isArray(persistedState.exerciseLibrary)) {
          persistedState.exerciseLibrary = migrateLibraryToV7(persistedState.exerciseLibrary)
        }
        if (version < 8 && Array.isArray(persistedState.exerciseLibrary)) {
          persistedState.exerciseLibrary = migrateLibraryToV8(persistedState.exerciseLibrary)
        }
        if (version < 9) {
          if (Array.isArray(persistedState.sessions)) {
            persistedState.sessions = migrateSessionsToV9(persistedState.sessions)
          }
          if (Array.isArray(persistedState.cardioSessions)) {
            persistedState.cardioSessions = migrateCardioSessionsToV9(persistedState.cardioSessions)
          }
        }
        return persistedState
      },
      // Custom merge: new top-level fields fall back to initial values when
      // not present in old persisted state — settings are deep-merged so
      // existing user prefs are never lost across deploys.
      merge: (persisted, current) => {
        const hasExistingSessions = persisted.sessions && persisted.sessions.length > 0
        return {
          ...current,
          ...persisted,
          settings: {
            ...current.settings,
            ...(persisted.settings || {}),
            // Existing users who already have sessions are treated as having seen the tutorial
            hasSeenTutorial: persisted.settings?.hasSeenTutorial
              ?? (hasExistingSessions ? true : false),
          },
          splits: persisted.splits || current.splits,
          splitDraft: persisted.splitDraft ?? current.splitDraft ?? null,
          exerciseLibrary: persisted.exerciseLibrary || current.exerciseLibrary,
          activeSplitId: persisted.activeSplitId ?? current.activeSplitId,
          cardioSessions: persisted.cardioSessions || current.cardioSessions,
          customCardioTypes: persisted.customCardioTypes || current.customCardioTypes,
          activeCardioSession: persisted.activeCardioSession ?? null,
          restDaySessions: persisted.restDaySessions || current.restDaySessions,
          // Existing users who already have sessions are treated as onboarded
          hasCompletedOnboarding: persisted.hasCompletedOnboarding
            || hasExistingSessions
            || false,
        }
      },
    }
  )
)

export default useStore
