// ESLint config — focused on bug-class prevention, NOT style.
//
// Catching the two bugs we shipped today:
//   - missedYesterdayWorkout dangling ref → caught by `no-undef`.
//   - CreateExerciseModal hooks-after-early-return → caught by
//     `react-hooks/rules-of-hooks`.
//
// The exhaustive-deps rule is downgraded to `warn` rather than `error`
// because there are legitimate intentional violations (refs, stable
// callbacks) that would otherwise need eslint-disable on every line.
//
// Style rules (semi, quotes, indent) are off — we don't want a churn pass
// on 100+ files for cosmetic deltas. Add Prettier later if desired.

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // Bug-class prevention — keep these as errors.
    'no-undef': 'error',
    'react-hooks/rules-of-hooks': 'error',

    // Useful but noisy — warn so they show in editor but don't block builds.
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],

    // Style/preference — off.
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '.claude',
    '*.config.js',
    '*.config.cjs',
    '*-sanity.mjs',
    'streak-debug.mjs',
    'migration*.mjs',
    'recommender-sanity.mjs',
    'fatigue-sanity.mjs',
    'anomaly-sanity.mjs',
    'readiness-sanity.mjs',
    'draft-sanity.mjs',
    'gym-tags-sanity.mjs',
    'equipment-instance-sanity.mjs',
    'rep-range-sanity.mjs',
    'hybrid-*.mjs',
    'hyrox-*.mjs',
  ],
}
