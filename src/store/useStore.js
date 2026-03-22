import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '../utils/helpers'
import {
  BB_WORKOUT_SEQUENCE,
  BB_WORKOUT_NAMES,
  BB_WORKOUT_EMOJI,
  BB_EXERCISE_GROUPS,
} from '../data/exercises'

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
      },
      // In-progress workout session — survives app backgrounding / page reload
      activeSession: null,
      // User-created workout templates
      customTemplates: [],
      // BB workout rotation order — null means use default BB_WORKOUT_SEQUENCE
      workoutSequence: null,
      // Timestamp (ms) when the rest timer should expire — null if not running
      restEndTimestamp: null,

      // ── Splits ─────────────────────────────────────────────────────────────
      splits: [],
      activeSplitId: null,
      // User's custom exercises (pre-built exercises stay in exercises.js)
      exerciseLibrary: [],

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

      // ── Split CRUD ────────────────────────────────────────────────────────

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

      // ── Active session (in-progress workout) ──────────────────────────────────────────

      saveActiveSession: (session) => set({ activeSession: session }),
      clearActiveSession: () => set({ activeSession: null }),

      // ── Rest timer (timestamp-based for background survival) ──────────────────────────

      setRestEndTimestamp: (ts) => set({ restEndTimestamp: ts }),

      // ── Settings actions ──────────────────────────────────────────────────────────────

      updateSettings: (updates) => {
        set(state => ({ settings: { ...state.settings, ...updates } }))
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
      version: 1,
      // Custom merge: new top-level fields fall back to initial values when
      // not present in old persisted state — settings are deep-merged so
      // existing user prefs are never lost across deploys.
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        settings: { ...current.settings, ...(persisted.settings || {}) },
        splits: persisted.splits || current.splits,
        exerciseLibrary: persisted.exerciseLibrary || current.exerciseLibrary,
        activeSplitId: persisted.activeSplitId ?? current.activeSplitId,
      }),
    }
  )
)

export default useStore
