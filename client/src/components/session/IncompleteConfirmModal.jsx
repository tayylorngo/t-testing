import React from 'react'

function IncompleteConfirmModal({ show, onCancel, onConfirm }) {
  if (!show) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Mark Room Incomplete</h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to mark this room as incomplete?
          </p>
          <p className="text-sm text-slate-500">
            This will change the room status back to active and clear the present students count. The session status may also change back to active if all rooms become incomplete.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="el-btn el-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="el-btn flex-1 bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500"
            >
              Mark Incomplete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncompleteConfirmModal
