import React from 'react'

function InvalidatedTestsSection({ invalidatedTests, rooms, onRemove }) {
  if (invalidatedTests.length === 0) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div className="rounded-xl shadow-sm border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-rose-700 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Invalidated Tests
          </h2>
          <span className="el-badge el-badge-rose">
            {invalidatedTests.length}
          </span>
        </div>

        <div className="space-y-4 max-h-64 overflow-y-auto">
          {invalidatedTests.map((invalidation) => {
            const room = rooms?.find(r => r._id === invalidation.roomId)
            return (
              <div key={invalidation.id} className="bg-white rounded-lg border border-rose-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">
                      Section {invalidation.sectionNumber} - {room?.name || 'Unknown Room'}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Invalidated by {invalidation.invalidatedBy}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">
                      {new Date(invalidation.timestamp).toLocaleString()}
                    </span>
                    <button
                      onClick={() => onRemove(invalidation)}
                      className="text-rose-500 hover:text-rose-700 text-sm"
                      title="Remove invalidation"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="bg-rose-50 rounded p-3">
                  <p className="text-sm text-rose-700">
                    <strong>Notes:</strong> {invalidation.notes}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default InvalidatedTestsSection
