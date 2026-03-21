import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { THEMES, getTheme } from '../theme'

const NAV_LINKS = [
  { to: '/log',      label: 'Log Workout', emoji: '➕' },
  { to: '/history',  label: 'History',     emoji: '📋' },
  { to: '/progress', label: 'Progress',    emoji: '📈' },
  { to: '/guide',    label: 'Guide',       emoji: '📖' },
]

export default function HamburgerMenu() {
  const loc       = useLocation()
  const navigate  = useNavigate()
  const { settings, updateSettings, exportData } = useStore()
  const theme     = getTheme(settings.accentColor)
  const [open, setOpen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Hide entirely on logging sub-routes (BbLogger / HyroxLogger have their own nav)
  const isLogging = loc.pathname.startsWith('/log/bb/') || loc.pathname.startsWith('/log/hyrox/')
  if (isLogging) return null

  const close = () => setOpen(false)

  const go = (path) => { navigate(path); close() }

  return (
    <>
      {/* ── Fixed hamburger trigger ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))', right: '1rem' }}
        className="fixed z-40 w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-800"
        aria-label="Open menu"
      >
        <span className="w-5 h-0.5 bg-gray-300 rounded-full" />
        <span className="w-5 h-0.5 bg-gray-300 rounded-full" />
        <span className="w-3.5 h-0.5 bg-gray-300 rounded-full self-start ml-[5px]" />
      </button>

      {/* ── Slide-in menu ───────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-gray-900 z-50 flex flex-col shadow-2xl"
            style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
          >
            {/* Close */}
            <div className="flex items-center justify-between px-5 pb-5 border-b border-gray-800">
              <span className="text-lg font-bold">Menu</span>
              <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Mode toggle */}
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">Mode</p>
                <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => updateSettings({ activeMode: 'bb' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      settings.activeMode === 'bb' ? `${theme.bg} text-white` : 'text-gray-400'
                    }`}
                  >
                    🏋️ BB
                  </button>
                  <button
                    onClick={() => updateSettings({ activeMode: 'hyrox' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      settings.activeMode === 'hyrox' ? `${theme.bg} text-white` : 'text-gray-400'
                    }`}
                  >
                    🏃 HYROX
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">Navigate</p>
                <div className="space-y-1">
                  {NAV_LINKS.map(link => (
                    <button
                      key={link.to}
                      onClick={() => go(link.to)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                        loc.pathname === link.to ? `${theme.bgSubtle} ${theme.text}` : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-lg w-6 text-center">{link.emoji}</span>
                      <span className="font-semibold">{link.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme */}
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">Accent Colour</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.values(THEMES).map(t => (
                    <button
                      key={t.id}
                      onClick={() => updateSettings({ accentColor: t.id })}
                      title={t.name}
                      className={`w-9 h-9 rounded-full transition-all ${
                        settings.accentColor === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
                      }`}
                      style={{ backgroundColor: t.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">More</p>
                <div className="space-y-1">
                  <button
                    onClick={() => go('/split')}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                      loc.pathname === '/split' ? `${theme.bgSubtle} ${theme.text}` : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-lg w-6 text-center">📅</span>
                    <span className="font-semibold">Manage Split</span>
                  </button>
                  <button
                    onClick={() => { exportData(); close() }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:bg-gray-800 text-left"
                  >
                    <span className="text-lg w-6 text-center">💾</span>
                    <span className="font-semibold">Export Data</span>
                  </button>
                  <button
                    onClick={() => setShowInfo(v => !v)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:bg-gray-800 text-left"
                  >
                    <span className="text-lg w-6 text-center">ⓘ</span>
                    <span className="font-semibold">How Tracking Works</span>
                  </button>
                  {showInfo && (
                    <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400 space-y-2 mt-1">
                      <p>📅 Sessions save to today's date automatically.</p>
                      <p>🔄 Your split (Push → Legs → Pull…) advances after each logged session.</p>
                      <p>🔥 Streak = consecutive calendar days with a session.</p>
                      <p>📊 Weekly stats reset every Monday.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
