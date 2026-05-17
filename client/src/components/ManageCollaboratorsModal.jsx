import { useState, useEffect } from 'react'
import { testingAPI } from '../services/api'

function ManageCollaboratorsModal({ sessionId, isOpen, onClose, onCollaboratorUpdated, onShowRemoveCollaboratorConfirmation, currentUser }) {
  console.log('ManageCollaboratorsModal props:', {
    sessionId,
    isOpen,
    onClose: typeof onClose,
    onCollaboratorUpdated: typeof onCollaboratorUpdated,
    onShowRemoveCollaboratorConfirmation: typeof onShowRemoveCollaboratorConfirmation
  })
  
  const [collaborators, setCollaborators] = useState([])
  const [owner, setOwner] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [updatingPermissions, setUpdatingPermissions] = useState(null)
  const [removingCollaborator, setRemovingCollaborator] = useState(null)

  // Check if current user is the session owner
  const isOwner = owner && currentUser && owner._id === currentUser._id

  useEffect(() => {
    if (isOpen) {
      fetchCollaborators()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchCollaborators stable, run when modal opens
  }, [isOpen, sessionId])

  useEffect(() => {
    const handleCollaboratorRemoved = (event) => {
      const { sessionId: removedSessionId, userId: removedUserId } = event.detail || {}
      if (removedSessionId === sessionId && removedUserId) {
        // Remove the collaborator from local state
        setCollaborators(prev => prev.filter(collab => collab.userId._id !== removedUserId))
        // Also refresh from server to ensure consistency
        fetchCollaborators()
      }
    }

    const handleConfirmRemoveCollaborator = (event) => {
      console.log('handleConfirmRemoveCollaborator event received:', event)
      const { sessionId: confirmSessionId, userId: confirmUserId } = event.detail || {}
      console.log('Event details - confirmSessionId:', confirmSessionId, 'confirmUserId:', confirmUserId)
      if (confirmSessionId === sessionId && confirmUserId) {
        console.log('Session IDs match, calling performRemoveCollaborator')
        // This is the confirmation, now actually remove the collaborator
        performRemoveCollaborator(confirmUserId)
      } else {
        console.log('Session IDs do not match or missing userId')
        console.log('Expected sessionId:', sessionId, 'Received:', confirmSessionId)
        console.log('Expected userId:', confirmUserId)
      }
    }

    window.addEventListener('collaboratorRemoved', handleCollaboratorRemoved)
    window.addEventListener('confirmRemoveCollaborator', handleConfirmRemoveCollaborator)
    return () => {
      window.removeEventListener('collaboratorRemoved', handleCollaboratorRemoved)
      window.removeEventListener('confirmRemoveCollaborator', handleConfirmRemoveCollaborator)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: event listeners for this sessionId only
  }, [sessionId])

  const fetchCollaborators = async () => {
    try {
      setIsLoading(true)
      const response = await testingAPI.getSessionCollaborators(sessionId)
      setOwner(response.owner)
      setCollaborators(response.collaborators || [])
    } catch (error) {
      console.error('Error fetching collaborators:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePermissionChange = async (userId, permission) => {
    if (permission === 'view') return // View permission can't be changed
    if (!isOwner) return // Only owners can change permissions

    setUpdatingPermissions(userId)
    try {
      const currentCollaborator = collaborators.find(c => c.userId._id === userId)
      const newPermissions = {
        ...currentCollaborator.permissions,
        [permission]: !currentCollaborator.permissions[permission]
      }

      await testingAPI.updateCollaboratorPermissions(sessionId, userId, newPermissions)
      
      // Update local state
      setCollaborators(prev => prev.map(collab => 
        collab.userId._id === userId 
          ? { ...collab, permissions: newPermissions }
          : collab
      ))

      onCollaboratorUpdated()
    } catch (error) {
      console.error('Error updating permissions:', error)
      alert('Failed to update permissions. Please try again.')
    } finally {
      setUpdatingPermissions(null)
    }
  }

  const handleRemoveCollaborator = async (userId) => {
    console.log('handleRemoveCollaborator called with userId:', userId)
    console.log('Modal isOpen state:', isOpen)
    console.log('sessionId prop:', sessionId)
    
    const collaborator = collaborators.find(c => c.userId._id === userId)
    console.log('Found collaborator:', collaborator)
    
    if (collaborator && onShowRemoveCollaboratorConfirmation) {
      console.log('Calling onShowRemoveCollaboratorConfirmation')
      // Prevent the modal from closing by not calling onClose
      onShowRemoveCollaboratorConfirmation(userId, collaborator.userId.username)
      return
    } else {
      console.error('Collaborator not found or onShowRemoveCollaboratorConfirmation not provided')
      console.log('Collaborator found:', !!collaborator)
      console.log('onShowRemoveCollaboratorConfirmation provided:', !!onShowRemoveCollaboratorConfirmation)
    }
  }

  const performRemoveCollaborator = async (userId) => {
    console.log('performRemoveCollaborator called with userId:', userId)
    setRemovingCollaborator(userId)
    try {
      console.log('Calling API to remove collaborator')
      await testingAPI.removeCollaborator(sessionId, userId)
      console.log('Collaborator removed successfully')
      
      // Update local state
      setCollaborators(prev => prev.filter(collab => collab.userId._id !== userId))
      
      // Trigger event to notify Dashboard to refresh sessions
      window.dispatchEvent(new CustomEvent('collaboratorRemoved', { 
        detail: { sessionId, userId } 
      }))
      
      onCollaboratorUpdated()
    } catch (error) {
      console.error('Error removing collaborator:', error)
      alert('Failed to remove collaborator. Please try again.')
    } finally {
      setRemovingCollaborator(null)
    }
  }

  const getPermissionLabel = (permission) => {
    switch (permission) {
      case 'view': return 'View'
      case 'edit': return 'Edit'
      case 'manage': return 'Manage'
      default: return permission
    }
  }

  if (!isOpen) return null

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Manage Collaborators</h2>

        {isLoading ? (
          <div className="flex flex-col items-center py-8">
            <span className="el-spinner h-9 w-9" />
            <p className="mt-3 text-sm text-slate-500">Loading collaborators...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Session Owner */}
            <div>
              <h3 className="el-label">Session Owner</h3>
              <div className="el-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {owner?.username}
                    </div>
                    <div className="text-sm text-slate-500">
                      {owner?.firstName} {owner?.lastName}
                    </div>
                  </div>
                  <span className="el-badge el-badge-brand">
                    Full Access
                  </span>
                </div>
              </div>
            </div>

            {/* Collaborators */}
            <div>
              <h3 className="el-label">
                Collaborators ({collaborators.length})
              </h3>

              {collaborators.length === 0 ? (
                <div className="el-card py-8 text-center text-sm text-slate-500">
                  No collaborators yet. Invite users to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {collaborators.map((collaborator) => (
                    <div key={collaborator.userId._id} className="el-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">
                            {collaborator.userId.username}
                          </div>
                          <div className="text-sm text-slate-500">
                            {collaborator.userId.firstName} {collaborator.userId.lastName}
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          {/* Permissions */}
                          <div className="flex items-center space-x-3">
                            {['view', 'edit', 'manage'].map((permission) => (
                              <div key={permission} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={collaborator.permissions[permission]}
                                  onChange={() => handlePermissionChange(collaborator.userId._id, permission)}
                                  disabled={updatingPermissions === collaborator.userId._id || !isOwner}
                                  className={`h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 ${
                                    !isOwner ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  title={!isOwner && permission !== 'view' ? 'Only session owners can change permissions' : ''}
                                />
                                <label className={`ml-1.5 text-xs font-medium ${
                                  !isOwner && permission !== 'view' ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                  {getPermissionLabel(permission)}
                                </label>
                              </div>
                            ))}
                          </div>

                          {/* Remove Button - Only show for owners */}
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveCollaborator(collaborator.userId._id)}
                              disabled={removingCollaborator === collaborator.userId._id}
                              className="el-icon-btn hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Remove collaborator"
                            >
                              {removingCollaborator === collaborator.userId._id ? (
                                <span className="el-spinner h-4 w-4" />
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-2">
              <button
                onClick={onClose}
                className="el-btn el-btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManageCollaboratorsModal
