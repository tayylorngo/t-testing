import React from 'react'
import { compareSectionNumbers } from '../../utils/sectionNumber'

function MoveStudentsModal({ show, fromRoom, rooms, studentMoveData, setStudentMoveData, onCancel, onConfirm }) {
  if (!show || !fromRoom) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6 max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Move Students</h2>

        <div className="space-y-4">
          <div>
            <label className="el-label">
              From Room
            </label>
            <div className="px-4 py-3 bg-slate-100 rounded-lg text-slate-700">
              {fromRoom.name}
            </div>
          </div>

          {fromRoom.sections && fromRoom.sections.length > 0 && (
            <div>
              <label className="el-label">
                Select Students to Move
              </label>
              <div className="space-y-4 max-h-60 overflow-y-auto">
                {fromRoom.sections
                  .sort((a, b) => compareSectionNumbers(a.number, b.number))
                  .map((section) => (
                    <div key={section._id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <div className="text-sm font-medium text-slate-700">
                            Section {section.number} ({section.studentCount} students)
                          </div>
                          {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                            <div className="text-xs text-brand-600 mt-1">
                              Accommodations: {section.accommodations.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">
                            Students to move from this section:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={section.studentCount}
                            value={studentMoveData[section._id]?.studentsToMove || 0}
                            onChange={(e) => {
                              const studentsToMove = parseInt(e.target.value) || 0
                              setStudentMoveData(prev => ({
                                ...prev,
                                [section._id]: {
                                  ...prev[section._id],
                                  studentsToMove
                                }
                              }))
                            }}
                            className="el-input w-20"
                          />
                          <span className="text-xs text-slate-400 ml-2">
                            (0-{section.studentCount})
                          </span>
                        </div>

                        {(studentMoveData[section._id]?.studentsToMove || 0) > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                              Destination room:
                            </label>
                            <select
                              value={studentMoveData[section._id]?.destinationRoom || ''}
                              onChange={(e) => {
                                setStudentMoveData(prev => ({
                                  ...prev,
                                  [section._id]: {
                                    ...prev[section._id],
                                    destinationRoom: e.target.value
                                  }
                                }))
                              }}
                              className="el-input"
                            >
                              <option value="">Select destination room</option>
                              {rooms
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(room => (
                                  <option key={room._id} value={room._id}>
                                    {room.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
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
              disabled={Object.keys(studentMoveData).filter(key =>
                studentMoveData[key].studentsToMove > 0 &&
                studentMoveData[key].destinationRoom
              ).length === 0}
              className="el-btn el-btn-primary flex-1"
            >
              Move Students
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MoveStudentsModal
