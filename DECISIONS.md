# Workout Tracker — Architecture & Product Decisions

> Living document. Every major decision for the next phase of the app (rename, iOS shipment, backend, monetization, coaches, social) lives here with its current answer. Update as decisions are made or revisited.
>
> **Working title:** TBD (see §1.5 — "Gains" is retired due to App Store name collisions)
>
> Last updated: April 15, 2026 (PR model refactored — see §11 decision log)
> Status key: ✅ Decided · 🟡 Leaning · ⬜ Open · 🔄 Revisit later

---

## ⭐ START HERE — Order of Operations

> **Purpose:** If you open this doc and don't know what to work on next, this section is the answer. Work top-down. Don't skip ahead — earlier items unblock later ones. When an item is done, check it off and move to the next one.
>
> **Rule:** The first unchecked item is your next action. Always.

### 🎯 Current next action
> **#2 — Start an expense tracking spreadsheet.** Google Sheets, one row per expense, columns for date, vendor, amount, category, purpose, and receipt link. Every project expense from today forward — Claude subscription, Vercel, future Apple Developer fee, domain, Supabase, test devices — goes here. This is doubly important now that item #1 is resolved under a "personal time, personal equipment" theory: contemporaneous personal-card receipts are part of the paper trail proving the project is yours. See §10.8.

---

### Tier 0 — Do this today (15 minutes of admin, zero code)

- [x] **1. Verify employment contract allows side projects** — ✅ Resolved April 8, 2026. Reviewed School AI PIIA (signed April 7, 2025) and offer letter. PIIA Section 2 explicitly limits IP assignment to "the fullest extent allowed by Utah Code Ann. Section 34-39-3," which carves out inventions created (a) entirely on the employee's own time and (b) that are not "employment inventions." School AI is an education AI company; a consumer fitness tracker is not related to its current or demonstrably anticipated business, so Gains is not an employment invention. PIIA Section 6 non-compete is limited to competitive activity (fitness ≠ education AI). Offer letter Section 11 echoes the same scope. Build will continue on personal devices, personal time, personal accounts, personal paid subscriptions — creating the paper trail that supports the Utah 34-39-3 carve-out. Not pursuing a formal HR disclosure.
- [ ] **2. Start an expense tracking spreadsheet.** Columns: date, vendor, amount, category, purpose, receipt link. Every project expense goes here starting now — Claude subscription, existing Vercel costs, future Apple Developer fee, domain, Supabase, etc. Google Sheets is fine. This is a tax deduction now and a real P&L later.
- [ ] **3. Save today's backup of your own app data** via the existing JSON export. You are a beta user too. Proof the export works end-to-end.

### Tier 1 — This week (foundation, before writing any new code)

