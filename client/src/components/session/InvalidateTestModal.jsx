import React from 'react'

function InvalidateTestModal({ show, room, selectedSection, setSelectedSection, notes, setNotes, onCancel, onConfirm }) {
  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Invalidate Test</h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Invalidate 1 test in <strong className="text-slate-900">{room.name}</strong>
          </p>

          {/* Section Selection */}
          <div>
            <label className="el-label">
              Select Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="el-input"
            >
              <option value="">Choose a section...</option>
              {room.sections?.map(section => (
                <option key={section._id} value={section.number}>
                  Section {section.number} ({section.studentCount} students)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="el-label">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="el-input"
              rows={3}
              placeholder="Enter notes about the test invalidation..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="el-btn el-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!notes.trim() || !selectedSection}
              className="el-btn el-btn-danger flex-1"
            >
              Invalidate Test
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvalidateTestModal
