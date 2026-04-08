import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import useStore from '../store/useStore'
import { THEMES, getTheme } from '../theme'

export default function HamburgerMenu({ open, setOpen }) {
  const loc       = useLocation()
  const navigate  = useNavigate()
  const { settings, updateSettings, exportData, importData } = useStore()
  const theme     = getTheme(settings.accentColor)
  const [subScreen, setSubScreen]       = useState(null) // null | 'settings' | 'info'
  const [showDataSection, setShowDataSection] = useState(false)
  const [showTrackingInfo, setShowTrackingInfo] = useState(false)

  const isLogging = loc.pathname.startsWith('/log/bb/')
  if (isLogging) return null

  const close = () => { setOpen(false); setSubScreen(null); setShowDataSection(false); setShowTrackingInfo(false) }
  const go = (path) => { navigate(path); close() }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        const json = event.target.result
        if (!window.confirm('This will replace your current data with the backup. Continue?')) return
        const ok = importData(json)
        if (ok) {
          const count = (() => { try { return JSON.parse(json).sessions?.length ?? 0 } catch { return 0 } })()
          alert(`Data restored! ${count} session${count !== 1 ? 's' : ''} imported.`)
          close()
        } else {
          alert('Invalid backup file. Please select a file exported from this app.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Shared row style
  const rowClass = 'w-full flex items-center justify-between text-base text-c-primary text-left'
  const rowStyle = { padding: '14px 0', borderBottom: '1px solid var(--bg-item)' }

  const themeColors = Object.values(THEMES)

  return (
    <>
      {/* ── Slide-in menu ─────────────────────────────────────────────────────── */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={close} />

          <div
            className="fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-card z-50 flex flex-col shadow-2xl"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
            }}
          >
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pb-4 border-b border-c-base">
              {subScreen ? (
                <button
                  onClick={() => setSubScreen(null)}
                  className="flex items-center gap-1 text-c-dim hover:text-c-primary transition-colors text-sm"
                >
                  ← Back
                </button>
              ) : (
                <span className="text-lg font-bold">Menu</span>
              )}
              {subScreen && (
                <span className="text-base font-bold absolute left-1/2 -translate-x-1/2">
                  {subScreen === 'settings' ? 'Settings' : 'Info'}
                </span>
              )}
              <button
                onClick={close}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-item text-c-dim"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Body ────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 pt-2">

              {/* ── Main menu ───────────────────────────────────────────────── */}
              {!subScreen && (
                <>
                  <button className={rowClass} style={rowStyle} onClick={() => go('/splits')}>
                    <span>My Splits</span>
                    <span className="text-c-dim">→</span>
                  </button>

                  <button className={rowClass} style={rowStyle} onClick={() => setSubScreen('settings')}>
                    <span>Settings</span>
                    <span className="text-c-dim">→</span>
                  </button>

                  <button className={rowClass} style={rowStyle} onClick={() => setSubScreen('info')}>
                    <span>Info</span>
                    <span className="text-c-dim">→</span>
                  </button>

                  {/* Manage Data (collapsible) */}
                  <button
                    className={rowClass}
                    style={{ ...rowStyle, borderBottom: showDataSection ? 'none' : '1px solid var(--bg-item)' }}
                    onClick={() => setShowDataSection(v => !v)}
                  >
                    <span>Manage Data</span>
                    <span className="text-c-dim text-sm">{showDataSection ? '▾' : '▸'}</span>
                  </button>

                  {showDataSection && (
                    <div style={{ borderBottom: '1px solid var(--bg-item)' }}>
                      <button
                        className="w-full text-left text-base text-c-secondary py-3 pl-4 hover:text-c-primary transition-colors"
                        onClick={() => { exportData(); close() }}
                      >
                        Export Data
                      </button>
                      <button
                        className="w-full text-left text-base text-c-secondary py-3 pl-4 hover:text-c-primary transition-colors"
                        onClick={handleImport}
                      >
                        Import Data
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── Settings sub-screen ─────────────────────────────────────── */}
              {subScreen === 'settings' && (
                <div className="space-y-6 pt-4">

                  {/* ── Appearance ──────────────────────────────────────────── */}
                  <div>
                    <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-3">Appearance</p>
                    <div className="space-y-4">
                      {/* Theme */}
                      <div>
                        <p className="text-sm font-semibold text-c-primary mb-2">Theme</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateSettings({ backgroundTheme: 'obsidian' })}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                              settings.backgroundTheme !== 'daylight'
                                ? `${theme.bg} text-white`
                                : 'bg-item text-c-secondary'
                            }`}
                            style={settings.backgroundTheme !== 'daylight' ? { color: theme.contrastText } : undefined}
                          >
                            Obsidian
                          </button>
                          <button
                            onClick={() => updateSettings({ backgroundTheme: 'daylight' })}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                              settings.backgroundTheme === 'daylight'
                                ? `${theme.bg} text-white`
                                : 'bg-item text-c-secondary'
                            }`}
                            style={settings.backgroundTheme === 'daylight' ? { color: theme.contrastText } : undefined}
                          >
                            Daylight
                          </button>
                        </div>
                      </div>

                      {/* Accent Color */}
                      <div>
                        <p className="text-sm font-semibold text-c-primary mb-2">Accent Color</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                          {themeColors.map(t => (
                            <button
                              key={t.id}
                              onClick={() => updateSettings({ accentColor: t.id })}
                              title={t.name}
                              style={{
                                backgroundColor: t.hex,
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                outline: settings.accentColor === t.id
                                  ? `2px solid ${t.id === 'white' ? '#888' : '#fff'}`
                                  : 'none',
                                outlineOffset: '2px',
                                border: t.id === 'white' ? '1px solid #555' : 'none',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Workout Defaults ─────────────────────────────────────── */}
                  <div>
                    <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-3">Workout Defaults</p>
                    <div className="space-y-4">
                      {/* Default first set type */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-c-primary">Default first set</p>
                          <p className="text-xs text-c-dim mt-0.5">Warmup or working</p>
                        </div>
                        <div className="flex gap-1 bg-item rounded-xl p-0.5 shrink-0">
                          <button
                            onClick={() => updateSettings({ defaultFirstSetType: 'warmup' })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                            style={settings.defaultFirstSetType !== 'working'
                              ? { backgroundColor: theme.hex, color: theme.contrastText }
                              : undefined}
                          >
                            Warm
                          </button>
                          <button
                            onClick={() => updateSettings({ defaultFirstSetType: 'working' })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                            style={settings.defaultFirstSetType === 'working'
                              ? { backgroundColor: theme.hex, color: theme.contrastText }
                              : undefined}
                          >
                            Work
                          </button>
                        </div>
                      </div>

                      {/* Auto-start rest timer */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-c-primary">Auto-start rest timer</p>
                          <p className="text-xs text-c-dim mt-0.5">After logging a working set</p>
                        </div>
                        <button
                          onClick={() => updateSettings({ autoStartRest: !settings.autoStartRest })}
                          className="relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden"
                          style={{ backgroundColor: settings.autoStartRest ? theme.hex : undefined }}
                          aria-label="Toggle auto-start rest timer"
                        >
                          {!settings.autoStartRest && <span className="absolute inset-0 rounded-full bg-item" />}
                          <span
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                            style={{ transform: settings.autoStartRest ? 'translateX(22px)' : 'translateX(2px)' }}
                          />
                        </button>
                      </div>

                      {/* Rest timer chime */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-c-primary">Rest timer chime</p>
                          <p className="text-xs text-c-dim mt-0.5">Play sound when timer ends</p>
                        </div>
                        <button
                          onClick={() => updateSettings({ restTimerChime: !settings.restTimerChime })}
                          className="relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden"
                          style={{ backgroundColor: settings.restTimerChime ? theme.hex : undefined }}
                          aria-label="Toggle rest timer chime"
                        >
                          {!settings.restTimerChime && <span className="absolute inset-0 rounded-full bg-item" />}
                          <span
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                            style={{ transform: settings.restTimerChime ? 'translateX(22px)' : 'translateX(2px)' }}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Account ──────────────────────────────────────────────── */}
                  <div>
                    <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-3">Account</p>
                    <div>
                      <p className="text-sm font-semibold text-c-primary mb-2">Your Name</p>
                      <input
                        type="text"
                        value={settings.userName || ''}
                        onChange={e => updateSettings({ userName: e.target.value })}
                        placeholder="Your name"
                        className="w-full bg-item text-c-primary rounded-xl px-3 py-2.5 text-sm placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* ── Info sub-screen ─────────────────────────────────────────── */}
              {subScreen === 'info' && (
                <>
                  <button className={rowClass} style={rowStyle} onClick={() => go('/guide')}>
                    <span>Guide</span>
                    <span className="text-c-dim">→</span>
                  </button>

                  <button
                    className={rowClass}
                    style={{ ...rowStyle, borderBottom: showTrackingInfo ? 'none' : '1px solid var(--bg-item)' }}
                    onClick={() => setShowTrackingInfo(v => !v)}
                  >
                    <span>How Tracking Works</span>
                    <span className="text-c-dim text-sm">{showTrackingInfo ? '▾' : '▸'}</span>
                  </button>

                  {showTrackingInfo && (
                    <div className="bg-item rounded-xl p-4 text-sm text-c-dim space-y-2 mt-1" style={{ borderBottom: '1px solid var(--bg-item)' }}>
                      <p>Sessions save to today's date automatically.</p>
                      <p>Your split advances after each logged session.</p>
                      <p>Streak = consecutive calendar days with a session.</p>
                      <p>Weekly stats reset every Monday.</p>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </>
      )}
    </>
  )
}
