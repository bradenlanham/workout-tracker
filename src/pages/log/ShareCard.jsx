export default function ShareCard({ data, onDone }) {
  const {
    userName, workoutName, workoutEmoji, dateStr, durationStr,
    totalVolume, totalSets, totalPRs, exerciseSummary,
    grade, cardio, theme,
  } = data

  const formatVolume = (v) => {
    if (v === 0) return '—'
    return v.toLocaleString() + ' lbs'
  }

  const gradeColor = (g) => {
    if (g === 'A+') return theme.text
    if (g === 'A')  return 'text-emerald-400'
    if (g === 'B')  return 'text-blue-400'
    if (g === 'C')  return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-base flex flex-col items-center overflow-y-auto"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))',
      }}
    >
      <div className="w-full max-w-sm px-5 flex flex-col items-center gap-6">

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div className="w-full">
          {/* Accent stripe */}
          <div className={`${theme.bg} h-1.5 rounded-t-3xl`} />

          <div className="bg-card rounded-b-3xl p-6 shadow-2xl">

            {/* User name */}
            {userName && (
              <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-3">
                {userName}
              </p>
            )}

            {/* Workout title */}
            <h1 className="text-2xl font-bold leading-tight">
              {workoutEmoji} {workoutName}
            </h1>

            {/* Date · Duration */}
            <p className="text-sm text-c-muted mt-1.5">
              {dateStr}&nbsp; · &nbsp;{durationStr}
            </p>

            {/* ── Stats row ─────────────────────────────────────────────── */}
            <div className="flex gap-2 mt-5">
              <div className="flex-1 bg-item rounded-2xl px-2 py-3 text-center">
                <p className={`text-base font-bold leading-none ${theme.text}`}>
                  {formatVolume(totalVolume)}
                </p>
                <p className="text-xs text-c-faint mt-1">volume</p>
              </div>
              <div className="flex-1 bg-item rounded-2xl px-2 py-3 text-center">
                <p className={`text-2xl font-bold leading-none ${theme.text}`}>{totalSets}</p>
                <p className="text-xs text-c-faint mt-1">sets</p>
              </div>
              {totalPRs > 0 && (
                <div className="flex-1 bg-amber-500/10 rounded-2xl px-2 py-3 text-center">
                  <p className="text-2xl font-bold leading-none text-amber-400">{totalPRs} 🏆</p>
                  <p className="text-xs text-amber-500/60 mt-1">PRs</p>
                </div>
              )}
              {grade && (
                <div className="flex-1 bg-item rounded-2xl px-2 py-3 text-center">
                  <p className={`text-2xl font-bold leading-none ${gradeColor(grade)}`}>{grade}</p>
                  <p className="text-xs text-c-faint mt-1">grade</p>
                </div>
              )}
            </div>

            {/* ── Exercise breakdown ────────────────────────────────────── */}
            {exerciseSummary.length > 0 && (
              <div className="mt-5">
                <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-1">
                  Exercises
                </p>
                <div>
                  {exerciseSummary.map((ex, i) => (
                    <div
                      key={i}
                      className={`py-2.5 ${i > 0 ? 'border-t border-c-base' : ''}`}
                    >
                      {/* Exercise name + PR badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{ex.name}</p>
                        {ex.hasPR && (
                          <span className="shrink-0 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                            PR
                          </span>
                        )}
                      </div>
                      {/* All sets */}
                      <div className="space-y-0.5">
                        {ex.sets.map((set, si) => (
                          <div key={si} className="flex items-center gap-2">
                            <span className="text-c-faint" style={{ fontSize: '11px', minWidth: '36px' }}>
                              Set {si + 1}
                            </span>
                            <span className="font-semibold text-c-secondary" style={{ fontSize: '11px' }}>
                              {set.weight > 0
                                ? `${set.weight} × ${set.reps}`
                                : `${set.reps} reps`}
                            </span>
                            {set.isNewPR && (
                              <span className="text-amber-400" style={{ fontSize: '10px' }}>PR</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {ex.notes && (
                        <p className="text-xs text-c-faint italic mt-1">{ex.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Cardio section ────────────────────────────────────────── */}
            {cardio?.completed && (
              <div className="mt-5 pt-4 border-t border-c-base">
                <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-1.5">
                  Cardio
                </p>
                <p className="text-sm font-semibold text-emerald-400">
                  {[
                    cardio.type,
                    cardio.duration ? `${cardio.duration} min` : null,
                    cardio.heartRate ? `${cardio.heartRate} bpm` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
                {cardio.notes && (
                  <p className="text-xs text-c-faint italic mt-0.5">{cardio.notes}</p>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Done ─────────────────────────────────────────────────────── */}
        <div className="text-center">
          <button
            onClick={onDone}
            className={`${theme.bg} text-white font-bold py-4 px-14 rounded-2xl text-base`}
            style={{ color: theme.contrastText }}
          >
            Done
          </button>
          <p className="text-xs text-c-faint mt-3">tap to continue</p>
        </div>

      </div>
    </div>
  )
}
