import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId, migrateSessionsToV2, migrateSessionsToV3, migrateSessionsToV5, toLocalDateStr } from '../utils/helpers'
import {
  BB_WORKOUT_SEQUENCE,
  BB_WORKOUT_NAMES,
  BB_WORKOUT_EMOJI,
  BB_EXERCISE_GROUPS,
} from '../data/exercises'
import { EXERCISE_LIBRARY as BUILT_IN_RAW } from '../data/exerciseLibrary'
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
        const skipTagging = exercise.needsTagging === true
        if (!skipTagging) {
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
          primaryMuscles:    Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles : [],
          equipment:         exercise.equipment || 'Other',
          isBuiltIn:         false,
          defaultUnilateral: !!exercise.defaultUnilateral,
          loadIncrement:     exercise.loadIncrement    || 5,
          defaultRepRange:   exercise.defaultRepRange  || [8, 12],
          progressionClass:  exercise.progressionClass || 'isolation',
          needsTagging:      skipTagging,
          createdAt:         new Date().toISOString(),
          ...(Array.isArray(exercise.sessionGymTags) && exercise.sessionGymTags.length
            ? { sessionGymTags: [...exercise.sessionGymTags] } : {}),
          ...(Array.isArray(exercise.skipGymTagPrompt) && exercise.skipGymTagPrompt.length
            ? { skipGymTagPrompt: [...exercise.skipGymTagPrompt] } : {}),
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
      loadTemplate: (templateId) => {
        const draft = loadTemplateForDraft(templateId)
        if (!draft) return false
        set({
          splitDraft: {
            originalId: null,
            draft,
            updatedAt: Date.now(),
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
            const migratedSessions = migrateSessionsToV5(data.sessions)
            set({
              sessions: migratedSessions,
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
      version: 5,
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
