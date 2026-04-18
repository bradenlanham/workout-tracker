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
  const [showStreakInfo, setShowStreakInfo] = useState(false)
  const [showCoachingInfo, setShowCoachingInfo] = useState(false)

  const isLogging = loc.pathname.startsWith('/log/bb/')
  if (isLogging) return null

  const close = () => { setOpen(false); setSubScreen(null); setShowDataSection(false); setShowTrackingInfo(false); setShowStreakInfo(false); setShowCoachingInfo(false) }
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

                  <button className={rowClass} style={rowStyle} onClick={() => go('/exercises')}>
                    <span>My Exercises</span>
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

                  {/* ── Profile Settings ────────────────────────────────────── */}
                  <div>
                    <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-3">Profile Settings</p>
                    <div className="space-y-4">
                      {/* Your Name */}
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

                      {/* AI Coaching (Batch 16i; scope expanded in 16q) */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-c-primary">AI coaching</p>
                          <p className="text-xs text-c-dim mt-0.5">Coach's Call tip + anomaly banners</p>
                        </div>
                        <button
                          onClick={() => updateSettings({ enableAiCoaching: !settings.enableAiCoaching })}
                          className="relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden"
                          style={{ backgroundColor: settings.enableAiCoaching ? theme.hex : undefined }}
                          aria-label="Toggle AI coaching"
                        >
                          {!settings.enableAiCoaching && <span className="absolute inset-0 rounded-full bg-item" />}
                          <span
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                            style={{ transform: settings.enableAiCoaching ? 'translateX(22px)' : 'translateX(2px)' }}
                          />
                        </button>
                      </div>

                      {/* Coach's Rec pill (Batch 16i) */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-c-primary">Show Rec pill</p>
                          <p className="text-xs text-c-dim mt-0.5">Per-exercise free-text prescription slot</p>
                        </div>
                        <button
                          onClick={() => updateSettings({ showRecPill: !settings.showRecPill })}
                          className="relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden"
                          style={{ backgroundColor: settings.showRecPill ? theme.hex : undefined }}
                          aria-label="Toggle Rec pill"
                        >
                          {!settings.showRecPill && <span className="absolute inset-0 rounded-full bg-item" />}
                          <span
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                            style={{ transform: settings.showRecPill ? 'translateX(22px)' : 'translateX(2px)' }}
                          />
                        </button>
                      </div>
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

                  <button
                    className={rowClass}
                    style={{ ...rowStyle, borderBottom: showStreakInfo ? 'none' : '1px solid var(--bg-item)' }}
                    onClick={() => setShowStreakInfo(v => !v)}
                  >
                    <span>How Streaks Work</span>
                    <span className="text-c-dim text-sm">{showStreakInfo ? '▾' : '▸'}</span>
                  </button>

                  {showStreakInfo && (
                    <div className="bg-item rounded-xl p-4 text-sm text-c-dim space-y-3 mt-1" style={{ borderBottom: '1px solid var(--bg-item)' }}>
                      <p><strong className="text-c-primary">What counts toward your streak:</strong></p>
                      <ul className="space-y-1.5 pl-2">
                        <li>🏋️ Logging a <strong className="text-c-secondary">workout</strong> → streak continues</li>
                        <li>🏃 Logging <strong className="text-c-secondary">cardio</strong> only → streak continues</li>
                        <li>😴 Logging a <strong className="text-c-secondary">rest day</strong> → streak continues</li>
                        <li>❌ Logging <strong className="text-c-secondary">nothing</strong> → streak resets to 0</li>
                      </ul>
                      <p className="pt-1"><strong className="text-c-primary">Every day has to be logged.</strong> If you don't log anything on a given day — no workout, no cardio, no rest day — your streak resets. Your rotation rest slots don't automatically bridge; you have to actually tap <strong className="text-c-secondary">Log Rest Day</strong> to keep the streak alive on an off day.</p>
                    </div>
                  )}

                  <button
                    className={rowClass}
                    style={{ ...rowStyle, borderBottom: showCoachingInfo ? 'none' : '1px solid var(--bg-item)' }}
                    onClick={() => setShowCoachingInfo(v => !v)}
                  >
                    <span>How AI Coaching Works</span>
                    <span className="text-c-dim text-sm">{showCoachingInfo ? '▾' : '▸'}</span>
                  </button>

                  {showCoachingInfo && (
                    <div className="bg-item rounded-xl p-4 text-sm text-c-dim space-y-3 mt-1" style={{ borderBottom: '1px solid var(--bg-item)' }}>
                      <p>The coach looks at your session history and suggests a weight for each exercise. It gets smarter as you log more sessions. You can turn it off any time with the AI coaching toggle in Workout Defaults.</p>

                      <p><strong className="text-c-primary">Your strength</strong></p>
                      <p>After a few sessions on an exercise, the coach estimates your one-rep max using your top working set (the heaviest set where you hit your reps). A common formula turns sets like 180 × 10 into an estimated one-rep max of about 240 lbs. The estimate updates every session.</p>

                      <p><strong className="text-c-primary">Today's suggestion</strong></p>
                      <p>From your strength estimate and the target rep range for the exercise, the coach picks a weight you should be able to handle for that many reps. If your progression trend is going up, it bumps the weight a little, capped at 3% per week so the jump is sustainable.</p>

                      <p><strong className="text-c-primary">Your check-in</strong></p>
                      <p>Before each session you tap three things: energy (low, mid, high), sleep (poor, mid, good), and today's goal (Recover, Match, or Push). Push is the default. Recover tells the coach to prescribe an easier day. Match keeps things steady. Poor sleep or low energy makes Push nudge more conservatively; feeling fresh makes it nudge harder.</p>

                      <p><strong className="text-c-primary">What the coach watches between sessions</strong></p>
                      <ul className="space-y-1.5 pl-2">
                        <li>Your last session's <strong className="text-c-secondary">grade</strong> (A+ means push harder, D means back off)</li>
                        <li>Whether you did <strong className="text-c-secondary">all-out cardio</strong> in the last 24 hours</li>
                        <li>Whether you logged a <strong className="text-c-secondary">rest day</strong> recently</li>
                        <li>How many days <strong className="text-c-secondary">since your last session</strong> (long gaps get ramped back up gradually, not all at once)</li>
                      </ul>

                      <p><strong className="text-c-primary">When you miss your reps</strong></p>
                      <p>If you fall one rep short, the coach keeps the same weight next time and tells you to chase the full rep target. If you fall two or more reps short two sessions in a row, the coach automatically prescribes a 10% deload to let you reset before pushing again.</p>

                      <p><strong className="text-c-primary">Anomaly banners</strong></p>
                      <p>On each exercise card, the coach flags three things:</p>
                      <ul className="space-y-1.5 pl-2">
                        <li><strong className="text-c-secondary">Plateau</strong> — six or more sessions flat, no movement up or down. Suggests dropping 10% and chasing reps to break through.</li>
                        <li><strong className="text-c-secondary">Regression</strong> — a clear downward trend. Suggests a lighter recovery week.</li>
                        <li><strong className="text-c-secondary">Swing</strong> — your top set jumped more than 30% from last time. Asks if you used a different machine or range of motion.</li>
                      </ul>
                      <p>Dismissing a banner hides it for the rest of today's session. It returns next session if the pattern is still there.</p>

                      <p><strong className="text-c-primary">What the coach won't do</strong></p>
                      <ul className="space-y-1.5 pl-2">
                        <li>Your data never leaves your device. No cloud, no account.</li>
                        <li>The suggestion is a starting point, not a rule. Lift what feels right.</li>
                        <li>For the first couple sessions of an exercise, the coach says nothing. It waits until it has enough history to be useful.</li>
                      </ul>
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
