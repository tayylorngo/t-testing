import React from 'react'

function AttendanceErrorModal({ show, message, onClose }) {
  if (!show) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 ml-4">Invalid Attendance</h2>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {message}
          </p>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="el-btn el-btn-danger"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AttendanceErrorModal
