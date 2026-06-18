import React, { useEffect, useState } from 'react'

// Modal for emailing the PDF report: the user enters a recipient and subject line.
// The body is auto-generated (shown read-only) and the PDF is attached server-side.
function EmailReportModal({ show, defaultSubject, body, sending, error, success, onCancel, onSend }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (show) {
      setTo('')
      setSubject(defaultSubject || '')
    }
  }, [show, defaultSubject])

  if (!show) return null

  if (success) {
    return (
      <div className="el-overlay">
        <div className="el-modal el-fade-up p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Report Sent</h2>
          <p className="text-sm text-slate-600">{success}</p>
          <div className="flex justify-end pt-4">
            <button onClick={onCancel} className="el-btn el-btn-primary">Done</button>
          </div>
        </div>
      </div>
    )
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Email Report</h2>

        <div className="space-y-4">
          <div>
            <label className="el-label">Recipient Email</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="el-input"
              placeholder="name@example.com"
              autoFocus
            />
          </div>

          <div>
            <label className="el-label">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="el-input"
              placeholder="Subject line"
            />
          </div>

          <div>
            <label className="el-label">Message (generated automatically)</label>
            <textarea
              value={body || ''}
              readOnly
              rows={8}
              className="el-input bg-slate-50 text-slate-600 cursor-default"
            />
            <p className="text-xs text-slate-400 mt-1">The PDF report is attached automatically.</p>
          </div>

          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={sending}
              className="el-btn el-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={() => onSend(to.trim(), subject.trim())}
              disabled={!emailValid || sending}
              className="el-btn el-btn-primary flex-1"
            >
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailReportModal
