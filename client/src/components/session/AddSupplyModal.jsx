import React from 'react'

function AddSupplyModal({
  show,
  room,
  presetSupplies,
  selectedPresetSupply,
  setSelectedPresetSupply,
  quantity,
  setQuantity,
  onCancel,
  onConfirm,
}) {
  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Supply to {room.name}</h2>

        <div className="space-y-4">
          {/* Preset Supplies */}
          <div>
            <label className="el-label">
              Select Supply
            </label>
            <select
              value={selectedPresetSupply}
              onChange={(e) => setSelectedPresetSupply(e.target.value)}
              className="el-input"
            >
              <option value="">Choose a supply</option>
              {presetSupplies.map(supply => (
                <option key={supply} value={supply}>{supply}</option>
              ))}
            </select>
          </div>

          {/* Quantity */}
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
              disabled={!selectedPresetSupply}
              className="el-btn el-btn-primary flex-1"
            >
              Add Supply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddSupplyModal
