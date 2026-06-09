import React from 'react'

function EditSuppliesModal({ show, room, onAdjustQuantity, onRemoveSupply, onClose }) {
  if (!show || !room) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit Supplies for {room.name}</h2>

        <div className="space-y-4">
          {(() => {
            const supplies = room.supplies || []
            const initialSupplies = supplies.filter(supply => supply.startsWith('INITIAL_'))
            const addedSupplies = supplies.filter(supply => !supply.startsWith('INITIAL_'))

            const initialSupplyCounts = {}
            initialSupplies.forEach(supply => {
              const cleanName = supply.replace('INITIAL_', '')
              initialSupplyCounts[cleanName] = (initialSupplyCounts[cleanName] || 0) + 1
            })

            const addedSupplyCounts = {}
            addedSupplies.forEach(supply => {
              addedSupplyCounts[supply] = (addedSupplyCounts[supply] || 0) + 1
            })

            return (
              <div className="space-y-4">
                {/* Initial Supplies */}
                {Object.keys(initialSupplyCounts).length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Initial Supplies</h3>
                    <div className="space-y-2">
                      {Object.entries(initialSupplyCounts).map(([supplyName, count]) => (
                        <div key={supplyName} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-emerald-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-emerald-700 font-medium">{supplyName}</span>
                          </div>
                          <span className="text-emerald-700 font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Added Supplies */}
                {Object.keys(addedSupplyCounts).length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Added Supplies</h3>
                    <div className="space-y-2">
                      {Object.entries(addedSupplyCounts).map(([supplyName, count]) => (
                        <div key={supplyName} className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg p-3">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-brand-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-brand-700 font-medium">{supplyName}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => onAdjustQuantity(room._id, supplyName, -1)}
                                disabled={count <= 0}
                                className="w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition duration-200"
                                title="Remove 1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                              <span className="text-brand-700 font-semibold min-w-[2rem] text-center">{count}</span>
                              <button
                                onClick={() => onAdjustQuantity(room._id, supplyName, 1)}
                                className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition duration-200"
                                title="Add 1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </button>
                            </div>
                            <button
                              onClick={() => onRemoveSupply(room._id, supplyName)}
                              className="text-rose-500 hover:text-rose-700 p-1 ml-2"
                              title="Remove all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(initialSupplyCounts).length === 0 && Object.keys(addedSupplyCounts).length === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-slate-500">No supplies assigned to this room</p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="el-btn el-btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditSuppliesModal
