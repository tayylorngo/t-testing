import { useState, useEffect } from 'react'
import { testingAPI, apiUtils } from '../services/api'
import { useRealTime } from '../contexts/RealTimeContext'
import InviteUsersModal from './InviteUsersModal'
import ManageCollaboratorsModal from './ManageCollaboratorsModal'
import PendingInvitationsModal from './PendingInvitationsModal'

function Dashboard({ user, onLogout, onViewSession }) {
  const { isConnected, reconnect } = useRealTime()
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState('date') // date, name, createdAt, status, roomCount
  const [sortDescending, setSortDescending] = useState(true) // true for newest first by default
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false)
  const [showPendingInvitationsModal, setShowPendingInvitationsModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [newSession, setNewSession] = useState({
    name: '',
    description: '',
    date: '',
    startTime: '',
    endTime: ''
  })
  const [editSession, setEditSession] = useState({
    name: '',
    description: '',
    date: '',
    startTime: '',
    endTime: ''
  })
  const [duplicateSession, setDuplicateSession] = useState({
    name: '',
    description: '',
    date: '',
    startTime: '',
    endTime: ''
  })
  const [leaveSessionModal, setLeaveSessionModal] = useState({ show: false, sessionId: null, sessionName: '' })
  const [removeCollaboratorModal, setRemoveCollaboratorModal] = useState({ show: false, sessionId: null, sessionName: '', userId: null, username: '' })
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' })

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    const handleCollaboratorRemoved = () => {
      fetchSessions()
    }

    window.addEventListener('collaboratorRemoved', handleCollaboratorRemoved)
    return () => {
      window.removeEventListener('collaboratorRemoved', handleCollaboratorRemoved)
    }
  }, [])

  // Ensure WebSocket connection is maintained when Dashboard is active
  useEffect(() => {
    console.log('Dashboard mounted - WebSocket connection status:', isConnected)
    // The RealTimeContext will handle connection automatically
    // This just ensures we're aware of the connection state
  }, [isConnected])

  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      const data = await testingAPI.getSessions()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get sorted and filtered sessions based on current sort criteria and search
  const getSortedSessions = () => {
    if (!sessions || sessions.length === 0) return []
    
    let filteredSessions = [...sessions]
    
    // Filter by search query
    if (searchQuery.trim()) {
      filteredSessions = filteredSessions.filter(session => 
        session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (session.description && session.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    return filteredSessions.sort((a, b) => {
      let aValue, bValue
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          // Sort by test date (newest first by default)
          aValue = new Date(a.date)
          bValue = new Date(b.date)
          comparison = aValue.getTime() - bValue.getTime()
          break
          
        case 'name':
          // Sort alphabetically by session name
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          comparison = aValue.localeCompare(bValue)
          break
          
        case 'createdAt':
          // Sort by creation date (newest first by default)
          aValue = new Date(a.createdAt)
          bValue = new Date(b.createdAt)
          comparison = aValue.getTime() - bValue.getTime()
          break
          
        case 'status':
          // Sort by status (planned, active, completed, cancelled)
          const statusOrder = { 'planned': 1, 'active': 2, 'completed': 3, 'cancelled': 4 }
          aValue = statusOrder[a.status] || 5
          bValue = statusOrder[b.status] || 5
          comparison = aValue - bValue
          break
          
        case 'roomCount':
          // Sort by number of rooms
          aValue = a.rooms?.length || 0
          bValue = b.rooms?.length || 0
          comparison = aValue - bValue
          break
          
        default:
          // Default to date sorting
          aValue = new Date(a.date)
          bValue = new Date(b.date)
          comparison = aValue.getTime() - bValue.getTime()
          break
      }
      
      // Apply sort direction
      return sortDescending ? -comparison : comparison
    })
  }

  const handleCreateSession = async (e) => {
    e.preventDefault()
    try {
      await testingAPI.createSession(newSession)
      setShowCreateModal(false)
      setNewSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
      fetchSessions() // Refresh the list
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  const handleEditSession = async (e) => {
    e.preventDefault()
    try {
      await testingAPI.updateSession(selectedSession._id, editSession)
      setShowEditModal(false)
      setSelectedSession(null)
      setEditSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
      fetchSessions() // Refresh the list
    } catch (error) {
      console.error('Error updating session:', error)
    }
  }

  const handleDeleteSession = async () => {
    try {
      await testingAPI.deleteSession(selectedSession._id)
      setShowDeleteModal(false)
      setSelectedSession(null)
      fetchSessions() // Refresh the list
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const handleDuplicateSession = async (e) => {
    e.preventDefault()
    try {
      await testingAPI.duplicateSession(selectedSession._id, duplicateSession)
      setShowDuplicateModal(false)
      setSelectedSession(null)
      setDuplicateSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
      fetchSessions() // Refresh the list
    } catch (error) {
      console.error('Error duplicating session:', error)
    }
  }

  const openEditModal = (session) => {
    setSelectedSession(session)
    setEditSession({
      name: session.name,
      description: session.description || '',
      date: session.date.split('T')[0], // Convert to YYYY-MM-DD format
      startTime: session.startTime,
      endTime: session.endTime
    })
    setShowEditModal(true)
  }

  const openDeleteModal = (session) => {
    setSelectedSession(session)
    setShowDeleteModal(true)
  }

  const openDuplicateModal = (session) => {
    setSelectedSession(session)
    setDuplicateSession({
      name: `${session.name} (Copy)`,
      description: session.description || '',
      date: session.date.split('T')[0], // Convert to YYYY-MM-DD format
      startTime: session.startTime,
      endTime: session.endTime
    })
    setShowDuplicateModal(true)
  }

  const handleLeaveSession = async (sessionId) => {
    const session = sessions.find(s => s._id === sessionId)
    if (session) {
      setLeaveSessionModal({
        show: true,
        sessionId: sessionId,
        sessionName: session.name
      })
    }
  }

  const confirmLeaveSession = async () => {
    try {
      await testingAPI.leaveSession(leaveSessionModal.sessionId)
      setLeaveSessionModal({ show: false, sessionId: null, sessionName: '' })
      fetchSessions() // Refresh the list
    } catch (error) {
      console.error('Error leaving session:', error)
      setErrorModal({
        show: true,
        title: 'Error Leaving Session',
        message: 'Failed to leave the session. Please try again.'
      })
    }
  }

  const handleShowRemoveCollaboratorConfirmation = (userId, username) => {
    console.log('handleShowRemoveCollaboratorConfirmation called with userId:', userId, 'username:', username)
    console.log('selectedSession:', selectedSession)
    console.log('sessions:', sessions)
    
    // Find the session from the sessions array using the sessionId from the modal
    // Since we're in the ManageCollaboratorsModal, we can use the sessionId prop
    const session = sessions.find(s => s._id === selectedSession?._id)
    console.log('Found session:', session)
    
    if (session) {
      console.log('Setting removeCollaboratorModal with session:', session._id, session.name)
      setRemoveCollaboratorModal({
        show: true,
        sessionId: session._id,
        sessionName: session.name,
        userId: userId,
        username: username
      })
    } else {
      console.error('Session not found for removal confirmation')
      // Try to find the session by looking through all sessions
      const allSessions = sessions.filter(s => s.collaborators?.some(c => c.userId._id === userId))
      console.log('Sessions with this collaborator:', allSessions)
      if (allSessions.length > 0) {
        const foundSession = allSessions[0]
        console.log('Found session from collaborator search:', foundSession)
        setRemoveCollaboratorModal({
          show: true,
          sessionId: foundSession._id,
          sessionName: foundSession.name,
          userId: userId,
          username: username
        })
      }
    }
  }

  const confirmRemoveCollaborator = async () => {
    console.log('confirmRemoveCollaborator called')
    // Store the values before clearing the modal state
    const { sessionId, userId } = removeCollaboratorModal
    console.log('Stored values - sessionId:', sessionId, 'userId:', userId)
    
    // Close the confirmation modal
    setRemoveCollaboratorModal({ show: false, sessionId: null, sessionName: '', userId: null, username: '' })
    
    // Trigger the actual removal in the ManageCollaboratorsModal
    if (sessionId && userId) {
      console.log('Dispatching confirmRemoveCollaborator event')
      window.dispatchEvent(new CustomEvent('confirmRemoveCollaborator', { 
        detail: { 
          sessionId: sessionId, 
          userId: userId 
        } 
      }))
    } else {
      console.log('Missing sessionId or userId, cannot dispatch event')
    }
  }

  const handleShowError = (message) => {
    setErrorModal({
      show: true,
      title: 'Error',
      message: message
    })
  }

  const handleCloseCollaboratorsModal = () => {
    setShowCollaboratorsModal(false)
    setSelectedSession(null)
  }

  const handleCloseInviteModal = () => {
    setShowInviteModal(false)
    setSelectedSession(null)
  }

  const handleManageSession = (session) => {
    if (onViewSession) {
      onViewSession(session._id)
    }
  }

  const handleViewSession = (session) => {
    if (onViewSession) {
      onViewSession(session._id, 'view')
    }
  }

  const canManageSession = (session) => {
    return session.createdBy._id === user._id || 
           session.collaborators?.some(collab => 
             collab.userId._id === user._id && collab.permissions.manage
           )
  }

  const canEditSession = (session) => {
    return session.createdBy._id === user._id || 
           session.collaborators?.some(collab => 
             collab.userId._id === user._id && collab.permissions.manage
           )
  }

  const getSessionRole = (session) => {
    if (session.createdBy._id === user._id) return 'Owner'
    const collaborator = session.collaborators?.find(collab => collab.userId._id === user._id)
    if (collaborator) {
      const permissions = []
      if (collaborator.permissions.view) permissions.push('View')
      if (collaborator.permissions.edit) permissions.push('Edit')
      if (collaborator.permissions.manage) permissions.push('Manage')
      return `Collaborator (${permissions.join(', ')})`
    }
    return 'Unknown'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    if (!timeString) return ''
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">T-Testing Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.firstName} {user.lastName}</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Real-time connection status */}
              <div className="flex items-center gap-2 mr-4">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
                {!isConnected && (
                  <button
                    onClick={() => {
                      console.log('🔄 Manual reconnect requested from Dashboard')
                      reconnect()
                    }}
                    className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                    title="Click to reconnect"
                  >
                    Reconnect
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowPendingInvitationsModal(true)}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-2H4v2zM4 15h6v-2H4v2zM4 11h6V9H4v2zM4 7h6V5H4v2z" />
                </svg>
                Invitations
              </button>
              <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Session Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Testing Session
          </button>
        </div>

        {/* Sort Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="date">Test Date</option>
                  <option value="name">Session Name</option>
                  <option value="createdAt">Created Date</option>
                  <option value="status">Status</option>
                  <option value="roomCount">Room Count</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Order
                </label>
                <button
                  onClick={() => setSortDescending(!sortDescending)}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition duration-200 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  {sortDescending ? 'Newest First' : 'Oldest First'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Sessions
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or description..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {getSortedSessions().length} of {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {getSortedSessions().length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Testing Sessions</h3>
                <p className="text-gray-600 mb-4">Get started by creating your first testing session</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Create Session
                </button>
              </div>
            </div>
          ) : (
            getSortedSessions().map((session) => (
              <div key={session._id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition duration-200">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">{session.name}</h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          session.createdBy._id === user._id 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {getSessionRole(session)}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {canEditSession(session) && (
                        <button
                          onClick={() => openEditModal(session)}
                          className="text-blue-500 hover:text-blue-700 transition duration-200"
                          title="Edit Session"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => openDuplicateModal(session)}
                        className="text-indigo-500 hover:text-indigo-700 transition duration-200"
                        title="Duplicate Session"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {canManageSession(session) && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedSession(session)
                              setShowInviteModal(true)
                            }}
                            className="text-green-500 hover:text-green-700 transition duration-200"
                            title="Invite Users"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSession(session)
                              setShowCollaboratorsModal(true)
                            }}
                            className="text-purple-500 hover:text-purple-700 transition duration-200"
                            title="Manage Collaborators"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        </>
                      )}
                      {session.createdBy._id === user._id && (
                        <button
                          onClick={() => openDeleteModal(session)}
                          className="text-red-500 hover:text-red-700 transition duration-200"
                          title="Delete Session"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      {/* Leave Session button for collaborators */}
                      {session.createdBy._id !== user._id && session.collaborators?.some(collab => collab.userId._id === user._id) && (
                        <button
                          onClick={() => handleLeaveSession(session._id)}
                          className="text-orange-500 hover:text-orange-700 transition duration-200"
                          title="Leave Session"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{session.description}</p>
                  
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDate(session.date)}
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTime(session.startTime)} - {formatTime(session.endTime)}
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {session.rooms?.length || 0} rooms
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {session.sections?.length || 0} sections
                    </div>
                    {session.collaborators && session.collaborators.length > 0 && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {session.collaborators.length} collaborator{session.collaborators.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 space-y-2">
                    <button 
                      onClick={() => handleManageSession(session)}
                      disabled={!canManageSession(session)}
                      className={`w-full font-semibold py-2 px-4 rounded-lg transition duration-200 ${
                        canManageSession(session)
                          ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                          : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      }`}
                      title={canManageSession(session) ? 'Manage Session' : 'You need manage permissions to access this feature'}
                    >
                      Manage Session
                    </button>
                    <button 
                      onClick={() => handleViewSession(session)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                      View Session
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Testing Session</h2>
            
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={newSession.name}
                  onChange={(e) => setNewSession({...newSession, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter session name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession({...newSession, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter session description"
                  rows="3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession({...newSession, date: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newSession.startTime}
                    onChange={(e) => setNewSession({...newSession, startTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newSession.endTime}
                    onChange={(e) => setNewSession({...newSession, endTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditModal && selectedSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Testing Session</h2>
            
            <form onSubmit={handleEditSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={editSession.name}
                  onChange={(e) => setEditSession({...editSession, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter session name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editSession.description}
                  onChange={(e) => setEditSession({...editSession, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter session description"
                  rows="3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={editSession.date}
                  onChange={(e) => setEditSession({...editSession, date: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editSession.startTime}
                    onChange={(e) => setEditSession({...editSession, startTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={editSession.endTime}
                    onChange={(e) => setEditSession({...editSession, endTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedSession(null)
                    setEditSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Update Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Session Modal */}
      {showDeleteModal && selectedSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Testing Session</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete "{selectedSession.name}"? This action cannot be undone.
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSelectedSession(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSession}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Delete Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Session Modal */}
      {showDuplicateModal && selectedSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Duplicate Testing Session</h2>
            
            <form onSubmit={handleDuplicateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={duplicateSession.name}
                  onChange={(e) => setDuplicateSession({...duplicateSession, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter session name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={duplicateSession.description}
                  onChange={(e) => setDuplicateSession({...duplicateSession, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter session description"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={duplicateSession.date}
                  onChange={(e) => setDuplicateSession({...duplicateSession, date: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={duplicateSession.startTime}
                    onChange={(e) => setDuplicateSession({...duplicateSession, startTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={duplicateSession.endTime}
                    onChange={(e) => setDuplicateSession({...duplicateSession, endTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false)
                    setSelectedSession(null)
                    setDuplicateSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Duplicate Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <InviteUsersModal
        sessionId={selectedSession?._id}
        isOpen={showInviteModal}
        onClose={handleCloseInviteModal}
        onInvitationSent={() => {
          fetchSessions()
        }}
        onShowError={handleShowError}
      />

      <ManageCollaboratorsModal
        sessionId={selectedSession?._id}
        isOpen={showCollaboratorsModal}
        onClose={handleCloseCollaboratorsModal}
        onCollaboratorUpdated={() => {
          fetchSessions()
        }}
        onShowRemoveCollaboratorConfirmation={(userId, username) => {
          console.log('Dashboard: onShowRemoveCollaboratorConfirmation called with:', userId, username)
          console.log('Dashboard: handleShowRemoveCollaboratorConfirmation function:', typeof handleShowRemoveCollaboratorConfirmation)
          handleShowRemoveCollaboratorConfirmation(userId, username)
        }}
      />

      <PendingInvitationsModal
        user={user}
        isOpen={showPendingInvitationsModal}
        onClose={() => setShowPendingInvitationsModal(false)}
        onInvitationResponded={() => {
          fetchSessions()
        }}
      />

      {/* Leave Session Confirmation Modal */}
      {leaveSessionModal.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">Leave Testing Session</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to leave "{leaveSessionModal.sessionName}"? You will lose access to this session and all its content.
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setLeaveSessionModal({ show: false, sessionId: null, sessionName: '' })}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLeaveSession}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Leave Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Collaborator Confirmation Modal */}
      {removeCollaboratorModal.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">Remove Collaborator</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to remove <strong>{removeCollaboratorModal.username}</strong> from "{removeCollaboratorModal.sessionName}"? They will lose access to this session.
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setRemoveCollaboratorModal({ show: false, sessionId: null, sessionName: '', userId: null, username: '' })}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveCollaborator}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModal.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">{errorModal.title}</h3>
              <p className="text-sm text-gray-500 mb-6">
                {errorModal.message}
              </p>
              
              <button
                onClick={() => setErrorModal({ show: false, title: '', message: '' })}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard 