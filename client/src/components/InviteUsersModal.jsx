import { useState, useEffect } from 'react'
import { testingAPI } from '../services/api'

function InviteUsersModal({ sessionId, isOpen, onClose, onInvitationSent, onShowError, currentUser, sessionOwner }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([]) // Array of {user, permissions}
  const [isInviting, setIsInviting] = useState(false)
  const [invitationProgress, setInvitationProgress] = useState({ sent: 0, total: 0, errors: [] })

  // Check if current user is the session owner
  const isOwner = sessionOwner && currentUser && sessionOwner._id === currentUser._id

  // Default permissions for new users
  const getDefaultPermissions = () => {
    if (isOwner) {
      // Owners can set any permissions
      return {
        view: true,
        edit: false,
        manage: false
      }
    } else {
      // Non-owners (managers) can only invite as viewers
      return {
        view: true,
        edit: false,
        manage: false
      }
    }
  }

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const searchUsers = async () => {
        setIsSearching(true)
        try {
          const response = await testingAPI.searchUsers(searchQuery, sessionId)
          setSearchResults(response.users || [])
        } catch (error) {
          console.error('Error searching users:', error)
          setSearchResults([])
        } finally {
          setIsSearching(false)
        }
      }

      const timeoutId = setTimeout(searchUsers, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, sessionId])

  const handleUserSelect = (user) => {
    // Check if user is already selected
    if (selectedUsers.find(u => u.user._id === user._id)) {
      return
    }
    
    // Add user with default permissions
    setSelectedUsers(prev => [...prev, { user, permissions: getDefaultPermissions() }])
    setSearchQuery('') // Clear search after selection
    setSearchResults([])
  }

  const handleUserRemove = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.user._id !== userId))
  }

  const handlePermissionChange = (userId, permission) => {
    if (permission === 'view') {
      // View permission can't be disabled
      return
    }
    
    if (!isOwner) {
      // Non-owners can't change permissions - they can only invite as viewers
      return
    }
    
    setSelectedUsers(prev => prev.map(u => {
      if (u.user._id === userId) {
        return {
          ...u,
          permissions: {
            ...u.permissions,
            [permission]: !u.permissions[permission]
          }
        }
      }
      return u
    }))
  }

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) return

    setIsInviting(true)
    setInvitationProgress({ sent: 0, total: selectedUsers.length, errors: [] })
    
    const errors = []
    
    try {
      // Send invitations to all selected users with their individual permissions
      for (let i = 0; i < selectedUsers.length; i++) {
        const { user, permissions } = selectedUsers[i]
        try {
          await testingAPI.sendInvitation(sessionId, user._id, permissions)
          setInvitationProgress(prev => ({ ...prev, sent: prev.sent + 1 }))
        } catch (error) {
          console.error(`Error sending invitation to ${user.username}:`, error)
          errors.push({ user: user.username, error: error.message || 'Failed to send invitation' })
        }
      }
      
      // Reset form and close modal
      setSelectedUsers([])
      setSearchQuery('')
      setInvitationProgress({ sent: 0, total: 0, errors: [] })
      
      if (errors.length === 0) {
        onInvitationSent()
        onClose()
      } else if (errors.length === selectedUsers.length) {
        // All failed
        if (onShowError) {
          onShowError('Failed to send any invitations. Please try again.')
        } else {
          alert('Failed to send any invitations. Please try again.')
        }
      } else {
        // Some succeeded, some failed
        const successCount = selectedUsers.length - errors.length
        const errorMessage = `Successfully sent ${successCount} invitation(s). ${errors.length} invitation(s) failed.`
        if (onShowError) {
          onShowError(errorMessage)
        } else {
          alert(errorMessage)
        }
        onInvitationSent() // Still call this since some succeeded
        onClose()
      }
    } catch (error) {
      console.error('Error in bulk invitation process:', error)
      if (onShowError) {
        onShowError('Failed to send invitations. Please try again.')
      } else {
        alert('Failed to send invitations. Please try again.')
      }
    } finally {
      setIsInviting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Invite Users to Session</h2>
        
        <div className="space-y-4">
          {/* User Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Users
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search by username, first name, or last name..."
              />
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                  {searchResults.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => handleUserSelect(user)}
                      disabled={selectedUsers.find(u => u.user._id === user._id)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        selectedUsers.find(u => u.user._id === user._id) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-gray-600">
                        {user.firstName} {user.lastName}
                      </div>
                      {selectedUsers.find(u => u.user._id === user._id) && (
                        <div className="text-xs text-blue-600">Already selected</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {isSearching && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-600">
                  Searching...
                </div>
              )}
            </div>
          </div>

          {/* Selected Users with Individual Permissions */}
          {selectedUsers.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-blue-900">
                  Selected Users ({selectedUsers.length})
                </h3>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-4">
                {selectedUsers.map(({ user, permissions }) => (
                  <div key={user._id} className="bg-white rounded-lg p-4 border border-blue-200">
                    {/* User Info */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-blue-900">{user.username}</div>
                        <div className="text-sm text-blue-700">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                      <button
                        onClick={() => handleUserRemove(user._id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Individual Permissions */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Permissions:
                        {!isOwner && (
                          <span className="text-xs text-gray-500 ml-2">
                            (Only owners can set permissions - invited as viewers)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={permissions.view}
                            disabled
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 text-sm text-gray-700">
                            View Session
                          </label>
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={permissions.edit}
                            onChange={() => handlePermissionChange(user._id, 'edit')}
                            disabled={!isOwner}
                            className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                              !isOwner ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={!isOwner ? 'Only session owners can set edit permissions' : ''}
                          />
                          <label className={`ml-2 text-sm ${
                            !isOwner ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                            Edit Details
                          </label>
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={permissions.manage}
                            onChange={() => handlePermissionChange(user._id, 'manage')}
                            disabled={!isOwner}
                            className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                              !isOwner ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={!isOwner ? 'Only session owners can set manage permissions' : ''}
                          />
                          <label className={`ml-2 text-sm ${
                            !isOwner ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                            Manage Others
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isInviting && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Sending Invitations...
                </span>
                <span className="text-sm text-gray-600">
                  {invitationProgress.sent} of {invitationProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(invitationProgress.sent / invitationProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInvitations}
              disabled={selectedUsers.length === 0 || isInviting}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200"
            >
              {isInviting 
                ? `Sending... (${invitationProgress.sent}/${invitationProgress.total})` 
                : `Send Invitations (${selectedUsers.length})`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteUsersModal
