import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { compareSectionNumbers } from '../../utils/sectionNumber'

// View-mode "Mark Room Complete" flow, for users at a computer: type how many students were
// present for each section, then complete the room. (Display Mode uses the tap keypad instead.)
//
// onConfirm(presentBySectionId) receives a map of { sectionId: presentCount } for every
// section in the room; the parent persists it and marks the room complete.
function PresentStudentsModal({ show, room, saving, onCancel, onConfirm }) {
  const sections = useMemo(
    () => [...(room?.sections || [])].sort((a, b) => compareSectionNumbers(a.number, b.number)),
    [room]
  )

  // Present counts as strings keyed by section id ('' = not yet entered).
  const [counts, setCounts] = useState({})

  // Seed from any already-recorded counts whenever a new room opens.
  useEffect(() => {
    if (!show || !room) return
    const seeded = {}
    sections.forEach((s) => {
      const existing = room.sectionReturns ? room.sectionReturns[s._id] : undefined
      seeded[s._id] = existing !== undefined ? String(existing) : ''
    })
    setCounts(seeded)
  }, [show, room, sections])

  if (!show || !room) return null

  const totalStudents = sections.reduce((sum, s) => sum + (s.studentCount || 0), 0)

  const parsed = (id) => {
    const n = parseInt(counts[id], 10)
    return Number.isNaN(n) ? null : n
  }
  const sectionValid = (s) => {
    const n = parsed(s._id)
    return n !== null && n >= 0 && n <= (s.studentCount || 0)
  }
  const allValid = sections.length > 0 && sections.every(sectionValid)
  const totalPresent = sections.reduce((sum, s) => sum + (parsed(s._id) || 0), 0)

  const setCount = (id, value) => setCounts((prev) => ({ ...prev, [id]: value }))

  const handleConfirm = () => {
    const map = {}
    sections.forEach((s) => { map[s._id] = parsed(s._id) || 0 })
    onConfirm(map)
  }

  return createPortal(
    <div className="el-overlay">
      <div className="el-modal el-fade-up max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Mark Room Complete</h2>

        <div className="space-y-6">
          <div className="rounded-lg bg-brand-50 p-4">
            <h3 className="mb-2 font-semibold text-slate-900">Room: {room.name}</h3>
            <p className="text-sm text-slate-600">Total Students: {totalStudents}</p>
            <p className="text-sm text-slate-600">Sections: {sections.length}</p>
          </div>

          {sections.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              This room has no sections — marking it complete will record 0 students present.
            </p>
          ) : sections.length > 1 ? (
            <div>
              <h3 className="mb-4 text-base font-semibold text-slate-900">Students Present by Section</h3>
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section._id} className="rounded-lg bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-medium text-slate-900">Section {section.number}</h4>
                      <span className="text-sm text-slate-500">Total: {section.studentCount} students</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={section.studentCount}
                      value={counts[section._id] ?? ''}
                      onChange={(e) => setCount(section._id, e.target.value)}
                      className="el-input"
                      placeholder={`Enter present students (0-${section.studentCount})`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">Total Present:</span> {totalPresent} / {totalStudents}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="el-label">How many students were present?</label>
              <input
                type="number"
                min="0"
                max={sections[0].studentCount}
                value={counts[sections[0]._id] ?? ''}
                onChange={(e) => setCount(sections[0]._id, e.target.value)}
                className="el-input"
                placeholder="Enter number of present students"
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-400">
                Enter a number between 0 and {sections[0].studentCount}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="el-btn el-btn-secondary flex-1" disabled={saving}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="el-btn el-btn-success flex-1"
              disabled={saving || (sections.length > 0 && !allValid)}
            >
              {saving ? 'Saving…' : 'Mark Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PresentStudentsModal
