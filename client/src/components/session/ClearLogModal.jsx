import React from 'react'

function ClearLogModal({ show, onCancel, onConfirm }) {
  if (!show) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Clear Activity Log</h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to clear the activity log for this session?
          </p>
          <p className="text-sm text-slate-500">
            This action cannot be undone. All activity history will be permanently removed.
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
              className="el-btn el-btn-danger flex-1"
            >
              Clear Log
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClearLogModal
