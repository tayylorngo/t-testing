import React from 'react'

function ActivityLogPanel({ show, onToggle, isOwner, onClear, activityLog, getActivityLogColors, formatTimestamp }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="el-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Activity Log</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="el-btn el-btn-primary el-btn-sm"
            >
              {show ? 'Hide Log' : 'Show Log'}
            </button>
            {isOwner && (
              <button
                onClick={onClear}
                className="el-btn el-btn-secondary el-btn-sm"
                title="Clear activity log (Owner only)"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {show && (
          <div className="space-y-4">
            {activityLog.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2">No activity recorded yet</p>
                <p className="text-sm">Actions will appear here as they happen</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3">
                {activityLog.map((log, index) => {
                  const colors = getActivityLogColors(log.action);
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 bg-slate-50 rounded-lg border-l-4 ${colors.border}`}
                    >
                      <div className={`flex-shrink-0 w-2 h-2 ${colors.dot} rounded-full mt-2`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">
                            {log.action}
                          </p>
                          <span className="text-xs text-slate-400">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-slate-600">
                            User: <span className="font-medium">{log.userName}</span>
                          </span>
                          {log.roomName && (
                            <span className="text-xs text-slate-600">
                              Room: <span className="font-medium">{log.roomName}</span>
                            </span>
                          )}
                          {log.details && (
                            <span className="text-xs text-slate-600">
                              {log.details}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityLogPanel
