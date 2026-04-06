# Share Card Redesign — Implementation Spec

> Status: Approved mockup at `src/pages/log/ShareCardTiers.jsx`
> Target file: `src/pages/log/ShareCard.jsx` (full rewrite)
> Touches: `ShareCard.jsx`, `BbLogger.jsx`, `History.jsx`, `helpers.js`

---

## Overview

Replace the current scrollable share card with a fixed-viewport trading card that always fits one screen. Add a tiered card rarity system driven by the user's workout streak, and a "Share" button that exports the card as a JPEG via the Web Share API.

---

## Design Reference

The approved mockup lives at `src/pages/log/ShareCardTiers.jsx`. Use it as the pixel-accurate visual reference. Navigate to `/#/mockup/common` through `/#/mockup/mythic` in the running app to see all five tiers rendered.

---

## Card Layout (top to bottom)

All tiers share the same layout. Only border/color treatment changes per tier.

### 1. Tier Badge Row
- Left: tier label ("COMMON", "RARE", etc.) in tier color, 9px, weight 800, letter-spacing 2.5px, uppercase
- Right: "GAINS" in #ffffff33, 9px, weight 600

### 2. Photo Window
- Margin: 8px 14px from card edges
- Border-radius: 14px
- Aspect ratio: **4:3** (fixed — this is how the user knows what they're framing)
- Border: 2px solid, tier-specific color
- Content: user's selfie (object-fit: cover) or the "Add a selfie" button
- The selfie camera/retake flow stays the same as current (`CameraCapture.jsx`)

### 3. Workout Title + Meta
- Padding: 4px 16px 0
- Workout name: `{emoji} {workoutName}`, 24px, weight 900, white, line-height 1.1, letter-spacing -0.02em
- Meta line below: `{userName} · {dateStr} · {durationStr}` separated by 3px dot dividers, 11px, #ffffff55

### 4. Exercise List
- Padding: 10px 16px 4px
- **Max 6 exercises shown.** If the session has more, show first 6 + "+N more exercises" overflow line
- Each exercise row:
  - Green ✓ (10px, #22C55E) — flex-shrink: 0
  - Exercise name: 12px, weight 600, #ffffffCC, truncate with ellipsis
  - PR badge (if applicable): "PR" in #FCD34D, 8px, weight 800, on #FCD34D22 bg, border-radius 3px
  - Top set: "weight × reps" format, 11px, #ffffff44, flex-shrink: 0
- Dividers between rows: 1px solid, tier-specific divider color
- Exercises sorted by completion order (same as current `exerciseSummary`)

### 5. Stats Bar
- Margin: 4px 12px 12px
- Border-radius: 12px
- Background: tier-specific gradient
- Border: 2px solid, tier-specific color
- **4 cells, equal width:**
  1. **VOL** — formatted volume (e.g., "21k lbs"), #ffffffDD
  2. **SETS** — total working+drop sets, #ffffffDD
  3. **STREAK** — workout streak + 🔥, #FB923C
  4. **GRADE** — session grade letter, color-coded (A+: accent, A: #34D399, B: #60A5FA, C: #FBBF24, D: #F87171)
- Value: 17px, weight 800. Label: 8px, weight 700, uppercase, #ffffff44

### 6. Card Frame
- Max-width: 380px, centered
- Border-radius: 20px
- Outer border: tier-specific (solid color for common/rare/epic, animated gradient for legendary/mythic)
- Inner border inset: 1px, tier-specific color at 26% opacity, 5-6px inset, border-radius 16px
- Box-shadow: tier-specific glow

---

## Tier System

The tier is determined by `getWorkoutStreak(sessions, rotation)` at the time the share card is shown.

| Tier | Streak | Label Color | Border | Card BG | Special Effects |
|---|---|---|---|---|---|
| Common | 0–5 | User's accent color | 3px solid accent | #111111 | None |
| Rare | 6–14 | #C0C0C0 (silver) | 3px solid silver | #111114 | None |
| Epic | 15–19 | #FFD700 (gold) | 3px solid gold | #12110D | None |
| Legendary | 20–49 | #FF6B2B (orange) | Animated gradient (orange/red/gold) | #110D0A | Shimmer border animation |
| Mythic | 50+ | #E879F9 (pink/purple) | Animated gradient (purple/cyan/pink) | #0D0A11 | Shimmer border + sparkle particles |

### Animated Gradient Border (Legendary & Mythic)

Uses a CSS mask trick to create an animated border:
- A full-size div with `padding: 3px` and the gradient background
- `background-size: 300% 300%` with `animation: shimmer-border 4s ease infinite`
- Masked using `-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)` with `-webkit-mask-composite: xor`
- Legendary gradient: `linear-gradient(135deg, #FF6B2B, #FF4500, #FFD700, #FF6B2B)`
- Mythic gradient: `linear-gradient(135deg, #E879F9, #8B5CF6, #06B6D4, #EC4899, #E879F9, #8B5CF6)`

### Mythic Sparkle Particles

12 absolutely-positioned 4px white circles scattered randomly across the card. Each has:
- `animation: sparkle {1.5–3.5s random} ease-in-out {0–2s random delay} infinite`
- `box-shadow: 0 0 4px #fff, 0 0 8px #E879F9`
- `pointer-events: none`, contained within the card

### CSS Keyframes Required

```css
@keyframes shimmer-border {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1); }
}
```

---

## Data Requirements

The share card currently receives a `data` prop with this shape:

```javascript
{
  userName, workoutName, workoutEmoji, dateStr, durationStr,
  totalVolume, totalSets, totalPRs, exerciseSummary, grade,
  cardio, theme
}
```

### Changes needed:

1. **Add `streak` to the data object.** Both callers must provide it:
   - `BbLogger.jsx` (line ~1750, the `setSummaryData` call): add `streak: getWorkoutStreak(sessions, activeSplit?.rotation)`
   - `History.jsx` (`buildShareData` function, line ~161): add `streak: getWorkoutStreak(sessions, activeSplit?.rotation)` — will need to access `sessions` and active split rotation from the store

2. **Add `tier` to the data object (or compute it inside ShareCard).** Recommended: compute `tier` inside ShareCard from `streak`:
   ```javascript
   function getTier(streak) {
     if (streak >= 50) return 'mythic'
     if (streak >= 20) return 'legendary'
     if (streak >= 15) return 'epic'
     if (streak >= 6)  return 'rare'
     return 'common'
   }
   ```

3. **The `theme` prop is still used** for the Common tier (accent color drives borders/glow). Other tiers use their own hardcoded color palettes.

4. **`exerciseSummary` needs a top set extracted.** Currently each entry has `{ name, sets, hasPR, notes }`. The share card needs a formatted top set string per exercise. Either:
   - Extract inside ShareCard (recommended — keeps callers unchanged): find the working set with highest weight, format as `"${weight} × ${reps}"`
   - Or add `topSet` to each summary entry at the caller

5. **`totalPRs` is no longer shown in the stat bar** (replaced by streak), but keep it in the data object — it's still used for the per-exercise PR badges.

---

## JPEG Export & Share Button

### Layout
Two buttons below the card (outside the captured area):
- **"Share" button**: ghost style (`#ffffff12` bg, `1px solid #ffffff1A` border), with ↗ icon
- **"Done" button**: accent-colored, solid

### Implementation

1. **Install `html2canvas`:**
   ```
   npm install html2canvas
   ```

2. **Capture flow:**
   - The card div gets a `ref` (`cardRef`)
   - "Share" button calls:
     ```javascript
     import html2canvas from 'html2canvas'

     async function handleShare() {
       const canvas = await html2canvas(cardRef.current, {
         backgroundColor: '#050505',
         scale: 2,  // retina quality
         useCORS: true,
       })
       const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92))
       const file = new File([blob], 'gains-workout.jpg', { type: 'image/jpeg' })

       if (navigator.canShare?.({ files: [file] })) {
         await navigator.share({
           files: [file],
           title: `${workoutName} — Gains`,
         })
       } else {
         // Fallback: download the image
         const url = URL.createObjectURL(blob)
         const a = document.createElement('a')
         a.href = url
         a.download = 'gains-workout.jpg'
         a.click()
         URL.revokeObjectURL(url)
       }
     }
     ```

3. **Important:** The card `ref` div must NOT include the Share/Done buttons — only the card itself gets captured. The buttons sit outside the ref'd container.

4. **iOS Safari note:** `navigator.share({ files })` works on iOS 15+ Safari. The `canShare` check handles older browsers gracefully with a download fallback.

---

## Caller Changes

### BbLogger.jsx

In the save handler (~line 1750), update the `setSummaryData` call:

```javascript
// Add these imports at top
import { getWorkoutStreak } from '../../utils/helpers'

// In the save handler, add streak to summaryData:
const activeSplit = splits.find(s => s.id === activeSplitId)
setSummaryData({
  userName: settings.userName || '',
  workoutName,
  workoutEmoji,
  dateStr,
  durationStr,
  totalVolume,
  totalSets,
  totalPRs,
  exerciseSummary,
  grade,
  cardio,
  theme,
  streak: getWorkoutStreak(sessions, activeSplit?.rotation),  // NEW
})
```

Note: `getWorkoutStreak` may already be imported (check). `sessions`, `splits`, and `activeSplitId` should already be available from the store destructure at the top of the component.

### History.jsx

In the `buildShareData` function (~line 161):

```javascript
// The function signature needs sessions and rotation:
function buildShareData(session, settings, theme, splits, attachedCardio, sessions) {
  // ... existing code ...
  const activeSplit = splits.find(s => /* active split logic */) || splits[0]
  return {
    // ... existing fields ...
    streak: getWorkoutStreak(sessions, activeSplit?.rotation),  // NEW
  }
}
```

The caller in `SessionDetail` already has access to sessions via `useStore()` — pass it through.

---

## Cleanup After Implementation

1. **Delete mockup files:**
   - `src/pages/log/ShareCardMockup1.jsx`
   - `src/pages/log/ShareCardMockup2.jsx`
   - `src/pages/log/ShareCardTiers.jsx`

2. **Remove mockup routes from `App.jsx`:**
   - Delete the `ShareCardMockup1`, `ShareCardMockup2`, `ShareCardTiers` imports
   - Delete the `/mockup1`, `/mockup2`, `/mockup/:tier` Route entries

3. **Install html2canvas:** `npm install html2canvas`

---

## Acceptance Criteria

- [ ] Card fits one screen on iPhone SE (smallest supported viewport) with no scrolling
- [ ] Photo window is always 4:3, framed within the card
- [ ] Exercise list caps at 6 with "+N more" overflow
- [ ] Stat bar shows VOL, SETS, STREAK (with 🔥), GRADE
- [ ] Common tier uses user's accent color for borders/glow
- [ ] Rare/Epic/Legendary/Mythic tiers match the mockup colors exactly
- [ ] Legendary border animates (shimmer gradient)
- [ ] Mythic has shimmer border + sparkle particles
- [ ] Share button exports card as JPEG and opens iOS share sheet
- [ ] Fallback to download on browsers without Web Share API
- [ ] Share/Done buttons are NOT included in the exported image
- [ ] Works from both BbLogger (post-save) and History (view share card)
- [ ] Selfie camera/retake flow still works
- [ ] Streak is calculated at share card render time from the store
- [ ] Mockup files and routes cleaned up after implementation
