# AI Coaching Recommender v1 — Decision & Build Plan

## Context

The spec (`coaching-recommender-spec-v3.pdf`) proposes a per-exercise, per-session load recommender: "my last top set was X, how much harder should I push today?" The feature is greenfield — zero recommendation logic exists in the bundle today. A source-code audit uncovered three live production bugs that silently corrupt the data the recommender would depend on; fixing them is prerequisite, not bonus.

This plan covers:
- **v1 prerequisites** (§3 data-model changes + §7 bug fixes, all verified against actual source).
- **v1 design decisions** (§9.1–§9.7 — my recommendation per item, for approval).
- **v1 build order** (per spec §6, with dependencies annotated).

Explicitly deferred: §8 post-v1 tracks (visual goals, coach marketplace, nutrition, learned readiness) and §9.8–§9.11 (their design decisions). Captured as a brief roadmap stub in Part 4.

---

## Part 1: Prerequisite Work

All three spec-claimed bugs have been verified in actual source (not bundle). File paths below are real, not line references to `index-hsSNM2WK.js`.

### 1a. Three live bugs (§7) — must fix regardless of recommender

| # | Bug | Location | Fix |
|---|---|---|---|
| 1 | Phantom PRs on unilateral sets | [helpers.js:93](src/utils/helpers.js:93) — `getExercisePRs` reads `set.weight` (doubled) | Change to `set.rawWeight ?? set.weight`, then recompute `isNewPR` across all historical sessions during persist migration. |
| 2 | "Last:" hint shows doubled value | [BbLogger.jsx:654-655](src/pages/log/BbLogger.jsx:654) — uses `lastTopSet.weight` | Change to `lastTopSet.rawWeight ?? lastTopSet.weight`. One-line fix. |
| 3 | Name-based exercise identity splits history | [helpers.js:90](src/utils/helpers.js:90) `===` match; [BbLogger.jsx:1454-1464](src/pages/log/BbLogger.jsx:1454) lookup scoped to `s.type === type` (same workout type only); [BbLogger.jsx:894,900](src/pages/log/BbLogger.jsx:894) freeform input with no normalization | Resolved holistically by §3.2 (ID-based references) + §3.3 (dedup at creation). |

### 1b. Data model migration (§3)

Persist version bumps from 1 → 2 ([useStore.js:317](src/store/useStore.js:317)). A single migration handles all transforms below in one pass.

**§3.1 Canonical weight field.** Introduce `perSideLoad(set) = set.rawWeight ?? set.weight`. Use it wherever load is read for comparison/display. Backfill missing `rawWeight` on historical sets (defaults to `weight`). Recompute `isNewPR` chronologically per exercise.

**§3.2 Exercise entity — IDs + required metadata.** Replace name-based identity with stable IDs.

- New `Exercise` shape: `{ id, name, aliases, primaryMuscles[], equipment, defaultUnilateral, loadIncrement, defaultRepRange, progressionClass, isBuiltIn, sessionGymTags?, needsTagging?, createdAt }`.
- `primaryMuscles` and `equipment` are **required** (runtime-validated in `addExerciseToLibrary`). Muscle group vocab already exists in [exerciseLibrary.js](src/data/exerciseLibrary.js) (12 groups); equipment vocab has 7 types (spec says 5 — reconcile to 7, keeping Kettlebell + Other).
- Seed `exerciseLibrary` (currently empty `[]` in store) from the 120 entries in [exerciseLibrary.js](src/data/exerciseLibrary.js), generating IDs via existing `generateId()` helper.
- `LoggedExercise` carries denormalized snapshots: `{ exerciseId, nameSnapshot, primaryMusclesSnapshot, equipmentSnapshot, equipmentInstance?, unilateral, notes, completedAt, sets[] }`.
- Name-to-ID resolution during migration: fuzzy-match user's session-exercise names against the seeded library. User-created names with no match enter the library as new records with `needsTagging: true`.

**§3.2.1 Backfill UI for user-created exercises.** One-time onboarding screen after the migration. Each `needsTagging: true` exercise presented as a card with the last logged set for context; tap-to-select muscle group + equipment. "Skip for now" available with a non-intrusive reminder.

**§3.3 Dedup at the picker.** Currently both [BbLogger.jsx AddExercisePanel:869-923](src/pages/log/BbLogger.jsx:869) and [SplitBuilder.jsx ExercisePicker:103-222](src/pages/SplitBuilder.jsx:103) accept freeform strings with zero normalization. Add fuzzy matching (case-insensitive, whitespace-normalized, token-order-invariant). Threshold: ≥0.85 auto-suggest, ≥0.7 prompt-for-confirmation. See §9.5 for the interaction.

**§3.4 Equipment instance (optional per v1).** Add `equipmentInstance?: string` on `LoggedExercise`. Anomaly prompt at save: "per-side e1RM swung >30% from last session — same machine?". Scope trend fits by instance.

