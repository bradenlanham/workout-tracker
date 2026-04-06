/**
 * MOCKUP ONLY — Share Card Concept 1: "The Collector's Card"
 *
 * Inspired by the BamBam trading card. Features:
 * - Gold/accent border frame with inner shadow texture
 * - Hero selfie photo with gradient overlay at bottom
 * - Workout name + date bannered across the photo
 * - Compact exercise list (name · top set · volume)
 * - Bold stat bar at bottom (VOL | SETS | PRs | GRADE)
 * - Card is wider than current (fills screen width minus small margin)
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
  streak: 5,
  grade: 'B',
  exercises: [
    { name: 'Incline DB Press', topSet: '85 × 8', volume: 1360, hasPR: false },
    { name: 'Incline Smith Machine Press', topSet: '225 × 10', volume: 2250, hasPR: false },
    { name: 'Flat Hammer Strength Press', topSet: '160 × 10', volume: 3200, hasPR: false },
    { name: 'Pec Dec', topSet: '190 × 12', volume: 880, hasPR: false },
    { name: 'Single Arm Tricep Extension', topSet: '25 × 12', volume: 840, hasPR: false },
    { name: 'Overhead DB Extension', topSet: '70 × 12', volume: 1700, hasPR: true },
  ],
}

const ACCENT = '#8B5CF6' // violet

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

export default function ShareCardMockup1() {
  const d = SAMPLE
  const [selfie] = useState(null) // no real selfie in mockup — shows placeholder

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
        padding: '16px',
      }}
    >
      {/* ── The Card ─────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 20,
          overflow: 'hidden',
          border: `3px solid ${ACCENT}`,
          boxShadow: `0 0 40px ${ACCENT}33, inset 0 0 60px rgba(0,0,0,0.3)`,
          background: '#111111',
          position: 'relative',
        }}
      >
        {/* ── Inner border inset ──────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 5,
            border: `1px solid ${ACCENT}44`,
            borderRadius: 16,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* ── Photo area ──────────────────────────────────────────── */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
          {selfie ? (
            <img
              src={selfie}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${ACCENT}22 0%, #1a1a2e 50%, ${ACCENT}11 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 64, opacity: 0.3 }}>📸</span>
            </div>
          )}

          {/* Gradient overlay on photo bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(to top, #111111 0%, transparent 100%)',
            }}
          />

          {/* Workout name banner — overlaid on photo bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 16,
              right: 16,
              zIndex: 3,
            }}
          >
            <div style={{ fontSize: 11, color: '#ffffff88', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>
              {d.userName}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {d.workoutEmoji} {d.workoutName}
            </div>
            <div style={{ fontSize: 12, color: '#ffffff77', marginTop: 2 }}>
              {d.dateStr} · {d.durationStr}
            </div>
          </div>
        </div>

        {/* ── Exercise list ────────────────────────────────────────── */}
        <div style={{ padding: '12px 16px 8px' }}>
          {d.exercises.map((ex, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '7px 0',
                borderBottom: i < d.exercises.length - 1 ? '1px solid #ffffff0D' : 'none',
                gap: 8,
              }}
            >
              {/* Check icon */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#22C55E22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#22C55E', fontSize: 10, fontWeight: 700 }}>✓</span>
              </div>

              {/* Name + PR */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#ffffffDD',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ex.name}
                  </span>
                  {ex.hasPR && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#FCD34D',
                        background: '#FCD34D22',
                        padding: '1px 5px',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      PR
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#ffffff55', marginTop: 1 }}>
                  Top: {ex.topSet}
                </div>
              </div>

              {/* Volume */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: ACCENT,
                  flexShrink: 0,
                }}
              >
                {formatVol(ex.volume)}
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats footer bar ────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            borderTop: `2px solid ${ACCENT}`,
            background: `linear-gradient(to right, ${ACCENT}15, ${ACCENT}08)`,
          }}
        >
          {[
            { label: 'VOL', value: formatVol(d.totalVolume), color: '#ffffffDD' },
            { label: 'SETS', value: d.totalSets, color: '#ffffffDD' },
            { label: 'STREAK', value: d.streak + '🔥', color: '#FB923C' },
            { label: 'GRADE', value: d.grade, color: gradeColor(d.grade) },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 4px',
                borderRight: i < 3 ? `1px solid ${ACCENT}33` : 'none',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 9, color: '#ffffff55', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 3 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom accent bar ───────────────────────────────────── */}
        <div style={{ height: 4, background: ACCENT }} />
      </div>

      {/* ── Buttons below card (not part of card design) ─────── */}
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
          Concept 1: "The Collector's Card"
        </div>
      </div>
    </div>
  )
}
