import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId, migrateSessionsToV2, migrateSessionsToV3 } from '../utils/helpers'
import {
  BB_WORKOUT_SEQUENCE,
  BB_WORKOUT_NAMES,
  BB_WORKOUT_EMOJI,
  BB_EXERCISE_GROUPS,
} from '../data/exercises'
import { EXERCISE_LIBRARY as BUILT_IN_RAW } from '../data/exerciseLibrary'

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
  return BUILT_IN_RAW.map(raw => ({
    id:                builtInExerciseIdForName(raw.name),
    name:              raw.name,
    aliases:           [],
    primaryMuscles:    [raw.muscleGroup],
    equipment:         raw.equipment,
    isBuiltIn:         true,
    defaultUnilateral: false,
    loadIncrement:     5,
    defaultRepRange:   [8, 12],
    progressionClass:
      raw.muscleGroup === 'Full Body' ? 'compound'
      : raw.equipment === 'Bodyweight' ? 'bodyweight'
      : 'isolation',
    needsTagging:      false,
    createdAt:         '2026-04-17',
  }))
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
        backgroundTheme: 'obsidian',
        userName: '',
        autoStartRest: false,
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
        // Required-field validation — enforces the §3.2.1 constraint that every
        // Exercise carries at least one primaryMuscles value and one equipment.
        if (!exercise?.name?.trim()) {
          throw new Error('addExerciseToLibrary: name required')
        }
        if (!Array.isArray(exercise.primaryMuscles) || exercise.primaryMuscles.length === 0) {
          throw new Error('addExerciseToLibrary: at least one primaryMuscles value required')
        }
        if (!exercise.equipment) {
          throw new Error('addExerciseToLibrary: equipment required')
        }
        const newEx = {
          id:                `ex_${generateId()}`,
          name:              exercise.name.trim(),
          aliases:           exercise.aliases || [],
          primaryMuscles:    exercise.primaryMuscles,
          equipment:         exercise.equipment,
          isBuiltIn:         false,
          defaultUnilateral: !!exercise.defaultUnilateral,
          loadIncrement:     exercise.loadIncrement    || 5,
          defaultRepRange:   exercise.defaultRepRange  || [8, 12],
          progressionClass:  exercise.progressionClass || 'isolation',
          needsTagging:      false,
          createdAt:         new Date().toISOString(),
          ...(exercise.sessionGymTags ? { sessionGymTags: exercise.sessionGymTags } : {}),
        }
        set(state => ({ exerciseLibrary: [...state.exerciseLibrary, newEx] }))
        return newEx
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
        const newSplit = { ...split, id: generateId(), createdAt: new Date().toISOString().split('T')[0] }
        set(state => ({ splits: [...state.splits, newSplit] }))
        return newSplit
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
          createdAt: new Date().toISOString().split('T')[0],
        }
        set(prev => ({ splits: [...prev.splits, clone] }))
        return clone
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

      removeGym: (id) => {
        set(state => {
          const gyms = (state.settings.gyms || []).filter(g => g.id !== id)
          const defaultGymId = state.settings.defaultGymId === id
            ? (gyms[0]?.id || null)
            : state.settings.defaultGymId
          return { settings: { ...state.settings, gyms, defaultGymId } }
        })
      },

      setDefaultGymId: (id) => {
        set(state => ({ settings: { ...state.settings, defaultGymId: id } }))
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
      // Also syncs to the active split's rotation if the active split is built-in,
      // so the existing SplitEditor continues to work correctly.

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
            set({
              sessions: data.sessions,
              settings: data.settings || get().settings,
              customTemplates: data.customTemplates || [],
              workoutSequence: data.workoutSequence || null,
              splits: data.splits || [],
              activeSplitId: data.activeSplitId || null,
              exerciseLibrary: data.exerciseLibrary || [],
              cardioSessions: data.cardioSessions || [],
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
      version: 3,
      // Versioned persist migrations. Each block runs in order; they modify
      // persistedState in place and pass it along.
      //   V1→V2 (Batch 14): backfill rawWeight on every set and recompute
      //   every isNewPR against per-side load.
      //   V2→V3 (Batch 15b): seed exerciseLibrary if empty, assign stable
      //   exerciseId + canonical name to every LoggedExercise, flag
      //   unresolved session names as needsTagging, and re-run the PR
      //   recompute keyed by exerciseId so dedup'd names share history.
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
