import React from 'react'

function PresentStudentsModal({
  show,
  room,
  calculateTotalStudents,
  sectionPresentCounts,
  setSectionPresentCounts,
  presentStudentsCount,
  setPresentStudentsCount,
  onCancel,
  onConfirm,
}) {
  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Mark Room Complete</h2>

        <div className="space-y-6">
          <div className="bg-brand-50 p-4 rounded-lg">
            <h3 className="font-semibold text-slate-900 mb-2">Room: {room.name}</h3>
            <p className="text-sm text-slate-600">
              Total Students: {calculateTotalStudents(room.sections)}
            </p>
            <p className="text-sm text-slate-600">
              Sections: {room.sections?.length || 0}
            </p>
          </div>

          {room.sections && room.sections.length > 1 ? (
            // Per-section input for multiple sections
            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                Students Present by Section
              </h3>
              <div className="space-y-4">
                {room.sections
                  .sort((a, b) => a.number - b.number)
                  .map((section) => (
                    <div key={section._id} className="bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-900">
                          Section {section.number}
                        </h4>
                        <span className="text-sm text-slate-500">
                          Total: {section.studentCount} students
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={section.studentCount}
                        value={sectionPresentCounts[section._id] || ''}
                        onChange={(e) => setSectionPresentCounts(prev => ({
                          ...prev,
                          [section._id]: e.target.value
                        }))}
                        className="el-input"
                        placeholder={`Enter present students (0-${section.studentCount})`}
                      />
                    </div>
                  ))}
              </div>
              <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">Total Present:</span> {
                    Object.values(sectionPresentCounts).reduce((total, count) => {
                      const num = parseInt(count) || 0
                      return total + num
                    }, 0)
                  } / {calculateTotalStudents(room.sections)}
                </p>
              </div>
            </div>
          ) : (
            // Single input for single section or no sections
            <div>
              <label className="el-label">
                How many students were present?
              </label>
              <input
                type="number"
                min="0"
                max={calculateTotalStudents(room.sections)}
                value={presentStudentsCount}
                onChange={(e) => setPresentStudentsCount(e.target.value)}
                className="el-input"
                placeholder="Enter number of present students"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter a number between 0 and {calculateTotalStudents(room.sections)}
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
              disabled={room.sections && room.sections.length > 1
                ? !Object.values(sectionPresentCounts).every(count => count !== '' && !isNaN(parseInt(count)))
                : (!presentStudentsCount || isNaN(parseInt(presentStudentsCount)))
              }
              className="el-btn el-btn-success flex-1"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PresentStudentsModal
