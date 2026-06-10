import React, { useEffect, useRef } from 'react'

// Shared keypad for entering how many students were present for a section.
// Used by both the Display Mode record popup and the Mark-Complete modal so the
// entry behaves identically everywhere.
//
// Controlled: the parent owns `value` and gets updates via `onChange`.
// - value/onChange: the current numeric value and its setter
// - max: the section roster (present can't exceed it)
// - resetKey: when this changes (e.g. switching sections), the next keypad press
//   replaces the value instead of appending (phone-keypad behavior)
// - autoFocus: focus + select the big number input on mount
function PresentKeypad({ value, max, onChange, resetKey, autoFocus = false }) {
  // True until the first keypad digit is pressed, so the first tap replaces the value.
  const freshRef = useRef(true)
  useEffect(() => { freshRef.current = true }, [resetKey])

  const v = Math.min(Math.max(Number(value) || 0, 0), max)
  const pct = max > 0 ? Math.round((v / max) * 100) : 0
  const absent = Math.max(max - v, 0)
  const done = max > 0 && v >= max

  const setClamped = (n) => onChange(Math.min(Math.max(n, 0), max))
  const pressDigit = (d) => {
    const fresh = freshRef.current
    freshRef.current = false
    const base = fresh ? 0 : v
    setClamped(base * 10 + d)
  }
  const backspace = () => { freshRef.current = false; setClamped(Math.floor(v / 10)) }
  const clear = () => { freshRef.current = true; onChange(0) }
  const adjust = (delta) => { freshRef.current = false; setClamped(v + delta) }

  return (
    <>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        {/* The big number is the input — tap it and type the count directly */}
        <div className="flex items-end justify-center">
          <input
            type="number"
            min={0}
            max={max}
            value={value}
            autoFocus={autoFocus}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              freshRef.current = false
              const n = parseInt(e.target.value, 10)
              if (Number.isNaN(n)) { onChange(0); return }
              setClamped(n)
            }}
            className="w-28 rounded-lg bg-transparent text-center text-5xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-400
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Number of students present"
          />
          <span className="pb-1 text-2xl font-semibold text-slate-400"> / {max}</span>
        </div>
        <p className={`mt-1 text-sm font-semibold ${done ? 'text-emerald-600' : 'text-amber-600'}`}>
          {done ? 'All present' : `${v} present · ${absent} absent`}
        </p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Keypad — tap the digits to enter the count */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pressDigit(d)}
            className="h-12 rounded-lg bg-slate-100 text-xl font-semibold text-slate-800 transition hover:bg-slate-200 active:bg-slate-300"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="h-12 rounded-lg bg-slate-100 text-sm font-semibold text-slate-500 transition hover:bg-slate-200 active:bg-slate-300"
          aria-label="Clear"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => pressDigit(0)}
          className="h-12 rounded-lg bg-slate-100 text-xl font-semibold text-slate-800 transition hover:bg-slate-200 active:bg-slate-300"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          className="flex h-12 items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-600 transition hover:bg-slate-200 active:bg-slate-300"
          aria-label="Backspace"
        >
          ⌫
        </button>
      </div>

      {/* Quick actions */}
      <div className="mb-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => adjust(-1)}
          disabled={v <= 0}
          className="el-btn el-btn-secondary el-btn-sm disabled:opacity-40"
        >
          −1
        </button>
        <button
          type="button"
          onClick={clear}
          className="el-btn el-btn-secondary el-btn-sm"
        >
          None
        </button>
        <button
          type="button"
          onClick={() => { freshRef.current = false; onChange(max) }}
          className="el-btn el-btn-secondary el-btn-sm"
        >
          All {max}
        </button>
        <button
          type="button"
          onClick={() => adjust(1)}
          disabled={v >= max}
          className="el-btn el-btn-secondary el-btn-sm disabled:opacity-40"
        >
          +1
        </button>
      </div>
    </>
  )
}

export default PresentKeypad
