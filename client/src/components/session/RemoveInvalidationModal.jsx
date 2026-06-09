import React from 'react'

function RemoveInvalidationModal({ show, invalidation, onCancel, onConfirm }) {
  if (!show || !invalidation) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Remove Invalidation</h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to remove this test invalidation?
          </p>

          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <p className="text-sm font-medium text-rose-700">
              Section {invalidation.sectionNumber}
            </p>
            <p className="text-sm text-rose-600 mt-1">
              {invalidation.notes}
            </p>
            <p className="text-xs text-rose-500 mt-2">
              Invalidated by {invalidation.invalidatedBy} on {new Date(invalidation.timestamp).toLocaleString()}
            </p>
          </div>

          <p className="text-sm text-slate-500">
            This action will be recorded in the activity log.
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
              Remove Invalidation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RemoveInvalidationModal
