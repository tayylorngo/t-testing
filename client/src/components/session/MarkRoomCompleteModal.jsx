import React from 'react'

function MarkRoomCompleteModal({ show, rooms, selectedRoom, setSelectedRoom, onCancel, onContinue }) {
  if (!show) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Mark Room Complete</h2>

        <div className="space-y-6">
          <div>
            <label className="el-label">
              Select Room
            </label>
            <select
              value={selectedRoom?._id || ''}
              onChange={(e) => {
                const roomId = e.target.value
                if (!roomId) {
                  setSelectedRoom(null)
                  return
                }
                const room = rooms?.find(r => r._id === roomId)
                setSelectedRoom(room || null)
              }}
              className="el-input"
            >
              <option value="">Choose a room...</option>
              {rooms
                ?.filter(room => room.status !== 'completed')
                ?.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                ?.map(room => (
                  <option key={room._id} value={room._id}>
                    {room.name} ({room.sections?.length || 0} section{room.sections?.length !== 1 ? 's' : ''})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="el-btn el-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              disabled={!selectedRoom}
              className="el-btn el-btn-success flex-1"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarkRoomCompleteModal
