/**
 * MOCKUP ONLY — Share Card Concept 2: "The Holographic"
 *
 * Trading card but more premium / modern. Features:
 * - Full-bleed photo behind a frosted glass card overlay
 * - Stats overlaid on the photo in a translucent banner
 * - Exercise list in a tight grid (2 columns) below the photo zone
 * - Holographic-style gradient border that shifts with the accent color
 * - Grade displayed as a large badge overlaid on the photo corner
 * - More square aspect ratio — feels like an actual collectible
 *
 * This is a STATIC MOCKUP with hardcoded sample data for design review.
 */

import { useState } from 'react'

const SAMPLE = {
  userName: 'Braden',
  workoutName: 'Push — Chest',
  workoutEmoji: '🏋️',
  dateStr: 'Monday, Mar 30',
  durationStr: '1h 11m',
  totalVolume: 21000,
  totalSets: 19,
  totalPRs: 2,
  grade: 'B',
  exercises: [
    { name: 'Incline DB Press', topSet: '85 × 8', volume: 1360, hasPR: false },
    { name: 'Incline Smith Press', topSet: '225 × 10', volume: 2250, hasPR: false },
    { name: 'Flat Hammer Press', topSet: '160 × 10', volume: 3200, hasPR: false },
    { name: 'Pec Dec', topSet: '190 × 12', volume: 880, hasPR: false },
    { name: 'SA Tricep Extension', topSet: '25 × 12', volume: 840, hasPR: false },
    { name: 'OH DB Extension', topSet: '70 × 12', volume: 1700, hasPR: true },
  ],
}

const ACCENT = '#8B5CF6'

function formatVol(v) {
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return v.toLocaleString()
}

function gradeColor(g) {
  if (g === 'A+') return ACCENT
  if (g === 'A') return '#34D399'
  if (g === 'B') return '#60A5FA'
  if (g === 'C') return '#FBBF24'
  return '#F87171'
}

export default function ShareCardMockup2() {
  const d = SAMPLE
  const [selfie] = useState(null)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
    >
      {/* ── The Card ─────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          background: '#111',
        }}
      >
        {/* Holographic gradient border */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            padding: 2,
            background: `linear-gradient(135deg, ${ACCENT}, #EC4899, ${ACCENT}, #06B6D4, ${ACCENT})`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            zIndex: 1,
          }}
        />

        {/* Card inner */}
        <div style={{ position: 'relative', margin: 2, borderRadius: 22, overflow: 'hidden', background: '#0D0D0D' }}>

          {/* ── Photo zone — top half ─────────────────────────────── */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '5/4' }}>
            {selfie ? (
              <img src={selfie} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(160deg, #1a1a2e 0%, ${ACCENT}15 40%, #0D0D0D 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 72, opacity: 0.2 }}>📸</span>
              </div>
            )}

            {/* Heavy gradient from bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60%',
                background: 'linear-gradient(to top, #0D0D0D 5%, transparent 100%)',
              }}
            />

            {/* Grade badge — top right */}
            {d.grade && (
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${gradeColor(d.grade)}22`,
                  border: `2px solid ${gradeColor(d.grade)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 900, color: gradeColor(d.grade) }}>
                  {d.grade}
                </span>
              </div>
            )}

            {/* PRs badge — top left */}
            {d.totalPRs > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  padding: '6px 12px',
                  borderRadius: 10,
                  background: '#FCD34D22',
                  border: '1px solid #FCD34D55',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  zIndex: 3,
                }}
              >
                <span style={{ fontSize: 14 }}>🏆</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FCD34D' }}>
                  {d.totalPRs} PR{d.totalPRs > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Title overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '0 20px 16px',
                zIndex: 3,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                {d.workoutEmoji} {d.workoutName}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <span style={{ fontSize: 12, color: '#ffffff66', fontWeight: 500 }}>
                  {d.dateStr}
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff33' }} />
                <span style={{ fontSize: 12, color: '#ffffff66', fontWeight: 500 }}>
                  {d.durationStr}
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff33' }} />
                <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700 }}>
                  {d.userName}
                </span>
              </div>
            </div>
          </div>

          {/* ── Stats ribbon ──────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              margin: '0 16px',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#ffffff08',
              border: '1px solid #ffffff0D',
            }}
          >
            {[
              { label: 'Volume', value: formatVol(d.totalVolume) + ' lbs' },
              { label: 'Sets', value: d.totalSets },
              { label: 'Exercises', value: d.exercises.length },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 4px',
                  borderRight: i < 2 ? '1px solid #ffffff0D' : 'none',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffffDD', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 9, color: '#ffffff44', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Exercise grid (2 columns) ─────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              padding: '12px 16px 16px',
            }}
          >
            {d.exercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  background: '#ffffff06',
                  borderRadius: 10,
                  padding: '8px 10px',
                  border: ex.hasPR ? '1px solid #FCD34D44' : '1px solid transparent',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#ffffffCC',
                    lineHeight: 1.2,
                    marginBottom: 3,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 4,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>
                    {ex.hasPR ? '🏆' : '✓'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {ex.name}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#ffffff44' }}>
                  {ex.topSet} · {formatVol(ex.volume)} lbs
                </div>
              </div>
            ))}
          </div>

          {/* ── Brand footer ──────────────────────────────────────── */}
          <div
            style={{
              textAlign: 'center',
              padding: '8px 0 14px',
              borderTop: '1px solid #ffffff0A',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ffffff22', letterSpacing: 3, textTransform: 'uppercase' }}>
              Gains
            </span>
          </div>
        </div>
      </div>

      {/* ── Buttons ───────────────────────────────────────────────── */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <div
          style={{
            background: ACCENT,
            color: '#fff',
            fontWeight: 700,
            padding: '12px 48px',
            borderRadius: 14,
            fontSize: 15,
          }}
        >
          Done
        </div>
        <div style={{ color: '#ffffff44', fontSize: 12, marginTop: 8 }}>
          Concept 2: "The Holographic"
        </div>
      </div>
    </div>
  )
}
