export default function ShareCard({ data, onDone }) {
  const {
    userName, workoutName, workoutEmoji, dateStr, durationStr,
    totalVolume, totalSets, totalPRs, exerciseSummary, theme,
  } = data

  const formatVolume = (v) => {
    if (v === 0) return '—'
    return v.toLocaleString() + ' lbs'
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
            <div className="flex gap-2.5 mt-5">
              <div className="flex-1 bg-item rounded-2xl px-3 py-3.5 text-center">
                <p className={`text-lg font-bold leading-none ${theme.text}`}>
                  {formatVolume(totalVolume)}
                </p>
                <p className="text-xs text-c-faint mt-1">volume</p>
              </div>
              <div className="flex-1 bg-item rounded-2xl px-3 py-3.5 text-center">
                <p className={`text-2xl font-bold leading-none ${theme.text}`}>{totalSets}</p>
                <p className="text-xs text-c-faint mt-1">sets</p>
              </div>
              {totalPRs > 0 && (
                <div className="flex-1 bg-amber-500/10 rounded-2xl px-3 py-3.5 text-center">
                  <p className="text-2xl font-bold leading-none text-amber-400">{totalPRs} 🏆</p>
                  <p className="text-xs text-amber-500/60 mt-1">PRs hit</p>
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold truncate">{ex.name}</p>
                          {ex.hasPR && (
                            <span className="shrink-0 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                              PR
                            </span>
                          )}
                        </div>
                        {ex.bestSet && (
                          <p className="shrink-0 text-sm font-bold text-c-secondary">
                            {ex.bestSet.weight > 0
                              ? `${ex.bestSet.weight} × ${ex.bestSet.reps}`
                              : `${ex.bestSet.reps} reps`}
                          </p>
                        )}
                      </div>
                      {ex.notes && (
                        <p className="text-xs text-c-faint italic mt-0.5">{ex.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Done ─────────────────────────────────────────────────────── */}
        <div className="text-center">
          <button
            onClick={onDone}
            className={`${theme.bg} ${theme.textOnBg} font-bold py-4 px-14 rounded-2xl text-base`}
          >
            Done
          </button>
          <p className="text-xs text-c-faint mt-3">tap to continue</p>
        </div>

      </div>
    </div>
  )
}
