import { useState, useEffect } from 'react'
import { testingAPI } from '../services/api'

function InviteUsersModal({ sessionId, isOpen, onClose, onInvitationSent, onShowError }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [permissions, setPermissions] = useState({
    view: true,
    edit: false,
    manage: false
  })
  const [isInviting, setIsInviting] = useState(false)

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
  }, [searchQuery])

  const handleUserSelect = (user) => {
    setSelectedUser(user)
    setSearchQuery(user.username)
    setSearchResults([])
  }

  const handleSendInvitation = async () => {
    if (!selectedUser) return

    setIsInviting(true)
    try {
      await testingAPI.sendInvitation(sessionId, selectedUser._id, permissions)
      setSelectedUser(null)
      setSearchQuery('')
      setPermissions({ view: true, edit: false, manage: false })
      onInvitationSent()
      onClose()
    } catch (error) {
      console.error('Error sending invitation:', error)
      if (onShowError) {
        onShowError('Failed to send invitation. Please try again.')
      } else {
        alert('Failed to send invitation. Please try again.')
      }
    } finally {
      setIsInviting(false)
    }
  }

  const handlePermissionChange = (permission) => {
    if (permission === 'view') {
      // View permission can't be disabled
      return
    }
    
    setPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Invite User to Session</h2>
        
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
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-gray-600">
                        {user.firstName} {user.lastName}
                      </div>
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

          {/* Selected User Display */}
          {selectedUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-blue-900">{selectedUser.username}</div>
                  <div className="text-sm text-blue-700">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(null)
                    setSearchQuery('')
                  }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={permissions.view}
                  disabled
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">
                  View Session (Required)
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={permissions.edit}
                  onChange={() => handlePermissionChange('edit')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Edit Session Details
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={permissions.manage}
                  onChange={() => handlePermissionChange('manage')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Manage Collaborators & Invitations
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInvitation}
              disabled={!selectedUser || isInviting}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200"
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteUsersModal
