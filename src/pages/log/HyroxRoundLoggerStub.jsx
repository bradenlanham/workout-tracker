// Batch 42 — Round logger placeholder. B43 replaces this with the real
// per-leg HYROX round logger at /log/hyrox/:exerciseId/round/:roundIdx/:leg.
//
// The Begin round 1 button on StartHyroxOverlay routes here and threads the
// pre-populated prescription via location.state.prescription. B43 reads that
// state at mount and uses it to seed the round logger's leg-by-leg surface.

import { useNavigate, useParams, useLocation } from 'react-router-dom'

const YELLOW = '#EAB308'

export default function HyroxRoundLoggerStub() {
  const { exerciseId, roundIdx, leg } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const prescription = location.state?.prescription || null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black text-white text-center px-6">
      <div
        className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full mb-6"
        style={{
          background: 'rgba(234,179,8,0.12)',
          color: YELLOW,
          border: `1px solid rgba(234,179,8,0.3)`,
        }}
      >
        HYROX · Round {roundIdx} · {String(leg).toUpperCase()}
      </div>
      <h1 className="text-2xl font-bold mb-2">Round logger ships in Batch 43</h1>
      <p className="text-sm text-white/60 mb-6 max-w-sm">
        Begin round 1 wired correctly. The next batch adds the gym-clock timer and
        the per-leg Done · Stamp time flow.
      </p>
      {prescription && (
        <pre className="text-[10px] text-white/40 bg-white/5 rounded-lg p-3 mb-6 text-left tabular-nums">
          {JSON.stringify({ exerciseId, ...prescription }, null, 2)}
        </pre>
      )}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="px-5 py-2 rounded-full text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
      >
        Go back
      </button>
    </div>
  )
}