**§3.5 Gym tagging — two-level model.**
- Level 1 (on `Exercise`): `sessionGymTags?: string[]` — which gyms this exercise is available at.
- Level 2 (on `Session`): `gymTag?: string` — where I am today.
- Settings: master gym list `{id, label, emoji?}[]`. Default gym remembered between sessions.
- Auto-tag-on-use prompt: when user selects an exercise not tagged for the current gym, prompt "Tag Leg Press as available at VASA?". Queue prompts until after the set, never mid-set.

**§3.7 RPE/RIR capture (optional per v1, recommended).** Optional per-set `rpe` (1–10) or `rir` (0–5). Wire into Layer 3's Δreps calculation. Spec calls this "the single largest accuracy improvement available to the recommender."

**§3.8 Warmup/working/drop auto-classify.** Filter non-working sets in `getExercisePRs` explicitly (`type === 'working' || type === 'drop'`). Auto-default on weight entry: <60% recent top e1RM → `warmup`, >80% → `working`.

**Required new store actions** (none exist today):
- `addExerciseToLibrary(exercise)` — rejects empty `primaryMuscles`.
- `updateExerciseInLibrary(id, patch)`.
- `deleteExerciseFromLibrary(id)`.
- `mergeExercises(keepId, mergeIds)` — rewrites `exerciseId` refs in all sessions.

---

## Part 2: §9 Design Decisions — Recommendations for Approval

Each item below: recommended option + 1-line rationale. Skim, then either "approve all" or call out ones to revise.

### §9.1 — Where the recommendation surfaces in the exercise card

**Recommend: Option C — Inline hint + expand-on-tap.**
Compact default (`Last: 175×11   Try: 185×10   ↑ +6%/wk`) keeps the card scannable; tapping "Try: 185×10" opens a bottom sheet with confidence label, reasoning sentence, and alternative prescriptions (push/maintain/deload). Matches the app's existing interaction patterns (bottom sheets, tap-to-expand). The exercise card at [BbLogger.jsx ExerciseItem:447](src/pages/log/BbLogger.jsx:447) already has the "Last:" hint at line 654 and the PR chip in the toolbar row at 749-760 — this slot slots cleanly alongside both.

### §9.2 — Readiness check-in format

**Recommend: Option A — Three tappable rows (energy, sleep, goal).**
Matches the user's own voice-memo framing word-for-word. Preserves separate energy/sleep signals for future analytics (§8.6 learned readiness model). Nine buttons feels like a form only once; on repeat visits it's three taps. Sliders (B) are fiddly on mobile per the spec's own note; one emoji (C) loses signal; two questions (D) blocks the user from overriding the inferred goal.

### §9.3 — Anomaly prompts (equipment variants, regressions, swings)

**Recommend: Option C — Contextual, persistent until answered.**
Banner sits at the top of the exercise card, doesn't block. If dismissed/ignored, re-shows next session until answered. Respects mid-workout flow while preserving the data signal. Option A (blocking) is a no — users resent blockers mid-set.

### §9.4 — Confidence label display

**Recommend: Option C — Color coding + one-word text label.**
Green "Solid" / amber "Maybe" / gray "New." Matches the existing amber PR chip pattern (see [BbLogger.jsx:749-760](src/pages/log/BbLogger.jsx:749)). Glanceable + readable + accessible. Text prevents the "ambiguous icon" problem of Option B.

### §9.5 — Dedup prompt when user types a near-match

**Recommend: Option C — Hybrid (inline suggestions + modal on high-similarity submit).**
As user types, show up to 3 matches below the input (familiar search pattern). On submit, if top match ≥0.85 similarity, surface a modal: "You typed 'seated cable row' — did you mean Seated Cable Row?". Below 0.85, submit silently creates. Catches confident matches without hassling the user on genuinely new exercises.

### §9.6 — Gym tagging: where session-gym selection happens

**Recommend: Option D — Smart default with override chip in the readiness step.**
The readiness check-in displays a small chip — `Gym: VASA [change]` — defaulting to the most recent session's gym. One tap to change when traveling. Single-gym users essentially never see it after the first session. Avoids the extra screen of Option B and the always-visible real estate cost of Option C. Requires the inference logic (trivial: previous session's gymTag).

### §9.7 — Gym tagging: exercise picker filter behavior

**Recommend: Option D — Soft-sort by default, hard-filter toggle.**
Default: picker shows "Available at VASA" section first, then "Unknown location" (untagged), then "Only at other gyms" (dimmed). Toggle at the top — "Only show available here" — collapses to Option A's hard filter. Matches the user's voice-memo wording ("eliminate all the ones that aren't available there") without breaking during the early backfill phase when many exercises are still untagged.

---

## Part 3: Build Order

Sequenced per spec §6. Each step produces a mergeable increment.

