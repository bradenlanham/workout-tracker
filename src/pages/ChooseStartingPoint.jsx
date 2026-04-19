import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { SPLIT_TEMPLATES } from '../data/splitTemplates'
import RestDayChip from '../components/RestDayChip'

// Batch 17f — ChooseStartingPoint (/splits/new/start). Replaces the
// zero-state drop into a blank wizard. 6 opinionated template cards
// + a Blank slate + an Import entry point. Tapping a template seeds
// `splitDraft` via the `loadTemplate` action and routes to `/splits/new`
// where SplitCanvas picks up the seeded state via its resume-banner path.
//
// Decisions baked in here:
//   D2 — all 6 templates ship now (no A/B gating)
//   D3 — rest days render as a dimmed dashed circle with R (RestDayChip)

export default function ChooseStartingPoint() {
  const navigate      = useNavigate()
  const loadTemplate  = useStore(s => s.loadTemplate)
  const clearSplitDraft = useStore(s => s.clearSplitDraft)
  const settings      = useStore(s => s.settings)
  const theme         = getTheme(settings.accentColor)

  // File input for the Import path — reused from the existing SplitManager
  // import shape. Cleaner than routing to /splits?import=1 (fewer surfaces
  // that have to know about the query string).
  const importRef = useRef(null)
  const addSplit  = useStore(s => s.addSplit)

  const handlePickTemplate = (templateId) => {
    const ok = loadTemplate(templateId)
    if (!ok) return
    // Navigate INTO the canvas — the template has already been staged in
    // `splitDraft`. SplitCanvas's mount-effect surfaces the resume banner;
    // tapping Resume populates the local state. Alternatively the user can
    // Discard to start from scratch anyway.
    navigate('/splits/new')
  }

  const handleBlank = () => {
    // Explicit blank — clear any prior draft so the wizard opens empty.
    clearSplitDraft()
    navigate('/splits/new')
  }

  const handleImport = () => importRef.current?.click()

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data?.type !== 'bambam-split-export' || !data.split) {
          navigate('/splits')       // punt to list; alert-free failure is fine at zero-state
          return
        }
        const { id: _id, ...splitData } = data.split
        addSplit({ ...splitData, isBuiltIn: false })
        navigate('/splits')
      } catch {
        navigate('/splits')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen pb-28">
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">How do you want to start?</h1>
        </div>
        <p className="text-sm text-c-muted ml-12">
          Pick a template and customize, or build from scratch.
        </p>
      </div>

      <div className="px-4 space-y-3">
        {SPLIT_TEMPLATES.map(t => (
          <TemplateCard key={t.id} template={t} onPick={handlePickTemplate} />
        ))}

        {/* Blank slate — visually distinct so it doesn't masquerade as a template */}
        <button
          type="button"
          onClick={handleBlank}
          className={`w-full bg-card rounded-2xl p-4 border-2 border-dashed ${theme.border} text-left transition-colors hover:bg-item`}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none mt-0.5" aria-hidden="true">✨</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">Blank slate</p>
              <p className="text-xs text-c-muted mt-1">
                Build from scratch. I know what I want.
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-6 text-center px-4">
        <button
          type="button"
          onClick={handleImport}
          className="text-sm text-c-secondary underline underline-offset-2"
        >
          Or import a split from a file
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>
    </div>
  )
}

// Template card — emoji + title + cycle badge, description, rotation preview
// as emoji chips (rest days rendered via shared RestDayChip).
function TemplateCard({ template, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(template.id)}
      className="w-full bg-card rounded-2xl p-4 text-left transition-colors hover:bg-item active:bg-item"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none mt-0.5" aria-hidden="true">{template.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-base leading-tight">{template.name}</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-item text-c-dim shrink-0">
              {template.cycleLengthLabel}
            </span>
          </div>
          <p className="text-xs text-c-muted mb-3">{template.description}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {template.previewEmojis.map((em, i) =>
              em === 'rest'
                ? <RestDayChip key={i} size={22} />
                : <span key={i} className="inline-flex items-center justify-center w-[22px] h-[22px] text-base leading-none" aria-hidden="true">{em}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
