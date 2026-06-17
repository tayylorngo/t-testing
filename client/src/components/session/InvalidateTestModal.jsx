import React, { useEffect, useState } from 'react'

function InvalidateTestModal({ show, room, selectedSection, setSelectedSection, notes, setNotes, existingInvalidations = [], onUpdateNotes, onCancel, onConfirm }) {
  // Local copy of each existing invalidation's notes, keyed by invalidation id, so they can be edited in place.
  const [editedNotes, setEditedNotes] = useState({})

  useEffect(() => {
    if (show) {
      const initial = {}
      existingInvalidations.forEach(inv => { initial[inv.id] = inv.notes })
      setEditedNotes(initial)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset edit buffers each time the modal opens
  }, [show, room?._id])

  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Invalidate Test</h2>

        <div className="space-y-4">
          {/* Existing invalidations for this room — edit notes already entered */}
          {existingInvalidations.length > 0 && (
            <div>
              <label className="el-label">Existing Invalidations</label>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {existingInvalidations.map(inv => {
                  const current = editedNotes[inv.id] ?? ''
                  const changed = current.trim() !== inv.notes && current.trim().length > 0
                  return (
                    <div key={inv.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-900">Section {inv.sectionNumber}</span>
                        <span className="text-xs text-slate-400">{inv.invalidatedBy}</span>
                      </div>
                      <textarea
                        value={current}
                        onChange={(e) => setEditedNotes(prev => ({ ...prev, [inv.id]: e.target.value }))}
                        className="el-input"
                        rows={2}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => onUpdateNotes(inv.id, current)}
                          disabled={!changed}
                          className="el-btn el-btn-secondary text-sm px-3 py-1"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
