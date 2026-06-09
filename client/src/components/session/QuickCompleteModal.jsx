import React from 'react'

function QuickCompleteModal({
  show,
  section,
  setSection,
  studentsPresent,
  setStudentsPresent,
  availableSections,
  onCancel,
  onConfirm,
}) {
  if (!show) return null

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
                  return
                }
                const [roomId, sectionId] = val.split('-')
                const item = availableSections.find(
                  x => x.room._id === roomId && x.section._id === sectionId
                )
                setSection(item || null)
                setStudentsPresent('')
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

          {section && (
            <div>
              <label className="el-label">
                Students Present (Section {section.section.number})
              </label>
              <input
                type="number"
                min="0"
                max={section.section.studentCount}
                value={studentsPresent}
                onChange={(e) => setStudentsPresent(e.target.value)}
                className="el-input"
                placeholder={`Enter 0–${section.section.studentCount}`}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Max: {section.section.studentCount} students
              </p>
            </div>
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
              disabled={!section || !studentsPresent || isNaN(parseInt(studentsPresent))}
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
