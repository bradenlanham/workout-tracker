# Gains — Project State

> Last updated: April 19, 2026 (Batch 17a — split draft auto-save + persist v4 migration)

## Rules for Claude

1. **Read this file first** at the start of every new session before doing anything else.
2. **Update this file** after every batch of changes. Add new features to "Recent Changes", update file structure if files were added/removed, and update store shape if state changed. Update the "Last updated" date.
3. **Git is fully writable from the sandbox.** Claude runs `git` directly — creates worktrees, commits, pushes feature branches, and merges to main. Never `--force` push. Never skip hooks (`--no-verify`).
4. **Validate builds** with `npx vite build --outDir /tmp/test-build`. Never build to the mounted `dist/` folder (Vite can't emit there — EPERM).
5. **Feature branches for non-trivial changes.** Not for review (user doesn't review), but to give a clean revert point and a Vercel preview URL before merging to main. Small fixes can go straight to main.

---

## Overview

**Gains** — a mobile-first PWA for tracking weight training and cardio sessions. Built around a customizable split rotation system with automatic workout progression, PR tracking, session grading, and detailed history/stats.

**Live URL:** Deployed to Vercel via GitHub auto-deploy from `main` branch.
**Repo:** `github.com/bradenlanham/workout-tracker`
**Primary user:** Braden

---

## Tech Stack

- **Framework:** React 18.3.1 + React Router v6 (HashRouter)
- **State:** Zustand 4.5.2 with `persist` middleware (localStorage key: `workout-tracker-v1`)
- **Styling:** Tailwind CSS 3.4.3 with CSS custom properties for theming
- **Charts:** Recharts 2.12.2
- **Build:** Vite 5.2.0
- **Image export:** html2canvas (for share card JPEG export)
- **No backend.** All data lives in localStorage. Export/import via JSON backup files.

---

## File Structure

```
src/
├── App.jsx                    # HashRouter, route definitions, theme init, split auto-creation
├── main.jsx                   # React root mount
├── index.css                  # Tailwind config + CSS variables (obsidian/daylight themes)
├── theme.js                   # 10 accent color definitions (violet, blue, emerald, orange, rose, cyan, red, pink, white, black)
│
├── store/
│   └── useStore.js            # Zustand store — ALL app state + actions
│
├── data/
│   ├── exercises.js           # Built-in "BamBam's Blueprint" workout data (5 workouts, exercise groups)
│   └── exerciseLibrary.js     # 140+ exercises by muscle group for the exercise picker
│
├── utils/
│   └── helpers.js             # getNextBbWorkout, getLastBbSession, perSideLoad, getExercisePRs, isSetPR, isPR,
│                              # getWorkoutStreak, getBestStreak, getRotationItemOnDate, getAchievements,
│                              # migrateSessionsToV2, migrateSessionsToV3, normalizeExerciseName,
│                              # similarExerciseScore, findSimilarExercises, formatDate/Time, playBeep, generateId,
│                              # e1RM, percent1RM, getExerciseHistory, getCurrentE1RM, getProgressionRate,
│                              # getRecommendationConfidence, recommendNextLoad   ← recommender engine (Batch 16a)
│                              # detectPlateau, detectRegression, detectSwing, detectAnomalies  ← anomaly detectors (Batch 16q)
│                              # getWorkoutStreak signature: (sessions, cardioSessions, restDaySessions)
│                              # getBestStreak    signature: (sessions, cardioSessions, restDaySessions)
│                              # perSideLoad(set): canonical per-side load accessor — rawWeight ?? weight ?? 0
│                              # findSimilarExercises(query, library, opts): trigram+token-sort fuzzy match
│                              # recommendNextLoad({history, targetReps, mode, progressionClass, loadIncrement})
│                              #   → { mode, confidence, prescription: {weight, reps}, reasoning, meta }
│                              # detectAnomalies(history): runs all three detectors, returns highest-priority
│                              #   hit or null; priority: regression > swing > plateau
│
├── components/
│   ├── BottomNav.jsx          # 4-tab nav: Dashboard, Log, History, Progress (hidden during logging)
│   ├── HamburgerMenu.jsx      # Slide-in menu: My Splits, Progress, Settings, Info (incl. "How Streaks Work"), Manage Data
│   ├── RestTimer.jsx          # Floating draggable rest timer with progress ring (visible only during logging)
│   ├── CustomNumpad.jsx       # Numpad overlay used by BbLogger for weight/reps entry
│   ├── CreateExerciseModal.jsx # Shared modal for adding a new library entry with required muscle + equipment
│   └── ExerciseEditSheet.jsx   # Bottom-sheet editor for existing library entries (Batch 16j)
│
│
└── pages/
    ├── Welcome.jsx            # Onboarding: name entry, split choice (Blueprint or build own), theme, import
    ├── Dashboard.jsx          # Main screen: greeting, 6 stat cards, CTA card, soreness check-in, weekly calendar, workout preview
    ├── Log.jsx                # Workout picker: shows rotation, split order editor modal, custom template list
    ├── History.jsx            # Calendar heatmap (13 weeks), session list by date, session detail modal, share card
    ├── Progress.jsx           # Bar chart of session volume (last 15 sessions via Recharts)
    ├── Guide.jsx              # Static training guide (sets, reps, hypertrophy tips)
    ├── CardioLogger.jsx       # Cardio session logger: type selection, stopwatch, manual entry, HR, distance, intensity
    ├── SplitManager.jsx       # List all splits, set active, edit, clone, export/import, delete
    ├── SplitBuilder.jsx       # 4-step wizard: name/emoji → add workouts → set rotation → review & save
    ├── SplitEditor.jsx        # Legacy built-in split rotation reorder (kept for backward compat)
    ├── TemplateEditor.jsx     # Create/edit custom workout templates (legacy, pre-splits feature)
    ├── Backfill.jsx           # One-time tagging screen for library entries with needsTagging: true.
    │                          # Per-card draft state + Confirm button (Batch 16j) — auto-save
    │                          # reverted so users get an explicit "I'm done" before the card
    │                          # drops off the list.
    ├── ExerciseLibraryManager.jsx # /exercises — list/filter/search/edit all library entries
    │                          # via ExerciseEditSheet. Batch 16j.
    │
    └── log/
        ├── BbLogger.jsx       # THE MAIN SESSION LOGGER — exercise cards, sets, plates mode, uni toggle,
        │                      # previous session ghost rows, add exercise panel, finish modal, session comparison,
        │                      # auto-persist to split template, share card integration
        ├── Recommendation.jsx # Recommender UI: RecommendationChip (toolbar-row "Tip" pill,
        │                      # 16n-1), RecommendationSheet (bottom-sheet w/ one-line header
        │                      # "Recommended top set: W×R" + exercise name above + last-session
        │                      # subtitle, e1RM sparkline w/ explicit Peak/Growth key, compact
        │                      # 1-line mode chips, tap-to-explain confidence %, plain-English
        │                      # reasoning, expandable Details section w/ "vs last session" delta,
        │                      # accepts aggressivenessMultiplier + defaultMode from readiness
        │                      # check-in), AnomalyBanner (Batch 16q — inline card banner for
        │                      # plateau/regression/swing, severity-keyed tint, dismiss-per-session
        │                      # X; rendered between toolbar row and column headers).
        │                      # Batches 16b + 16f + 16n + 16n-1 + 16q.
        │                      # Exports: RecommendationChip, RecommendationSheet, AnomalyBanner.
        ├── ReadinessCheckIn.jsx # Batch 16n — three-tap pre-session overlay (§2.5): Energy /
        │                      # Sleep / Goal rows + gym chip. Goal→mode, Energy+Sleep→multiplier.
        │                      # Defaults OK/OK/Push = no-op (mult 1.0). Skip link + Go back.
        ├── ShareCard.jsx      # Trading card share card: 5 tiers by streak, selfie, stats bar, JPEG export
        └── CameraCapture.jsx  # Selfie camera component for share card
```

---

## Zustand Store Shape (`useStore.js`)

```javascript
{
  // ── Sessions ──
  sessions: [],                    // Array of completed workout sessions
  activeSession: null,             // In-progress workout (survives reload/backgrounding)

  // ── Settings ──
  settings: {
    restTimerDuration: 90,         // Seconds
    accentColor: 'violet',         // Theme key (see theme.js)
    backgroundTheme: 'obsidian',   // 'obsidian' | 'daylight'
    userName: '',
    autoStartRest: false,          // Auto-start rest timer after logging a working set
    defaultFirstSetType: 'warmup', // 'warmup' | 'working'
    restTimerChime: true,          // Play beep when timer ends
    hasSeenTutorial: false,        // Dashboard tutorial overlay
    enableAiCoaching: true,        // Batch 16i — gates the recommender UI (banner + sheet)
    showRecPill: true,             // Batch 16i — gates the per-exercise blue REC chip
    gyms: [],                      // Batch 16n — [{id, label}] — populated inline from readiness chip picker
    defaultGymId: null,            // Batch 16n — last-selected gym (seeds the chip next session)
    dismissedAnomalies: {},        // Batch 16q — { [exerciseKey]: sessionId } — anomaly-banner dismissals scoped to current active session
  },

  // ── Splits ──
  splits: [],                      // Array of split objects (built-in + user-created)
  activeSplitId: null,             // Currently active split ID
  splitDraft: null,                // Batch 17a — in-progress wizard/canvas draft; { originalId, draft, updatedAt } | null
  exerciseLibrary: [],             // Canonical Exercise[] — seeded by initLibrary() on mount
                                   // from data/exerciseLibrary.js + extended by the v2→v3
                                   // migration with needsTagging:true entries for any
                                   // user-created session names that didn't resolve.
                                   // Entry shape: { id, name, aliases, primaryMuscles[],
                                   // equipment, isBuiltIn, defaultUnilateral, loadIncrement,
                                   // defaultRepRange, progressionClass, needsTagging, createdAt }

  // ── Legacy ──
  customTemplates: [],             // Pre-splits custom workout templates
  workoutSequence: null,           // Legacy rotation order (synced to active split)

  // ── Cardio ──
  cardioSessions: [],              // Standalone + attached cardio sessions
  customCardioTypes: [],           // User-added cardio type strings
  activeCardioSession: null,       // In-progress cardio

  // ── Rest Day Logging ──
  restDaySessions: [],             // Explicitly logged rest days { id, date: 'YYYY-MM-DD', note? }

  // ── Timer ──
  restEndTimestamp: null,          // ms timestamp when rest timer expires

  // ── Onboarding ──
  hasCompletedOnboarding: false,
}
```

### Session Object

```javascript
{
  id: 'generated-id',
  date: '2026-04-01T14:30:00.000Z',
  mode: 'bb',                          // 'bb' for weight training
  type: 'push' | 'legs1' | 'generated-id',  // workout ID from split rotation
  duration: 45,                         // Minutes
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | null,
  completedCardio: true | false,
  cardio: { completed, type, duration, heartRate, notes },
  notes: '...',
  selfie: 'data:image/...' | null,
  soreness: { rating: 'notsore'|'sore'|'verysore'|'wrecked', date: '2026-04-01' } | null,
  readiness: {                          // Batch 16n — present when user answered the check-in
    energy: 'low'|'ok'|'high',
    sleep: 'poor'|'ok'|'good',
    goal: 'recover'|'match'|'push',
    aggressivenessMultiplier: 0.85|1.00|1.15,   // energy + sleep → scales push-mode nudge
    suggestedMode: 'deload'|'maintain'|'push',   // goal → recommender mode
    timestamp: '...',
  } | null,                             // null when Skip check-in tapped
  gymId: 'gym_...' | null,              // Batch 16n — where the session was logged
  data: {
    workoutType: 'push',
    exercises: [
      {
        name: 'Bench Press',            // Canonical name — matches a library entry
        exerciseId: 'ex_bench_press',   // Stable library link (added in Batch 15)
        notes: '...',
        completedAt: timestamp,
        unilateral: false,              // If true, volume was doubled at save time
        sets: [
          {
            type: 'warmup' | 'working' | 'drop',
            reps: 8,
            weight: 185,                // Already doubled if unilateral
            rawWeight: 92.5,            // Original input (only present if unilateral)
            isNewPR: false,
            plates: { 45: 2, 25: 1, ... },  // Only present if logged in plate mode
            barWeight: 45,                    // Only present if logged in plate mode
            // rpe: 8                          // (16c shipped + reverted in 16d — engine
            //                                  //  still reads rpe if present, but no UI
            //                                  //  captures it; field no longer saved)
          }
        ]
      }
    ]
  }
}
```

### Split Object

```javascript
{
  id: 'split_bam' | 'generated-id',
  name: "BamBam's Blueprint",
  emoji: '🏋️',
  isBuiltIn: true | false,
  createdAt: '2026-03-22',
  workouts: [
    {
      id: 'push' | 'generated-id',
      name: 'Push — Chest',
      emoji: '🏋️',
      sections: [
        {
          label: 'Primary',
          exercises: ['Pec Dec', 'Incline DB Press', ...]  // String names
        },
        { label: 'Choose 1', exercises: [...] },
        { label: 'If You Have Time', exercises: [...] }
      ]
    }
  ],
  rotation: ['push', 'legs1', 'rest', 'pull', ...],  // Workout IDs + 'rest'
}
```

---

## Built-in Split: BamBam's Blueprint

5 workouts in default rotation order: `push → legs1 → pull → push2 → legs2`

| ID | Name | Emoji | Primary Exercises |
|---|---|---|---|
| push | Push — Chest | 🏋️ | Pec Dec, Incline DB Press, Flat Bench Press |
| legs1 | Legs 1 — Quads | 🦵 | Leg Curls, Leg Extensions |
| pull | Pull — Back | 💪 | Single Arm Lat Pulldown, Single Arm Row, Chest Supported Wide Row |
| push2 | Push 2 — Shoulders & Arms | 🎯 | Rear Delts, DB Lateral Raises, Military Press |
| legs2 | Legs 2 — Hams | 🦿 | Seated Leg Curl, DB Romanian Deadlifts |

Each workout has 3 sections: "Primary" (always do), "Choose 1" (pick one), "If You Have Time" (optional).

---

## Key Features & How They Work

### Workout Rotation & Progression
- `getNextBbWorkout()` finds the last logged session type in the rotation and returns the next one (skipping rest days).
- `getRotationItemOnDate()` calculates what workout falls on any given date (including rest days) using the most recent session as an anchor.
- Rest days in the rotation are markers that prevent streak-breaking on off days.

### Session Logger (BbLogger.jsx) — The Core
- **Initialization:** Loads exercises from the active split's workout template. Also merges in any exercises from the last session of the same type that aren't in the template (ensures custom exercises persist).
- **Active session persistence:** Every change to exercises or notes auto-saves to `activeSession` in the store, surviving page reload and app backgrounding.
- **Plate mode:** Per-exercise toggle. Shows plate buttons (100, 45, 35, 25, 10, 5, 2.5) with a bar weight cycler (45/0/25). A **1× / 2× multiplier toggle** controls whether plates are counted once or on both sides (default: 2×). Plate breakdown data is saved to the session for accurate ghost row display next time. **Plates toggle is pre-selected** from last session's data (`plateLoaded` state initialized from last session).
- **Unilateral (Uni) toggle:** Per-exercise. When active, volume is doubled at save time. The doubled weight is stored in `weight`, original in `rawWeight`. **Uni toggle is pre-selected** from last session's `unilateral` flag.
- **Previous session ghost rows:** Shows last session's sets as faded, non-interactive rows. Ghost rows display `rawWeight` (not doubled weight) for unilateral exercises. Includes plate breakdown if logged in plate mode. Toggled by "Last Time" button per exercise.
- **Set types:** warmup / working / drop. Drop sets auto-suggest 75% of previous working set weight.
- **PR detection:** Weight-anchored — a set is a PR only if (a) its weight exceeds the all-time max weight for that exercise, or (b) its weight equals the all-time max and reps exceed the best rep count ever achieved at that max weight. Reps alone at sub-max weight are never a PR. Single source of truth lives in `isSetPR()` in `helpers.js` and is used by the live per-set trophy, the card-level trophy, and the saved `isNewPR` flag. An amber "PR 185×8" chip on every exercise card surfaces the all-time max at a glance.
- **Auto-sync custom exercises to split:** After saving, any exercises that were in the session but not in the template get added to the appropriate section of the split definition. Placement is intelligent — inserts near the exercises it was positioned next to during the session.
- **Finish flow:** Grade picker → optional cardio attachment (attach today's cardio, log inline, or log now via CardioLogger) → **Session Comparison screen** (shows volume % diff per exercise vs last session, green ↑ / red ↓) → Share Card.
- **Session timer:** Timestamp-based, survives backgrounding via `visibilitychange` listener.

### Grade System
- Grades: D, C, B, A, A+ (assigned at session finish or edited later in History).
- Grades drive the color of heatmap cells in History: A+ = accent color, A = emerald, B = amber, C = red, D = dark red.
- **Editable after save:** The grade badge in History session detail is tappable and shows a picker to set/change grade anytime.

### Share Card (ShareCard.jsx)
- **Fixed-viewport trading card** — always fits one screen (max 380px wide, no scrolling).
- **5 rarity tiers** based on workout streak from `getWorkoutStreak()`:
  - Common (0–5): user's accent color border/glow
  - Rare (6–14): silver
  - Epic (15–19): gold
  - Legendary (20–49): animated shimmer gradient border (orange/red/gold)
  - Mythic (50+): animated shimmer border (purple/cyan/pink) + sparkle particles
- **Layout (top to bottom):** tier badge row → 4:3 photo window (selfie or placeholder) → workout title + meta → exercise list (max 6 + overflow) → stats bar (VOL / SETS / STREAK 🔥 / GRADE).
- **JPEG export:** Share button captures card via `html2canvas` at 2× scale, exports via Web Share API (iOS) or download fallback.
- **Share/Done buttons** are outside the `cardRef` div and not captured in the JPEG.
- **Data shape:** `data` prop includes `streak` (number) in addition to the standard fields. Both `BbLogger.jsx` and `History.jsx` pass `streak: getWorkoutStreak(sessions, activeSplit?.rotation)`.
- **Dependency:** `html2canvas` (installed).

### Session Comparison (in BbLogger.jsx)
- Shown automatically after saving a session (before share card), if a previous session of the same workout type exists.
- Per-exercise volume comparison with % change (green ↑ increase, red ↓ decrease).
- Overall volume diff prominently displayed at the top.
- "Continue" button advances to share card. Skipped entirely if no previous session exists.

### History (History.jsx)
- **Calendar heatmap:** 13 weeks × 7 days. Color-coded by best session grade that day.
- **Session list:** Grouped by date, newest first. Shows workout name, emoji, exercise count, set count, time, grade.
- **Session detail modal:** Exercise breakdown with sets, attached cardio, soreness, notes.
- **Workout name resolution:** Uses `resolveWorkoutName()` / `resolveWorkoutEmoji()` which check all splits in the store (not just built-in names). Fixes display of user-created split workout names.

### Dashboard (Dashboard.jsx)
- **Greeting:** Time-based ("Good morning/afternoon/evening, {name}") with increased top padding for proper spacing.
- **6 stat cards** (compact layout): Last Week Volume, This Week Volume, Sessions (Split), Day Streak, Total Sessions, PRs This Split.
- **Active split label:** Shows current split name and emoji (no "X/7 days" text — removed).
- **Main CTA card:** Shows next workout in rotation with "Start Session" button. Shows "Rest Day" message on rest days. "Preview" button shows the workout's exercise list. Increased gap between Preview and Start Session buttons.
- **Soreness check-in:** Prompted the day after a workout (yesterday's session). `yesterdayLogged` checks sessions, cardioSessions, AND restDaySessions. Ratings: Not Sore, Sore, Very Sore, Wrecked. Can be skipped.
- **Action buttons row:** "Log Cardio" and "Log Rest Day" buttons side by side below the CTA card.
- **StreakBadge:** Always rendered (even at 0, shows "0🔥"). Not conditionally hidden.
- **Weekly calendar strip:** Sun–Sat with emoji indicators for completed, planned, and rest days. Explicitly logged rest days show a brighter dot. Tapping a future day shows workout preview.
- **Monthly calendar view** (toggleable): Full month view.
- **Tutorial overlay:** 4-step walkthrough on first visit.

### Cardio Logger (CardioLogger.jsx)
- Type selection: Treadmill, Stairmaster, Running, Walking, Assault Bike, Other + user-added custom types.
- Two modes: Stopwatch (live timer) or Manual Entry (h:m:s input).
- Fields: duration, distance (unit varies by type), intensity (Easy/Moderate/Hard/All Out), min/max HR, notes.
- Can attach to a previous weight session from the same day, or log standalone.
- Navigated to directly from Dashboard or via "Log Cardio Now" in the finish modal.

### Splits System
- **SplitManager:** List, activate, edit, clone, export (JSON), import, delete splits.
- **SplitBuilder:** 4-step wizard. Step 1: split name + emoji. Step 2: add/edit workouts (each with name, emoji, exercise sections pulled from the exercise library or custom input). Step 3: set rotation order (drag workouts + rest days). Step 4: review & save.
- **SplitEditor:** Legacy editor for reordering the built-in split's rotation only.
- Splits are auto-created on first app load (built-in "BamBam's Blueprint").
- When a split is created/edited, workout IDs are generated via `generateId()`. These IDs are used in the rotation array and as the `type` field in logged sessions.

### Rest Timer (RestTimer.jsx)
- Floating circular button, visible only on logging screens (`/log/*`).
- **Draggable** (touch-based repositioning).
- Scales up 1.5× while running. Progress ring shows remaining time.
- Color states: idle (gray), running (blue), almost done ≤10s (amber), done (green ✓).
- Settings gear opens duration config (preset buttons: 60/90/120/180s, or custom).
- Auto-start option: begins countdown after logging a working set.
- Timestamp-based: survives backgrounding. Chime plays via Web Audio API on completion.

### Streaks
- **"Active day" definition (single source of truth):** a calendar day with at least one of a weight session, a cardio session, or an explicitly-logged rest day. Nothing else counts — rotation rest slots do NOT bridge gaps.
- `getWorkoutStreak(sessions, cardioSessions, restDaySessions)` returns the current unbroken run of active days ending at (or just before) today. Today is exempt from breaking the streak so it doesn't zero out before the user logs.
- `getBestStreak(sessions, cardioSessions, restDaySessions)` returns the longest consecutive-active-day run anywhere in history, using the exact same active-day definition. Guaranteed `best >= current`.
- **Both functions share the `buildActiveDaySet()` helper** in helpers.js so they can never drift.
- **Historical note:** Earlier versions bridged rotation rest slots (e.g. if the rotation said Sunday was a rest day, a missed Sunday didn't break the streak). That produced surprising jumps and a "best < current" inconsistency on Progress. Removed in Batch 11.
- `getAchievements(sessions, cardioSessions, restDaySessions)` — also dropped the `rotation` param.
- All call sites (Dashboard, History, BbLogger, Progress, ShareCard) call with the 3-arg signature.

### PR Tracking
- **Weight-anchored model.** `getExercisePRs(sessions, exerciseName)` returns `{ maxWeight, maxRepsAtMaxWeight }` — the heaviest weight ever lifted on that exercise, plus the best rep count achieved specifically at that max weight. Reps at sub-max weight are not tracked as PRs.
- **Single source of truth:** `isSetPR(sessions, exerciseName, weight, reps)` is the canonical PR check. A set is a PR if weight > maxWeight, OR weight === maxWeight AND reps > maxRepsAtMaxWeight. Used by per-set trophies (`PlateSetRow`, `SetRow`), the card-level `hasPR` trophy, and the save-time `isNewPR` flag baked onto each set. `isPR()` is a back-compat alias.
- **Scoped to workoutType.** All PR comparisons (live UI and save-time flag) use `scopedSessions` — sessions filtered to the current workout type — so "Pull-ups" in Back Day and Full Body track independently.
- **All-time PR chip.** Each exercise card header shows a small amber chip (`PR {maxWeight}×{maxRepsAtMaxWeight}`) as soon as the exercise has any logged history, giving immediate context for what threshold a new PR has to beat.
- New PRs are flagged with 🏆 in the session logger, share card, and history. Since Batch 14, historical `isNewPR` flags on all persisted sessions are recomputed under the weight-anchored-per-side rule by the v1→v2 persist migration, so they match what the live UI shows.
- **Known gap:** `getExercisePRs` signature changed from `{ maxWeight, maxReps }` to `{ maxWeight, maxRepsAtMaxWeight }`. No other call sites remain (verified via grep), but watch for stale destructuring if resurrecting old branches.

### Achievements
- Badge system based on milestones: session counts (1/10/25/50/100), PR counts (1/10/25), streaks (3/7 days), grade quality (5 A-grade sessions).
- Computed by `getAchievements()` in helpers.js.

### Settings (via HamburgerMenu)
- **Your Name:** Displayed in greeting and share card.
- **Theme:** Obsidian (dark) or Daylight (light). Controlled via `data-theme` attribute on `<html>`.
- **Accent Color:** 10 options. Each provides a full set of Tailwind class strings (bg, text, border, ring, hex, contrastText).
- **Auto-start rest timer:** Toggle.
- **First set defaults to:** Warmup or Working.
- **Rest timer chime:** Toggle.
- **Info section — "How Streaks Work":** Explains streak mechanics: logging any workout, cardio, or rest day keeps the streak alive. Rest day allotment = number of `'rest'` entries in the rotation. Example shown in the UI.
- **Manage Data:** Export/Import full backup as JSON (includes `restDaySessions`).

### Theming
- Two background themes via CSS custom properties: Obsidian (dark, default) and Daylight (light).
- 10 accent colors defined in `theme.js`. Each color provides Tailwind classes and hex values used for inline styles.
- CSS variables in `index.css` define: `--bg-base`, `--bg-card`, `--bg-item`, `--text-primary`, `--text-secondary`, `--text-dim`, `--text-muted`, `--text-faint`, `--border-base`, `--border-subtle`.
- Tailwind utility classes map to these: `bg-base`, `bg-card`, `bg-item`, `text-c-primary`, `text-c-secondary`, `text-c-dim`, `text-c-muted`, `text-c-faint`.

---

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | Redirect | → `/welcome` (new users) or `/dashboard` (returning) |
| `/welcome` | Welcome | Onboarding wizard |
| `/dashboard` | Dashboard | Main screen |
| `/log` | Log | Workout picker |
| `/log/bb/:type` | BbLogger | Session logger (type = workout ID) |
| `/cardio` | CardioLogger | Cardio session logger |
| `/history` | History | Calendar heatmap + session list |
| `/progress` | Progress | Volume bar chart |
| `/guide` | Guide | Training tips |
| `/templates/new` | TemplateEditor | Legacy template creation |
| `/templates/:id` | TemplateEditor | Legacy template editing |
| `/split` | SplitEditor | Legacy built-in split reorder |
| `/splits` | SplitManager | Split list & management |
| `/splits/new` | SplitBuilder | New split wizard |
| `/splits/edit/:id` | SplitBuilder | Edit existing split |
| `/backfill` | Backfill | One-time muscle-group + equipment tagging for user-created exercises |
| `/exercises` | ExerciseLibraryManager | Full library management — filter, search, edit any entry |

---

## Data Persistence

- **Zustand persist middleware** with localStorage key `workout-tracker-v1`, current persist `version: 4`.
- Custom `merge` function in the persist config handles schema evolution: new fields get defaults, existing user settings are preserved via deep merge, existing users auto-skip onboarding.
- `migrate` hook handles versioned schema changes.
  - V1→V2 (Batch 14): backfills `rawWeight` on every set and recomputes `isNewPR` via `migrateSessionsToV2()` in helpers.js.
  - V2→V3 (Batch 15): seeds `exerciseLibrary` from built-in data if empty, assigns stable `exerciseId` to every LoggedExercise, canonicalizes display names against the library (Title Case variants win), flags unresolved names as `needsTagging: true`, and recomputes `isNewPR` keyed by exerciseId. Runs via `migrateSessionsToV3({sessions, library})`.
  - V3→V4 (Batch 17a): additive — ensures `splitDraft` slot exists (defaults to `null`). Pre-v4 users simply don't have a draft, which is the correct initial state.
- **Active session** (`activeSession`) persists across page reloads and app backgrounding so in-progress workouts are never lost.
- **Rest timer** uses absolute timestamps (`restEndTimestamp`) rather than countdown values, so it stays accurate across backgrounding.

---

## Development Workflow (Claude Code Desktop)

**Git is fully writable from the sandbox.** Verified April 15, 2026. An earlier rule prohibited sandbox git operations, but that was a stale scar from a transient issue — git works cleanly. Claude runs git directly.

**Standard workflow for a non-trivial change:**
1. `git worktree add -b claude/<descriptive-name> .claude/worktrees/<name>` — isolated branch + checkout
2. Edit files in the worktree
3. Validate: `cd .claude/worktrees/<name> && npx vite build --outDir /tmp/test-build`
4. For logic-heavy changes, run a data sanity check (e.g. `streak-debug.mjs` against `debug-backup.json`)
5. Start preview: `preview_start` with config from `.claude/launch.json`
6. Verify no runtime errors on affected pages
7. Commit in the worktree (heredoc commit message, Co-Authored-By Claude line)
8. For risky changes: push the branch, check the Vercel preview URL, then merge to main
9. For safe changes: merge to main directly
10. `git checkout main && git merge --ff-only claude/<name> && git push origin main`
11. Delete the worktree: `git worktree remove .claude/worktrees/<name>`

**Small fixes (typo, one-line patch):** straight to main is fine — no worktree.

**PowerShell note:** If the user needs to run a git command for any reason, use PowerShell syntax (`Remove-Item`, backslashes, etc.) since they're on Windows.

**Vercel project:** Team `team_Ol4ZacaHh0oiEz562VTQLwRg` (slug: `bbblueprint`), Project ID `prj_PFuFC2BuTn6LFhR03fODL5Poc0eo` (name: `bambam`). Auto-deploys preview URLs for non-main branches, production for `main`.

**Build validation:** `npx vite build` will fail with EPERM when writing to the mounted `dist/` folder. Always use `--outDir /tmp/test-build`.

---

## Known Architectural Notes

- The app uses `HashRouter` (not `BrowserRouter`) for Vercel SPA deployment compatibility.
- Max width is constrained to `max-w-lg` (32rem / 512px) and centered — mobile-first design.
- Bottom nav hides during logging sessions. Hamburger menu also hides during logging.
- The `SplitEditor` page is a legacy component for reordering the built-in split only. The `SplitBuilder` is the full-featured split creation/editing tool.
- `customTemplates` is a legacy feature predating the splits system. Templates use `tpl_` prefixed IDs.
- The exercise library (`exerciseLibrary.js`) has 140+ exercises organized by muscle group and is used by the SplitBuilder's exercise picker. The session logger's "Add Exercise" panel has its own smaller hardcoded suggestion list of 15 common exercises.

---

## Recent Changes (April 1, 2026)

### Batch 1
1. **Dashboard spacing:** Increased top padding on greeting from 32px to 56px + safe area offset.
2. **Stat cards compact:** Reduced padding, font sizes, divider heights for tighter layout while keeping full width.
3. **Custom exercise persistence:** Logger now merges exercises from last session of the same type that aren't in the template, placed in an "Added" group. Ensures custom exercises always reappear.
4. **Reorder button removed:** Stripped the "Reorder" button and reorder mode from session logger exercise groups.
5. **History name resolution:** Added `resolveWorkoutName()` / `resolveWorkoutEmoji()` that look up names from all splits in the store, fixing garbled IDs for user-created split workouts.

### Batch 2
6. **Editable grade in History:** Grade badge in session detail is now tappable — shows inline picker to set/change grade post-save. Also shows cardio ✓ badge when cardio is attached (even if not inline).
7. **Share card cardio fix:** `buildShareData` in History now accepts and uses `attachedCardio` to populate cardio details when viewing from History.
8. **Unilateral (Uni) toggle:** Purple "Uni" button next to Plates on each exercise. Doubles volume at save time. Stored as `unilateral: true` on the exercise, `rawWeight` preserved.
9. **Plates 1× / 2× multiplier:** Global toggle per exercise in plate picker area. Replaces auto-doubling. All set weights recalculate when toggled. Default: 2× (both sides).
10. **Plate data in session history:** Set data now includes `plates` and `barWeight` fields. Ghost rows display plate breakdown format when available.
11. **Post-session comparison screen:** Auto-shown after saving if previous session exists. Per-exercise volume % diff with green ↑ / red ↓ arrows. Overall volume change at top. "Continue" button proceeds to share card.

### Batch 3 (April 2, 2026) — UX simplification based on user feedback
12. **Removed pre-populated weights/reps:** Set inputs now start blank with generic placeholders ("lbs" / "reps"). No more previous-session weight/rep hints in placeholders, no plate mode weight pre-fill from last session, no drop set 75% auto-suggestions. "Last Time" ghost rows remain fully intact for on-demand reference.
13. **Keyboard-driven set input flow:** Weight input uses `enterKeyHint="next"` (iOS keyboard shows "Next"), reps input uses `enterKeyHint="done"`. Pressing Next jumps from weight → reps. Pressing Done auto-adds a new set row and focuses its weight field. Enables a seamless number → next → number → done → repeat loop.
14. **Contextual green ✓ button on set rows:** The × (delete) button morphs into a green ✓ when both weight and reps are filled (or reps + plates in plate mode). Tapping ✓ advances to the next set, same as the keyboard Done action. Empty/incomplete rows keep the × for deletion.

### Batch 4 (April 3–5, 2026) — Custom numpad and focus mode

15. **Custom numpad (CustomNumpad.jsx):** Replaces the iOS system keyboard for all weight/reps inputs. Uses `inputMode="none"` to suppress system keyboard, `onPointerDown` with `preventDefault` on keys to keep inputs focused. Phone layout (1-2-3 on top). NumpadContext provided at BbLogger page level for SetRow/PlateSetRow to register focus.
16. **Numpad action row:** Shows field label (WEIGHT/REPS), Next → (secondary outlined), Done ✓ (accent primary). Next on weight → focuses reps. Next on reps → submits set and adds new row. Done → marks exercise as completed (calls `markDone`) and closes numpad.
17. **Hide button:** "Hide ↓" button in the bottom-left key grid cell (reps fields, where decimal isn't needed). On weight fields, a full-width Hide bar below the grid. Styled with same outline as Next. Just closes the numpad without marking done.
18. **Focus mode:** When numpad is open, all non-active exercises, section labels, Add Exercise button, Session Notes, and the sticky footer are hidden. Only the exercise owning the active input field remains visible. Determined by `activeFieldKey.includes(exercise.name)`.
19. **Focus mode exit:** "Tap to show all exercises" zone appears below the active exercise when numpad is open. Tapping it blurs input and closes numpad, restoring the full exercise list.
20. **Anti-jostling:** `focus({ preventScroll: true })` when auto-focusing newly added set rows prevents browser viewport jumping.
21. **Compact numpad:** Keys 44px tall (down from 56px), gap 6px (down from 8px), reclaiming ~60px vertical space.
22. **Stable ref callbacks:** All numpad config callbacks (`onChange`, `onNext`, `onDone`) use ref-backed patterns to avoid stale closures when set state changes while an input is focused.
23. **Next button stale-state fix:** The numpad now passes `currentValueRef.current` (the live numpad buffer) as an argument to `onNext(value)`. This fixes the critical bug where pressing Next on the reps field did nothing because `setRef.current.reps` was stale (React hadn't re-rendered yet after the last `onChange`). The `handleNextSet` callbacks in both SetRow and PlateSetRow now use this passed value instead of reading from the stale ref.

### Batch 5 (April 5, 2026) — Session timer UX overhaul

24. **"Start Session" overlay:** When entering BbLogger, a full-screen overlay appears with the workout emoji, name, and a "Start Session" button. Timer stays at 0:00 until tapped. Includes "Go back" link. Overlay does not appear when resuming a saved session (already started).
25. **Timer repositioned & bolder:** The elapsed timer badge in the clipboard header is now `text-base font-extrabold` (up from `text-sm font-bold`) with tighter tracking. Positioned in the top-right of the header bar alongside a new pause/play button.
26. **Pause/resume button:** A play/pause toggle button appears next to the timer once the session has started. Pausing switches the timer badge to a `bg-white/30` style to visually indicate paused state.
27. **Pause persists across navigation:** Tapping the back arrow auto-pauses the session. All timer state (`sessionStarted`, `startTimestamp`, `isPaused`, `totalPausedMs`, `pauseStartedAt`) is persisted in `activeSession` via Zustand, so navigating away and returning preserves exact timer state. Timer stays paused until manually resumed.
28. **Accurate elapsed time with pause tracking:** Elapsed seconds now calculated as `(now - startTimestamp - totalPausedMs) / 1000`, properly subtracting all accumulated pause durations. Duration saved to the session remains accurate.
29. **Dashboard "Resume Workout" CTA:** When an active session exists (started but not finished), the Dashboard CTA card changes to show the in-progress workout name/emoji, a pulsing "In Progress" or "Paused" indicator, a count of exercises logged so far, and a "Resume Workout →" button that navigates back to the logger. This replaces the normal "Start Session" CTA so users always know their progress is preserved.

### Batch 6 (April 6, 2026) — Share Card redesign

30. **Share Card full rewrite (`ShareCard.jsx`):** Replaced old scrollable card with a fixed-viewport trading card design (max 380px, no scrolling). Uses all-inline styles (no Tailwind) matching the approved mockup.
31. **5-tier rarity system:** Tier determined by `getWorkoutStreak()` at render time — Common (0–5, user accent color), Rare (6–14, silver), Epic (15–19, gold), Legendary (20–49, animated shimmer orange/gold gradient border), Mythic (50+, animated shimmer purple/cyan border + 12 sparkle particles). CSS keyframes injected via `<style>` tag.
32. **JPEG export + Web Share API:** "Share ↗" button captures the card via `html2canvas` (scale:2, retina quality), exports as JPEG via `navigator.share({ files })` on iOS; falls back to download on unsupported browsers. Share/Done buttons are outside `cardRef` so they don't appear in the exported image.
33. **New stat bar:** VOL / SETS / STREAK 🔥 / GRADE — replacing old PRs slot with streak. Per-exercise PR badges still shown in exercise list.
34. **`streak` added to share data:** Both `BbLogger.jsx` (uses `getWorkoutStreak(sessions, activeSplit?.rotation)`) and `History.jsx` (`buildShareData` now accepts `sessions` + `activeSplitId`) pass streak into the data object.
35. **Cleanup:** Deleted `ShareCardMockup1.jsx`, `ShareCardMockup2.jsx`, `ShareCardTiers.jsx` and removed their routes from `App.jsx`.
36. **New dependency:** `html2canvas` added to `package.json`.

### Batch 7 (April 6, 2026) — Rest day calendar + streak bug fix

37. **Fixed `getFullRotationItem` timezone bug (`Dashboard.jsx`):** The old implementation computed `daysSinceAnchor` as `Math.round((today - new Date('YYYY-MM-DD')) / 86400000)` — `today` included current local time while the anchor date was UTC midnight, so after ~12pm the round went to 1 instead of 0, shifting the entire rotation index forward by one slot. Replaced with a delegate to `getRotationItemOnDate(toDateStr(d), sessions, rotation)` which uses UTC-midnight strings on both sides and is always timezone-safe.
38. **Rest days now show in the weekly and monthly calendars for past dates (`Dashboard.jsx`):** `getDayInfo` previously only checked the rotation for future days (`ahead > 0`). Past days with no session fell through to `{ type: 'empty' }`. Now past rest days are detected via `getRotationItemOnDate` and returned as `{ type: 'past-rest' }`, rendering a dimmed "R" in both the weekly strip and monthly grid (matching the existing future-rest "R" display).
39. **Monthly view `isFutureRest` fixed:** The monthly calendar was rendering `isFutureRest` via a condition that required `info.emoji` (which rest days don't have), so rest days were invisible. Now explicitly renders an "R" badge for `isFutureRest` and `isPastRest`.

### Batch 8 (April 6, 2026) — Beta UX polish

40. **Force portrait orientation:** `main.jsx` calls `screen.orientation.lock('portrait')` on load (works for installed PWAs). CSS fallback in `index.css` covers non-PWA browsers with a black overlay via `@media (orientation: landscape) { body::before }`.
41. **Completed exercises sorted by completion time (`BbLogger.jsx`):** `completedExes` is now sorted ascending by `completedAt` timestamp before being added to `renderGroups`, so exercises appear in the order they were marked done.
42. **Compact sticky header (`BbLogger.jsx`):** Removed the ClipGraphic decorative SVG from the header. Reduced the back/timer row from `pb-2` to `pb-1.5`, shrunk control buttons (w-9→w-8, w-8→w-7), reduced timer badge padding (`px-3 py-1.5`→`px-2.5 py-1`) and font size (`text-base`→`text-sm`), reduced workout title from `text-2xl pb-4` to `text-lg pb-2`. Net ~35% less vertical header height.
43. **Auto-collapse completed exercises in focus mode (`BbLogger.jsx`):** Removed the `&& !exercise.done` guard from the `focusCollapsed` condition. Completed exercises now collapse along with pending ones when the numpad is open and another exercise owns the active field.
44. **Fix numpad hide scroll jump (`CustomNumpad.jsx`):** `handleHide` now captures `window.scrollY` before blurring the active input, then calls `window.scrollTo({ top: y, behavior: 'instant' })` to restore the position immediately, preventing the page from scrolling up when the numpad slides away.

### Batch 9 (April 12, 2026) — Streak overhaul + rest day logging

45. **Streak forward-check fix (`helpers.js`):** `getWorkoutStreak()` now counts backwards from *yesterday* (not today), so the streak doesn't drop to 0 before the user logs today's activity.
46. **Cardio counts toward streak (`helpers.js`):** `getWorkoutStreak()` accepts a `cardioSessions` param. Cardio session dates are merged into the activity day set, so standalone cardio keeps the streak alive. All call sites (Dashboard, History, BbLogger, Progress, ShareCard) updated to pass `cardioSessions`.
47. **Rest day logging (`useStore.js`, `Dashboard.jsx`):** New `restDaySessions` array in the store with `addRestDaySession` / `deleteRestDaySession` actions. "Log Rest Day" button added to Dashboard (next to Log Cardio). Included in full JSON export/import.
48. **Rest days count toward streak (`helpers.js`):** `getWorkoutStreak()` also accepts `restDaySessions`. Logging a rest day on any given calendar day keeps the streak alive. All call sites pass `restDaySessions`.
49. **Flexible rest day allotment (`helpers.js`):** Rest days are no longer position-based. The streak algorithm uses a pool equal to the count of `'rest'` entries in the rotation. Any empty day within a rotation cycle consumes one from the pool instead of breaking the streak.
50. **Streak always visible (`Dashboard.jsx`):** `StreakBadge` renders unconditionally. At 0 it shows "0🔥" instead of being hidden.
51. **"MISSED YESTERDAY" fix (`Dashboard.jsx`):** `yesterdayLogged` now checks all three arrays (sessions, cardioSessions, restDaySessions) so cardio-only or rest-day-only days suppress the soreness prompt correctly.
52. **Removed "X/7 days" display (`Dashboard.jsx`):** The `weekCompletedCount/7` text was removed from the active split label. Now just shows the split name and emoji.
53. **Calendar strip Sun–Sat (`Dashboard.jsx`):** Weekly strip changed from Mon–Sun to Sun–Sat to align with weekly volume stats.
54. **Hero card spacing (`Dashboard.jsx`):** Increased gap between Preview and Start Session buttons; reduced bottom padding on the CTA card.
55. **Unilateral ghost row fix (`BbLogger.jsx`):** `PrevSetRow` now displays `rawWeight` instead of the doubled `weight` for unilateral exercises, so "Last Time" shows the actual per-side input the user entered.
56. **Uni toggle pre-selected (`BbLogger.jsx`):** The Uni toggle initializes to `true` if the last session had `unilateral: true` for that exercise.
57. **Plates toggle pre-selected (`BbLogger.jsx`):** `plateLoaded` state is initialized from last session's set data — if the last session had plate data, the plate picker opens pre-loaded.
58. **getDayInfo handles logged rest days (`Dashboard.jsx`):** Calendar day pills distinguish explicitly logged rest days (brighter dot / different style) from rotation rest days.
59. **`getAchievements` updated (`helpers.js`):** Now passes `cardioSessions` (and `restDaySessions`) to `getWorkoutStreak` for accurate streak-based badge evaluation.
60. **"How Streaks Work" info section (`HamburgerMenu.jsx`):** Added an expandable explainer in the Info menu covering streak rules, what counts as activity, and rest day allotment logic.
61. **Drag-and-drop exercises between sections (`SplitBuilder.jsx`):** Long-press drag to reorder and move exercises between workout sections within the SplitBuilder. *(Note: implemented in worktree `claude/brave-chandrasekhar`, not yet merged to main.)*
62. **Persistent added exercises (`BbLogger.jsx`):** Logger now scans ALL past sessions of a workout type (not just the most recent) to build the exercise list. Any exercise ever added to a workout is permanently remembered. Uses `lastExDataByName` map keyed by exercise name from newest-first session scan.
63. **Last Time always most recent (`BbLogger.jsx`):** Ghost row (`PrevSetRow`) data pulls from the most recent session that actually included that specific exercise, not just the immediately preceding session. Fixes stale/missing Last Time data when exercises are skipped.
64. **Plates/Uni init from all sessions (`BbLogger.jsx`):** Template exercise plates/uni pre-selection also uses `lastExDataByName` instead of only last session, ensuring correct toggle state even when exercises were skipped recently.

### Batch 10 (April 15, 2026) — PR refactor + all-time PR chip

65. **PR model rewritten to weight-anchored (`helpers.js`):** `getExercisePRs` now returns `{ maxWeight, maxRepsAtMaxWeight }` instead of the old `{ maxWeight, maxReps }`. Only the heaviest weight ever lifted is tracked, along with the best rep count achieved specifically at that top weight. Reps at lighter weights no longer qualify as PRs.
66. **`isSetPR()` single source of truth (`helpers.js`):** New canonical helper. A set is a PR iff `weight > maxWeight` (new heaviest) or `weight === maxWeight && reps > maxRepsAtMaxWeight` (more reps at top weight). Zero-weight and zero-rep sets never qualify. First-ever logged set for an exercise counts as a PR.
67. **`isPR()` kept as back-compat alias (`helpers.js`):** Delegates to `isSetPR`. The old `isPR` semantics (reps-PR only if weight >= maxWeight) is gone; the new stricter rule applies everywhere.
68. **All inline PR checks consolidated (`BbLogger.jsx`):** `PlateSetRow` per-set trophy, `SetRow` per-set trophy, card-level `hasPR` trophy, and save-time `isNewPR` flag all now call `isSetPR(scopedSessions, ...)`. Eliminates the four-way drift that previously produced inconsistent trophies.
69. **Save-time PR scoping fix (`BbLogger.jsx`):** `isNewPR` baked onto each saved set now uses `scopedSessions` (filtered to the current workout type) instead of all sessions. Aligns the saved flag with what the UI shows during logging and makes an exercise reused across splits (e.g., Pull-ups in Back Day vs. Full Body) track independently end-to-end.
70. **All-time PR chip on every exercise card (`BbLogger.jsx`):** Small amber chip `PR {maxWeight}×{maxRepsAtMaxWeight}` renders next to the exercise name in the card header whenever any history exists. Visible in both collapsed and expanded states. Makes the PR threshold explicit so users know what they're chasing — ghost "Last Time" rows were misleading users into thinking they had a PR when their actual all-time max was higher.
71. **Historical flags unchanged:** Sessions saved before this batch retain their original `isNewPR` flags (computed under the old looser rule). Only newly saved sessions reflect the weight-anchored model. A one-time migration pass over historical sessions is available if desired but not yet run. *(Batch 14 ran it.)*

### Batch 11 (April 15, 2026) — Streak unification + sandbox git rule removed

72. **Unified streak definition (`helpers.js`):** `getWorkoutStreak` and new `getBestStreak` now share a single `buildActiveDaySet()` helper and a single "active day" definition: a calendar day with a weight session, a cardio session, or an explicitly-logged rest day. Rotation rest slots NO LONGER bridge empty days. This kills the prior bug where current-streak (rotation-aware) could be larger than best-streak (rotation-unaware) — classic symptom: Dashboard shows 14, Progress shows "Best: 8".
73. **`getWorkoutStreak` signature change:** dropped `rotation` param. Now `(sessions, cardioSessions, restDaySessions)`. All 4 call sites updated (Dashboard, History, BbLogger, Progress).
74. **`getAchievements` signature change:** dropped `rotation` param. Now `(sessions, cardioSessions, restDaySessions)`.
75. **New `getBestStreak` (`helpers.js`):** scans the full activity set and returns the longest consecutive-active-day run. Replaces the inline calc that previously lived in `Progress.jsx`'s `ConsistencyHeatmap`, which used BB-sessions-only (no cardio, no rest-day logs).
76. **`ConsistencyHeatmap` now takes `bestStreak` as a prop** from the parent `Progress` component, which computes it via `useMemo`. Inline calc removed.
77. **Sandbox-git prohibition removed (`CLAUDE.md`):** Verified that git is fully writable from the sandbox. Updated workflow docs to have Claude run git directly (worktree → edit → build → preview → commit → merge → push), and dropped the prior "give user PowerShell commands" dance. User still owns the final merge gate for anything risky via Vercel preview URLs. No `--force` pushes, no hook skipping.

### Batch 12 (April 16, 2026) — Critical hotfix: Finish Session modal buttons dead

78. **`scopedSessions` scope bug (`BbLogger.jsx`):** Batch 10's PR refactor introduced `isSetPR(scopedSessions, ex.name, w, r)` inside `buildExerciseData()` at line 1634, but `scopedSessions` was only defined inside the `ExerciseItem` sub-component (line 466) — not in the parent `BbLogger` scope. Every Finish-modal button (Attach / Keep Separate / Log Another / Save / Log Now) threw `ReferenceError: scopedSessions is not defined` when clicked, silently aborting the save. Users saw buttons that "don't respond." Fixed by defining `scopedSessions` at the BbLogger scope alongside `lastSession` (line 1576), mirroring the ExerciseItem filter. Verified by reproducing the error live (clicking Save returned `save-err: scopedSessions is not defined`), applying the fix, and re-running both Scenario A (cardio today → Attach) and Scenario B (no cardio → Save): both now persist correctly with `isNewPR` flag set.

### Batch 13 (April 16, 2026) — Per-exercise REC (coach's prescription) pill + PR chip relocation

79. **REC field on split exercises (`BbLogger.jsx`, data model):** Split workout exercises can now be either a bare string (legacy) OR an object `{ name, rec }` where `rec` is a free-text prescription string like `"3x20 (warmup)"` or `"4x10-10-10 drop"`. Length-capped at 20 chars to keep the title row from overflowing. Loaded via the existing `typeof e === 'string' ? e : e.name` unwrap pattern that already existed in the save-time auto-persist code.
80. **Blue REC pill on every exercise card header (`BbLogger.jsx`):** When an exercise is expanded, a small pill appears next to the title: 📋 with the rec text if set (filled blue pill, `bg-blue-500/15 border-blue-500/40 text-blue-300`), or dashed-outline `📋 REC` placeholder when empty (`bg-item text-c-muted border-dashed`). Hidden when the card is collapsed. Tapping the pill swaps it for a 20-char-capped input field; Enter/blur commits, Esc cancels. `stopPropagation` on the pill/input prevents the card collapse toggle from firing.
81. **Header wrapper changed from `<button>` to `<div role="button">` (`BbLogger.jsx`):** The collapse-toggle header is now a div so nested interactive elements (the REC pill button + its inline `<input>`) are valid HTML. `cursor-pointer select-none` + `role="button"` + `tabIndex={0}` preserve click-to-expand semantics.
82. **PR chip moved + hidden when collapsed (`BbLogger.jsx`):** The amber `PR {maxWeight}×{maxRepsAtMaxWeight}` chip no longer sits in the title row. It's now grouped with `Last Time` in the toolbar row (`[Plates] [Uni] …[Last Time] [PR chip]`, right-aligned via a `ml-auto` group wrapper) and only renders when the card is expanded. Distinct blue (REC) vs. amber (PR) keeps the two concepts visually separate.
83. **Rec auto-persists to split on session save (`BbLogger.jsx`):** The existing auto-persist block (which added new exercises to the split template) now also detects `rec` changes on existing template exercises. If any `rec` differs from what's in the split — or if new exercises exist with a `rec` — the block rebuilds the `sections` array, promoting exercises to `{name, rec}` when rec is set and keeping them as strings when it isn't. Result: once the user fills in a REC in the logger and saves, it pre-populates next time they open that workout.
84. **REC loads from split on template init (`BbLogger.jsx`):** `templateExercises` now unwraps `{name, rec}` from the split's section.exercises entries and seeds `exercise.rec` on the logger's exercise state. Also survives active-session reload since `exercise.rec` persists through the existing `saveActiveSession` flow.
85. **SplitBuilder rec data-loss fix + inline rec entry (`SplitBuilder.jsx`):** Both places where `SplitBuilder` loaded existing split exercises (outer `useState` at line ~964 and `WorkoutBuilder` sub-component at line ~230) previously called `typeof ex === 'string' ? ex : (ex?.name || '')` — actively flattening `{name, rec}` objects back to strings. After Batch 13 landed, this silently wiped any rec set via the logger whenever the user edited the split. Fixed by preserving objects as-is (stripping only malformed entries). Also added a `RecInline` component that renders next to each exercise name in the workout builder so coaches can prescribe recs up front; same pill style as the logger, same 20-char cap, same stop-propagation behavior so editing doesn't interfere with drag-to-reorder.
86. **Label + style tweaks (`BbLogger.jsx`, `SplitBuilder.jsx`):** "REC" → "Rec" (title case). Empty-state pill dropped the dashed white outline and softened to `bg-item text-c-faint` (no border) to de-emphasize when no recommendation is set. Filled pill remains blue; collapsed state still hides the pill entirely.

### Batch 14 (April 17, 2026) — Canonical weight field + v2 migration (AI coaching prereq, step 1)

Step 1 of the AI Coaching Recommender v1 plan (see `coaching-recommender-spec-v3.pdf` §3.1 and `.claude/plans/c-users-user-claude-code-workout-tracke-misty-hearth.md`). Fixes three live production bugs that silently corrupted the data the recommender depends on.

87. **`perSideLoad(set)` helper (`helpers.js`):** New canonical accessor — `set.rawWeight ?? set.weight ?? 0`. Use this wherever a set's load is read for comparison or display. For non-unilateral sets `rawWeight` is undefined and `weight` IS the per-side load, so the fallback is correct. For unilateral sets, `rawWeight` holds the per-side input; `weight` holds the doubled volume value.
88. **Phantom PR fix (`helpers.js:93`):** `getExercisePRs` reads `perSideLoad(set)` instead of `set.weight`. Previously post-2026-04-02 unilateral sets trivially beat pre-cutover records because the doubled `weight` field was compared against historical per-side values. Live PR trophies, all-time PR chips, and save-time `isNewPR` all now track per-side strength progression.
89. **"Last:" display fix (`BbLogger.jsx:654-655`):** Collapsed-card inline "Last: 180×9" hint reads `perSideLoad(lastTopSet)` instead of `lastTopSet.weight`. Aligns with `PrevSetRow` (ghost rows) which was already correct. Same fix applied to both the plate-mode total (`= ${perSideLoad(lastTopSet)}`) and the non-plate-mode display.
90. **Save-time PR check fix (`BbLogger.jsx:1695`):** `buildExerciseData()` now passes `rawW` (per-side) to `isSetPR`, not `w` (doubled). Aligns saved flags with the weight-anchored-per-side rule so newly saved unilateral sets don't trivially beat their own scoped history.
91. **V1→V2 persist migration (`useStore.js:317`, `helpers.js`):** Persist version bumped `1 → 2`. New `migrate` hook runs `migrateSessionsToV2(persistedState.sessions)` — backfills `rawWeight` on every set (defaults to `weight`) and recomputes every `isNewPR` chronologically per exercise name using `perSideLoad`. O(sets), idempotent. Validated against `debug-backup.json` (24 sessions, 425 sets preserved, 188 rawWeight backfills, phantom PRs 232 → 135, unilateral PRs 48 → 18). Updates the Batch 10 "known gap" — historical flags now match the live UI rule.
92. **Minor: `.js` extension on internal import (`helpers.js:1`):** `'../data/exercises'` → `'../data/exercises.js'`. Vite supports both; bare Node 24 requires the explicit extension. Enables `node migration-sanity.mjs` without a bundler step.
93. **`migration-sanity.mjs` checked in (repo root):** Node ESM script — loads `debug-backup.json`, runs `migrateSessionsToV2`, reports before/after PR counts, rawWeight coverage, per-exercise max weight spot-checks, and name-collision candidates (preview of step 2's dedup work). Mirrors the `streak-debug.mjs` pattern already in the repo.

### Batch 15 (April 17, 2026) — Exercise IDs + canonical library + backfill UI + picker dedup (AI coaching prereq, step 2)

Step 2 of the AI Coaching Recommender plan. Eliminates name-based identity for exercises and replaces it with a stable, deduplicated library that every session references by `exerciseId`. Unblocks the recommender (step 3) by giving it a reliable per-exercise history to fit against. Shipped in four substeps (15a–15d) — each reviewable on its own.

#### 15a — Library foundation

94. **`exerciseLibrary` slice seeded from built-in data** (`useStore.js`, `data/exerciseLibrary.js`). `buildBuiltInLibrary()` transforms the 90 raw `{name, muscleGroup, equipment}` entries in `data/exerciseLibrary.js` into the canonical Exercise entity with slug-derived IDs (`ex_{slug(name)}`), `primaryMuscles[]`, `progressionClass` (compound/isolation/bodyweight), and the other recommender-facing fields. `builtInExerciseIdForName(name)` is exported for the migration and dedup paths. `EQUIPMENT_TYPES` array exported from `exerciseLibrary.js` (Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, Other).
95. **`initLibrary()` store action** — idempotent seed called from `App.jsx` alongside `initSplits()` on mount. Fresh installs get the seeded library immediately; returning users with a populated library skip the seed. Paired with an adjusted merge hook so persisted empty libraries don't stick on upgrade.
96. **Library CRUD store actions.** `addExerciseToLibrary(exercise)` enforces the §3.2.1 required-field constraint at runtime (rejects empty `primaryMuscles`, missing `equipment`, empty `name`). `updateExerciseInLibrary(id, patch)`, `deleteExerciseFromLibrary(id)`, and `mergeExercises(keepId, mergeIds)` complete the surface. `mergeExercises` rewrites every session's `exerciseId` from any merge-id → keep-id before removing the merged entries, so history is never lost.

#### 15b — V2→V3 migration

97. **`migrateSessionsToV3({sessions, library})` helper** (`helpers.js`). Collects every distinct session-exercise name, pre-sorts by descending capital-letter count (so Title Case variants win the canonical slot), then resolves each against the library by normalized key (`normalizeExerciseName` — case-insensitive, whitespace-collapsed). Matches become aliases on the existing library entry; unresolved names become new library entries with `primaryMuscles: []`, `equipment: 'Other'`, `needsTagging: true`. Every LoggedExercise is rewritten with canonical `name` + stable `exerciseId`. `isNewPR` is then recomputed chronologically keyed by exerciseId so post-canonicalization duplicates share PR progression.
98. **Persist version bumped `2 → 3`** with the migrate hook wired up. V2→V3 seeds the library from built-in if the persisted slice is empty (supports the direct v1→v3 upgrade path) then runs `migrateSessionsToV3`. Idempotent — re-running is a no-op.
99. **Sanity-checked against `debug-backup.json`** (`migration-v3-sanity.mjs` checked in): 90 built-ins + 19 user-created = 109 library entries (all 19 flagged `needsTagging`), 136 LoggedExercises get exerciseId (100% coverage), "Seated cable row" correctly canonicalizes to "Seated Cable Row" with the lowercase form preserved as an alias. PR flags 135 → 134 (one phantom cleared by unified history).

#### 15c — Backfill UI

100. **`/backfill` route + `Backfill.jsx` page.** Lists every library entry with `needsTagging: true` as cards. Each card shows canonical name + most-recent logged set for context (`Last: 190 × 9 · 10 Apr 2026`) plus pill rows for primary muscles (multi-select, min 1) and equipment (single-select from `EQUIPMENT_TYPES`). Completion rule: entry drops off the list once `primaryMuscles.length > 0` AND `equipment` is set to a non-`'Other'` value. Success state at 0 remaining: "All exercises tagged!" + "Back to Dashboard" CTA.
101. **`tagExercise(id, patch)` store action** (`useStore.js`). Atomic merge-and-recompute — needsTagging is evaluated against the merged state inside a single `set(state => ...)`, not against a stale render snapshot. This was a real bug — back-to-back pill taps in Backfill.jsx were losing the completion check because each click's handler read `exerciseLibrary` from the prior render's closure and overwrote the other's update.
102. **Dashboard banner.** Small blue pill above the calendar, only rendered while `pendingCount > 0`, links to `/backfill`. Message mentions "smarter recommendations" to preview the v1 payoff. Non-intrusive — no auto-redirect from Dashboard mount, so the user can defer indefinitely. Disappears when tagging is complete.

#### 15d — Picker dedup + creation modal

103. **Fuzzy match helpers** (`helpers.js`). `similarExerciseScore(a, b)` returns 0.0–1.0 by maxing three signals: exact-after-normalization, token-sort equality (catches "DB Lateral Raises" vs "Lateral DB Raises"), and trigram Jaccard. `findSimilarExercises(query, library, {suggestThreshold, max})` scans each library entry's canonical name + aliases, returns the top-N above threshold sorted by score desc. Spec §3.3 thresholds: `0.85` for auto-dedup, `0.7` for the suggest-list. `normalizeExerciseName(name)` exposed for callers that want to compare without scoring.
104. **`CreateExerciseModal.jsx`** — shared bottom-sheet-on-mobile / centered-on-desktop form. Collects `name`, `primaryMuscles` (multi-select, ≥1), `equipment` (single-select), and `defaultUnilateral` toggle. Save button is disabled until required fields are set, so the §3.2.1 constraint is enforced at the UI layer in addition to the store action's runtime check.
105. **BbLogger `AddExercisePanel` rewired.** Suggestions come from the store library via fuzzy match when the user types; a 12-name starter list (pulled from built-ins) shows on empty query. Tapping "+ Add [typed]" auto-uses any library match scoring ≥0.85 (so "pec dec" silently resolves to `ex_pec_dec`); otherwise opens `CreateExerciseModal` pre-filled with the typed name. `addExercise(name, exerciseId)` accepts an optional id so picked-from-library exercises carry the link through to save.
106. **`buildExerciseData` saves canonical name + exerciseId** (`BbLogger.jsx`). On session save, resolves `exerciseId` — prefers the row's linked id from the picker selection, falls back to a library lookup by canonical/alias name. Canonicalizes `name` to the library's value too. Going forward every saved session has `{name: 'Canonical Name', exerciseId: 'ex_...'}` on every LoggedExercise.
107. **SplitBuilder `ExercisePicker` wired to the same dedup path.** "Add your own" now fuzzy-matches against the store library before creating; high-similarity matches reuse the existing entry, low-similarity opens `CreateExerciseModal`. The full picker list now reads from the store library when populated (so user-created entries show up alongside built-ins), falling back to the raw data import for fresh installs before `initLibrary()` fires.

### Batch 16a (April 18, 2026) — Recommendation engine (AI coaching prereq, step 3, substep a)

Step 3 of the AI Coaching Recommender plan (see `coaching-recommender-plan.md` Part 3). Pure algorithm code — no UI wiring yet. Sanity-validated via `recommender-sanity.mjs` against `debug-backup.json`.

108. **`e1RM(weight, reps)` + `percent1RM(targetReps)` (`helpers.js`).** Layer 1 (Epley: `w × (1 + r/30)`) and Layer 2 table lookup per spec §2.2. `percent1RM` linearly interpolates between the 7 anchors (3→93%, 5→86%, 6→83%, 8→78%, 10→73%, 12→69%, 15→63%) and clamps at the endpoints so off-table inputs still return a sane number.
109. **`getExerciseHistory(sessions, exerciseId, exerciseName?)` (`helpers.js`).** Walks `bb`-mode sessions, prefers `exerciseId` match (with name fallback for pre-v3 safety), returns the per-session TOP SET (highest e1RM across working+drop sets with w>0 and r>0). Chronological ascending so the caller can `slice(-2)` / `slice(-6)` without resorting. Warmups are excluded.
110. **`getCurrentE1RM(history)` (`helpers.js`).** Layer 1 input to the recommender — max of the last two sessions' top-set e1RMs. Filters out a single bad day per spec §2.1.
111. **`getProgressionRate(history)` (`helpers.js`).** §2.3 linear regression of e1RM on days over the last 6 sessions. Returns `{ rate, rSquared, n, slope, meanE1RM }` where `rate` is the fractional weekly gain (`slope × 7 / mean`). Caller gates usability with `n ≥ 4 && R² ≥ 0.4` and falls back to `0.01` (compound) or `0.005` (isolation) when the fit is weak.
112. **`getRecommendationConfidence(n, rSquared)` (`helpers.js`).** §2.4 labels: `high` (n≥6, R²≥0.9), `moderate` (n≥4, R²≥0.6), `building` (n≥3), `none` (<3 — caller shows "Last:" only, no prescription).
113. **`recommendNextLoad({history, targetReps, mode, progressionClass, loadIncrement, now})` (`helpers.js`).** Top-level. Returns `{ mode, confidence, prescription: {weight, reps} | null, reasoning, meta }`. Implements the full §2.2 decision rule:
    - **`mode: 'push'`** (default) — Layer 3 nudge with aggressiveness multiplier 1.15 on the progression rate, capped at 3%/wk. `nextWeight = lastWeight × (1 + P·α) + 0.033·lastWeight·Δreps` where α = daysSince/7 and Δreps = lastReps − targetReps. Clamped to Layer 2 floor.
    - Hit target last session → apply Layer 3 nudge.
    - Missed by 1 rep → hold weight, "go for the reps."
    - Missed by 2+ reps → hold weight, push for reps (unless triggers auto-deload).
    - Auto-deload: missed by 2+ reps for two consecutive sessions → override to `mode: 'deload'`, prescribe 10% off last weight.
    - **`mode: 'maintain'`** — Layer 2 only (e1RM × %1RM(targetReps)), no nudge.
    - **`mode: 'deload'`** — 65% of current e1RM for recovery (midpoint of §2.5's 60–70% range).
    - <3 sessions → confidence=`none`, prescription=`last` (or null at n=0); reasoning counts down until recommendations unlock.
    - Result weight rounded to `loadIncrement` (default 5).
114. **`recommender-sanity.mjs` (repo root).** Node ESM — loads `debug-backup.json`, runs v2+v3 migrations to canonicalize sessions, then reports per-exercise fits + recommendations against the spec §5 high-confidence-ready list. Also exercises mode comparison on Pec Dec (push/maintain/deload produce distinct prescriptions), cold-start behavior (n=0/1/2), and the auto-deload trigger on a simulated 2-miss streak. Mirrors `migration-sanity.mjs` / `migration-v3-sanity.mjs` pattern — run from a worktree root with `node recommender-sanity.mjs`.
115. **Nothing wired to UI yet.** Step 3b (next batch) adds the inline `Try: 185×10` hint + expand-on-tap bottom sheet per §9.1 to the exercise card. Step 3c adds RPE/RIR capture per §3.7. This substep is a clean revert point.

### Batch 16b (April 18, 2026) — Recommender UI in exercise card (AI coaching prereq, step 3, substep b)

Step 3 UI surface — exposes the Batch 16a engine to the user per spec §9.1 Option C (inline hint + expand-on-tap) and §9.4 Option C (color + one-word confidence label).

116. **`Recommendation.jsx` — three display components** (`src/pages/log/Recommendation.jsx`). `RecommendationHint` renders the inline `● Try: 185×10` snippet appended to the collapsed card's "Last: 175×11" line; colored dot encodes confidence (green=Solid, amber=Maybe, gray=New); hidden when confidence='none'. `RecommendationBanner` is the prominent tappable banner at the top of the expanded body — two-line format with "TRY 185 × 10" / "●Maybe · short reasoning". `RecommendationSheet` is the bottom-sheet modal (createPortal, z-index 250 so it clears CustomNumpad's 200 and RestTimer's 50) with headline prescription, confidence chip, three side-by-side mode buttons (↑Push / →Maintain / ↓Deload — each showing its own weight×reps), reasoning card, and stats rows (current e1RM, last session + days-ago, progression fit, Layer 2 target).
117. **ExerciseItem integration** (`BbLogger.jsx`). Subscribes to `exerciseLibrary`; looks up entry by id (fallback by name); derives targetReps from `defaultRepRange` midpoint (default 10). Computes `recHistory` via `getExerciseHistory(allSessions, id, name)` — passing ALL bb sessions intentionally, NOT scopedSessions. The recommender is cross-workout-type by design (spec §1.3, §3.2: Pec Dec in push and push2 should share history), which differs from PR logic (workout-type-scoped per Batch 10/12). `recommendation` computed once via useMemo in mode='push'.
118. **Collapsed-card restructure.** The existing "Last:" `<p>` had `opacity-50` which was washing out the confidence dot on the appended hint. Replaced the single-paragraph with a flex div holding two siblings — the "Last:" span with its original opacity and the `RecommendationHint` at full opacity so the colored dot is legible.
119. **Sheet default mode = 'push'.** So the sheet opens aligned with what the banner renders (the banner always shows recs.push's output, even if auto-deload triggered within push mode). The DELOAD chip in the sheet still surfaces the user-selected deload (65% of e1RM) as the alternative — distinct number and reasoning from the decision rule's auto-triggered 10% off last. Two distinct deload prescriptions by design, per the spec.
120. **Verified live in preview** (mobile 375×812, debug-backup.json migrated to v3 with 24 sessions, 109 library entries). Pec Dec: banner "TRY 185×10 · ● Maybe · Hit target last session — pushing +2.3%…", sheet chips push 185 / maintain 175 / deload 155 with correct reasoning per mode. Overhead DB Extension (auto-deload triggered): banner 80 (10% off last); DELOAD chip 75 (65% of e1RM). DB Shrug (n=0): no banner. Cross-workout-type hint ("● Try: 80×10" without "Last:") for exercises logged elsewhere but not in the current workout. No console errors. ✓

### Batch 16c (April 18, 2026) — RPE capture + Layer 3 rep-accuracy boost (AI coaching prereq, step 3, substep c)

Step 3 per-set effort signal — spec §3.7 calls RPE "the single largest accuracy improvement available to the recommender." Optional at every layer (type, UI, persistence, engine) so forced entry doesn't kill adherence.

121. **Set schema + `getExerciseHistory` carry `rpe: number | null`** (`helpers.js`). `e1RM` unchanged (still uses raw reps). `getExerciseHistory`'s per-session top-set now carries rpe through when set, validated 1–10 inclusive. Saved-set shape in `buildExerciseData` gets `...(typeof s.rpe === 'number' && 1–10 ? { rpe: s.rpe } : {})`.
122. **Layer 3 uses effective reps when rpe is present** (`recommendNextLoad`). `rir = max(0, 10 − rpe)`, `effectiveReps = reps + rir`. Hit-target check is now `last.reps >= targetReps || effectiveReps >= targetReps`; Δreps in the nudge formula uses `effectiveReps − targetReps`. Same effective-reps logic feeds the auto-deload trigger, so a user who misses raw reps but still hit target via RIR (e.g. 8 reps @ RPE 8 with target 10) is NOT false-alarmed into a deload. Reasoning string appends "(8×@RPE8≈10 effective)" when rir>0 so the math is visible.
123. **`RpePill.jsx` — per-set chip + picker** (`src/pages/log/RpePill.jsx`). 44×40px pill inserted into both SetRow and PlateSetRow after the reps input. Empty state: muted `bg-item text-c-faint` with small "RPE" text. Set state: fuchsia-bordered pill (`bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300`) with the number. Tapping opens a bottom-sheet `RpePicker` (createPortal, z:250) — two rows of 5 buttons with 6–10 prominent and 1–5 dimmed (matches the typical RPE range for strength training), plus an inline description per value ("8 → 2 reps in reserve — challenging" etc.), a 2-sentence explainer for new users ("RPE = reps in reserve. 10 is all-out failure; 8 means '2 more reps possible.'"), and a Clear button to unset.
124. **`PrevSetRow` (ghost rows) show RPE read-only.** If the prior top set had an rpe, shows it in a muted version of the pill. If not, renders a 44×36 invisible placeholder so column widths still align with the live row. No pill is shown for pre-16c sessions (they have no rpe field).
125. **Sanity (node, against debug-backup.json + synthetic rpe):** Pec Dec last 175×11, target 10 → no-RPE pushes 185, RPE 8 pushes 195 (Δreps=3 bonus), RPE 10 pushes 185 (rir=0, identical to no-RPE). Auto-deload bypass: 115×8×2 with RPE 8 (effective 10) does NOT auto-deload; pushes instead. All expected behaviors hit.
126. **Verified live in preview:** Pec Dec expanded → RPE pill tap → picker → select 8 → pill shows fuchsia "8". Toggle to Plates mode → RPE pill persists with same value. Clear button → pill returns to muted "RPE". Reload page mid-session → RPE value preserved via `activeSession` roundtrip. Ghost-row alignment correct. No console errors. ✓

Step 3 complete — the recommender is wired end-to-end: engine (16a) → inline+sheet UI (16b) → per-set RPE signal (16c). Step 4 (readiness check-in per §2.5) and step 6 (fatigue signals per §4) are next up in the plan.

### Batch 16d (April 18, 2026) — Revert RPE UI + back-off-sets future scope

First feedback round on the recommender. User observation: "most sets go to failure" → RPE captures zero signal for their logging pattern and adds visible clutter. Spec called RPE "largest accuracy improvement" but that assumed varied effort across sets.

127. **Reverted RPE UI** — deleted `src/pages/log/RpePill.jsx`. Removed the pill + picker from SetRow / PlateSetRow / PrevSetRow. Removed the `rpe` field from `buildExerciseData`'s saved set shape. Engine-side plumbing is **kept** (cheap and invisible): `getExerciseHistory` still carries `rpe` if present, `recommendNextLoad` still does RIR-aware Layer 3 math if set. Re-enabling later is a UI-only change.
128. **Back-off-sets future scope flagged** (`coaching-recommender-plan.md` Part 4). v1 prescribes the top working set only; a future expansion could prescribe back-off sets (e.g. `top: 185×10, back-off: 2× 175×10`). Trivial formula extension, interesting UI work. Revisit after readiness (step 4) ships.

### Batch 16e (April 18, 2026) — Plate clutter → nested popover + compact picker

User: "nest buttons within buttons" to conserve real estate. The bar selector, multiplier toggle, and 7-plate picker all living persistently on the card was too much.

129. **`PlateConfigPopover` (`BbLogger.jsx`)** — anchored-below-button popover rendered via `createPortal` (escapes the card's `overflow-hidden`). Fixed positioning computed from the anchor's `getBoundingClientRect` at open. Outside-click dismiss via `mousedown` + `touchstart` document listeners, with a 0ms `setTimeout` so the opening click doesn't immediately close it. z-index 220 — below RecommendationSheet (250) and above page content. Contains: Bar (45 / None / 25), Multiplier (1× / 2×), and "Turn off plate mode" button (the only way to disable plate mode — tapping Plates when already on re-opens the popover instead of toggling off, to prevent accidental data loss).
130. **Plates button summary inline.** When plate mode is active the Plates toggle shows a compact `45·2×` config summary so users see current state without opening the popover.
131. **`PlatePicker` (extracted sub-component in `BbLogger.jsx`)** — plate row now renders 5 common plates always (45/35/25/10/5), rare plates (100, 2.5) only when loaded OR user tapped the expand icon. Expand icon is a single-character `+` (collapsed) / `×` (expanded) — no text label per user feedback. Hidden entirely when all rare plates are already loaded. Loaded-rare plates stay visible even after collapse so users can still decrement them.

### Batch 16f (April 18, 2026) — Coach's Call sheet redesign (sparkline + plain English)

Second feedback round: the math in the sheet was "esoteric," "Maybe confidence" was meaningless out of context, three modes was one too many. Largely a rewrite of `Recommendation.jsx`.

132. **Inline SVG sparkline** — new `E1RMSparkline` component inside `Recommendation.jsx`. Plots the last 6 e1RM data points as circles + connecting line with a subtle dashed linear trend line underneath, `+10.5%/wk` rate label in the top-right. Auto-scales to window's min/max with 15% padding. Uses the exercise's accent color (`theme.hex` threaded from `ExerciseItem` → sheet → sparkline). The "killer feature" per user feedback — makes progression visceral in one glance instead of demanding the user parse R² and weekly %.
133. **Two modes, not three.** Maintain (left, easier) | Push (right, harder). Deload is gone as a user-selectable mode — it's still an algorithmic override when `autoDeload` triggers (reflected in `recs.push`'s output and its reasoning string). Default-selected chip is always 'push' so sheet stays aligned with the banner.
134. **Confidence as a percentage with tap-to-explain.** Replaced the opaque "Maybe confidence" amber label with `N% confident` — percent computed from `min(1, n/6) × R² × 100`, clamped 1–99. Green ≥80%, amber ≥50%, blue below. Tap the row to expand an explainer: "Based on N prior sessions — your e1RM has been tracking [very closely / closely / roughly / loosely] against the trend line" plus agency language ("Log M more consistent sessions and confidence will climb" when n<6, or a noise callout when n≥6 but R²<0.9). Hidden entirely when n<3.
135. **Plain-English reasoning** in the WHY panel. All strings in `recommendNextLoad` rewritten:
    - Hit target → "You hit W×R last session. Adding a little more weight based on how fast you've been progressing."
    - Missed by 1 → "You got R reps at W last time (target was T). Same weight — go for all T this session."
    - Missed by 2+ → "... Holding the weight — push for the reps before adding load."
    - Auto-deload → "You've missed the rep target two sessions in a row. Backing off 10% today to reset before pushing again."
    - Maintain → "Matching your e1RM at T reps — a solid maintenance day."
    - Deload → "Recovery day — 65% of your e1RM for an easier session."
    - Cold start → "Log M more sessions and I'll start prescribing weights."
136. **Details ▾ accordion** for the math: Estimated 1-rep max, Last session, Trend fit (n/R²/rate), This session's nudge (push mode only), Layer-2 Floor @ targetReps. Each row with an ⓘ is tappable to reveal a one-sentence explainer (what e1RM is, what R² means, why the floor exists, what the +3% cap is). New meta field `thisSessionNudgePct` on the recommender output (cap-adjusted, α-scaled) surfaces only in Details.
137. **"Top set" labeling** on both banner and sheet headline. Explicitly frames the scope so users know the prescription is for the top working set, not every set — primes the UI for the future back-off-sets expansion flagged in 16d.

Step 3 follow-up round complete — the recommender UI now matches user's design feedback. Next up per plan: step 4 readiness check-in (§2.5) and step 6 fatigue signals (§4).

### Batch 16g (April 18, 2026) — Sheet polish round 2

Round-2 feedback on the redesigned Coach's Call sheet. Largely cosmetic.

138. **ModeChip sub-component** (`Recommendation.jsx`). Maintain chip now has a blue flat-line SVG icon + blue accent; Push has an emerald rising-arrow SVG icon + emerald accent. Selected state tints its own accent color (border 40%, bg 10%). Default selected mode stays `push` — now visually unambiguous thanks to the green treatment.
139. **Copy cleanup.** Dropped the "WHY" eyebrow above the reasoning box — reasoning stands alone. "81% confident" became "Confidence: 81%" with pct in accent color and label in `text-c-secondary`. Chevrons unified to `▾`/`▴` on both Confidence and Details (removed the `?` icon that was confusing out of context).
140. **Hint rewrites** (all em dashes stripped, multi-line via `\n` + `whitespace-pre-line`). Formula on e1RM hint now on its own line so it doesn't wrap mid-expression. Trend fit, this-session nudge, and Floor @ N reps rewritten to be more educational — the nudge hint directly answers "why cap at 3% if the trend is 10%?", the floor hint shows the actual math worked through.
141. **Engine reasoning strings** (`helpers.js`) also scrubbed of em dashes.

### Batch 16h (April 19, 2026) — Collapsed card cleanup + plate reorder + plate Confirm

142. **Collapsed exercise-card cleanup.** Removed the inline "● Try: 185×10" hint AND the faded "Last: 175×11" line from collapsed rows. All prescription / historical info lives only in the expanded card's banner + sheet. The collapsed card now shows exercise name + REC pill (if enabled) + in-progress summary + completed state only.
143. **Toolbar emojis removed.** 🏋️ from Plates and ⏱️ from Last Time buttons — Last Time was wrapping to two lines on mobile because of the emoji padding. Labels read cleanly without them.
144. **Banner hidden when `confidence === 'none'`.** Cold-start exercises (fewer than 3 logged sessions) no longer surface a "Log N more sessions" banner whose only content is saying there's no prescription yet. Banner returns as soon as there are 3+ sessions.
145. **Plate split reorder.** `COMMON_PLATES` = `[100, 45, 35, 25, 10]` (100 promoted inline since it's used regularly); `RARE_PLATES` = `[5, 2.5]` (behind the + expand icon). Loaded rare plates still always visible so decrement works even when collapsed.
146. **Bar weight chip order.** Popover chips now ascend: `[None] [25 lb] [45 lb]` (was `[45][None][25]`). 45 still the init default via `barDefault` fallback. `BAR_CYCLE` constant updated.
147. **Plate popover Confirm button.** Bottom row is now `[Turn off plate mode]` (flex-grow 2) + `[✓ Confirm]` (flex-grow 1, emerald pill). Tapping Confirm closes the popover — state already applies on each tap, but the button gives users an explicit "I'm done" affordance without having to tap outside.

### Batch 16i (April 19, 2026) — AI coaching + Rec pill toggles; Dashboard banner move

148. **`settings.enableAiCoaching`** (default `true`). Gates `RecommendationBanner` + `RecommendationSheet`. When off, both disappear from the expanded card; engine (`getExerciseHistory`, `recommendNextLoad`, etc.) still runs in the render path — flipping back on is instant. Data collection is unaffected.
149. **`settings.showRecPill`** (default `true`). Gates the per-exercise blue REC chip (added in Batch 13). Some users never use the free-text prescription slot. Does not hide existing `exercise.rec` values; flipping back on re-reveals them.
150. **HamburgerMenu toggles.** Both added under the existing "Workout Defaults" section using the same switch pattern as `autoStartRest` / `restTimerChime`. Same theme-colored track when on.
151. **Dashboard banner moved.** The "Tag N custom exercises to unlock smarter recommendations" banner now sits between `SECTION 3: Hero Workout Card` and `SECTION 4: Stat Cards`, instead of at the top of the page (where it was encroaching on the "This Week" calendar header). Also dropped the 📋 emoji per the 16h "labels over emojis" principle.

### Batch 16j (April 19, 2026) — Manage Exercise Library + Backfill confirm flow

152. **`/exercises` page** (`src/pages/ExerciseLibraryManager.jsx`). Full library management surface. Header with filter chips (`All` / `Custom` / `Built-in` / `Untagged` — Untagged hidden when count=0), optional search input, scrollable list. Needs-tagging entries sort to the top within any filter that includes them. Each row shows name, TAG badge (for needsTagging) or Custom label (for `!isBuiltIn`), one-line summary of muscles/equipment, most-recent logged set + date. Tap → opens `ExerciseEditSheet`.
153. **`ExerciseEditSheet`** (`src/components/ExerciseEditSheet.jsx`). Bottom-sheet portal at z-index 260 (above `RecommendationSheet`'s 250). Pre-fills from the exercise's current values. Fields: name input, multi-pill primaryMuscles (≥1 required), single-pill equipment (Other filtered out so user has to pick a real type), `loadIncrement` choice chips (2.5 / 5 / 10), unilateral checkbox. Save button disabled until name + ≥1 muscle + real equipment. Delete button only for non-built-in entries and goes through a two-step "Delete → Delete permanently" confirm to prevent accidental wipes. Built-in entries remain editable — "built-in" just means seeded, not immutable.
154. **"My Exercises" link in HamburgerMenu** between "My Splits" and "Settings" — the new surface is discoverable without users needing to know the URL.
155. **`Backfill.jsx` rewrite — confirm flow.** Each card now holds LOCAL DRAFT STATE for muscle/equipment instead of auto-committing on every tap. User can fiddle freely; only an explicit Confirm commits to store. Confirm button at the bottom of each card is disabled ("Pick muscle group + equipment" in muted text) until both fields valid, then transitions to emerald "✓ Confirm". On tap: phase → 'saving', inline "✓ Saved" text shows, 350ms CSS fade + translateY(-6px), then `tagExercise` fires and the card drops off the list. Copy also rewritten to emphasize "edit later in My Exercises, no pressure to get it perfect first try." Completion screen now links to `/exercises` explicitly.

### Batch 16k (April 19, 2026) — Two hotfixes after the first full-flow test

156. **Timezone-drift on the Dashboard calendar strip.** Evening entries in a western timezone were landing ✓ on the wrong local day. Root cause: `addRestDaySession` (and every save path) stores `new Date().toISOString()` — UTC. The Dashboard's weekly/monthly calendar strips and the soreness check-in read those via `date.split('T')[0]` (the UTC date) and compared against `todayStr` computed from local getDate/Month/Year. For a 6:30 PM Friday entry in UTC-5, that pushed ✓ to Saturday. Fix: new `isoToLocalDateStr(iso)` helper in `Dashboard.jsx` parses the ISO and returns `YYYY-MM-DD` from local getters. All 6 `.split('T')[0]` usages on session/cardio/rest-day fields replaced. `buildActiveDaySet` in helpers.js was already local-correct (Batch 11), so the streak number was fine — only the calendar rendering was drifting.
157. **Cardio "No" button auto-saving in Finish modal.** Scenario B (no cardio logged today) had three chips: Yes / Log Now / No. Tapping "No" was wired directly to `onSave({cardioAction: 'none'})`, short-circuiting past the main Save button with no way to undo. Fix: `cardioChoice` state expanded to 'yes' | 'no' | null. No button now toggles between 'no' and null (symmetric with Yes), highlights when selected, and lets the main Save button at the bottom commit. Removed unused `handleSaveNo` function.

### Batch 16l (April 19, 2026) — Manage Exercises filter chips

158. **Workout + usage filter row on `/exercises`.** 109 entries were too many to scroll through. Added a second chip row below the existing source filter (All/Custom/Built-in/Untagged): `Any workout` / `[each workout in the active split with its exercise count]` / `Logged` / `Never logged`. The two axes combine independently, so a user can show e.g. "Custom + Never logged" to find unused custom entries.
159. **`exerciseIdsByWorkout` resolution (`ExerciseLibraryManager.jsx`).** `useMemo` walks each active-split workout's sections, unwraps string-or-`{name,rec}` exercises, and resolves names via `normalizeExerciseName` against a pre-built `(normalized name → library id)` map covering canonical names + aliases. Same approach as the v3 migration — renamed variants still match. Workout chips with 0 matching exercises are hidden.
160. **`loggedIds` set.** Flat scan of sessions builds a Set of every `exerciseId` with at least one session set. O(sessions × exercises). Drives both the `Logged` / `Never logged` chip filters and their counts. Workout display name uses the first segment before " — " (e.g. "Push" instead of "Push — Chest") to keep chip widths reasonable.

### Batch 16m (April 19, 2026) — Monthly calendar redesign

161. **Monthly grid cells → circles matching the weekly pill strip** (`Dashboard.jsx`). Every day cell is now a 36px circle (aspectRatio 1, borderRadius 50%) with the day number centered inside. State mapping:
    - Active day (session or cardio done): filled accent circle, contrastText number, bold.
    - Today pending / today-rest: transparent with 2px accent border, number in accent.
    - Today-logged-rest: muted white fill plus 2px accent ring.
    - Logged rest (past): muted white 14% fill, secondary-text number.
    - Rotation rest (past or future): 1px **dashed** border in muted color, muted number — dashed line signals "planned rest, not logged".
    - Future planned workout: 1px subtle solid border, muted number.
    - Empty past (missed): no shape, faint number.
    Dropped the workout-type emojis (🏋️ / 🦵 / 💪 / 🎯 / 🦿), the R / C single-letter overlays, and the floating blue cardio dot. Workout-type detail lives in History → session detail on tap; the monthly grid now answers "what happened on this day" in terms of activity state only. Tap handlers preserved (active → session detail, future → preview sheet, future-rest → rest-day sheet). Grid gap 3px → 6px for visual balance.

### Batch 16n (April 19, 2026) — Readiness check-in (AI coaching step 4)

Step 4 of the AI Coaching Recommender plan — pre-session prompt per spec §2.5. Replaces the plain Start Session overlay with three tappable rows (Energy / Sleep / Goal) plus a gym chip. Captured data feeds the recommender: Goal → mode (Recover=deload, Match=maintain, Push=push), and Energy+Sleep → aggressivenessMultiplier (low+poor=0.85, neutral=1.00, high+good=1.15) that scales push-mode nudging.

162. **`recommendNextLoad` accepts `aggressivenessMultiplier` (default 1)** (`helpers.js`). Scales the push-mode 1.15 aggressiveness constant and the `thisSessionNudgePct` display value. Zero effect in maintain/deload modes, and zero effect at the default (1.0) — so pre-16n callers and OK/OK users get identical output.
163. **`buildReadiness({energy, sleep, goal})` + `readinessMultiplier()` + `READINESS_GOAL_TO_MODE`** (`helpers.js`). Centralized mapping so the UI doesn't duplicate the goal→mode or energy+sleep→multiplier tables. Sanity-checked against `readiness-sanity.mjs` at repo root.
164. **`ReadinessCheckIn` component** (`src/pages/log/ReadinessCheckIn.jsx`). Three-row chip grid (§9.2 Option A), defaults OK/OK/Push. Selected state uses the user's accent color (`theme.bg` + `theme.contrastText`). Inline gym chip below the rows (§9.6 Option D): single chip text "Gym: VASA change" when gyms exist, or "+ Where are you lifting?" placeholder. Tapping opens an anchored popover with existing-gym list + inline "Add gym name…" field. Start Session commits readiness + gym; "Skip check-in" commits readiness=null; "Go back" navigates away.
165. **Gym store actions** (`useStore.js`). `settings.gyms: []` + `settings.defaultGymId: null` under existing settings slice (rides along export/import/merge without new code). Actions `addGym(label)` (case-insensitive dedupe, auto-sets default if first), `removeGym(id)`, `setDefaultGymId(id)`. Gym CRUD lives in the readiness chip for now — full Settings UI is deferred until step 8 when sessionGymTags + picker filters ship.
166. **BbLogger wiring** (`BbLogger.jsx`). `readiness` + `gymId` state in the main component (loaded from savedSession?.readiness/gymId so reload preserves). `handleStartSession(payload)` receives `{energy, sleep, goal, gymId}` from the overlay and calls `buildReadiness()`. `saveActiveSession` useEffect and the final `addSession` call both persist them. ExerciseItem gets two new props — `aggressivenessMultiplier` and `suggestedMode` — threaded to both the useMemo that powers the banner and to the RecommendationSheet as `defaultMode`.
167. **RecommendationSheet wakes up on each open** (`Recommendation.jsx`). New `useEffect([open, validInitial])` syncs `selectedMode` to the readiness-derived `defaultMode` every time the sheet opens. Previously useState's initializer only ran on first mount, so a user who picked Recover after the sheet had been opened once in Push mode would still see Push selected. Also a new `showDeloadChip` path surfaces a 3-chip layout (Deload | Maintain | Push) when `defaultMode === 'deload'`; user can still tap Maintain/Push to compare. Orange accent for the Deload chip with a new `DescendingLineIcon` SVG so the three chips read as an easier→harder continuum.
168. **`readiness-sanity.mjs` at repo root.** Node ESM — loads `debug-backup.json`, migrates through v2+v3, runs the recommender across the 3 readiness bands and the 3 goals against Pec Dec's real history. 9/9 multiplier lookups and 3/3 goal→mode mappings verified. Confirms Recover goal → 155 lbs (65% of e1RM deload), Match → 175 (maintain), Push → 185 (push).
169. **Verified live in preview** (mobile 375×812, debug-backup.json data, theme=blue): overlay renders with rows + gym chip + Start Session; selecting Low/Poor/Match persists `readiness.aggressivenessMultiplier=0.85, suggestedMode=maintain`; expanded Pec Dec card shows maintain prescription on the banner; tapping banner opens sheet with Maintain chip selected + "Matching your e1RM at 10 reps" reasoning. Recover-goal flow: banner 155×10, sheet opens 3 chips with Deload selected + orange accent. Skip flow: `readiness=null`, sessionStarted=true, push defaults apply. No console errors. ✓

### Batch 16n-1 (April 19, 2026) — Coach's Call polish

UX review round on readiness + Coach's Call after 16n shipped. No engine changes, no new data. Pure copy, layout, and chart clarity.

170. **Readiness labels: OK → Mid** (`ReadinessCheckIn.jsx`). Energy `Low/Mid/High`, Sleep `Poor/Mid/Good`. Keys stay `'ok'` internally so nothing migrates; only the display label changed.
171. **Banner → compact `RecommendationChip`** (`Recommendation.jsx`, `BbLogger.jsx`). The wide `RecommendationBanner` at the top of the expanded card is replaced by a small emerald pill `[✨ Tip]` in the toolbar row. Opens the sheet on tap. Same rendering guard (`settings.enableAiCoaching && prescription && confidence !== 'none'`). Banner export kept for back-compat but no longer consumed — candidate for deletion with a cleanup pass.
172. **Toolbar row unified** (`BbLogger.jsx`). All five chips (Plates, Uni, Last, PR, Tip) use `px-3 py-1.5 text-xs font-semibold` with `gap-2` between them. "Last Time" shortened to "Last" for fit. PR chip bumped up to match the other heights (was `px-2 py-1 fontSize:11`). Removes the inner `ml-auto` group wrapper — chips flow naturally left-to-right with even spacing.
173. **Sheet header collapsed to one line** (`Recommendation.jsx`). Previous two-eyebrow layout (`COACH'S CALL / Pec Dec` left, `TOP SET / 175×10` right, close far right) replaced with a single-line `✨ Recommended top set: **175 × 10**` in emerald, with `Last session's top set: 150 × 10` as a subtle subtitle beneath. Close button stays right. Exercise name (`Pec Dec`) promoted to a small heading ABOVE the recommended row, left-indented to align with the sparkle icon.
174. **Sparkline rewritten with explicit variable labels** (`Recommendation.jsx`, `E1RMSparkline`). Removed all in-chart text (floating "EST. 1-REP MAX" caption, rate label, peak callout). The chart now renders ONLY the line, trend line, and dots — clean visual. Explicit labels wrap it:
    - **Title above**: `Estimated 1-rep max · last 6 sessions`
    - **Stat key below**: `Peak: 239 lbs` (left) · `Growth: +7.0%/wk` (right)
    Each number has a named label; no orphaned numbers on the chart. Trend line kept; peak dot is 4.5px (vs 3.5px for latest, 2.5px for others) so the peak stands out visually as the "239 lbs" value the label refers to.
175. **Mode chips collapsed to single line** (`Recommendation.jsx`, `ModeChip`). Was 3 stacked rows (icon+label / weight×reps / sub-label). Now one row: `[icon] LABEL  weight×reps`. Dropped the "Keep it steady" / "Go for progress" sub-labels — redundant with icon+label. Padding reduced from `py-3 px-3` to `py-2 px-3`. Significant vertical and horizontal space saved.
176. **Hit-target reasoning split by math driver** (`helpers.js`, `recommendNextLoad`). Vague "Adding a little more weight based on how fast you've been progressing" replaced with branch-specific strings:
    - **Floor-driven, catching up** (most common): "Your recent top sets put your estimated 1-rep max around {e1RM} lbs, which projects to {floor} for {targetReps} reps. Last session you went {last.weight}×{last.reps}, lighter than your strength suggests, so today's weight catches you back up to your actual level."
    - **Floor-driven, steady**: "Matching your current strength level: {e1RM} lb e1RM projects to {floor} for {targetReps} reps, right around last session's {last.weight}×{last.reps}."
    - **Nudge-driven**: "You hit {last.weight}×{last.reps} last session, right at your current strength level. Bumping load by +{bump} lbs today based on your progression trend (capped at +3% per elapsed week to keep it sustainable)."
177. **Details: `This session's nudge` → `vs last session: +25 lbs (+16.7%)`** (`Recommendation.jsx`). The old "nudge" row reported an internal engine sub-value (Layer 3's `P × alpha × 100`) that was 0% whenever `daysSince=0` and irrelevant when the Floor drove the prescription — confusing. Replaced with the actual session-over-session delta, which matches what the user sees on the banner. Old nudge row is gone from the UI; `thisSessionNudgePct` is still computed in the engine meta block for anyone who wants it.
178. **`daysAgoLabel(0)`: `today` → `earlier today`** (`Recommendation.jsx`). "Last session: 150×10 · today" was ambiguous alongside a session in progress. `earlier today` disambiguates — explicitly a prior session.
179. **Pec Dec heading spacing tightened** (`Recommendation.jsx`). `mb-1` (4px) below the exercise name reduced to `mb-0.5` (2px) to match the `mt-0.5` between Recommended and Last session subtitle. Visual rhythm now balanced across the three title lines.

No console errors. All changes verified in the preview across Push (default), Match (maintain), Recover (deload), and Skip flows.

### Batch 16o (April 19, 2026) — Fatigue signals (AI coaching step 6)

Step 6 of the AI Coaching Recommender plan per spec §4. Engine-only (no new UI surfaces) — just four contextual multipliers stacked alongside the readiness multiplier, plus a one-sentence fatigue prefix on the reasoning when a signal materially moved the prescription. User explicitly called for the cardio factor to be "slightest manner" since routine cardio shouldn't drag next-day readiness; implemented accordingly.

180. **`gradeMultiplier(grade)` (`helpers.js`).** Prior bb session's grade scales aggressiveness: A+=1.10, A=1.05, B=1.00, C=0.95, D=0.90, null=1.00. Mirror of readiness but from observed past performance. Scoped to most recent graded bb session (any workout type).
181. **`cardioDamping(cardioRecent)` (`helpers.js`).** Deliberately minimal per user feedback: only triggers on `intensity === 'allout'` AND `hoursAgo < 24`, at 0.98× (2% reduction). Easy/moderate/hard cardio has zero effect regardless of timing; all-out cardio >24h ago also has zero effect. Tiny guardrail for the extreme case without being noisy for routine cardio.
182. **Rest-day boost (`helpers.js`).** When a rest day was logged within ~36h (covers "yesterday" without timezone gymnastics), aggressiveness gets a 1.05× boost. No-op otherwise.
183. **`gapAdjustment(daysSince)` (`helpers.js`).** Long inter-session gap tempers the final prescription and caps the nudge alpha. `daysSince > 14`: `{ mult: 0.85, alphaCap: 2 }`. `daysSince > 10`: `{ mult: 0.95, alphaCap: 2 }`. Otherwise no-op. Protects against the 3-week-gap → `alpha=3` → tripled nudge → injury scenario.
184. **`buildFatigueSignals({sessions, cardioSessions, restDaySessions, now})` (`helpers.js`).** Resolves raw store slices into `{priorGrade, cardioRecent, restedYesterday}`. Called once per BbLogger render via `useMemo`; signals ride into every ExerciseItem's recommender call. Keeps the recommender pure (no direct store coupling).
185. **`recommendNextLoad` accepts `fatigueSignals = {}`** (`helpers.js`). All four multipliers stack onto the existing `aggressivenessMultiplier` inside the push branch: `aggressiveness = 1.15 × readinessMult × gradeMult × cardioMult × restMult`. Alpha is clamped by `gapAdjustment.alphaCap`. Final prescription is additionally scaled by `gap.mult` when the gap is long enough to warrant tempering. Maintain and deload branches ignore fatigue signals entirely (as they ignore readiness).
186. **`buildFatigueReasoningPrefix` (`helpers.js`).** Composes a one-sentence prefix for material signals: D/C grade → "Last session graded D, so holding back a touch."; A+/A → "Last session graded A — pushing a touch more today."; all-out cardio → "Taking it a touch easier after your all-out cardio session."; long gap → "It's been N days — ramping back up gradually, not catching up."; rest day (no cardio damp) → "Coming off a rest day, giving you a little more room." Only one prefix surfaces at a time; priority is warn-first (deload-ish signals before boost signals).
187. **`thisSessionNudgePct` reflects composed aggressiveness** (`helpers.js`). The engine meta value is now computed against the full `readiness × grade × cardio × rest` product and the gap-capped alpha, for accuracy if any future UI surface exposes it. Currently unused in UI (replaced by "vs last session" delta in 16n-1).
188. **BbLogger wiring** (`BbLogger.jsx`). `fatigueSignals` computed once at the top level via `useMemo(() => buildFatigueSignals({sessions, cardioSessions, restDaySessions}), [...])` and passed to every ExerciseItem. ExerciseItem threads it to both the recommendation useMemo and the RecommendationSheet. Sheet passes it into all three mode calls inside `recs`.
189. **`fatigue-sanity.mjs` at worktree root.** Node ESM — validates 6/6 grade multipliers, 6/6 cardio damping cases, 6/6 gap adjustments, end-to-end reasoning prefix firing on real Pec Dec history, plus a synthetic slow-progression (+1%/wk) scenario that proves multipliers bite when the 3% cap isn't saturated (baseline nudge 1.14% → D 1.03% → A+ 1.26%), plus a 21-day gap scenario (150→130, "ramping back up gradually").
190. **Verified live in preview** (mobile 375×812, debug-backup.json data, theme=blue). Opened Pec Dec Tip → sheet renders with reasoning: "Last session graded A — pushing a touch more today. You hit 175×11 last session, right at your current strength level. Bumping load by +10 lbs today based on your progression trend (capped at +3% per elapsed week to keep it sustainable)." Fatigue prefix fires correctly from the backup data's A-graded prior session. No console errors. ✓

### Batch 16p (April 19, 2026) — Polish sweep + §3.8 auto-classify

Small-scope housekeeping pass. Sweeps the UX items flagged in 16n-1, deletes dead code, and ships the remaining small v1 engine item (§3.8 warmup/working auto-classification on weight entry). No new features or schema changes.

191. **Maintain = Push chip collapse** (`Recommendation.jsx`). When `recs.maintain.prescription.weight === recs.push.prescription.weight` (the Floor-dominated case), the Maintain chip is hidden and the grid shrinks to `grid-cols-1`. `effectiveMode` forces selection to `push` when the stored `selectedMode` was `maintain`, so the reasoning and Details pane stay consistent with the visible chip. Deload-three-chip layout still takes precedence when the user's goal was Recover.
192. **"Floor @ N reps" → "Strength at N reps"** (`Recommendation.jsx`). The word "Floor" read as "lowest allowed" and confused users when the Floor equaled the prescription (common in catch-up mode). Renamed throughout the Details pane and updated the hint copy to describe it as a strength-level projection (e1RM × %1RM at target reps), not a floor. The "vs last session" hint also swapped the internal "floor / nudge" wording for user-facing "strength level / weekly nudge".
193. **Sparkline tap-to-select** (`Recommendation.jsx`, `E1RMSparkline`). Dots are tappable again with an invisible 14px hit area. Tapping swaps the "Peak: 239 lbs" key label to "Session N: 225 lbs · 150×10" (e1RM value + session's top set). Tapping the same dot clears back to Peak. State lives in the sheet (`sparkSelectedIdx`) and resets on each open. Re-enabled by lifting state out of the sparkline so the key line can reflect the selection.
194. **Dead export cleanup** (`Recommendation.jsx`). Removed the unused `RecommendationHint` and `RecommendationBanner` exports plus their helper fns (`hasRenderableHint`, `hintDotColor`). Neither was consumed since Batch 16n-1 (banner → chip) and 16h (hint removal). Comment in `useStore.js` also updated `RecommendationBanner` → `RecommendationChip` for the `enableAiCoaching` setting.
195. **Auto-classify warmup/working on weight entry** (`BbLogger.jsx`, spec §3.8). In `updateSet`, when the user changes the weight and the set isn't a drop set, we compute `weight / recentTopE1RM` and classify: `<60%` → `warmup`, `>80%` → `working`, middle band keeps current type. `recentTopE1RM` is read from the last session's top-set e1RM via `recHistoryRef` (a ref populated after `recHistory` is computed, so `updateSet`'s closure can read the latest value without a TDZ ReferenceError). No history → skip entirely. User can always manually override afterward.
196. **Verified live in preview** (mobile 375×812, debug-backup.json). Pec Dec Tip sheet: renders with "Estimated 1-rep max · last 6 sessions" title, "Peak: 239 lbs · Growth: +7.0%/wk" key, clean chart. Both Maintain (175×10) and Push (185×10) chips render when they diverge. Details pane: "Strength at 10 reps: 175 lbs" row + "vs last session: +10 lbs (+5.7%)" row, no "Floor @" anywhere. No console errors. ✓

### Batch 16q (April 19, 2026) — Anomaly coaching surfaces (AI coaching step 9)

Step 9 of the AI Coaching Recommender plan per spec §4.5 + §9.3. Engine-plus-small-UI pass: three detectors (plateau, regression, swing) run over the existing per-exercise e1RM history and surface a contextual banner on each expanded exercise card. No schema changes; dismissal rides the existing settings slice. User-clarified this round: banner body tap does nothing (icon + copy + dismiss X only, per "less is more"); dismiss lasts only the current active session — the banner returns next session if the detector still fires.

197. **`detectPlateau(history, {minSessions=6})`, `detectRegression(history, {minSessions=3, rateThreshold=-0.01})`, `detectSwing(history, {threshold=0.30})`** (`helpers.js`). Pure functions — no store access, no time dependency beyond the input history. Plateau uses the existing `getProgressionRate` window; fires when `|rate| < 0.005` (±0.5%/wk). No R² gate because a perfectly flat line yields rSquared=0 in our code via the `ssyy===0` branch, which would otherwise falsely block the detector. Regression uses the same fit plus an R² ≥ 0.4 gate (matches the recommender's `usedFit` cutoff) so noisy scatter doesn't trigger a warning. Swing is a simple session-over-session delta: `|last.e1RM - prev.e1RM| / prev.e1RM > 0.30`.
198. **`detectAnomalies(history)` aggregator** (`helpers.js`). Runs all three and returns the highest-priority non-null result, or null. Priority: **regression > swing > plateau** — warning first (things are getting worse), data-quality second (same machine?), passive observation third (you're stuck).
199. **`AnomalyBanner` component** (`Recommendation.jsx`). Inline-styled bottom-sheet-free div: 10px padding, 10px border-radius, severity-keyed tint (amber `rgba(245,158,11)` for `warn` — regression; blue `rgba(59,130,246)` for `info` — plateau / swing). One-line copy left, 28×28 dismiss ✕ button right. No portal — renders inside the exercise card. `buildAnomalyCopy(anomaly, name)` co-located: plateau "You've been flat on {name} for the last {n} sessions. Try dropping 10% and chasing reps this week to break through."; regression "Trend on {name} has dipped the last {n} sessions. Consider a lighter recovery week, then build back up."; swing "Your top set on {name} swung {dir} {pct}% from last session. Same machine? Same range of motion?" Copy respects the no-em-dashes preference throughout.
200. **`settings.dismissedAnomalies: {}`** (`useStore.js`). New settings field, `{ [exerciseKey]: sessionId }`. Additive — no persist version bump (rides the existing `settings` deep-merge on load). Companion action `dismissAnomaly(exerciseKey)` stamps the current `activeSession.startTimestamp` against the key, so a stale dismissal from a previous session fails the match check automatically and the banner reappears. No cleanup logic needed — the map stays small (at most one entry per exercise).
201. **`ExerciseItem` wiring** (`BbLogger.jsx`). `anomaly = useMemo(() => detectAnomalies(recHistory), [recHistory])`. Anomaly key is `exercise.exerciseId || exercise.name` (falls back to name because template-seeded exercises don't carry exerciseId until save time via `buildExerciseData`). Render gate: `settings.enableAiCoaching && anomaly && !dismissedThisSession`. Banner slots between the toolbar row (Plates / Uni / Last / PR / Tip) and the column headers (`Type / Lbs / Reps`). New prop `activeSessionId={startTimestamp.current || null}` threaded from parent BbLogger so the dismissal check has a stable per-session id.
202. **`anomaly-sanity.mjs` at worktree root.** Node ESM. 25/25 synthetic + edge-case assertions pass: plateau on 6 flat values, regression on 6 declining values (R²=1.0, rate=-9.3%/wk), swing on a +39% and -35% jump, priority order when multiple fire, healthy-gains case fires nothing, n<6 flat does NOT trigger plateau, noisy scatter does NOT trigger regression. Real-data pass against `debug-backup.json` logs informationally — Pec Dec / Chest Supported Wide Row / Seated Cable Row / Incline DB Press all return "nothing fires" on the user's healthy progression, as expected.
203. **Verified live in preview** (mobile 375×812, debug-backup.json with synthetic injections). Plateau scenario (6 Pec Dec sessions flat at 180×10): banner renders with blue `rgba(59,130,246,0.08)` tint + blue border and correct copy referencing "6 sessions". Dismiss ✕ hides the banner; `dismissedAnomalies.Pec Dec === activeSession.startTimestamp` in localStorage. Collapsing + re-expanding the card keeps the banner hidden. Regression scenario (200→100 linear decline): amber `rgba(245,158,11,0.1)` tint, regression copy. Swing scenario (+39% last-over-prev): blue tint, "swung up 39% from last session. Same machine?" copy. Flipping `settings.enableAiCoaching = false` hides both the banner AND the Tip chip; flipping back on restores both. No console errors throughout. ✓

### Batch 16r (April 19, 2026) — Menu restructure + How AI Coaching Works explainer

User-requested reorganization of the HamburgerMenu Settings screen to separate profile concerns from workout concerns, plus a new plain-English "How AI Coaching Works" explainer under Info. No engine changes, no schema changes.

204. **Settings restructure** (`HamburgerMenu.jsx`). The "Appearance" and "Account" sections collapsed into a single **Profile Settings** section containing Your Name (moved to top — users see their name field first), Theme, and Accent Color. **Workout Defaults** stays as-is: Default first set / Auto-start rest timer / Rest timer chime / AI coaching / Show Rec pill. Previous three-section layout (Appearance / Workout Defaults / Account) becomes two (Profile Settings / Workout Defaults). Matches the user's mental model: "who I am" vs "how I train."
205. **AI coaching description updated** (`HamburgerMenu.jsx:290`). Was "Show the coach's call banner + sheet" (written for Batch 16i when the only surface was Coach's Call). Now reads "Coach's Call tip + anomaly banners" so the toggle's expanded 16q scope is explicit in the UI.
206. **"How AI Coaching Works" expandable** (`HamburgerMenu.jsx`). New collapsible entry under Info, alongside "How Tracking Works" and "How Streaks Work". Plain-English 2400-char explainer covers: your-strength estimate (Epley in layman's terms), today's suggestion (Layer 2 + Layer 3, capped 3%/wk in plain English), the readiness check-in (energy/sleep/goal), what the coach watches between sessions (grade, cardio, rest day, gap), miss-the-reps logic (hold weight / auto-deload), the three anomaly banners (plateau / regression / swing), and what the coach won't do (local data only, suggestion not rule, waits for enough history). Respects user UX preferences: no em dashes, less-is-more defaults (section starts collapsed), labels + strong-tagged key terms rather than bullet-heavy formatting.
207. **Verified live in preview** (mobile 375×812, debug-backup.json). Menu → Settings: Profile Settings section lists Your Name → Theme → Accent Color in that order; Workout Defaults lists the five toggles in their original order. AI coaching toggle's description reads "Coach's Call tip + anomaly banners". Menu → Info: three expandables present — How Tracking Works / How Streaks Work / How AI Coaching Works — the third expands to 2435 chars of explainer content rendering without layout issues. No console errors.

### Batch 17a (April 19, 2026) — Split draft auto-save + persist v4 migration

First step of the Split Builder redesign (see `split-builder-redesign-handoff.md` Step 1). Closes the data-loss class where an accidental tab brush, OS kill, or tab close mid-wizard wiped the in-progress split. Additive store slice + persist bump + debounced auto-save + resume banner. No UI on the wizard side beyond the banner — engine-invisible otherwise.

208. **`splitDraft` store slice + `setSplitDraft` / `clearSplitDraft` actions (`useStore.js`).** Shape: `{ originalId: string | null, draft: PartialSplit, updatedAt: number } | null`. `originalId` is `null` when creating new, or a split id when editing. One draft at a time — a second create overwrites any prior create draft; same for edit drafts scoped to the same id. The `draft` object carries only what the user has typed so far (name / emoji / workouts / rotation) so partial state is fine. Actions are dumb setters — debouncing + dirty-tracking live in the consumer.
209. **Persist version bumped `3 → 4`** with additive `migrate` block — sets `splitDraft = null` when upgrading from v3. Pre-v4 users have no drafts on disk, which is the correct initial state. The `merge` hook also preserves `splitDraft` explicitly so it survives schema evolution. Idempotent: re-running the v4 block on a v4 state with a live draft preserves the draft untouched.
210. **SplitBuilder auto-save + resume banner (`SplitBuilder.jsx`).** New `isDirty` flag + debounced (500ms) `useEffect` that writes the current wizard state to `setSplitDraft` whenever name/emoji/workouts/rotation change. Every setter passed down to Step1 / Step3 / workout-builder is wrapped so typing / adding / reordering all flow through one dirty pipeline. Mount effect: if a matching draft exists for this route context (create OR edit-of-this-id), show an amber banner at the top of Step 1 offering Resume / Discard. Banner copy includes `formatTimeAgo(updatedAt)` so users see "last saved 3m ago" rather than a raw timestamp.
211. **Auto-clear safety rails (`SplitBuilder.jsx`).** Drafts older than 7 days auto-clear on mount (constant `DRAFT_STALE_MS`). Drafts with an `originalId` that no longer exists in `splits[]` (user deleted that split between drafting and returning) also auto-clear. Draft scoping: a create-mode draft shows the banner on `/splits/new` only, an edit-mode draft shows only on `/splits/edit/:id` where `id === originalId` — mismatched edit URLs leave the draft untouched (so returning to the owning url still surfaces it). `handleSave` and the explicit Discard button both call `clearSplitDraft()` so successful saves + intentional discards never leave orphan state behind.
212. **`formatTimeAgo(tsOrIso)` helper (`helpers.js`).** Accepts a ms epoch or an ISO string. Returns "just now", "Nm ago", "Nh ago", "yesterday", "Nd ago" (under 7 days), or `formatDate(...)` beyond. Handles clock-skew (negative diffs → "just now") and invalid inputs → empty string.
213. **`draft-sanity.mjs` at worktree root.** Node ESM — exercises the v3→v4 additive migration on a stripped backup, a full roundtrip through JSON.stringify/parse of a representative draft (create + edit), the clear path, and the edge cases `formatTimeAgo` handles (1m / 2h / yesterday / just-now / future / 10 days). 20/20 assertions pass. Mirrors the existing `migration-sanity.mjs` / `migration-v3-sanity.mjs` / `recommender-sanity.mjs` / `fatigue-sanity.mjs` / `anomaly-sanity.mjs` pattern.
214. **Verified live in preview** (mobile 375×812). Six scenarios all pass — (A) create new / leave / resume restores name+emoji+workouts; (B) edit-mode scoping — banner fires on `/splits/edit/split_bam` when the draft's originalId matches, silent on `/splits/edit/other_id`; (C) Discard button nulls the store slice + hides the banner; (D) completing the wizard and tapping Save Split nulls the draft and navigates to `/splits`; (E) manually aging `updatedAt` 8 days auto-clears on next mount; (F) orphaned-split draft (originalId pointing at a deleted split) auto-clears on mount. No console errors across all six flows. ✓

---

## Where to Go From Here

### What's remaining

Core v1 engine work is DONE: steps 1–6 + §3.8 all shipped, and step 9 anomaly UI landed in 16q. The recommender has every §2 + §4 input wired (e1RM history, readiness, goal mode, progression rate, grade, cardio, rest, gap), §3.8 auto-classify fills the last small engine item, and the coach now surfaces plateau / regression / swing banners on the exercise card. Remaining v1 steps are two data-collection features — neither touches prescription math.

**Step 7 — Equipment instance (§3.4).** Per-session `equipmentInstance: string` optional field on LoggedExercise (e.g. "Hoist leg press" vs "Cybex leg press"). The swing detector shipped in 16q catches machine swaps via the "Same machine?" prompt even without this field, so step 7 is now primarily about trend-fit scoping (separate progression regressions per machine) and a small per-exercise instance chip for explicit tracking. Size: moderate (persist change + anomaly detection refinement + small UI).

**Step 8 — Gym tagging full loop (§3.5, §9.7).** Exercise-level `sessionGymTags`, auto-tag-on-use prompts, picker filter ("Only available at VASA"). Settings UI for managing the gym list (currently gyms are added inline from the readiness overlay only). Size: moderate-to-large.

### Post-v1 roadmap (explicitly deferred per plan Part 4)

- **Back-off sets**: v1 prescribes the top working set only. Top-set labeling already primes the UI. Trivial engine work, interesting UI work.
- **RPE re-introduction**: engine plumbing is alive (16c→16d revert). User observation: "most sets go to failure" — re-enabling needs smart defaults (auto-infer RPE from reps vs target) or a clear opt-in.
- **Anomaly detector refinements**: the three v1 detectors use conservative thresholds. Possible tunings once we have real usage signal: (a) per-exercise threshold (compound vs isolation expect different variance), (b) grade-aware plateau (a flat trend with consistent A grades is different from a flat trend with consistent C grades), (c) swing detector integration with equipment instance (step 7) to suppress cross-machine false positives.
- **§8.x tracks** (visual goals, coaching commentary, coach marketplace, macro/nutrition, learned readiness model): out of v1 scope entirely.

### Recommended sequencing

**Step 7 (equipment instance) next** is my pick. It's the only remaining feature that touches the session schema, so getting it out of the way before step 8 means all v1 schema work ships before the final UI-heavy loop. The 16q swing detector primes the UI for this: users have already been prompted "Same machine?" so asking them to tag the instance will feel natural. Step 8 naturally goes last since the gym list grows organically as sessions accumulate — we want some gym data to exist before shipping the picker filter.
