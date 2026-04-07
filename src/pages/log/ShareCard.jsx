import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import CameraCapture from './CameraCapture'

// ── CSS keyframes (injected once) ──────────────────────────────────────────────
const SHIMMER_CSS = `
@keyframes shimmer-border {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1); }
}
`

// ── Tier logic ─────────────────────────────────────────────────────────────────
function getTier(streak) {
  if (streak >= 50) return 'mythic'
  if (streak >= 20) return 'legendary'
  if (streak >= 15) return 'epic'
  if (streak >= 6)  return 'rare'
  return 'common'
}

function buildTierConfig(accentHex) {
  const a = accentHex || '#8B5CF6'
  return {
    common: {
      label: 'COMMON',
      labelColor: a,
      border: `3px solid ${a}`,
      innerBorder: `1px solid ${a}44`,
      shadow: `0 0 30px ${a}22`,
      photoBorder: `2px solid ${a}66`,
      statBarBg: `linear-gradient(to right, ${a}12, ${a}06)`,
      statBarBorder: `2px solid ${a}55`,
      cardBg: '#111111',
      exerciseDivider: '#ffffff0D',
      shimmer: false,
    },
    rare: {
      label: 'RARE',
      labelColor: '#C0C0C0',
      border: '3px solid #C0C0C0',
      innerBorder: '1px solid #C0C0C044',
      shadow: '0 0 35px #C0C0C022, 0 0 80px #C0C0C00A',
      photoBorder: '2px solid #C0C0C066',
      statBarBg: 'linear-gradient(to right, #C0C0C012, #C0C0C006)',
      statBarBorder: '2px solid #C0C0C055',
      cardBg: '#111114',
      exerciseDivider: '#C0C0C015',
      shimmer: false,
    },
    epic: {
      label: 'EPIC',
      labelColor: '#FFD700',
      border: '3px solid #FFD700',
      innerBorder: '1px solid #FFD70044',
      shadow: '0 0 40px #FFD70022, 0 0 80px #FFD70011',
      photoBorder: '2px solid #FFD70066',
      statBarBg: 'linear-gradient(to right, #FFD70018, #FFD70008)',
      statBarBorder: '2px solid #FFD70066',
      cardBg: '#12110D',
      exerciseDivider: '#FFD70015',
      shimmer: false,
    },
    legendary: {
      label: 'LEGENDARY',
      labelColor: '#FF6B2B',
      border: 'none',
      innerBorder: '1px solid #FF6B2B33',
      shadow: '0 0 50px #FF6B2B22, 0 0 100px #FF6B2B11',
      photoBorder: '2px solid #FF6B2B55',
      statBarBg: 'linear-gradient(to right, #FF6B2B15, #FF6B2B08)',
      statBarBorder: '2px solid #FF6B2B55',
      cardBg: '#110D0A',
      exerciseDivider: '#FF6B2B15',
      shimmer: true,
      gradient: 'linear-gradient(135deg, #FF6B2B, #FF4500, #FFD700, #FF6B2B)',
    },
    mythic: {
      label: 'MYTHIC',
      labelColor: '#E879F9',
      border: 'none',
      innerBorder: '1px solid #E879F933',
      shadow: '0 0 60px #E879F933, 0 0 120px #8B5CF622',
      photoBorder: '2px solid #E879F955',
      statBarBg: 'linear-gradient(to right, #E879F915, #8B5CF610)',
      statBarBorder: '2px solid #E879F955',
      cardBg: '#0D0A11',
      exerciseDivider: '#E879F915',
      shimmer: true,
      gradient: 'linear-gradient(135deg, #E879F9, #8B5CF6, #06B6D4, #EC4899, #E879F9, #8B5CF6)',
    },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatVol(v) {
  if (!v || v === 0) return '—'
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return v.toLocaleString()
}

function gradeColor(g) {
  if (g === 'A+') return '#A78BFA'
  if (g === 'A')  return '#34D399'
  if (g === 'B')  return '#60A5FA'
  if (g === 'C')  return '#FBBF24'
  return '#F87171'
}

function getTopSet(sets) {
  const working = (sets || []).filter(s => s.type === 'working' && (s.weight > 0 || s.reps > 0))
  if (!working.length) return null
  const best = working.reduce((b, s) => {
    if (!b) return s
    if (s.weight > b.weight) return s
    if (s.weight === b.weight && s.reps > b.reps) return s
    return b
  }, null)
  if (!best) return null
  if (best.weight > 0) return `${best.weight} × ${best.reps}`
  return `${best.reps} reps`
}

// Stable sparkle positions (not randomized on each render)
const SPARKLES = [
  { left: '12%', top: '8%',  dur: 2.1, delay: 0.3 },
  { left: '78%', top: '15%', dur: 1.8, delay: 1.1 },
  { left: '35%', top: '22%', dur: 2.8, delay: 0.7 },
  { left: '62%', top: '35%', dur: 1.6, delay: 1.9 },
  { left: '18%', top: '45%', dur: 2.4, delay: 0.1 },
  { left: '88%', top: '52%', dur: 3.1, delay: 0.5 },
  { left: '45%', top: '60%', dur: 1.9, delay: 1.4 },
  { left: '25%', top: '72%', dur: 2.6, delay: 0.9 },
  { left: '70%', top: '78%', dur: 1.7, delay: 1.7 },
  { left: '55%', top: '85%', dur: 2.3, delay: 0.2 },
  { left: '82%', top: '90%', dur: 3.3, delay: 1.2 },
  { left: '10%', top: '92%', dur: 2.0, delay: 0.6 },
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function ShareCard({ data, onDone, sessionId, onUpdateSession, initialSelfie }) {
  const {
    userName, workoutName, workoutEmoji, dateStr, durationStr,
    totalVolume, totalSets, totalPRs, exerciseSummary,
    grade, theme, streak = 0,
  } = data

  const [selfie, setSelfie]     = useState(initialSelfie || null)
  const [showCamera, setShowCamera] = useState(false)
  const [sharing, setSharing]   = useState(false)
  const cardRef    = useRef(null)
  const shimmerRef = useRef(null)

  const tier      = getTier(streak)
  const allTiers  = buildTierConfig(theme?.hex)
  const t         = allTiers[tier]

  // Exercise list: max 6 shown, rest overflow
  const MAX_EX = 6
  const shownExercises = (exerciseSummary || []).slice(0, MAX_EX).map(ex => ({
    name:   ex.name,
    hasPR:  ex.hasPR,
    topSet: getTopSet(ex.sets),
  }))
  const overflow = (exerciseSummary?.length || 0) - MAX_EX

  // Total working + drop sets for the stat bar
  const workingSetCount = (exerciseSummary || []).reduce(
    (sum, ex) => sum + (ex.sets || []).filter(s => s.type === 'working' || s.type === 'drop').length,
    0,
  )

  function handleCapture(dataUrl) {
    setSelfie(dataUrl)
    setShowCamera(false)
    if (sessionId && onUpdateSession) {
      onUpdateSession(sessionId, { selfie: dataUrl })
    }
  }

  async function handleShare() {
    if (!cardRef.current || sharing) return
    setSharing(true)
    // Hide shimmer div during capture: html2canvas doesn't support CSS masks
    // (WebkitMask/maskComposite), causing it to render as a full opaque gradient overlay.
    if (shimmerRef.current) shimmerRef.current.style.display = 'none'
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#050505',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      })
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92))
      const file = new File([blob], 'gains-workout.jpg', { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${workoutName} — Gains` })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'gains-workout.jpg'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      if (shimmerRef.current) shimmerRef.current.style.display = ''
      setSharing(false)
    }
  }

  return (
    <>
      <style>{SHIMMER_CSS}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: '#050505',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          overflowY: 'auto',
        }}
      >
        {/* ── Card (captured by html2canvas) ───────────────────────── */}
        <div
          ref={cardRef}
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 20,
            overflow: 'hidden',
            border: t.border,
            boxShadow: t.shadow,
            background: t.cardBg,
            position: 'relative',
          }}
        >
          {/* Animated gradient border — Legendary & Mythic */}
          {t.shimmer && (
            <div
              ref={shimmerRef}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 20,
                padding: 3,
                background: t.gradient,
                backgroundSize: '300% 300%',
                animation: 'shimmer-border 4s ease infinite',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                zIndex: 1,
              }}
            />
          )}

          {/* Inner border inset */}
          <div
            style={{
              position: 'absolute',
              inset: t.shimmer ? 6 : 5,
              border: t.innerBorder,
              borderRadius: 16,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* Mythic sparkle overlay */}
          {tier === 'mythic' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', overflow: 'hidden' }}>
              {SPARKLES.map((sp, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#fff',
                    left: sp.left,
                    top: sp.top,
                    animation: `sparkle ${sp.dur}s ease-in-out ${sp.delay}s infinite`,
                    boxShadow: '0 0 4px #fff, 0 0 8px #E879F9',
                  }}
                />
              ))}
            </div>
          )}

          {/* Card content */}
          <div style={{ position: 'relative', zIndex: 2, margin: t.shimmer ? 3 : 0 }}>

            {/* ── Tier badge row ─────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 0' }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: t.labelColor, textTransform: 'uppercase' }}>
                {t.label}
              </span>
              <span style={{ fontSize: 9, color: '#ffffff33', fontWeight: 600 }}>GAINS</span>
            </div>

            {/* ── Photo window (4:3) ─────────────────────────────────── */}
            <div
              style={{
                margin: '8px 14px',
                borderRadius: 14,
                overflow: 'hidden',
                border: t.photoBorder,
                aspectRatio: '4/3',
                position: 'relative',
              }}
            >
              {selfie ? (
                <img
                  src={selfie}
                  alt="Workout selfie"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                  onClick={() => setShowCamera(true)}
                />
              ) : (
                <button
                  onClick={() => setShowCamera(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(160deg, #1a1a2e 0%, #1a1a2e 40%, #0D0D0D 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 32, opacity: 0.4 }}>📸</span>
                  <span style={{ fontSize: 11, color: '#ffffff44', fontWeight: 500 }}>Add a selfie</span>
                </button>
              )}
            </div>

            {/* ── Workout name + meta ────────────────────────────────── */}
            <div style={{ padding: '4px 16px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {workoutEmoji} {workoutName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'nowrap' }}>
                <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{userName}</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff22', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{dateStr}</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff22', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{durationStr}</span>
              </div>
            </div>

            {/* ── Exercise list (max 6) ──────────────────────────────── */}
            <div style={{ padding: '10px 16px 4px' }}>
              {shownExercises.map((ex, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: (i < shownExercises.length - 1 || overflow > 0)
                      ? `1px solid ${t.exerciseDivider}`
                      : 'none',
                    gap: 6,
                  }}
                >
                  <span style={{ color: '#22C55E', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#ffffffCC',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ex.name}
                  </span>
                  {ex.hasPR && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: '#FCD34D',
                      background: '#FCD34D22',
                      padding: '1px 4px',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}>
                      PR
                    </span>
                  )}
                  {ex.topSet && (
                    <span style={{ fontSize: 11, color: '#ffffff44', flexShrink: 0 }}>{ex.topSet}</span>
                  )}
                </div>
              ))}
              {overflow > 0 && (
                <div style={{ padding: '5px 0', fontSize: 11, color: '#ffffff33', fontWeight: 500 }}>
                  +{overflow} more exercise{overflow > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* ── Stats bar ──────────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                margin: '4px 12px 12px',
                borderRadius: 12,
                overflow: 'hidden',
                background: t.statBarBg,
                border: t.statBarBorder,
              }}
            >
              {[
                { label: 'VOL',    value: `${formatVol(totalVolume)} lbs`, color: '#ffffffDD' },
                { label: 'SETS',   value: workingSetCount,                  color: '#ffffffDD' },
                { label: 'STREAK', value: `${streak} 🔥`,                  color: '#FB923C'   },
                { label: 'GRADE',  value: grade || '—',                     color: gradeColor(grade) },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '9px 2px',
                    borderRight: i < 3 ? `1px solid ${t.exerciseDivider}` : 'none',
                  }}
                >
                  <div style={{ fontSize: 17, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontSize: 8,
                    color: '#ffffff44',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    marginTop: 3,
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Share + Done buttons (outside cardRef — not in JPEG) ───── */}
        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              background: '#ffffff12',
              color: '#ffffffCC',
              fontWeight: 700,
              padding: '12px 28px',
              borderRadius: 14,
              fontSize: 14,
              border: '1px solid #ffffff1A',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: sharing ? 0.6 : 1,
              cursor: sharing ? 'default' : 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>↗</span>
            {sharing ? 'Sharing…' : 'Share'}
          </button>
          <button
            onClick={onDone}
            style={{
              background: theme?.hex || '#8B5CF6',
              color: theme?.contrastText || '#fff',
              fontWeight: 700,
              padding: '12px 36px',
              borderRadius: 14,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>

      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </>
  )
}
