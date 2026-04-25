// Batch 42 — Cycling-headline bank for the Start HYROX overlay.
//
// Per design doc §13. 30 entries across three tiers (serious / coach voice /
// playful). Selection logic is in `helpers.js` → `pickHeadline(lastShownIndex)`,
// which avoids back-to-back repeats. The selected index persists in
// `settings.lastHyroxHeadlineIndex` so re-opening the same overlay shows the
// same line (only NEW Start HYROX events draw a new headline).

export const HYROX_HEADLINES = [
  // Tier 1 — serious, locked-in
  'Lock in.',
  'Earn it.',
  'Time to work.',
  'The clock starts now.',
  'Pace, not panic.',
  'Built for this.',
  'Quiet legs. Loud lungs.',
  'Show up for it.',
  'Eyes ahead. Move.',
  'One round at a time.',

  // Tier 2 — coach voice, motivating
  'You against last week.',
  'Smooth is fast.',
  'Every round counts.',
  'Hold the pace.',
  'Trust the work.',
  "Don't think. Move.",
  'Make her sweat.',
  'This is the part you came for.',
  'Outwork yesterday.',
  'Run it back.',

  // Tier 3 — playful, light
  'Time to suffer fluently.',
  "Let's get rude.",
  'Gather, dear, we lift.',
  "Cardio o'clock.",
  'The vibes are aerobic.',
  'Knees up, sass on.',
  "Your lungs called. They're charging hourly.",
  'Mile by mile, station by station.',
  'Sprint now, brunch later.',
  'The treadmill misses you.',
]
