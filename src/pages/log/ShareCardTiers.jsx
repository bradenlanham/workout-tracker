/**
 * MOCKUP ONLY — All 5 Share Card Tiers
 *
 * Navigate to /mockup/common, /mockup/rare, /mockup/epic, /mockup/legendary, /mockup/mythic
 * Each shows the same workout data with a different card frame treatment.
 *
 * Fixed aspect ratio card (9:16 phone screen). Photo window ~35% of card.
 * Exercise list adapts: compact single-line, truncates at 6 with "+N more".
 * Stat bar locked to bottom.
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const ACCENT = '#8B5CF6'

const SAMPLE = {
  userName: 'Braden',
  workoutName: 'Push — Chest',
  workoutEmoji: '🏋️',
  dateStr: 'Mon, Mar 30',
  durationStr: '1h 11m',
  totalVolume: 21000,
  totalSets: 19,
  streak: 12,
  grade: 'A',
  exercises: [
    { name: 'Incline DB Press', topSet: '85 × 8', hasPR: false },
    { name: 'Incline Smith Machine Press', topSet: '225 × 10', hasPR: false },
    { name: 'Flat Hammer Strength Press', topSet: '160 × 10', hasPR: true },
    { name: 'Pec Dec', topSet: '190 × 12', hasPR: false },
    { name: 'Single Arm Tricep Extension', topSet: '25 × 12', hasPR: false },
    { name: 'Overhead DB Extension', topSet: '70 × 12', hasPR: true },
    { name: 'Preacher Curl', topSet: '70 × 7', hasPR: false },
    { name: 'Seated Cable Row', topSet: '176 × 8', hasPR: true },
  ],
}

// Use the user's actual selfie from the most recent session if available
const SAMPLE_SELFIE = null // Will show placeholder

function formatVol(v) {
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return v.toLocaleString()
}

function gradeColor(g) {
  if (g === 'A+') return '#A78BFA'
  if (g === 'A') return '#34D399'
  if (g === 'B') return '#60A5FA'
  if (g === 'C') return '#FBBF24'
  return '#F87171'
}

// ─── Tier definitions ─────────────────────────────────────────────────────────
const TIERS = {
  common: {
    label: 'COMMON',
    labelColor: '#9CA3AF',
    border: `3px solid ${ACCENT}`,
    innerBorder: `1px solid ${ACCENT}44`,
    shadow: `0 0 30px ${ACCENT}22`,
    photoBorder: `2px solid ${ACCENT}66`,
    statBarBg: `linear-gradient(to right, ${ACCENT}12, ${ACCENT}06)`,
    statBarBorder: `2px solid ${ACCENT}55`,
    badgeBg: `${ACCENT}22`,
    badgeBorder: `1px solid ${ACCENT}55`,
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
    badgeBg: '#C0C0C022',
    badgeBorder: '1px solid #C0C0C055',
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
    badgeBg: '#FFD70022',
    badgeBorder: '1px solid #FFD70055',
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
    badgeBg: '#FF6B2B22',
    badgeBorder: '1px solid #FF6B2B55',
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
    badgeBg: '#E879F922',
    badgeBorder: '1px solid #E879F955',
    cardBg: '#0D0A11',
    exerciseDivider: '#E879F915',
    shimmer: true,
    gradient: 'linear-gradient(135deg, #E879F9, #8B5CF6, #06B6D4, #EC4899, #E879F9, #8B5CF6)',
  },
}

// ─── Shimmer keyframes (injected once) ────────────────────────────────────────
const shimmerCSS = `
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

function PhotoPlaceholder({ tier }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(160deg, #1a1a2e 0%, ${ACCENT}18 40%, #0D0D0D 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 48, opacity: 0.25 }}>📸</span>
      <span style={{ fontSize: 11, color: '#ffffff33', fontWeight: 500 }}>Your selfie here</span>
    </div>
  )
}

function ShareCardFrame({ tier, data }) {
  const t = TIERS[tier]
  const d = data
  const navigate = useNavigate()

  // Limit exercises shown
  const MAX_EXERCISES = 6
  const shown = d.exercises.slice(0, MAX_EXERCISES)
  const overflow = d.exercises.length - MAX_EXERCISES

  return (
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
      }}
    >
      {/* Inject shimmer CSS */}
      <style>{shimmerCSS}</style>

      {/* ── Nav between tiers (mockup only) ───────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Object.entries(TIERS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => navigate(`/mockup/${key}`)}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              background: tier === key ? val.labelColor + '33' : '#ffffff0A',
              color: tier === key ? val.labelColor : '#ffffff44',
              border: tier === key ? `1px solid ${val.labelColor}55` : '1px solid transparent',
            }}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* ── The Card ───────────────────────────────────────────── */}
      <div
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
        {/* Animated gradient border for legendary/mythic */}
        {t.shimmer && (
          <div
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
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#fff',
                  left: `${10 + Math.random() * 80}%`,
                  top: `${5 + Math.random() * 90}%`,
                  animation: `sparkle ${1.5 + Math.random() * 2}s ease-in-out ${Math.random() * 2}s infinite`,
                  boxShadow: '0 0 4px #fff, 0 0 8px #E879F9',
                }}
              />
            ))}
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 2, margin: t.shimmer ? 3 : 0 }}>

          {/* ── Tier badge ──────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 0' }}>
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 2.5,
              color: t.labelColor,
              textTransform: 'uppercase',
            }}>
              {t.label}
            </span>
            <span style={{ fontSize: 9, color: '#ffffff33', fontWeight: 600 }}>GAINS</span>
          </div>

          {/* ── Photo window ────────────────────────────────────── */}
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
            <PhotoPlaceholder tier={tier} />
          </div>

          {/* ── Workout name + meta ─────────────────────────────── */}
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {d.workoutEmoji} {d.workoutName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{d.userName}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff22' }} />
              <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{d.dateStr}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff22' }} />
              <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{d.durationStr}</span>
            </div>
          </div>

          {/* ── Exercise list ───────────────────────────────────── */}
          <div style={{ padding: '10px 16px 4px' }}>
            {shown.map((ex, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 0',
                  borderBottom: i < shown.length - 1 || overflow > 0 ? `1px solid ${t.exerciseDivider}` : 'none',
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
                <span style={{ fontSize: 11, color: '#ffffff44', flexShrink: 0 }}>{ex.topSet}</span>
              </div>
            ))}
            {overflow > 0 && (
              <div style={{ padding: '5px 0', fontSize: 11, color: '#ffffff33', fontWeight: 500 }}>
                +{overflow} more exercise{overflow > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* ── Stats bar ──────────────────────────────────────── */}
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
              { label: 'VOL', value: formatVol(d.totalVolume), unit: 'lbs', color: '#ffffffDD' },
              { label: 'SETS', value: d.totalSets, unit: '', color: '#ffffffDD' },
              { label: 'STREAK', value: d.streak, unit: '🔥', color: '#FB923C' },
              { label: 'GRADE', value: d.grade, unit: '', color: gradeColor(d.grade) },
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
                  {stat.value}{stat.unit ? ` ${stat.unit}` : ''}
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

      {/* ── Share + Done buttons ───────────────────────────────── */}
      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
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
          }}
        >
          <span style={{ fontSize: 16 }}>↗</span> Share
        </button>
        <button
          style={{
            background: ACCENT,
            color: '#fff',
            fontWeight: 700,
            padding: '12px 36px',
            borderRadius: 14,
            fontSize: 14,
          }}
        >
          Done
        </button>
      </div>
      <div style={{ color: '#ffffff33', fontSize: 11, marginTop: 8 }}>
        {t.label} card · {tier === 'common' ? '0–5' : tier === 'rare' ? '6–14' : tier === 'epic' ? '15–19' : tier === 'legendary' ? '20–49' : '50+'} day streak
      </div>
    </div>
  )
}

export default function ShareCardTiers() {
  const { tier } = useParams()
  const validTier = TIERS[tier] ? tier : 'common'
  return <ShareCardFrame tier={validTier} data={SAMPLE} />
}
