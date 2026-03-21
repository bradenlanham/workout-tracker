import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-900 text-gray-50 max-w-lg mx-auto relative">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/log/bb/:type" element={<BbLogger />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/templates/new" element={<TemplateEditor />} />
          <Route path="/templates/:id" element={<TemplateEditor />} />
          <Route path="/split" element={<SplitEditor />} />
        </Routes>
        <HamburgerMenu />
        <RestTimer />
      </div>
    </HashRouter>
  )
}