- [ ] **4. Audit the JSON export for completeness.** Open the exported file and verify it captures EVERY field the app uses: sessions, splits, activeSession, settings (all of them), cardioSessions, customCardioTypes, customTemplates, workoutSequence, exerciseLibrary, splits.rotation, plate breakdowns, unilateral flags, selfies, soreness, pause state, schemaVersion (doesn't exist yet — add it), etc. If there are gaps, fix the export code before touching anything else. The beta migration plan depends on this being 100% faithful.
- [ ] **5. Manually collect backup JSON files from every current beta user.** Text them, ask them to tap Export, send you the file. Store them somewhere safe (not just your laptop — email them to yourself, or drop them in a private cloud folder). These are your insurance policy against every downstream migration step.
- [ ] **6. Brainstorm new app name.** Constraints from §1.5: App Store unique, .com or .app domain available, Instagram/TikTok/X @handle available, trademark-clear (search USPTO TESS), pronounceable, short. Generate 15–20 candidates, pre-screen to 3–5 that clear all checks, then sit with them for a few days before committing. I can help brainstorm and pre-screen — just say the word.
- [ ] **7. Add `schemaVersion` field to Zustand persisted state.** Even just `schemaVersion: 1` with no migration logic yet. This is the foundation for every future data migration and it must land BEFORE any schema changes. See §9.3.

### Tier 2 — This month (legal/business setup, runs in parallel with Tier 3)

- [ ] **8. Form a single-member LLC in your home state.** File directly with the Secretary of State (~$50–$500 + annual fee varies by state) or use Northwest Registered Agent (~$39 + state fee). Do NOT file in Delaware unless you're taking VC money. See §10 for full details.
- [ ] **9. Get an EIN from the IRS.** Free, 10 minutes online at irs.gov. Do this the same week the LLC is formed.
- [ ] **10. Open a business checking account** in the LLC's name. Mercury, Relay, or a local credit union. Capitalize it with a small transfer from personal. Every project expense flows through this account from here forward — NO commingling with personal spending. This is the step that actually preserves liability protection.
- [ ] **11. Apply for a free D-U-N-S number** from Dun & Bradstreet. Required for Apple Developer Organization enrollment. Takes 1–2 weeks, so start it as soon as the LLC exists.
- [ ] **12. One-hour consultation with an accountant.** $150–$300. Bring the expense spreadsheet, the LLC paperwork, and a summary of the monetization plan. Ask specifically: what to deduct, whether S-Corp election makes sense, quarterly estimated taxes.
- [ ] **13. Draft a privacy policy and terms of service.** Use a generator (Termly, iubenda, or have Claude draft one) tailored for a fitness app with subscriptions. Host at a stable URL — probably yourapp.com/privacy and /terms. Required for App Store submission.

### Tier 3 — This month (code hardening, runs in parallel with Tier 2)

- [ ] **14. Add Sentry (crash + error reporting) to the current app.** Free tier is plenty. Wire in a React error boundary. This is #1 in the risk section for a reason — once beta grows, silent failures become invisible. See §9.10.
- [ ] **15. Set up Vitest + write unit tests for the high-stakes pure functions.** Target: `getNextBbWorkout`, `getWorkoutStreak`, `getRotationItemOnDate`, `getExercisePRs`, session volume math, plate math combinations (plate mode × unilateral × 1×/2×). See §9.9, §9.15. Not full coverage — just a regression net for the things that have already broken.
- [ ] **16. Downscale selfies before save.** Interim mitigation for storage bloat: resize to ~400px wide, 70% JPEG quality, before writing to state. See §9.2.
- [ ] **17. Add a stale-active-session guard.** On app open, if `activeSession.startTimestamp` is more than 12 hours old, show a "Resume or discard?" prompt instead of silently resuming. See §9.8.
- [ ] **18. Add a "Backup my data" reminder** to the current PWA. Weekly nudge if no export in the last 7 days. Visible "last backed up" indicator in Settings. See §9.1.
- [ ] **19. Audit timezone/date math.** Every place the code creates, compares, or subtracts dates. Standardize on UTC ISO strings for storage, local-date strings for display. Add `date-fns` if it helps. See §9.5.

### Tier 4 — Phase 1: Native shell (1–3 weeks, after Tiers 0–3 are done)

- [ ] **20. Enroll in Apple Developer Program as Organization** ($99/yr). Uses the LLC + D-U-N-S from Tier 2. Do NOT enroll as Individual — the upgrade path later is painful.
- [ ] **21. Install Capacitor into the existing Vite project** and generate the iOS project. Follow the official Capacitor + Vite guide.
- [ ] **22. Build and run on your own iPhone IMMEDIATELY.** Before wiring any new features. The goal is to see exactly what the current app looks and feels like in a Capacitor WKWebView, and find surprises early. Pay extra attention to the custom numpad (§9.4) and the share card rendering (§9.11).
- [ ] **23. Configure basics:** app icon, splash screen, status bar, safe area insets, portrait lock, bundle ID (now that the name is decided), display name.
- [ ] **24. Replace web camera (MediaDevices) with Capacitor Camera plugin** for the selfie capture.
- [ ] **25. Replace html2canvas share with Capacitor Share plugin + native screenshot.** See §9.11.
- [ ] **26. Wire Capacitor Haptics** into set completion, PR celebrations, and button presses.
- [ ] **27. Implement the in-app "Delete account" flow** (Apple mandate — even for a pre-cloud single-device app, they want it present).
- [ ] **28. Add a "Restore from backup" screen** that accepts a JSON file from Tiers 1/5. First-launch flow for beta users migrating from the PWA.
- [ ] **29. Privacy policy, terms, and support URLs** finalized and live.
- [ ] **30. Submit the first TestFlight build** to Apple. Invite yourself, then invite 1–2 beta users, then expand.
- [ ] **31. Coordinate beta group migration.** Walk each beta user through installing the TestFlight build and restoring their JSON backup. Verify everyone's data is intact before retiring the PWA.

### Tier 5 — Phase 2: Backend + sync (3–6 weeks)

- [ ] **32. Lock Supabase as backend** (currently 🟡 in §2.1 — upgrade to ✅) or briefly evaluate alternatives first.
- [ ] **33. Define the sync semantics document.** Write the explicit rules into §2.3 / §9.14: what syncs, what stays device-local, how conflicts resolve, how active session and rest timer behave across devices.
- [ ] **34. Create the Supabase project.** Schema per §2.5 draft, RLS policies from day one, separate dev and prod projects.
- [ ] **35. Implement Sign in with Apple + email/password** auth via Supabase.
- [ ] **36. Build the sync layer:** push on session finish, pull on app open, background retry for failed pushes.
- [ ] **37. First-login data migration flow:** auto-backup → upload existing local data to cloud → mark account as seeded.
- [ ] **38. Move selfies to Supabase Storage** with signed URLs. Retroactively migrate existing base64 selfies out of localStorage.
- [ ] **39. Seed beta user accounts server-side** from their collected JSON backups (Tier 1 step 5), so they log in and find their data already present.
- [ ] **40. Add automatic daily backups of the Supabase DB** (built-in on Pro plan; manual otherwise).
- [ ] **41. Submit Phase 2 to TestFlight.**

### Tier 6 — Monetization infrastructure (can start during Phase 2)

- [ ] **42. Create a RevenueCat account** and wire the iOS SDK into the app.
- [ ] **43. Configure StoreKit products** in App Store Connect: paid, pro, and coach tiers (placeholder prices ok).
- [ ] **44. Wire RevenueCat → Supabase entitlements webhook** so backend knows who has what tier.
- [ ] **45. Build the entitlements feature-flag system** in code. Single `entitlements` concept, feature checks keyed to tier, never to product IDs. See §3.1.
- [ ] **46. Build the paywall UI.** Defer pricing (§3.9) but ship the UI.
- [ ] **47. Enable the free trial via StoreKit Introductory Offer.** 14-day Pro trial, no credit card (§3.2).
- [ ] **48. Flip monetization on for a small beta group** before wider launch.

### Tier 7 — Decision point: Coaches OR Social next?

- [ ] **49. Make the call: Phase 3 (Coaches) or Phase 4 (Social) first.** Current leaning is Social first because it's a growth engine and makes Coaches more valuable later. Revisit when you get here based on what beta users are actually asking for.
- [ ] **50. MVP scope doc for whichever you pick.** Add to §4 or §5.

### Tier 8 — Strategic check-in (revisit every quarter)

- [ ] **51. Answer the Section 8 open strategic questions.** Business goal, ideal early user, one metric that matters, runway, solo vs. collaborators, 3/6/12 month success definition. You can't build the right thing without these.

---

## 0. Guiding Principles

- **A.** ✅ **Mobile-first, offline-first.** The gym is the primary environment. Nothing in the app can require connectivity to log a workout.
- **B.** ✅ **Local-first, cloud-synced.** Zustand remains the runtime source of truth during a session; cloud is a sync layer, not a dependency.
- **C.** ✅ **Don't throw away the codebase.** Current React/Vite/Zustand stack is the foundation. No rewrites unless forced.
- **D.** ✅ **Defer pricing, commit to tier shape.** Exact prices are TBD; code must support multiple entitlement levels from day one.
- **E.** 🟡 **Ship fast, iterate with real users.** Prefer TestFlight with a small group over perfecting behind closed doors.
- **F.** ✅ **Zero data loss for existing beta users.** A test group is already 2–3 weeks deep into daily use. Any migration path — PWA → native, local → cloud, schema change — MUST preserve their sessions, splits, PRs, streaks, and settings exactly. This is non-negotiable and blocks any phase that touches data.

---

## 1. Native Shipment (Phase 1 — iOS)

### 1.1 How do we get to iOS?
- **A. Decision:** ✅ **LOCKED — Capacitor (wrap existing React app).** This app will never be PWA-only. iOS is the destination.
- **B. Alternatives considered and rejected:** React Native rewrite (throws away the codebase), Expo (same problem), PWA-only (dead end — not an App Store path, no IAP, unreliable iOS push).
- **C. Rationale:** Preserves 100% of current codebase (Tailwind, Zustand, Recharts, html2canvas, custom numpad all work unchanged); fastest path to App Store; full access to native APIs via plugins; used in production by thousands of apps.
- **D. Not revisiting.** Research budget is better spent on testing an actual Capacitor build on a real iPhone early in Phase 1 to surface WebView quirks when they're cheap to fix.

### 1.2 What native APIs do we need at launch?
- **A.** ⬜ Haptics (set completion, PR moments) — likely yes
- **B.** ⬜ Native Camera plugin (replace web MediaDevices for selfie) — likely yes
- **C.** ⬜ Native Share plugin (replace html2canvas-only flow) — likely yes
- **D.** ⬜ Push notifications (APNs) — yes, but may defer actual notification content to Phase 2
- **E.** ⬜ Screen orientation lock — already handled in CSS/JS, verify on native
- **F.** ⬜ Status bar styling
- **G.** ⬜ Safe area insets
- **H.** ⬜ Keyboard avoidance (the custom numpad changes this calculus — verify)

### 1.3 Router compatibility
- **A.** ⬜ Keep HashRouter or switch to BrowserRouter in Capacitor shell?
- **B. Note:** HashRouter works fine inside Capacitor's WebView; leave it alone unless there's a specific reason to change.

### 1.4 Data migration from PWA → native (BETA USER BLOCKER)
- **A.** 🔄 **Existing beta testers have 2–3 weeks of daily data in the current PWA's localStorage. They cannot lose it.** This is the highest-priority constraint on the Phase 1 migration path.
- **B.** ⬜ PWA localStorage is sandboxed separately from Capacitor's native WebView storage — they are not the same origin and do NOT share data automatically.
- **C. Migration approach (draft):**
  1. Before shipping the native app, add a "Backup my data" button to the current PWA that downloads a JSON file (the existing export flow already does this — verify it captures EVERYTHING: sessions, splits, active session, settings, cardio, custom types, soreness, etc.).
  2. On first launch of the native app, show a one-time "Restore from backup" screen prompting the user to import the JSON.
  3. For beta users specifically: manually collect their backup JSONs before the native app ships and seed their accounts server-side during Phase 2, so they don't have to do anything.
- **D.** ⬜ Alternative considered: a server-side bridge where the PWA uploads its localStorage blob to a temporary endpoint keyed by email, then the native app pulls it down. Cleaner UX but requires backend work in Phase 1, which defeats the point of Phase 1 being lean.
- **E. Current leaning:** 🟡 Manual backup/restore for v1 + personally hand-hold the beta group through the migration. Move to automatic cloud sync once Phase 2 ships.
- **F.** ⬜ **Pre-migration audit required:** Before writing any migration code, verify the current JSON export captures every field the app uses. If there are gaps, fix the export first.

### 1.5 App Store basics
- **A.** ⬜ Apple Developer account enrollment ($99/yr) — not yet done
- **B.** 🔄 **App name — BLOCKER.** "Gains" is taken (existing app "Gain"); multiple "Gains Workout Tracker" variants also exist. Need a new name before anything else in Phase 1 can lock. Criteria to consider: (a) available on App Store, (b) available as a .com or .app domain, (c) available as @handle on Instagram/X/TikTok, (d) trademark-clear in the US, (e) pronounceable and short, (f) works as a verb or noun in-app copy.
- **C.** ⬜ Bundle ID (depends on name)
- **D.** ⬜ App icon set
- **E.** ⬜ Splash screen
- **F.** ⬜ Privacy policy URL (required)
- **G.** ⬜ Terms of service URL (required)
- **H.** ⬜ Support URL (required)
- **I.** ⬜ Screenshots for all required device sizes
- **J.** ⬜ App Store category (Health & Fitness)
- **K.** ⬜ Age rating questionnaire

### 1.6 Required App Store compliance items
- **A.** ⬜ **Delete account flow** (Apple mandate — must be in-app, not just email)
- **B.** ⬜ **App Tracking Transparency prompt** (if any analytics)
- **C.** ⬜ Report user / block user (only if social ships at launch)
- **D.** ⬜ Sign in with Apple (required if any other third-party auth is offered)

### 1.7 iPad support?
- **A.** ⬜ Ship iPhone-only at v1, add iPad later? Or universal binary?
- **B. Current leaning:** 🟡 iPhone-only for v1. The `max-w-lg` constraint already works on iPad in landscape letterbox mode. Revisit when coach dashboard lands (Phase 3) — coaches genuinely benefit from a wider layout.

---

## 2. Backend & Sync (Phase 2)

### 2.1 Backend platform
- **A. Decision:** 🟡 Supabase (Postgres + Auth + Realtime + Storage + RLS)
- **B. Alternatives considered:** Firebase, custom Node + Postgres, Convex
- **C. Rationale:** Postgres is right for relational data (coach/client links, follows, session history). RLS is the cleanest access-control model for multi-tenant user data. Already have Supabase tools wired up. Can self-host later if needed.
- **D. Open:** Lock this in before Phase 2 begins, or evaluate alternatives first?

### 2.2 Auth strategy
- **A.** ⬜ Sign in with Apple (required by Apple if any third-party auth exists)
- **B.** ⬜ Email + password via Supabase Auth
- **C.** ⬜ Google Sign-In?
- **D. Current leaning:** 🟡 Start with Sign in with Apple + email/password. Add Google later if demand exists.

### 2.3 Sync model
- **A. Decision:** ✅ Local-first with cloud backup. Zustand stays the runtime store during workouts. A thin sync layer pushes completed sessions and split changes to Supabase when online.
- **B.** ⬜ Sync direction: push-only, pull-on-open, realtime subscription, or hybrid?
- **C. Current leaning:** 🟡 Push on session finish + pull on app open. Realtime only for coach/social features.

### 2.4 Conflict resolution
- **A.** ⬜ What happens if user logs on two devices offline?
- **B. Current leaning:** 🟡 Last-write-wins per session (sessions are immutable once finished, so conflicts should be rare). Splits need stronger handling — maybe last-edit-wins with a warning.

### 2.5 Schema (draft)
- **A.** ⬜ `profiles` (id, display_name, email, avatar_url, accent_color, theme, created_at)
- **B.** ⬜ `splits` (id, owner_id, name, emoji, is_built_in, created_at)
- **C.** ⬜ `split_workouts` (id, split_id, name, emoji, sections_json, order)
- **D.** ⬜ `split_rotations` (split_id, order_index, workout_id_or_rest)
- **E.** ⬜ `sessions` (id, user_id, split_id, workout_id, date, duration_sec, grade, notes, selfie_url, soreness_json)
- **F.** ⬜ `session_exercises` (id, session_id, name, order_index, unilateral, notes)
- **G.** ⬜ `session_sets` (id, exercise_id, type, reps, weight, raw_weight, is_pr, plates_json, bar_weight)
- **H.** ⬜ `cardio_sessions` (id, user_id, session_id_nullable, type, duration, distance, intensity, hr_min, hr_max, notes)
- **I.** ⬜ `entitlements` (user_id, tier, expires_at, source)
- **J. Open:** Do sets stay as JSON on the exercise row, or normalize to their own table? (Normalize — better for analytics.)

### 2.6 Selfie storage
- **A.** ⬜ Supabase Storage vs. keep as base64 in DB
- **B. Current leaning:** 🟡 Supabase Storage with signed URLs. Base64 bloats rows and kills sync performance.

### 2.7 Existing localStorage data migration (BETA USER BLOCKER)
- **A.** 🔄 **Beta users must transition from local-only → cloud-synced without any data loss.** See Section 1.4 for the PWA → native piece; this section covers the local → cloud piece.
- **B.** ⬜ On first login to the native app with a Supabase account, the app uploads the entire local Zustand state to the new account as a seed, then switches to sync mode.
- **C.** ⬜ What if a user signs in on a second device before the first device has finished uploading? Device A has 100 sessions locally, Device B has 0. We need a "first upload wins, later devices pull down" rule — and a safeguard that prevents Device B from overwriting Device A's data with an empty state.
- **D.** ⬜ **Safety net:** Before the first cloud upload runs, auto-download a JSON backup to the device as a fallback. If something goes wrong, the user (or we) can restore manually.
- **E. Current leaning:** 🟡 First login on a device with existing local data triggers (a) a local JSON backup, (b) an upload of local data to the cloud, (c) a flag marking this account as "seeded." Subsequent logins on other devices pull down from cloud and never overwrite.

---

## 3. Monetization & Entitlements

### 3.1 Tier shape
- **A. Decision:** ✅ Four entitlement levels: `free`, `paid`, `pro`, `coach`
- **B. Note:** Specific feature breakdown per tier is TBD. Code must use a single `entitlements` concept with feature flags, not hardcoded product IDs.

### 3.2 Free trial
- **A. Decision:** ✅ Yes, a free trial exists on first install.
- **B.** ⬜ Length: 7 days? 14 days?
- **C.** ⬜ Which tier does the trial unlock? (Probably Pro, so users feel the full value.)
- **D.** ⬜ Credit card required? Apple's "Introductory Offer" lets you do no-CC trials via StoreKit.
- **E. Current leaning:** 🟡 14-day Pro trial, no credit card, drops to Free after expiry.

### 3.3 Free tier — what's included?
- **A.** ⬜ Core logging loop (always free)
- **B.** ⬜ How many custom splits? (1? 3? Unlimited?)
- **C.** ⬜ History depth cap? (e.g., last 90 days?)
- **D.** ⬜ Share cards included?
- **E.** ⬜ Cardio included?

### 3.4 Paid tier — what's included?
- **A.** ⬜ Unlimited splits
- **B.** ⬜ Full history
- **C.** ⬜ All accent themes
- **D.** ⬜ Advanced stats
- **E.** ⬜ Rest timer customization

### 3.5 Pro tier — what's included?
- **A.** ⬜ Everything in Paid
- **B.** ⬜ Advanced analytics (volume landmarks, fatigue, periodization)
- **C.** ⬜ CSV / PDF export
- **D.** ⬜ Early access to new features
- **E.** ⬜ Social feed? (or is social in Free — see 5.1)
- **F.** ⬜ Richer share card tiers?

### 3.6 Coach tier — what's included?
- **A. Decision:** ✅ Everything in Pro + coach dashboard + client management + push splits to clients
- **B.** ⬜ Client count cap? (Unlimited? Tiered?)
- **C. Current leaning:** 🟡 Flat coach tier at launch with unlimited clients. Tiered pricing later if justified.

### 3.7 Billing frequency
- **A.** ⬜ Monthly, annual, or both?
- **B.** ⬜ Lifetime deal for early adopters?
- **C. Current leaning:** 🟡 Monthly + annual (annual discounted ~30%). **No lifetime** — 30% Apple cut + lost recurring revenue = regret.

### 3.8 Payment infrastructure
- **A. Decision:** ✅ StoreKit via RevenueCat wrapper.
- **B. Rationale:** Apple requires IAP for digital subscriptions on iOS — Stripe is not allowed. RevenueCat handles StoreKit hell, receipt validation, and syncs entitlement state to Supabase via webhook.

### 3.9 Pricing
- **A.** ⬜ Free trial length: ___
- **B.** ⬜ Paid tier: $___/mo, $___/yr
- **C.** ⬜ Pro tier: $___/mo, $___/yr
- **D.** ⬜ Coach tier: $___/mo, $___/yr
- **E. Note:** Defer until we have real user feedback. Comp research: Strong ($5/mo), Hevy (freemium, $6/mo Pro), Fitbod ($13/mo), Trainerize for coaches ($5–10/client/mo).

---

## 4. Coaches Module (Phase 3)

### 4.1 Relationship model
- **A.** ⬜ How does a coach link to a client?
- **B. Current leaning:** 🟡 Coach generates an invite code or link → client taps it in-app → confirms linking → relationship created. Either party can sever.

### 4.2 What can a coach see about a client?
- **A.** ⬜ All session data? Only sessions from coach-assigned splits? Client-configurable?
- **B. Current leaning:** 🟡 Client-configurable per coach. Default: all data visible. Privacy matters — RLS policies enforce it.

### 4.3 Pushing splits to clients
- **A.** ⬜ Versioning model: coach edits a split → bumps version → client sees "update available" and can accept or auto-apply
- **B.** ⬜ Can coaches force updates, or is client acceptance always required?
- **C. Current leaning:** 🟡 Client acceptance required for v1. Optional auto-apply setting per client-coach link.

### 4.4 Coach dashboard UI
- **A.** ⬜ Dedicated dashboard screen showing all clients, last session date, streak, recent volume trend, grade distribution
- **B.** ⬜ Per-client drill-down with their full history
- **C.** ⬜ Notes feature for coaches (private notes per client)
- **D.** ⬜ Messaging? (Probably defer — scope creep.)

### 4.5 Does a coach need to be a Pro user first?
- **A.** ⬜ Or does Coach tier stand alone?
- **B. Current leaning:** 🟡 Coach tier includes Pro features automatically. It's a superset.

### 4.6 Discovery
- **A.** ⬜ Can clients find coaches in-app, or is it invite-only?
- **B. Current leaning:** 🟡 Invite-only at launch. A public coach directory is a whole marketplace problem — defer.

---

## 5. Social Features (Phase 4)

### 5.1 Is social a Free feature or a paid feature?
- **A.** ⬜ Free (growth engine, Strava model) vs. Pro (monetization lever)
- **B. Current leaning:** 🟡 Free — social is an acquisition channel. Viral share cards + follower feeds drive installs.

### 5.2 Follow model
- **A.** ⬜ Symmetric (mutual friends) or asymmetric (Instagram-style)?
- **B. Current leaning:** 🟡 Asymmetric. Follow anyone; they don't need to follow back.

### 5.3 Privacy defaults
- **A.** ⬜ All profiles public by default? Private by default? Per-session visibility?
- **B. Current leaning:** 🟡 Profiles private by default. Users opt into public. Per-session "share to profile" toggle during finish flow.

### 5.4 Feed content
- **A.** ⬜ What appears in the following feed? Share cards? PR moments? Streak milestones?
- **B. Current leaning:** 🟡 Share cards as the primary feed unit. Achievements (PRs, streaks) as secondary.

### 5.5 Interactions
- **A.** ⬜ Likes? Comments? Reactions?
- **B. Current leaning:** 🟡 Likes + emoji reactions at launch. Comments deferred (moderation cost).

### 5.6 Discovery
- **A.** ⬜ Suggested users? Leaderboards? Global feed?
- **B. Current leaning:** 🟡 Following-only feed at launch. No global feed, no leaderboards. Add once there's enough content to make them meaningful.

### 5.7 Can you see someone's splits without following?
- **A.** ⬜ Public profile pages with their splits visible?
- **B. Current leaning:** 🟡 Public profiles show stats and recent share cards only. Splits are private unless the user explicitly publishes one.

### 5.8 Moderation & safety
- **A.** ⬜ Report user — required by Apple
- **B.** ⬜ Block user — required by Apple
- **C.** ⬜ Content reporting (report a share card / post)
- **D.** ⬜ Moderation queue — manual for v1, automated later

---

## 6. Cross-cutting Concerns

### 6.1 Notifications (push)
- **A.** ⬜ Rest timer done (when backgrounded)
- **B.** ⬜ Coach messages / split updates
- **C.** ⬜ Social interactions (new follower, like on your share card)
- **D.** ⬜ Streak reminders ("You haven't logged in 2 days")
- **E.** ⬜ Soreness check-in reminder

### 6.2 Analytics
- **A.** ⬜ Which tool? PostHog, Mixpanel, Amplitude, RevenueCat's built-in, Supabase events?
- **B. Current leaning:** 🟡 PostHog (self-hostable, product analytics + feature flags + session replay). Triggers ATT prompt on iOS.

### 6.3 Crash & error reporting
- **A.** ⬜ Sentry? Bugsnag?
- **B. Current leaning:** 🟡 Sentry. Required before we have paying users.

### 6.4 Feature flags
- **A.** ⬜ Use PostHog flags? LaunchDarkly? Home-rolled on Supabase?
- **B. Current leaning:** 🟡 PostHog feature flags if we adopt PostHog for analytics. Otherwise Supabase table + realtime.

### 6.5 Legal
- **A.** ⬜ Privacy policy (required for App Store)
- **B.** ⬜ Terms of service
- **C.** ⬜ GDPR data export + deletion (required if EU users)
- **D.** ⬜ CCPA (California)
- **E.** ⬜ Health data disclaimer (we're tracking exercise, not medical data, but still)

### 6.6 Backups
- **A.** ⬜ Supabase automatic backups sufficient, or do we want a user-facing export-to-file still?
- **B. Current leaning:** 🟡 Keep the JSON export/import feature. Users value control.

### 6.7 Accessibility
- **A.** ⬜ Formal WCAG 2.1 AA audit before launch?
- **B.** ⬜ VoiceOver support
- **C.** ⬜ Dynamic Type (iOS text scaling)
- **D. Current leaning:** 🟡 Basic VoiceOver labels + Dynamic Type at launch. Full audit before public launch.

---

## 7. Sequencing

### 7.1 Proposed order
- **A.** ✅ **Phase 1:** Capacitor shell → TestFlight with small beta group (1–3 weeks)
- **B.** ✅ **Phase 2:** Supabase backend + sync + auth (3–6 weeks)
- **C.** ⬜ **Phase 3 OR 4 next?** Coaches (clear monetization) vs. Social (growth engine)
- **D. Current leaning:** 🟡 Social first — creates the network effect that makes Coaches valuable.

### 7.2 What's the MVP for each phase?
- **A.** ⬜ Phase 1 MVP: Exactly today's feature set in a native shell. No new features.
- **B.** ⬜ Phase 2 MVP: Auth, upload existing data, push new sessions to cloud, pull on open. No realtime, no conflict UI.
- **C.** ⬜ Phase 3 MVP (if next): Invite flow, coach dashboard, push splits with version. No messaging, no client caps.
- **D.** ⬜ Phase 4 MVP (if next): Profile, follow, following feed of share cards, report/block. No comments, no global feed.

### 7.3 Public launch vs. private beta
- **A.** ⬜ How long does private TestFlight run before App Store release?
- **B. Current leaning:** 🟡 At least 4 weeks of private TestFlight after each phase lands.

---

## 8. Open Strategic Questions

These don't block Phase 1 but need answers before too long:

- **A.** ⬜ What's the business goal? Lifestyle indie app, venture-scale, coach marketplace, acquisition target?
- **B.** ⬜ Who is the ideal early user? Hardcore lifters? General fitness? Coached clients?
- **C.** ⬜ What's the one metric that matters? DAU? Sessions logged per week? Coach-client pairs?
- **D.** ⬜ How much runway are you giving this before evaluating?
- **E.** ⬜ Are you building this solo or bringing in collaborators?
- **F.** ⬜ What does "success" look like at 3 / 6 / 12 months?

---

## 9. Warnings & Known Risks

> Things I'm worried about based on how the app works today. Not blockers — just landmines to watch for as we move into native, cloud, and multi-user territory. Each item has a **severity** (🔴 high · 🟠 medium · 🟡 low) and the phase where it's most likely to bite us.

### 9.1 Data fragility (🔴 high — Phase 1/2)
**The entire app lives in a single localStorage key (`workout-tracker-v1`) with no backup mechanism the user can't forget to run.** This is fine for a solo hobby app; it is dangerous for a beta group with 2–3 weeks of invested data. Specific failure modes:
- **A.** iOS WKWebView can evict storage under memory pressure. Capacitor WebView is no exception. A user could open the app tomorrow and find everything gone, with no recourse.
- **B.** If Zustand's `persist` middleware throws during serialization (corrupt state, quota exceeded), we silently lose writes.
- **C.** Clearing Safari data, reinstalling the PWA, or iOS restoring from a backup that predates the PWA install all nuke the data.
- **D. No server backup exists as a safety net until Phase 2 lands.**
- **E. Mitigation:** Until Phase 2, we should add an automatic JSON backup download prompt on a recurring schedule (weekly?) and a visible "last backed up" indicator on the settings page. Low effort, high insurance.

### 9.2 Selfie storage bloat (🟠 medium — Phase 1)
Selfies are stored as base64 strings directly on the session object. A single selfie is ~100–300KB after base64 encoding. At ~5 sessions/week with selfies, that's ~1.5MB/month added to a single localStorage entry. **localStorage caps vary (5–10MB in most browsers), and hitting the cap causes silent write failures.** A beta user who's been logging daily for 2–3 weeks with selfies is already a meaningful fraction of that budget. This will break before we think it will.
- **A. Mitigation:** In Phase 2, move selfies to Supabase Storage with signed URLs. Before then, consider downscaling selfies aggressively before save (maybe 400px wide, 70% JPEG quality) or storing them in IndexedDB separately from the main state.

### 9.3 Schema evolution has no migration framework (🔴 high — all phases)
The `merge` function in Zustand's persist config handles new fields via deep merge, which works for *adding* optional fields but is silent and lossy when you *rename* or *restructure*. We have no `version` field and no explicit migration pipeline. Every state-shape change is a potential data corruption event, and we have no way to run a one-time transform on existing user data.
- **A. Example risk:** If we rename `customTemplates` to `templates`, or change `sessions[].data.exercises[].sets[].weight` to be an object instead of a number, existing users' data will be partially or fully lost at the moment of app upgrade.
- **B. Mitigation:** Add a `schemaVersion` field to the persisted state NOW. Write a proper migration system that runs version-to-version transforms on load. Do this before Phase 2 because schema changes are coming.

### 9.4 The custom numpad is a load-bearing hack (🟠 medium — Phase 1)
The numpad works by suppressing the iOS keyboard via `inputMode="none"` and using `onPointerDown` with `preventDefault` to avoid losing focus. This is a precise choreography that depends on WebView focus-management behavior. Already caused the Batch 4 stale-ref bug and required ref-backed callback patterns to fix. **Capacitor's WKWebView may behave subtly differently from Safari**, especially around:
- **A.** Keyboard avoidance interactions when the numpad overlay is open.
- **B.** Focus restoration when returning from app background.
- **C.** Scroll position preservation (Batch 8 already had to fix this).
- **D.** Safe area insets with the numpad pinned to the bottom edge.
- **E. Mitigation:** Test the numpad on a real Capacitor build on day one of Phase 1, not at the end. This is the single most likely source of "wait, it doesn't work the same" surprises.

### 9.5 Timezone and date math are historically fragile (🟠 medium — all phases)
Batch 7 already fixed a timezone bug where `daysSinceAnchor` math broke after noon local time. The streak calculation, rotation resolution, and calendar rendering all depend on getting dates right, and the current code mixes ISO strings, Date objects, and millisecond math. **This class of bug will come back every time we add cross-device sync (Phase 2), time-of-day features, or users in different timezones.**
- **A. Mitigation:** Before Phase 2, do a focused audit of every place the code creates, compares, or subtracts dates. Standardize on a single representation (UTC ISO strings for storage, local-date strings for display). Consider adding `date-fns` or similar instead of hand-rolled math.

### 9.6 Exercise identity is a string, not an ID (🟠 medium — Phase 2/3)
PRs, history, and "last time" ghost rows all match exercises by exact string name. "Bench Press" and "bench press" are different exercises. "DB Lateral Raises" and "DB Lateral Raise" are different exercises. Users already make typos. **Worse, when coaches push a split to a client and the client's local data has slightly different names, PR tracking breaks silently.** And when social launches and people compare lifts, name inconsistency will confuse everyone.
- **A. Mitigation:** Introduce an exercise ID concept backed by a canonical exercise library. Existing sessions keep their string names, but new logging resolves to IDs. This is a Phase 2 or Phase 3 task, not immediate — but we should stop making it worse in the meantime.

### 9.7 Split auto-sync of custom exercises has unclear semantics (🟡 low — Phase 1)
When a session finishes, any exercises that weren't in the template get auto-added to the split definition with "intelligent placement" based on surrounding exercises. This is a cute feature that will do surprising things at scale:
- **A.** Typo once → the typo lives in the template forever.
- **B.** Swap an exercise mid-session to try something new → it's now permanently in your split.
- **C.** When coach pushes a new version of a split, how do these auto-added exercises interact with the update?
- **D. Mitigation:** Consider making auto-sync opt-in (a small "save to template?" prompt when unexpected exercises are detected at finish time). Not urgent, but worth a conversation before coach split-pushing lands in Phase 3.

### 9.8 Active session persistence has edge cases (🟡 low — Phase 1)
The active session survives reload and backgrounding via localStorage, which is great. But:
- **A.** What if a user starts a session, closes the app, and comes back three days later? The timer resumes from three days ago, and the "current workout" is no longer the next one in rotation.
- **B.** What if a user starts a session on device A, then logs one on device B (post-Phase 2)? Which is the "active" one?
- **C.** Pause state is persisted, but there's no "this session is stale, discard?" prompt on return.
- **D. Mitigation:** Phase 1: add a stale-session detection on resume (e.g., if active session is older than 12 hours, prompt "resume or discard"). Phase 2: define multi-device active-session semantics explicitly.

### 9.9 No test coverage (🟠 medium — all phases)
CLAUDE.md mentions `npx vite build` as the only validation step. There are no unit tests, no integration tests, no regression tests. **Every bug fix in the batches 1–8 log was found by the user in production.** This is survivable for a single-user app; it's a ticking clock as soon as there are paying users, coaches managing clients, or cross-device sync to reason about.
- **A. Mitigation:** Before Phase 2, add at least a minimal test suite around the highest-stakes pure functions: `getNextBbWorkout`, `getWorkoutStreak`, `getRotationItemOnDate`, `getExercisePRs`, session volume calculation, plate math (unilateral × multiplier combinations). Vitest is a natural fit for Vite. This doesn't need to be 100% coverage — it needs to be a regression net for the things that have already broken.

### 9.10 No crash or error reporting (🔴 high — Phase 1)
Right now, if a user hits an exception, we find out by them texting you. Once the beta group grows past ~5 people, and especially once we're in TestFlight with users you don't know personally, **silent failures become invisible.** Capacitor + a React error boundary without Sentry = you will ship bugs you never hear about.
- **A. Mitigation:** Sentry (or equivalent) should land in Phase 1 alongside Capacitor, not later. Free tier is sufficient for a long time.

### 9.11 html2canvas share card export is notoriously fragile (🟠 medium — Phase 1)
html2canvas has known issues with CSS custom properties (which we use heavily for theming), web fonts, inline styles, and WebView rendering quirks. The ShareCard rewrite in Batch 6 uses all-inline styles specifically to sidestep some of these, but:
- **A.** Animated shimmer borders for Legendary/Mythic tiers use CSS keyframes that html2canvas cannot capture in motion — the exported JPEG will be a static snapshot.
- **B.** Sparkle particles on Mythic tier are animated — same issue.
- **C.** Custom fonts may not render correctly in captured output.
- **D. Capacitor's WebView may behave differently from Safari here.**
- **E. Mitigation:** When Phase 1 lands, replace html2canvas with the Capacitor Screenshot plugin or a native share action that captures the actual rendered view. Better quality, more reliable, and sidesteps the whole class of rendering-mismatch bugs.

### 9.12 Grade system is subjective and single-valued (🟡 low — Phase 3+)
Session grades (D → A+) are a nice UX touch and drive the heatmap colors, but they're (a) subjective, (b) editable retroactively, and (c) the only qualitative measure of session quality. When coaches start monitoring client progress, they'll want to see *why* a session was a "B" — was volume down? Fatigue? Missed a lift? Right now there's no structured answer.
- **A. Mitigation:** Not urgent. But if we want coaches to do real analysis, consider augmenting grades with a structured "how did it feel" scale (RPE 1–10) and free-text notes, stored separately from the grade.

### 9.13 No undo for destructive actions (🟡 low — Phase 1)
Deleting a session, deleting a split, or overwriting a split during edit have no undo path. A misclick costs a user real work.
- **A. Mitigation:** Soft-delete with a 30-day trash bin, or at minimum an "are you sure" confirmation with the item's name. Cheap to add; hard to rebuild lost data.

### 9.14 Multi-device assumptions are baked in everywhere (🔴 high — Phase 2)
The current code assumes a single device with a single local store. Once Phase 2 introduces sync, a pile of implicit invariants become explicit problems: active session on two devices, rest timer running on two devices, settings changes conflicting, PR computed locally vs. on server, streak calculated from local data vs. cloud data. **Every feature we've built will need a second pass to reason about "what if this same user is using the app on another device right now."**
- **A. Mitigation:** Phase 2 needs an explicit "sync semantics" design session before coding. Draft the rules ("active session is device-local, never syncs," "rest timer is device-local," "settings last-write-wins," etc.) and write them into this document.

### 9.15 Plate math complexity compounds (🟡 low — Phase 1)
Plate mode × unilateral × 1×/2× multiplier × bar weight cycling × per-set plate data is a lot of interacting state. Each combination is tested individually; the combinatorial space is not. Bugs here are silent — a user sees a weight that looks plausible and logs it — and corrupt historical PR data.
- **A. Mitigation:** This is the #1 candidate for the first unit tests (see 9.9). Pure functions, clear inputs/outputs, combinatorial coverage is tractable.

---

## 10. Business & Legal Setup

> **Disclaimer:** This section captures general information only. I am not a lawyer or an accountant. Before acting on any of this, confirm with professionals who know your specific situation (especially for LLC formation, tax strategy, and employment contract interpretation).

### 10.1 Employment contract review (🔴 BLOCKER, pre-everything)
- **A.** 🔄 **Verify that your current employment contract permits personal side projects, especially in fitness or consumer software.** Read the IP assignment, outside activities, moonlighting, and non-compete sections. If there's any ambiguity, ask HR in writing (email) for clarification. A depressingly high number of tech employment contracts claim ownership over side projects built on personal time, sometimes even in adjacent domains.
- **B. Why this is #1 in Order of Operations:** Every downstream step (LLC, revenue, App Store listing, beta users) compounds the cost of discovering a contract problem. Finding it now costs a conversation. Finding it after launch costs the project.
- **C. If there's a problem:** Options include getting a written carve-out from your employer, waiting until after you leave, or restructuring ownership. Talk to an employment lawyer before making any move.

### 10.2 Business structure
- **A. Decision:** 🟡 Single-member LLC, home state, formed before Apple Developer enrollment.
- **B. Alternatives considered:** Sole proprietorship (no liability protection, messy seller name on App Store, painful migration to LLC later), Delaware LLC (only makes sense for VC-backed companies), S-Corp election (reasonable later once revenue justifies payroll overhead — ask accountant).
- **C. Rationale:**
  - **i. Liability separation.** Fitness apps touch health-adjacent territory. Coach-client relationships introduce additional liability surface. LLC protection matters here more than for a to-do list app.
  - **ii. Clean seller name on App Store.** "Your LLC Name" looks more legitimate to users than a personal name.
  - **iii. Cleaner accounting.** Dedicated EIN, dedicated bank account, clean P&L, easier deductions.
- **D. Cost:** $50–$500 to file + annual fee (varies by state; $0 in some states, $800 in California).
- **E. How to file:**
  - **i.** File directly with your state's Secretary of State website (cheapest).
  - **ii.** OR use Northwest Registered Agent (~$39 + state fee, includes registered agent service — worth it if you don't want your home address in public records).
  - **iii.** Skip LegalZoom — overpriced for what you get.
- **F.** ⬜ **Home state to file in:** ___ (fill in when known)

### 10.3 EIN (Employer Identification Number)
- **A. Decision:** ✅ Required.
- **B. Cost:** Free.
- **C. How:** irs.gov → "Apply for an EIN online" → takes 10 minutes. Must be done AFTER the LLC is formed.
- **D. Why:** Opens business bank account, enrolls Apple Developer, files taxes, receives payments in LLC name.

### 10.4 Business bank account
- **A. Decision:** ✅ Required for liability protection.
- **B. Alternatives:** Mercury (free, fintech, strong for software businesses), Relay (free, good if you want multiple accounts for envelope budgeting), local credit union (free, more traditional).
- **C. Rule:** Every project expense and every project income MUST flow through this account. Commingling personal and business funds breaks LLC liability protection ("piercing the corporate veil").
- **D.** ⬜ **Bank chosen:** ___

### 10.5 D-U-N-S number
- **A. Decision:** ✅ Required for Apple Developer Organization enrollment.
- **B. Cost:** Free (Dun & Bradstreet offers it at no cost for Apple Developer Program applicants — specifically request the free version, they will try to upsell).
- **C. How long:** 1–2 weeks processing time. Start as soon as the LLC is formed and has an address.
- **D. Why not skip it and enroll as Individual?** Individual accounts list your personal name as the seller on the App Store, can't be easily transferred to the LLC later, and don't get the liability separation benefit.

### 10.6 Apple Developer Program enrollment
- **A. Decision:** ✅ Enroll as Organization (not Individual).
- **B. Cost:** $99/yr.
- **C. Prerequisites:** LLC formed, EIN issued, D-U-N-S number received, bank account open, legal name of entity matches everywhere.
- **D. Timeline:** 1–3 days processing after submission, assuming no verification holds.

### 10.7 Payments and taxes
- **A. How Apple pays:** Monthly remittance to your bank account. Apple acts as Marketplace Facilitator in most jurisdictions, handling sales tax and VAT collection/remittance — you do NOT need to register for sales tax in 50 states or deal with EU VAT yourself. This is a real benefit of the App Store route.
- **B. What you receive:** Net of Apple's cut (15% under Small Business Program for first $1M/yr, 30% after) and any foreign withholding taxes Apple deducts.
- **C. Tax reporting:** LLC income flows to personal return by default (single-member LLC = disregarded entity). You'll receive a 1099-K from Apple annually. Your accountant will handle the rest.
- **D. Quarterly estimated taxes:** If the app starts generating meaningful income, you'll owe quarterly estimated taxes to the IRS and your state. Accountant will tell you when to start.

### 10.8 Expense tracking (🔴 start immediately)
- **A. Decision:** ✅ Start a spreadsheet TODAY, LLC or not.
- **B. Columns:** date, vendor, amount, category (software, hardware, services, fees, etc.), purpose (1-line business justification), receipt link or file.
- **C. Why now:** IRS requires contemporaneous records — you can't reconstruct them at tax time. Every dollar you spend on this project is potentially a deduction against any income it generates (and if it loses money, against other income depending on "hobby loss" rules your accountant will explain).
- **D. Deductible examples:** Claude subscription, existing Vercel costs, Apple Developer fee, domain, Supabase, Sentry, RevenueCat, design tools, a test device purchased specifically for development, portion of internet bill attributable to business use, home office (if you qualify), contractor payments, stock photos, fonts, any app you pay for to help build this one.
- **E. Tool:** Google Sheets is fine at this stage. Upgrade to Wave, QuickBooks Self-Employed, or similar if/when volume justifies it.

### 10.9 Trademark
- **A. Decision:** ⬜ Defer until the name is proven and the app has revenue.
- **B. Rationale:** Trademark filings cost $250–$350 per class at USPTO, plus legal fees if you use a lawyer. Not worth it until the name is worth protecting. In the meantime, establishing common-law trademark through continuous use gives you some protection.
- **C. What to do now:** Search USPTO TESS for conflicts when picking the new name. That's the trademark equivalent of a name availability check.

### 10.10 Business insurance
- **A. Decision:** ⬜ Defer until the app has meaningful users and revenue, or coach-client liability is live.
- **B. When to revisit:** Once there are paying users, once Coaches module launches (introduces professional liability around training advice), or if you ever hire a contractor or employee.
- **C. Types to look at later:** General liability, professional liability (E&O), cyber liability. An insurance broker specializing in tech/SaaS can bundle these efficiently.

### 10.11 Accounting
- **A. Decision:** 🟡 DIY spreadsheet for now; one-time accountant consultation ($150–$300) within the first few months; ongoing bookkeeper only when volume justifies it.
- **B. What to ask the accountant:** Whether an S-Corp election makes sense, how to handle quarterly estimated taxes, which deductions are reasonable for a solo indie software business, whether your home office qualifies, how to report Apple 1099-K income.

### 10.12 Privacy policy, terms of service, support URL
- **A. Decision:** ✅ Required before App Store submission.
- **B. How:** Generate via Termly, iubenda, or similar (~$10–$30/mo or one-time). Customize the fitness-app-specific sections yourself. Have Claude review for gaps before publishing.
- **C. Hosting:** A simple static page at yourapp.com/privacy, /terms, /support. GitHub Pages or Vercel static hosting is free and sufficient.
- **D. Required disclosures:** Subscription billing terms, data collection (especially if analytics are added), data deletion process, contact method, governing law, auto-renewal language per Apple's guidelines.

### 10.13 Delete account flow (Apple mandate)
- **A. Decision:** ✅ Must be in-app, not just an email request.
- **B. Scope:** Must fully delete user data, cancel subscriptions, and confirm to the user. Cannot require contacting support.
- **C. Phase 1 approach:** Since there's no backend yet, the delete flow wipes localStorage and resets the app. Still counts as "account deletion" for Apple's purposes.
- **D. Phase 2+ approach:** Deletes the Supabase account, cascades data deletion per RLS, revokes RevenueCat entitlements, sends confirmation email.

### 10.14 GDPR and CCPA
- **A. Decision:** ⬜ Handle in Phase 2 when data goes to the cloud.
- **B. Phase 1 posture:** All data is local to the user's device. GDPR/CCPA obligations are minimal because no personal data leaves the device. Still need a privacy policy that states this.
- **C. Phase 2 obligations:** Data export (user can download all their data), data deletion (already covered by 10.13), explicit consent for EU users, appropriate Data Processing Agreement with Supabase, list of sub-processors, breach notification plan.

---

## 11. Decision Log

> Each time we lock in an answer here, add a line below with the date and what changed.

- **April 8, 2026** — Document created. Captured all decisions from initial iOS/coaches/social planning conversation.
- **April 8, 2026** — Name "Gains" flagged as unusable (App Store collision with "Gain" and multiple "Gains Workout Tracker" variants). Rename is now a Phase 1 blocker. Section 1.5 updated with naming criteria.
- **April 8, 2026** — Beta user migration elevated to a core guiding principle. Existing test group has 2–3 weeks of daily data in PWA localStorage that cannot be lost. Sections 1.4 and 2.7 rewritten with specific migration paths. Added pre-migration audit of JSON export completeness as a prerequisite to any migration code.
- **April 8, 2026** — Capacitor/iOS decision LOCKED. No longer open for revision. Section 1.1 updated.
- **April 8, 2026** — Added Section 9 "Warnings & Known Risks" — 15 risk items spanning data fragility, schema evolution, numpad fragility, timezone bugs, exercise identity, test coverage, crash reporting, html2canvas quirks, and multi-device invariants. Decision log renumbered to Section 10.
- **April 8, 2026** — Added "⭐ START HERE — Order of Operations" section at the very top of the document. Contains a single ordered list of 51 actions across 8 tiers, from "check employment contract today" through "Phase 4 decision point." Rule: the first unchecked item is always the next action. No more ambiguity about what to do next.
- **April 8, 2026** — Added Section 10 "Business & Legal Setup" covering employment contract review, LLC formation, EIN, business banking, D-U-N-S, Apple Developer enrollment, payments/taxes, expense tracking, trademark, insurance, accounting, legal documents, delete account flow, and GDPR/CCPA posture. Decision log renumbered to Section 11.
- **April 8, 2026** — Retired "Gains" as the working title of the doc itself (name collision with existing App Store apps). Title and header updated. Rename remains tracked as a blocker in §1.5.
- **April 8, 2026** — Added letter prefixes (A, B, C, ...) to every bullet inside numbered subsections across §0 and §1–§10. This gives every bullet a unique, stable reference (e.g. "§9.4 C" = the scroll-position preservation concern). Sub-bullets inside §10.2 use lowercase roman numerals (i, ii, iii). The Order of Operations list in "Start Here" already had numeric IDs 1–51 and was left alone. Purpose: make it impossible to misidentify which bullet is being discussed during review.
- **April 8, 2026** — Tier 0 item #1 resolved. Reviewed School AI Proprietary Information and Inventions Agreement (Utah, signed April 7, 2025) and offer letter. Found the IP assignment clause explicitly constrained by Utah Code 34-39-3, which protects personal-time inventions that aren't "employment inventions." School AI's business (education AI) is clearly distinct from a consumer fitness tracker, so Gains falls outside the assignment. Non-compete and "no other business activity" clauses in both documents are limited to activity related to School AI's current or anticipated business — also clear. Not pursuing formal HR disclosure; relying on statutory protection + clean personal-time/personal-equipment paper trail. "Current next action" pointer in Start Here advanced to #2 (expense tracking spreadsheet).
- **April 15, 2026** — PR model refactored to weight-anchored semantics. Previous implementation tracked `maxWeight` and `maxReps` independently, so a high-rep set at a light weight would flag as a PR, and the live logger and the `isPR` helper in `helpers.js` had drifted to two different rules. New definition, per user: a PR is a new heaviest weight (any rep count) OR matching the current heaviest weight with more reps than any prior set at that weight. Reps at sub-max weight are never a PR. Implementation: `getExercisePRs` now returns `{ maxWeight, maxRepsAtMaxWeight }`; a new `isSetPR(sessions, name, weight, reps)` helper is the single canonical check and is used by every trophy in the logger plus the save-time `isNewPR` flag. `isPR` kept as back-compat alias. Save-time flag also switched from unscoped `sessions` to `scopedSessions` so exercises shared across workout types track independently. Added an always-on "PR {maxWeight}×{maxRepsAtMaxWeight}" chip to every exercise card so users can see the threshold they're chasing (root cause of the user-reported inconsistency: ghost rows showed only last session, not all-time max, so users thought 180×7 should trophy when their actual max was already ≥180). Historical sessions retain their original `isNewPR` flags; only newly saved sessions reflect the new rule. Relevant to §9.15 test coverage plan — `isSetPR` is now the #1 candidate for the first unit tests alongside plate math.
