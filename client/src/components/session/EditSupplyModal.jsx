import React from 'react'

function EditSupplyModal({
  show,
  room,
  editingSupply,
  setEditingSupply,
  quantity,
  setQuantity,
  onCancel,
  onConfirm,
}) {
  if (!show || !room || !editingSupply) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit Supply in {room.name}</h2>

        <div className="space-y-4">
          <div>
            <label className="el-label">
              Supply Name
            </label>
            <input
              type="text"
              value={editingSupply.name}
              onChange={(e) => setEditingSupply({ ...editingSupply, name: e.target.value })}
              className="el-input"
            />
          </div>

          <div>
            <label className="el-label">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="el-input"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="el-btn el-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="el-btn el-btn-primary flex-1"
            >
              Update Supply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditSupplyModal
