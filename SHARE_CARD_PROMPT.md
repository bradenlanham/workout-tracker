# Claude Code Initiation Prompt

Copy and paste this entire message into Claude Code to kick off the implementation:

---

Read `CLAUDE.md` first, then read `SHARE_CARD_SPEC.md`. You're implementing a full rewrite of the Share Card feature.

**What you're building:** Replace the current `src/pages/log/ShareCard.jsx` with a trading-card-style share card that has 5 visual tiers (Common → Rare → Epic → Legendary → Mythic) based on the user's workout streak. The card must always fit one screen (no scrolling), export as JPEG via the Web Share API, and look like a collectible trading card.

**Before writing any code:**
1. Read `SHARE_CARD_SPEC.md` — it has the complete spec including layout, tier definitions, CSS animations, data changes, caller changes, and acceptance criteria.
2. Look at the approved visual mockup at `src/pages/log/ShareCardTiers.jsx` — this is your pixel reference for all 5 tiers. Match it exactly.
3. Run `npm install html2canvas` for the JPEG export.

**Implementation order:**
1. Rewrite `src/pages/log/ShareCard.jsx` with the new trading card layout and tier system. Keep the same component interface (`data`, `onDone`, `sessionId`, `onUpdateSession`, `initialSelfie` props).
2. Add `streak` to the share data in both callers:
   - `src/pages/log/BbLogger.jsx` (~line 1750, the `setSummaryData` call)
   - `src/pages/History.jsx` (the `buildShareData` function ~line 161)
3. Add the JPEG export + share button using `html2canvas` and `navigator.share()`.
4. Clean up: delete `ShareCardMockup1.jsx`, `ShareCardMockup2.jsx`, `ShareCardTiers.jsx`, and remove their imports + routes from `App.jsx`.
5. Validate the build compiles with `npx vite build --outDir /tmp/test-build`.
6. Update `CLAUDE.md`: remove the "PENDING REDESIGN" note from the Share Card section, replace with final feature description, add to Recent Changes, remove the mockup route from the routes table.

**Critical constraints:**
- The card must fit one screen on iPhone SE. Max 380px width. No scrolling.
- Photo window is exactly 4:3 aspect ratio with 14px border-radius.
- Exercise list maxes out at 6 entries with "+N more" overflow.
- Stat bar: VOL | SETS | STREAK 🔥 | GRADE (streak replaces PRs).
- Common tier uses the user's accent color (`theme.hex`). Other tiers use hardcoded palettes from the spec.
- Legendary and Mythic tiers have animated gradient borders (CSS `shimmer-border` keyframe).
- Mythic has sparkle particle overlay.
- The Share/Done buttons must be OUTSIDE the `cardRef` div so they don't appear in the exported JPEG.
- Never run git commands from the sandbox. Give me PowerShell commands to run locally.
