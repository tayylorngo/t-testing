import React, { useState } from 'react'

// View-mode control for the session's external notes sheet (keeps PII off this app).
// - When a link exists: a "Notes" button that opens it in a new tab (+ edit for editors).
// - When empty and the user can edit: an "Add notes sheet" button.
// onSave(url) persists the link (empty string clears it).
function NotesSheetControl({ url, canEdit, onSave }) {
  const [showModal, setShowModal] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const openModal = () => { setValue(url || ''); setShowModal(true) }

  const persist = async (next) => {
    setSaving(true)
    try {
      await onSave(next)
      setShowModal(false)
    } catch (err) {
      console.error('Failed to save notes sheet link:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {url ? (
        <div className="flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="el-btn el-btn-secondary"
            title="Open the notes sheet in a new tab"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes
          </a>
          {canEdit && (
            <button onClick={openModal} className="el-icon-btn" title="Edit notes sheet link" aria-label="Edit notes sheet link">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
      ) : canEdit ? (
        <button onClick={openModal} className="el-btn el-btn-secondary" title="Link a Google Sheet for notes">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add notes sheet
        </button>
      ) : null}

      {showModal && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Notes Sheet</h2>
            <p className="text-sm text-slate-500 mb-4">
              Link a Google Sheet for notes. It opens in a new tab — no student PII is stored in this app.
            </p>

            <label className="el-label">Google Sheets link</label>
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="el-input"
              placeholder="https://docs.google.com/spreadsheets/..."
              autoFocus
            />

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowModal(false)} className="el-btn el-btn-secondary flex-1" disabled={saving}>
                Cancel
              </button>
              <button onClick={() => persist(value.trim())} className="el-btn el-btn-primary flex-1" disabled={saving || !value.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {url && (
              <button onClick={() => persist('')} className="el-btn el-btn-danger w-full mt-2" disabled={saving}>
                Remove link
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default NotesSheetControl
