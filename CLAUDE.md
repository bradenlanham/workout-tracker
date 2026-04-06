# Gains — Project State

> Last updated: April 6, 2026 (Batch 8)

## Rules for Claude

1. **Read this file first** at the start of every new session before doing anything else.
2. **Update this file** after every batch of changes. Add new features to "Recent Changes", update file structure if files were added/removed, and update store shape if state changed. Update the "Last updated" date.
3. **Never run git commands from the sandbox.** See "Development Workflow" below. Give the user PowerShell commands to run locally.
4. **Validate builds** with `npx vite build --outDir /tmp/test-build`. Never build to the mounted `dist/` folder.
5. **Give the user exact PowerShell commands** for git operations. Use PowerShell syntax (`Remove-Item`, backslashes, etc.), not bash.

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
│   └── helpers.js             # getNextBbWorkout, getLastBbSession, getExercisePRs, getWorkoutStreak,
│                              # getRotationItemOnDate, getAchievements, formatDate/Time, playBeep, generateId
│
├── components/
│   ├── BottomNav.jsx          # 4-tab nav: Dashboard, Log, History, Progress (hidden during logging)
│   ├── HamburgerMenu.jsx      # Slide-in menu: My Splits, Progress, Settings, Info, Manage Data
│   └── RestTimer.jsx          # Floating draggable rest timer with progress ring (visible only during logging)
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
    │
    └── log/
        ├── BbLogger.jsx       # THE MAIN SESSION LOGGER — exercise cards, sets, plates mode, uni toggle,
        │                      # previous session ghost rows, add exercise panel, finish modal, session comparison,
        │                      # auto-persist to split template, share card integration
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
  },

  // ── Splits ──
  splits: [],                      // Array of split objects (built-in + user-created)
  activeSplitId: null,             // Currently active split ID
  exerciseLibrary: [],             // User's custom exercises (not heavily used yet)

  // ── Legacy ──
  customTemplates: [],             // Pre-splits custom workout templates
  workoutSequence: null,           // Legacy rotation order (synced to active split)

  // ── Cardio ──
  cardioSessions: [],              // Standalone + attached cardio sessions
  customCardioTypes: [],           // User-added cardio type strings
  activeCardioSession: null,       // In-progress cardio

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
  data: {
    workoutType: 'push',
    exercises: [
      {
        name: 'Bench Press',
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
- **Plate mode:** Per-exercise toggle. Shows plate buttons (100, 45, 35, 25, 10, 5, 2.5) with a bar weight cycler (45/0/25). A **1× / 2× multiplier toggle** controls whether plates are counted once or on both sides (default: 2×). Plate breakdown data is saved to the session for accurate ghost row display next time.
- **Unilateral (Uni) toggle:** Per-exercise. When active, volume is doubled at save time. The doubled weight is stored in `weight`, original in `rawWeight`.
- **Previous session ghost rows:** Shows last session's sets as faded, non-interactive rows (including plate breakdown if logged in plate mode). Toggled by "Last Time" button per exercise.
- **Set types:** warmup / working / drop. Drop sets auto-suggest 75% of previous working set weight.
- **PR detection:** Compares current set weight/reps against all-time maxes across all sessions for that exercise.
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
- **Active split label:** Shows current split name, emoji, and age.
- **Main CTA card:** Shows next workout in rotation with "Start Session" button. Shows "Rest Day" message on rest days. "Preview" button shows the workout's exercise list.
- **Soreness check-in:** Prompted the day after a workout (yesterday's session). Ratings: Not Sore, Sore, Very Sore, Wrecked. Can be skipped.
- **Cardio card:** Quick link to CardioLogger.
- **Weekly calendar strip:** Sun–Sat with emoji indicators for completed, planned, and rest days. Tapping a future day shows workout preview.
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
- `getWorkoutStreak()` counts consecutive calendar days with a session, going backwards.
- Rest days in the rotation don't break the streak.
- Streak resets to 0 if a non-rest workout day is missed.

### PR Tracking
- `getExercisePRs()` scans all sessions for the highest weight and highest reps per exercise name.
- New PRs are flagged with 🏆 in the session logger, share card, and history.

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
- **Manage Data:** Export/Import full backup as JSON.

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

---

## Data Persistence

- **Zustand persist middleware** with localStorage key `workout-tracker-v1`.
- Custom `merge` function in the persist config handles schema evolution: new fields get defaults, existing user settings are preserved via deep merge, existing users auto-skip onboarding.
- **Active session** (`activeSession`) persists across page reloads and app backgrounding so in-progress workouts are never lost.
- **Rest timer** uses absolute timestamps (`restEndTimestamp`) rather than countdown values, so it stays accurate across backgrounding.

---

## Development Workflow (Cowork / Claude Desktop)

**CRITICAL: Never run git commands that write to `.git/` from the sandbox.** The sandbox mounts the repo from the user's Windows machine but does NOT have write permission to `.git/`. Running `git commit`, `git push`, `git checkout`, etc. from the sandbox will create stale `.lock` files that block all future git operations until manually deleted. This has caused repeated issues.

**The correct workflow is:**
1. Claude edits source files directly (full read/write access to `src/`, `public/`, config files, etc.)
2. Claude verifies code compiles by running `npx vite build --outDir /tmp/test-build` (writes to sandbox temp, not the mounted `dist/`)
3. Claude gives the user the exact `git add`, `git commit`, and `git push` commands to run in their local terminal (PowerShell on Windows)
4. User runs those commands locally where git has full permissions
5. Vercel auto-deploys from the pushed branch; Claude can check deployment status via Vercel MCP tools

**PowerShell note:** The user runs PowerShell on Windows. Use `Remove-Item` instead of `rm -f`, backslashes for paths, etc. when giving git/shell commands.

**Vercel project:** Team `team_Ol4ZacaHh0oiEz562VTQLwRg` (slug: `bbblueprint`), Project ID `prj_PFuFC2BuTn6LFhR03fODL5Poc0eo` (name: `bambam`). Auto-deploys preview URLs for non-main branches, production for `main`.

**Build validation:** `npx vite build` will fail with EPERM when writing to the mounted `dist/` folder. Always use `--outDir /tmp/test-build` to validate compilation without hitting permission errors.

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
