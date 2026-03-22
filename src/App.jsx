import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore'
import HamburgerMenu from './components/HamburgerMenu'
import RestTimer from './components/RestTimer'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import Progress from './pages/Progress'
import Guide from './pages/Guide'
import BbLogger from './pages/log/BbLogger'
import TemplateEditor from './pages/TemplateEditor'
import SplitEditor from './pages/SplitEditor'
import SplitManager from './pages/SplitManager'
import SplitBuilder from './pages/SplitBuilder'
import Welcome from './pages/Welcome'

function ThemedApp() {
  const { settings, initSplits, sessions, hasCompletedOnboarding } = useStore()

  useEffect(() => {
    const theme = settings.backgroundTheme === 'daylight' ? 'daylight' : 'obsidian'
    document.documentElement.setAttribute('data-theme', theme)
  }, [settings.backgroundTheme])

  // Auto-create the built-in split on first load if splits array is empty
  useEffect(() => {
    initSplits()
  }, []) // eslint-disable-line

  // Show welcome screen for new users who haven't completed onboarding
  const isNewUser = !hasCompletedOnboarding && sessions.length === 0

  return (
    <div className="min-h-screen bg-base text-c-primary max-w-lg mx-auto relative">
      <Routes>
        <Route path="/" element={<Navigate to={isNewUser ? '/welcome' : '/dashboard'} replace />} />
        <Route path="/welcome" element={isNewUser ? <Welcome /> : <Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/log" element={<Log />} />
        <Route path="/log/bb/:type" element={<BbLogger />} />
        <Route path="/history" element={<History />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/templates/new" element={<TemplateEditor />} />
        <Route path="/templates/:id" element={<TemplateEditor />} />
        <Route path="/split" element={<SplitEditor />} />
        <Route path="/splits" element={<SplitManager />} />
        <Route path="/splits/new" element={<SplitBuilder />} />
        <Route path="/splits/edit/:id" element={<SplitBuilder />} />
      </Routes>
      <HamburgerMenu />
      <RestTimer />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ThemedApp />
    </HashRouter>
  )
}
