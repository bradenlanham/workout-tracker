import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme, THEMES } from '../theme'

const themeColors = Object.values(THEMES)

export default function Welcome() {
  const navigate = useNavigate()
  const { settings, addSplit, setActiveSplit, completeOnboarding, updateSettings } = useStore()
  const importRef = useRef(null)

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [importError, setImportError] = useState(null)
  const [pendingDestination, setPendingDestination] = useState('dashboard')

  // Recalculate theme on every render so Step 3 previews update live
  const theme = getTheme(settings.accentColor)

  const handleNameNext = () => {
    if (!name.trim()) return
    updateSettings({ userName: name.trim() })
    setStep(2)
  }

  const handleUseBlueprint = () => {
    setPendingDestination('dashboard')
    setStep(3)
  }

  const handleBuildOwn = () => {
    setPendingDestination('splits-new')
    setStep(3)
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
        setPendingDestination('dashboard')
        setStep(3)
      } catch {
        setImportError("Couldn't read file — make sure it's a valid JSON export.")
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleDone = () => {
    completeOnboarding()
    if (pendingDestination === 'splits-new') {
      navigate('/splits/new', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  // ── Step 1: Name ────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-base text-c-primary flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-xs" style={{ animation: 'fadeInUp 0.4s ease both' }}>
          <h1 className="text-center font-bold mb-6" style={{ fontSize: 20 }}>
            What should we call you?
          </h1>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleNameNext()}
            placeholder="Your name"
            autoFocus
            className="w-full bg-card text-c-primary text-center rounded-2xl px-4 py-4 focus:outline-none placeholder-gray-500"
            style={{ fontSize: 18 }}
          />
          <button
            onClick={handleNameNext}
            disabled={!name.trim()}
            className={`w-full mt-4 py-4 rounded-2xl font-bold text-base transition-all ${
              name.trim()
                ? `${theme.bg} active:scale-[0.98]`
                : 'bg-card opacity-40 cursor-not-allowed'
            }`}
            style={name.trim() ? { color: theme.contrastText } : undefined}
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: Split selection ─────────────────────────────────────────────────
  if (step === 2) {
    const displayName = name.trim() || 'there'
    return (
      <div
        className="min-h-screen bg-base text-c-primary flex flex-col px-5"
        style={{ paddingTop: 'max(5rem, env(safe-area-inset-top, 5rem))' }}
      >
        <div className="mb-8" style={{ animation: 'fadeInUp 0.4s ease both' }}>
          <h1 className="text-2xl font-bold mb-1">Hey {displayName}.</h1>
          <p className="text-c-muted text-base">Pick how you want to start.</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={handleUseBlueprint}
            className={`w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98] ${theme.bg}`}
            style={{
              color: theme.contrastText,
              animation: 'fadeInUp 0.4s ease both',
              animationDelay: '0.05s',
            }}
          >
            <p className="font-bold text-base leading-tight mb-1">Use BamBam's Blueprint</p>
            <p className="text-sm leading-snug" style={{ opacity: 0.7 }}>Pre-built 5-day bodybuilding split</p>
          </button>

          <button
            onClick={handleBuildOwn}
            className="w-full text-left rounded-2xl p-5 bg-card border border-white/10 transition-all active:scale-[0.98]"
            style={{ animation: 'fadeInUp 0.4s ease both', animationDelay: '0.1s' }}
          >
            <p className="font-bold text-base leading-tight mb-1 text-c-primary">Build Your Own</p>
            <p className="text-sm leading-snug text-c-muted">Create a custom program</p>
          </button>

          <button
            onClick={() => importRef.current?.click()}
            className="w-full text-left rounded-2xl p-5 bg-card border border-white/10 transition-all active:scale-[0.98]"
            style={{ animation: 'fadeInUp 0.4s ease both', animationDelay: '0.15s' }}
          >
            <p className="font-bold text-base leading-tight mb-1 text-c-primary">Import a Split</p>
            <p className="text-sm leading-snug text-c-muted">From a coach or friend</p>
          </button>
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />

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

  // ── Step 3: Theme & Accent ──────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-base text-c-primary flex flex-col px-5"
      style={{ paddingTop: 'max(5rem, env(safe-area-inset-top, 5rem))' }}
    >
      <div className="mb-8" style={{ animation: 'fadeInUp 0.4s ease both' }}>
        <h1 className="text-2xl font-bold mb-1">Make it yours.</h1>
        <p className="text-c-muted text-base">Choose your look.</p>
      </div>

      <div
        className="flex flex-col gap-6 w-full max-w-sm"
        style={{ animation: 'fadeInUp 0.4s ease both', animationDelay: '0.05s' }}
      >
        {/* Theme toggle */}
        <div>
          <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-2">Theme</p>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ backgroundTheme: 'obsidian' })}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                settings.backgroundTheme !== 'daylight'
                  ? `${theme.bg}`
                  : 'bg-card text-c-secondary'
              }`}
              style={settings.backgroundTheme !== 'daylight' ? { color: theme.contrastText } : undefined}
            >
              Obsidian
            </button>
            <button
              onClick={() => updateSettings({ backgroundTheme: 'daylight' })}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                settings.backgroundTheme === 'daylight'
                  ? `${theme.bg}`
                  : 'bg-card text-c-secondary'
              }`}
              style={settings.backgroundTheme === 'daylight' ? { color: theme.contrastText } : undefined}
            >
              Daylight
            </button>
          </div>
        </div>

        {/* Accent colors */}
        <div>
          <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-3">Accent Color</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {themeColors.map(t => (
              <button
                key={t.id}
                onClick={() => updateSettings({ accentColor: t.id })}
                title={t.name}
                style={{
                  backgroundColor: t.hex,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  outline: settings.accentColor === t.id
                    ? `3px solid ${t.id === 'white' ? '#888' : '#fff'}`
                    : 'none',
                  outlineOffset: 3,
                  border: t.id === 'white' ? '1px solid #555' : 'none',
                  transition: 'outline 0.1s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Done */}
        <button
          onClick={handleDone}
          className={`w-full mt-2 py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] ${theme.bg}`}
          style={{ color: theme.contrastText }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