1. **§3.1 weight canonicalization + bug fixes.** `perSideLoad()` helper, rewrite `getExercisePRs` + save-time `isNewPR`, fix "Last:" hint. Bump persist v1 → v2, add migration that backfills `rawWeight` on historical sets and recomputes all `isNewPR` flags. Quick win — unblocks PR truth immediately.

2. **§3.2 + §3.2.1 + §3.3 in one migration pass.** Exercise entity with IDs, required muscle/equipment tags, seeded library, fuzzy-match name-to-ID resolution, backfill UI for `needsTagging` exercises, dedup in both pickers. Biggest single change — affects `helpers.js`, `useStore.js`, `BbLogger.jsx`, `SplitBuilder.jsx`, `exerciseLibrary.js`.

3. **Recommender v1.** Layers 1–3 (Epley e1RM → %1RM target → progressive-overload nudge). Three modes (push/maintain/deload). Confidence labels per §9.4. Render in exercise card per §9.1. Per-exercise progression rate via linear regression (sliding window 6, R²≥0.4 gate).

4. **§2.5 Readiness check-in.** Three-row prompt per §9.2, session-gym chip per §9.6. Hook into the Start Session overlay at [BbLogger.jsx:1965-1987](src/pages/log/BbLogger.jsx:1965). Modulate recommender via `aggressivenessMultiplier` (0.85 / 1.00 / 1.15).

5. **§3.7 RPE/RIR capture.** Optional per-set input. Wire `effectiveRepsBeaten = repsHit + estimatedRIR - targetReps` into Layer 3.

6. **§4 Fatigue signals.** Grade multiplier, cardio-within-48h damping, rest-day boost, inter-session gap adjustments.

7. **§3.4 Equipment instance.** Anomaly prompt at save, `equipmentInstance` field, scope trend fits by instance.

8. **§3.5 Gym tagging — two-level + filter.** Exercise-level `sessionGymTags`, auto-tag-on-use prompt, picker filter per §9.7.

9. **§4.5 Anomaly coaching surfaces.** Plateau detection (flat for 6+), regression detection (negative for 2+), swing detection (>30% per-side e1RM). Surfaced per §9.3.

---

## Part 4: Deferred Roadmap (post-v1)

Captured so it's not lost, but explicitly out of scope for this plan:

- **§8.1 Visual goal tracking** — body photos, focus-area tagging, weekly check-ins. User-tagged only in MVP, no AI body analysis.
- **§8.2 Strength-to-growth correlation research** — v3+, data-collection opportunity only.
- **§8.3 AI-generated coaching commentary** — natural-language verdict layer. Bridge to paid tier.
- **§8.4 Paid coach marketplace** — freemium funnel, coach-pushes-split-back integration.
- **§8.5 Macro/nutrition recommendations** — distinct product surface, v3+.
- **§8.6 Learned readiness model** — replace static multiplier with per-user fit, once readiness data accumulates.
- **§9.8–§9.11 design decisions** — visual goal interaction, check-in cadence, coach marketplace model, App Store launch timing. Decide when post-v1 tracks are scheduled.

---

## Part 5: Resolved Decisions (scoping)

1. **RPE/RIR → ships with recommender v1 (folded into step 3).** Spec called it "the single largest accuracy improvement." Step 5 in the original build order is collapsed into step 3.
2. **AI-assisted muscle group suggestions → deferred.** User will manually tag own exercises. Revisit when opening to other users.
3. **Supabase backend → deferred.** localStorage-only is fine for v1. Revisit when starting §8 tracks.

---

## Part 6: Verification Approach

Each build step has an explicit validation gate before merging.

- **After step 1 (weight fix):** run `getExercisePRs` against `debug-backup.json` before and after. Confirm no phantom PRs on post-2026-04-02 unilateral sets. Spot-check the "Last:" hint in preview on an exercise logged in unilateral mode.
- **After step 2 (IDs + dedup):** spot-check that known duplicates merge correctly ("Seated Cable Row" vs "Seated cable row", "DB Lateral Raises" vs "Lateral DB Raises"). Verify exercise history continuity across workout types (e.g. pec lateral raises performed in both push and push2 share history under the canonical ID).
- **After step 3 (recommender v1):** pick the three high-confidence exercises from spec §5 (Pec Dec, Chest Supported Wide Row, Seated Cable Row). Hand-calc Layer 1–3 math against the user's actual recent history. Verify the app's recommendation matches.
- **After step 4 (readiness):** complete the three-tap flow in preview end-to-end. Confirm aggressiveness multiplier applies (e.g. Deload day bypasses Layer 3). Verify session record has the `readiness` block.
- **Every step:** `npx vite build --outDir /tmp/test-build` before merge. `preview_start` per `.claude/launch.json` for runtime smoke.
- **Migration safety:** run the v1→v2 migration against `debug-backup.json` (copy to a scratch file) before pointing it at real localStorage. Confirm session counts, exercise counts, and PR counts are stable.
