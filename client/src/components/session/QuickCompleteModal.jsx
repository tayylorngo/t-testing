import React from 'react'

function QuickCompleteModal({
  show,
  section,
  setSection,
  studentsPresent,
  setStudentsPresent,
  totalStudents,
  setTotalStudents,
  availableSections,
  onCancel,
  onConfirm,
}) {
  if (!show) return null

  // The roster total can be edited here; fall back to the section's stored count.
  const totalValue = totalStudents === '' || totalStudents === undefined
    ? (section ? section.section.studentCount : '')
    : totalStudents
  const totalNum = parseInt(totalValue, 10)
  const maxPresent = Number.isNaN(totalNum) ? 0 : totalNum

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Mark Section Complete</h2>

        <div className="space-y-6">
          <div>
            <label className="el-label">
              Select Section
            </label>
            <select
              value={section ? `${section.room._id}-${section.section._id}` : ''}
              onChange={(e) => {
                const val = e.target.value
                if (!val) {
                  setSection(null)
                  setStudentsPresent('')
                  setTotalStudents('')
                  return
                }
                const [roomId, sectionId] = val.split('-')
                const item = availableSections.find(
                  x => x.room._id === roomId && x.section._id === sectionId
                )
                setSection(item || null)
                setStudentsPresent('')
                // Seed the editable total with the section's current roster.
                setTotalStudents(item ? String(item.section.studentCount) : '')
              }}
              className="el-input"
            >
              <option value="">Choose a section...</option>
              {availableSections.map(({ section, room }) => (
                  <option key={`${room._id}-${section._id}`} value={`${room._id}-${section._id}`}>
                    Section {section.number} – {room.name} ({section.studentCount} students)
                  </option>
                ))}
            </select>
          </div>

          {section && section.room.reminder && section.room.reminder.trim() && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Reminder for {section.room.name}</p>
                <p className="text-sm text-amber-700 whitespace-pre-wrap">{section.room.reminder}</p>
              </div>
            </div>
          )}

          {section && (
            <>
              <div>
                <label className="el-label">
                  Total Students (Section {section.section.number})
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalValue}
                  onChange={(e) => {
                    setTotalStudents(e.target.value)
                    // Don't let "present" exceed a newly lowered total.
                    const newTotal = parseInt(e.target.value, 10)
                    const present = parseInt(studentsPresent, 10)
                    if (!Number.isNaN(newTotal) && !Number.isNaN(present) && present > newTotal) {
                      setStudentsPresent(String(newTotal))
                    }
                  }}
                  className="el-input"
                  placeholder="Total students in this section"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Adjust if more or fewer students showed up than expected.
                </p>
              </div>

              <div>
                <label className="el-label">
                  Students Present (Section {section.section.number})
                </label>
                <input
                  type="number"
                  min="0"
                  max={maxPresent}
                  value={studentsPresent}
                  onChange={(e) => setStudentsPresent(e.target.value)}
                  className="el-input"
                  placeholder={`Enter 0–${maxPresent}`}
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">
                  Max: {maxPresent} students
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="el-btn el-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!section || studentsPresent === '' || isNaN(parseInt(studentsPresent)) || maxPresent < 1}
              className="el-btn el-btn-success flex-1"
            >
              Mark Section Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickCompleteModal
