import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore'
import HamburgerMenu from './components/HamburgerMenu'
import BottomNav from './components/BottomNav'
import RestTimer from './components/RestTimer'
import Toast from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import Progress from './pages/Progress'
import Guide from './pages/Guide'
import BbLogger from './pages/log/BbLogger'
import StartHyroxOverlay from './pages/log/StartHyroxOverlay'
import HyroxRoundLogger from './pages/log/HyroxRoundLogger'
import HyroxSessionSummary from './pages/log/HyroxSessionSummary'
import CardioLogger from './pages/CardioLogger'
import TemplateEditor from './pages/TemplateEditor'
import SplitManager from './pages/SplitManager'
import SplitCanvas from './pages/SplitCanvas'
import ChooseStartingPoint from './pages/ChooseStartingPoint'
import Welcome from './pages/Welcome'
import Backfill from './pages/Backfill'
import ExerciseLibraryManager from './pages/ExerciseLibraryManager'
import { getTheme, applyAccentToRoot, setCustomAccentHex } from './theme'

function ThemedApp() {
  const { settings, initSplits, initLibrary, sessions, hasCompletedOnboarding } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const theme = settings.backgroundTheme === 'daylight' ? 'daylight' : 'obsidian'
    document.documentElement.setAttribute('data-theme', theme)
  }, [settings.backgroundTheme])

  // Batch 49 — prime the custom-hex cache SYNCHRONOUSLY during render so
  // any child component that reads getTheme('custom') in its own render
  // path gets the right value on first paint (no yellow flash before the
  // user's custom color kicks in). Side-effect-free idempotent assignment.
  setCustomAccentHex(settings.customAccentHex)

  // Inject the CSS variables on <html> for the .accent-* classes after
  // commit. Named themes paint directly via Tailwind class strings, so this
  // is a no-op for them. Re-runs whenever accentColor or customAccentHex
  // changes so a picked color applies instantly.
  useEffect(() => {
    const t = getTheme(settings.accentColor, settings.customAccentHex)
    applyAccentToRoot(t)
  }, [settings.accentColor, settings.customAccentHex])

  // Auto-create the built-in split + seed the exercise library on first
  // load. Both are idempotent — no-op on returning users.
  useEffect(() => {
    initSplits()
    initLibrary()
  }, []) // eslint-disable-line

  // Show welcome screen for new users who haven't completed onboarding
  const isNewUser = !hasCompletedOnboarding && sessions.length === 0

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-base text-c-primary max-w-lg mx-auto relative">
        <Routes>
          <Route path="/" element={<Navigate to={isNewUser ? '/welcome' : '/dashboard'} replace />} />
          <Route path="/welcome" element={isNewUser ? <Welcome /> : <Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/log/bb/:type" element={<BbLogger />} />
          {/* Batch 42 — Start HYROX overlay (mockup 2). */}
          <Route path="/log/hyrox/:exerciseId/start" element={<StartHyroxOverlay />} />
          {/* Batch 43 — Round logger with gym-clock timer + intra-leg comparison.
              The :roundIdx and :leg URL params track navigation continuity for
              back-button semantics; the source of truth for which round/leg
              the user is on lives in activeSession.hyrox. */}
          <Route path="/log/hyrox/:exerciseId/round/:roundIdx/:leg" element={<HyroxRoundLogger />} />
          {/* Batch 45 — HYROX session summary (mockup 4). Renders after the
              final round's station-Done navigates here from HyroxRoundLogger.
              Composes activeSession.hyrox.completedLegs into rounds[] and
              persists them onto activeSession.data.exercises so the B41
              section preview's ✓ done state lights up on Back-to-lift. */}
          <Route path="/log/hyrox/:exerciseId/summary" element={<HyroxSessionSummary />} />
          <Route path="/cardio" element={<CardioLogger />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/templates/new" element={<TemplateEditor />} />
          <Route path="/templates/:id" element={<TemplateEditor />} />
          <Route path="/splits" element={<SplitManager />} />
          {/* /splits/new/start must register BEFORE /splits/new so React
              Router v6's specificity-first matching picks it up */}
          <Route path="/splits/new/start" element={<ChooseStartingPoint />} />
          {/* Batch 17k — SplitCanvas is now the sole split editor, retiring
              the legacy 4-step wizard. */}
          <Route path="/splits/new" element={<SplitCanvas />} />
          <Route path="/splits/edit/:id" element={<SplitCanvas />} />
          <Route path="/backfill" element={<Backfill />} />
          <Route path="/exercises" element={<ExerciseLibraryManager />} />
        </Routes>
      </div>
      <HamburgerMenu open={menuOpen} setOpen={setMenuOpen} />
      <BottomNav onMenuOpen={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <RestTimer />
      <Toast />
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ThemedApp />
    </HashRouter>
  )
}
