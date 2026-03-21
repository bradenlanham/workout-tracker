import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '../utils/helpers'

const useStore = create(
  persist(
    (set, get) => ({
      sessions: [],
      settings: {
        restTimerDuration: 90,
        accentColor: 'violet',
      },
      // In-progress workout session — survives app backgrounding / page reload
      activeSession: null,
      // User-created workout templates
      customTemplates: [],
      // BB workout rotation order — null means use default BB_WORKOUT_SEQUENCE
      workoutSequence: null,
      // Timestamp (ms) when the rest timer should expire — null if not running
      restEndTimestamp: null,

      // ── Session actions ───────────────────────────────────────────────────

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

      // ── Active session (in-progress workout) ──────────────────────────────

      saveActiveSession: (session) => set({ activeSession: session }),
      clearActiveSession: () => set({ activeSession: null }),

      // ── Rest timer (timestamp-based for background survival) ──────────────

      setRestEndTimestamp: (ts) => set({ restEndTimestamp: ts }),

      // ── Settings actions ──────────────────────────────────────────────────

      updateSettings: (updates) => {
        set(state => ({ settings: { ...state.settings, ...updates } }))
      },

      // ── Custom templates ──────────────────────────────────────────────────

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

      // ── Workout sequence (split order) ────────────────────────────────────

      updateWorkoutSequence: (sequence) => set({ workoutSequence: sequence }),

      // ── Export ────────────────────────────────────────────────────────────

      exportData: () => {
        const state = get()
        const payload = {
          exportedAt: new Date().toISOString(),
          sessions: state.sessions,
          settings: state.settings,
          customTemplates: state.customTemplates,
          workoutSequence: state.workoutSequence,
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

      // ── Import ────────────────────────────────────────────────────────────

      importData: (json) => {
        try {
          const data = JSON.parse(json)
          if (data.sessions && Array.isArray(data.sessions)) {
            set({
              sessions: data.sessions,
              settings: data.settings || get().settings,
              customTemplates: data.customTemplates || [],
              workoutSequence: data.workoutSequence || null,
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
      }),
    }
  )
)

export default useStore
