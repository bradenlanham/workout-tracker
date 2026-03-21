import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  {
    emoji: '📊',
    title: 'How Many Sets?',
    items: [
      'Always start with at least 1 warm-up set.',
      'Then do at least 2 working sets.',
      'Do 3–4 working sets if you connect well with the exercise.',
    ],
  },
  {
    emoji: '🔢',
    title: 'How Many Reps?',
    items: [
      '8–12 reps on your first working set (heaviest set).',
      'On subsequent working sets, aim for 12–15 reps.',
      'Increase weight once you can complete all reps at the top of the range.',
    ],
  },
  {
    emoji: '💪',
    title: 'Hypertrophy Basics',
    items: [
      'Pause at the apex of each rep — feel the muscle contract.',
      'Go slow on the negative (lowering) phase.',
      'Use the full range of motion every rep.',
      'Prioritize form and isolation over heavy weight.',
    ],
  },
  {
    emoji: '🏃',
    title: 'Cardio Guidelines',
    subsections: [
      {
        label: 'Fat Loss Cardio — 2–3×/week (great on rest days)',
        items: [
          '20 min stairmaster',
          '20 min walking incline treadmill',
          '20 min stationary bike',
        ],
      },
      {
        label: 'HIIT — 2×/week',
        items: [
          'Run or bike',
          '1:1 work-to-rest ratio',
          '1 min on, 1 min off — 4 sets (8 min total)',
          'Increase duration by 30 sec each month',
        ],
      },
    ],
  },
]

export default function Guide() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 z-30 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 shrink-0"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">Training Guide</h1>
            <p className="text-xs text-gray-500">Principles for hypertrophy</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-2">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{section.emoji}</span>
              <h2 className="text-base font-bold">{section.title}</h2>
            </div>

            {/* Simple bullet list */}
            {section.items && (
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-gray-600 shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Subsections (cardio) */}
            {section.subsections && (
              <div className="space-y-4">
                {section.subsections.map((sub) => (
                  <div key={sub.label}>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">{sub.label}</p>
                    <ul className="space-y-1.5">
                      {sub.items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-300">
                          <span className="text-gray-600 shrink-0 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
