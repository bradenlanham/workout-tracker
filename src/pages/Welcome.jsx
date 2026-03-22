import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'

export default function Welcome() {
  const navigate = useNavigate()
  const { settings, addSplit, setActiveSplit, completeOnboarding } = useStore()
  const theme = getTheme(settings.accentColor)
  const importRef = useRef(null)
  const [importError, setImportError] = useState(null)

  const handleUseBlueprint = () => {
    completeOnboarding()
    navigate('/dashboard', { replace: true })
  }

  const handleBuildOwn = () => {
    completeOnboarding()
    navigate('/splits/new', { replace: true })
  }

  const handleImportFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.type !== 'bambam-split-export' || !data.split) {
          setImportError('Invalid file — not a BamBam split export.')
          return
        }
        const { id: _id, ...splitData } = data.split
        const newSplit = addSplit({ ...splitData, isBuiltIn: false })
        setActiveSplit(newSplit.id)
        completeOnboarding()
        navigate('/dashboard', { replace: true })
      } catch {
        setImportError("Couldn't read file — make sure it's a valid JSON export.")
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const cards = [
    {
      emoji: '🏋️',
      title: "Use BamBam's Blueprint",
      subtitle: 'Pre-built 5-day bodybuilding split. Ready to go immediately.',
      action: handleUseBlueprint,
      accent: true,
    },
    {
      emoji: '✏️',
      title: 'Build Your Own Split',
      subtitle: 'Design a program around your own exercises and schedule.',
      action: handleBuildOwn,
      accent: false,
    },
    {
      emoji: '📥',
      title: 'Import a Split',
      subtitle: 'Got a split file from a coach or friend? Load it in one tap.',
      action: () => importRef.current?.click(),
      accent: false,
    },
  ]

  return (
    <div className="min-h-screen bg-base text-c-primary flex flex-col px-5"
      style={{ paddingTop: 'max(4rem, env(safe-area-inset-top, 4rem))' }}
    >
      {/* Logo + heading */}
      <div
        className="flex flex-col items-center text-center mb-10"
        style={{ animation: 'fadeInUp 0.5s ease both' }}
      >
        <img
          src="/icon-192.png"
          alt="BamBam"
          className="w-20 h-20 rounded-3xl mb-6 shadow-lg"
        />
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Welcome to BamBam</h1>
        <p className="text-c-muted text-base leading-relaxed max-w-xs">
          Your workout companion. Track sessions, build splits, and crush PRs.
        </p>
      </div>

      {/* Option cards */}
      <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
        {cards.map((card, i) => (
          <button
            key={card.title}
            onClick={card.action}
            style={{ animation: 'fadeInUp 0.5s ease both', animationDelay: `${0.1 + i * 0.08}s` }}
            className={`w-full text-left rounded-2xl p-5 flex items-start gap-4 transition-all active:scale-[0.98] ${
              card.accent
                ? `${theme.bg} text-white shadow-lg`
                : 'bg-card hover:bg-hover'
            }`}
          >
            <span className="text-3xl leading-none mt-0.5 shrink-0">{card.emoji}</span>
            <div className="min-w-0">
              <p className={`font-bold text-base leading-tight mb-1 ${card.accent ? 'text-white' : 'text-c-primary'}`}>
                {card.title}
              </p>
              <p className={`text-sm leading-snug ${card.accent ? 'text-white/70' : 'text-c-muted'}`}>
                {card.subtitle}
              </p>
            </div>
            <svg
              className={`w-5 h-5 shrink-0 mt-1 ${card.accent ? 'text-white/70' : 'text-c-muted'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Hidden file input */}
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Import error toast */}
      {importError && (
        <div className="fixed bottom-8 inset-x-5 z-50 max-w-sm mx-auto">
          <div className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 flex items-center gap-3">
            <p className="flex-1 text-sm text-red-400 font-medium">{importError}</p>
            <button onClick={() => setImportError(null)} className="text-red-400/70 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
