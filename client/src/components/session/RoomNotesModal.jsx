import React from 'react'

function RoomNotesModal({ show, room, notes, setNotes, onCancel, onConfirm }) {
  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Notes to {room.name}</h2>

        <div className="space-y-4">
          <div>
            <label className="el-label">
              Room Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes for this room..."
              rows={4}
              className="el-input resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="el-btn el-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="el-btn el-btn-primary flex-1"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoomNotesModal
