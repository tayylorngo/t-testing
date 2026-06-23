import React from 'react'

// Set/edit a reminder for a room. The reminder pops up when returning tests for any
// section in this room (in the "Mark Section Complete" flow).
function RoomReminderModal({ show, room, reminder, setReminder, onCancel, onConfirm }) {
  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Reminder for {room.name}</h2>
        <p className="text-sm text-slate-500 mb-4">
          Shown when returning tests for a section in this room.
        </p>

        <div className="space-y-4">
          <div>
            <label className="el-label">Reminder</label>
            <textarea
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              placeholder="e.g. Collect the extra scratch paper, double-check section 12's roster…"
              rows={4}
              className="el-input resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button onClick={onCancel} className="el-btn el-btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} className="el-btn el-btn-primary flex-1">
            Save Reminder
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoomReminderModal
