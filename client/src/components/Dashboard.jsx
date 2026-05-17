import { useState, useEffect } from 'react'
import { testingAPI, authAPI } from '../services/api'
import { useRealTime } from '../contexts/RealTimeContext'
import InviteUsersModal from './InviteUsersModal'
import ManageCollaboratorsModal from './ManageCollaboratorsModal'
import PendingInvitationsModal from './PendingInvitationsModal'

function Dashboard({ user, onUserUpdated, onLogout, onViewSession }) {
  const { isConnected, reconnect } = useRealTime()
  const [sessions, setSessions] = useState([])
  const [showArchived, setShowArchived] = useState(false)

  // Set page title
  useEffect(() => {
    document.title = 'Elmira'
  }, [])
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
  const [archiveSessionModal, setArchiveSessionModal] = useState({ show: false, sessionId: null, sessionName: '', isArchived: false })
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

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', username: '', email: '', currentPassword: '', password: '', confirmPassword: '' })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileMessage, setProfileMessage] = useState('')
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  useEffect(() => {
    fetchSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  useEffect(() => {
    const handleCollaboratorRemoved = () => {
      fetchSessions(showArchived)
    }

    window.addEventListener('collaboratorRemoved', handleCollaboratorRemoved)
    return () => {
      window.removeEventListener('collaboratorRemoved', handleCollaboratorRemoved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: setup listener once
  }, [])

  // Ensure WebSocket connection is maintained when Dashboard is active
  useEffect(() => {
    console.log('Dashboard mounted - WebSocket connection status:', isConnected)
    // The RealTimeContext will handle connection automatically
    // This just ensures we're aware of the connection state
  }, [isConnected])

  const fetchSessions = async (includeArchived = showArchived) => {
    try {
      setIsLoading(true)
      const data = await testingAPI.getSessions({ includeArchived })
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Profile handlers
  const handleOpenProfile = () => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        email: user.email || '',
        currentPassword: '',
        password: '',
        confirmPassword: ''
      })
      setProfileErrors({})
      setProfileMessage('')
      setShowProfileModal(true)
    }
  }

  const validateProfileForm = () => {
    const newErrors = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!profileForm.firstName.trim()) newErrors.firstName = 'First name is required'
    else if (profileForm.firstName.trim().length < 2) newErrors.firstName = 'First name must be at least 2 characters'
    if (!profileForm.lastName.trim()) newErrors.lastName = 'Last name is required'
    else if (profileForm.lastName.trim().length < 2) newErrors.lastName = 'Last name must be at least 2 characters'
    if (!profileForm.username) newErrors.username = 'Username is required'
    else if (profileForm.username.length < 3) newErrors.username = 'Username must be at least 3 characters'
    else if (profileForm.username.length > 30) newErrors.username = 'Username must be less than 30 characters'
    if (!profileForm.email.trim()) newErrors.email = 'Email is required'
    else if (!emailRegex.test(profileForm.email.trim())) newErrors.email = 'Please enter a valid email'
    if (profileForm.password) {
      if (!profileForm.currentPassword.trim()) newErrors.currentPassword = 'Enter your current password to change it'
      if (profileForm.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(profileForm.password)) newErrors.password = 'Password must contain uppercase, lowercase, and a number'
      if (profileForm.password !== profileForm.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    }
    setProfileErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileMessage('')
    if (!validateProfileForm()) return
    setIsProfileLoading(true)
    try {
      const updateData = {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        username: profileForm.username,
        email: profileForm.email.trim().toLowerCase()
      }
      if (profileForm.password) {
        updateData.currentPassword = profileForm.currentPassword
        updateData.password = profileForm.password
      }
      const response = await authAPI.updateProfile(updateData)
      if (onUserUpdated && response.user) onUserUpdated(response.user)
      setProfileMessage('Profile updated successfully')
      setProfileForm(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }))
    } catch (error) {
      setProfileMessage(error.message || 'Failed to update profile')
    } finally {
      setIsProfileLoading(false)
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
          
        case 'status': {
          // Sort by status (planned, active, completed, cancelled)
          const statusOrder = { 'planned': 1, 'active': 2, 'completed': 3, 'cancelled': 4 }
          aValue = statusOrder[a.status] || 5
          bValue = statusOrder[b.status] || 5
          comparison = aValue - bValue
          break
        }
          
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

  const handleToggleShowArchived = () => {
    const next = !showArchived
    setShowArchived(next)
    fetchSessions(next)
  }

  const openArchiveSessionModal = (session) => {
    setArchiveSessionModal({
      show: true,
      sessionId: session._id,
      sessionName: session.name,
      isArchived: !!session.archived
    })
  }

  const confirmArchiveSession = async () => {
    try {
      const { sessionId, isArchived } = archiveSessionModal
      if (!sessionId) return

      if (isArchived) {
        await testingAPI.unarchiveSession(sessionId)
      } else {
        await testingAPI.archiveSession(sessionId)
      }

      setArchiveSessionModal({ show: false, sessionId: null, sessionName: '', isArchived: false })
      fetchSessions(showArchived)
    } catch (error) {
      console.error('Error archiving/unarchiving session:', error)
      setArchiveSessionModal({ show: false, sessionId: null, sessionName: '', isArchived: false })
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'Failed to update archive status. Please try again.'
      })
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

  const isSessionOwner = (session) => {
    return session.createdBy._id === user._id
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
      if (collaborator.permissions.manage) permissions.push('Manager')
      return `Collaborator (${permissions.join(', ')})`
    }
    return 'Unknown'
  }

  const formatDate = (dateString) => {
    // Extract UTC date parts to avoid timezone conversion issues
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
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
      <div className="el-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="el-spinner h-9 w-9" />
          <p className="text-sm text-slate-500">Loading sessions…</p>
        </div>
      </div>
    )
  }

  const sortedSessions = getSortedSessions()

  return (
    <div className="el-app-bg pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 shadow-sm">
              <svg className="h-6 w-6 text-white" viewBox="0 0 32 32" fill="none">
                <rect x="8" y="6" width="2.5" height="20" rx="1.25" fill="white"/>
                <rect x="8" y="6" width="12" height="2.5" rx="1.25" fill="white"/>
                <rect x="8" y="14.75" width="9" height="2.5" rx="1.25" fill="white"/>
                <rect x="8" y="23.5" width="12" height="2.5" rx="1.25" fill="white"/>
                <circle cx="24" cy="10" r="2" fill="white" opacity="0.8"/>
                <circle cx="26" cy="22" r="1.5" fill="white" opacity="0.6"/>
              </svg>
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Elmira</h1>
              <p className="hidden text-xs text-slate-400 sm:block">Testing Session Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Real-time connection status */}
            <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${
              isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
              {isConnected ? 'Live' : 'Offline'}
            </span>
            {!isConnected && (
              <button
                onClick={reconnect}
                className="el-btn el-btn-secondary el-btn-sm"
                title="Click to reconnect"
              >
                Reconnect
              </button>
            )}

            <button
              onClick={() => setShowPendingInvitationsModal(true)}
              className="el-icon-btn"
              title="Invitations"
              aria-label="Invitations"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              onClick={handleOpenProfile}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              title="Edit profile"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
              </span>
              <span className="hidden sm:inline">{user.firstName}</span>
            </button>

            <button
              onClick={onLogout}
              className="el-btn el-btn-ghost el-btn-sm"
              title="Log out"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Testing Sessions</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Welcome back, {user.firstName} — you have {sessions.length} session{sessions.length !== 1 ? 's' : ''}.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="el-btn el-btn-primary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        </div>

        {/* Toolbar */}
        <div className="el-card mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions by name or description…"
              className="el-input pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="el-input w-auto py-1.5 text-sm"
            >
              <option value="date">Sort: Test Date</option>
              <option value="name">Sort: Name</option>
              <option value="createdAt">Sort: Created</option>
              <option value="status">Sort: Status</option>
              <option value="roomCount">Sort: Room Count</option>
            </select>

            <button
              onClick={() => setSortDescending(!sortDescending)}
              className="el-btn el-btn-secondary el-btn-sm"
              title="Toggle sort order"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDescending ? 'M3 4h13M3 8h9M3 12h5m9 0l4 4m0 0l4-4m-4 4V8' : 'M3 4h13M3 8h9M3 12h5m9 8l4-4m0 0l4 4m-4-4v8'} />
              </svg>
              {sortDescending ? 'Newest' : 'Oldest'}
            </button>

            <button
              onClick={handleToggleShowArchived}
              className={`el-btn el-btn-sm ${showArchived ? 'el-btn-primary' : 'el-btn-secondary'}`}
              title={showArchived ? 'Hide archived sessions' : 'Show archived sessions'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4m4-4h8" />
              </svg>
              Archived
            </button>

            <span className="ml-1 text-xs font-medium text-slate-400">
              {sortedSessions.length} / {sessions.length}
            </span>
          </div>
        </div>

        {/* Sessions List */}
        {sortedSessions.length === 0 ? (
          <div className="el-card flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {searchQuery ? 'No matching sessions' : 'No testing sessions yet'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {searchQuery ? 'Try a different search term or clear the filter.' : 'Create your first testing session to start monitoring rooms and proctors.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="el-btn el-btn-primary mt-5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Session
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedSessions.map((session) => {
              const statusStyles = {
                planned: 'bg-slate-100 text-slate-600',
                active: 'bg-blue-100 text-blue-700',
                completed: 'bg-emerald-100 text-emerald-700',
                cancelled: 'bg-rose-100 text-rose-700',
              }
              const status = session.status || 'planned'
              const owner = session.createdBy._id === user._id
              return (
                <div key={session._id} className="el-card el-fade-up flex flex-col transition hover:shadow-md hover:ring-1 hover:ring-brand-200">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`el-badge ${statusStyles[status] || statusStyles.planned}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span className={`el-badge ${owner ? 'el-badge-brand' : 'el-badge-green'}`}>
                          {getSessionRole(session)}
                        </span>
                        {session.archived && (
                          <span className="el-badge el-badge-slate">Archived</span>
                        )}
                      </div>
                      <h3 className="truncate text-base font-semibold text-slate-900" title={session.name}>
                        {session.name}
                      </h3>
                    </div>
                  </div>

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-4">
                    <div className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
                      <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{formatDate(session.date)}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
                      <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatTime(session.startTime)} – {formatTime(session.endTime)}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <p className="el-stat-label">Rooms</p>
                      <p className="text-sm font-semibold text-slate-900">{session.rooms?.length || 0}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <p className="el-stat-label">Sections</p>
                      <p className="text-sm font-semibold text-slate-900">{session.sections?.length || 0}</p>
                    </div>
                    {session.description && (
                      <p className="col-span-2 line-clamp-2 text-xs text-slate-400">{session.description}</p>
                    )}
                    {session.collaborators && session.collaborators.length > 0 && (
                      <p className="col-span-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {session.collaborators.length} collaborator{session.collaborators.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions toolbar */}
                  <div className="mt-auto flex items-center gap-0.5 border-t border-slate-100 px-2 py-1.5">
                    {canEditSession(session) && (
                      <button onClick={() => openEditModal(session)} className="el-icon-btn" title="Edit session">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => openDuplicateModal(session)} className="el-icon-btn" title="Duplicate session">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {canManageSession(session) && (
                      <>
                        <button onClick={() => openArchiveSessionModal(session)} className="el-icon-btn" title={session.archived ? 'Unarchive session' : 'Archive session'}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4m4-4h8" />
                          </svg>
                        </button>
                        <button onClick={() => { setSelectedSession(session); setShowInviteModal(true) }} className="el-icon-btn" title={isSessionOwner(session) ? 'Invite users' : 'Invite users (viewer only)'}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-2a4 4 0 014-4h4m6 0v6m3-3h-6" />
                          </svg>
                        </button>
                        <button onClick={() => { setSelectedSession(session); setShowCollaboratorsModal(true) }} className="el-icon-btn" title={isSessionOwner(session) ? 'Manage collaborators' : 'View collaborators'}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </>
                    )}
                    {session.createdBy._id === user._id && (
                      <button onClick={() => openDeleteModal(session)} className="el-icon-btn hover:bg-rose-50 hover:text-rose-600" title="Delete session">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    {session.createdBy._id !== user._id && session.collaborators?.some(collab => collab.userId._id === user._id) && (
                      <button onClick={() => handleLeaveSession(session._id)} className="el-icon-btn hover:bg-amber-50 hover:text-amber-600" title="Leave session">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => handleViewSession(session)}
                        className="el-btn el-btn-secondary el-btn-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleManageSession(session)}
                        disabled={!canManageSession(session)}
                        className="el-btn el-btn-primary el-btn-sm"
                        title={canManageSession(session) ? 'Manage session' : 'You need manage permissions for this'}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Create Testing Session</h2>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="el-label">Session Name</label>
                <input
                  type="text"
                  value={newSession.name}
                  onChange={(e) => setNewSession({...newSession, name: e.target.value})}
                  className="el-input"
                  placeholder="e.g. June Regents — Algebra I"
                  required
                />
              </div>

              <div>
                <label className="el-label">Description</label>
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession({...newSession, description: e.target.value})}
                  className="el-input"
                  placeholder="Optional notes about this session"
                  rows="3"
                />
              </div>

              <div>
                <label className="el-label">Date</label>
                <input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession({...newSession, date: e.target.value})}
                  className="el-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="el-label">Start Time</label>
                  <input
                    type="time"
                    value={newSession.startTime}
                    onChange={(e) => setNewSession({...newSession, startTime: e.target.value})}
                    className="el-input"
                    required
                  />
                </div>
                <div>
                  <label className="el-label">End Time</label>
                  <input
                    type="time"
                    value={newSession.endTime}
                    onChange={(e) => setNewSession({...newSession, endTime: e.target.value})}
                    className="el-input"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="el-btn el-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="el-btn el-btn-primary flex-1">
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditModal && selectedSession && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Testing Session</h2>

            <form onSubmit={handleEditSession} className="space-y-4">
              <div>
                <label className="el-label">Session Name</label>
                <input
                  type="text"
                  value={editSession.name}
                  onChange={(e) => setEditSession({...editSession, name: e.target.value})}
                  className="el-input"
                  placeholder="Enter session name"
                  required
                />
              </div>

              <div>
                <label className="el-label">Description</label>
                <textarea
                  value={editSession.description}
                  onChange={(e) => setEditSession({...editSession, description: e.target.value})}
                  className="el-input"
                  placeholder="Optional notes about this session"
                  rows="3"
                />
              </div>

              <div>
                <label className="el-label">Date</label>
                <input
                  type="date"
                  value={editSession.date}
                  onChange={(e) => setEditSession({...editSession, date: e.target.value})}
                  className="el-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="el-label">Start Time</label>
                  <input
                    type="time"
                    value={editSession.startTime}
                    onChange={(e) => setEditSession({...editSession, startTime: e.target.value})}
                    className="el-input"
                    required
                  />
                </div>
                <div>
                  <label className="el-label">End Time</label>
                  <input
                    type="time"
                    value={editSession.endTime}
                    onChange={(e) => setEditSession({...editSession, endTime: e.target.value})}
                    className="el-input"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedSession(null)
                    setEditSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
                  }}
                  className="el-btn el-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="el-btn el-btn-primary flex-1">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Session Modal */}
      {showDeleteModal && selectedSession && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Delete Testing Session</h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              Are you sure you want to delete <strong className="text-slate-700">{selectedSession.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedSession(null) }}
                className="el-btn el-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={handleDeleteSession} className="el-btn el-btn-danger flex-1">
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive/Unarchive Session Modal */}
      {archiveSessionModal.show && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4m4-4h8" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {archiveSessionModal.isArchived ? 'Unarchive Session' : 'Archive Session'}
            </h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              {archiveSessionModal.isArchived
                ? <>Unarchive <strong className="text-slate-700">{archiveSessionModal.sessionName}</strong> so it shows in your main list again?</>
                : <>Archive <strong className="text-slate-700">{archiveSessionModal.sessionName}</strong>? It will be hidden from your main list unless you choose “Archived”.</>
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setArchiveSessionModal({ show: false, sessionId: null, sessionName: '', isArchived: false })}
                className="el-btn el-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchiveSession}
                className={`el-btn flex-1 ${archiveSessionModal.isArchived ? 'el-btn-success' : 'el-btn-primary'}`}
              >
                {archiveSessionModal.isArchived ? 'Unarchive' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Session Modal */}
      {showDuplicateModal && selectedSession && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Duplicate Testing Session</h2>

            <form onSubmit={handleDuplicateSession} className="space-y-4">
              <div>
                <label className="el-label">Session Name</label>
                <input
                  type="text"
                  value={duplicateSession.name}
                  onChange={(e) => setDuplicateSession({...duplicateSession, name: e.target.value})}
                  className="el-input"
                  placeholder="Enter session name"
                  required
                />
              </div>

              <div>
                <label className="el-label">Description (Optional)</label>
                <textarea
                  value={duplicateSession.description}
                  onChange={(e) => setDuplicateSession({...duplicateSession, description: e.target.value})}
                  className="el-input"
                  placeholder="Optional notes about this session"
                  rows="3"
                />
              </div>

              <div>
                <label className="el-label">Date</label>
                <input
                  type="date"
                  value={duplicateSession.date}
                  onChange={(e) => setDuplicateSession({...duplicateSession, date: e.target.value})}
                  className="el-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="el-label">Start Time</label>
                  <input
                    type="time"
                    value={duplicateSession.startTime}
                    onChange={(e) => setDuplicateSession({...duplicateSession, startTime: e.target.value})}
                    className="el-input"
                    required
                  />
                </div>
                <div>
                  <label className="el-label">End Time</label>
                  <input
                    type="time"
                    value={duplicateSession.endTime}
                    onChange={(e) => setDuplicateSession({...duplicateSession, endTime: e.target.value})}
                    className="el-input"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false)
                    setSelectedSession(null)
                    setDuplicateSession({ name: '', description: '', date: '', startTime: '', endTime: '' })
                  }}
                  className="el-btn el-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="el-btn el-btn-primary flex-1">
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
        currentUser={user}
        sessionOwner={selectedSession?.createdBy}
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
        currentUser={user}
      />

      <PendingInvitationsModal
        user={user}
        isOpen={showPendingInvitationsModal}
        onClose={() => setShowPendingInvitationsModal(false)}
        onInvitationResponded={() => {
          fetchSessions()
        }}
      />

      {/* Profile Modal */}
      {showProfileModal && user && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up max-h-[90vh] overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Profile</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="el-label">First Name</label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className={`el-input ${profileErrors.firstName ? 'el-input-error' : ''}`}
                    disabled={isProfileLoading}
                  />
                  {profileErrors.firstName && <span className="el-error">{profileErrors.firstName}</span>}
                </div>
                <div>
                  <label className="el-label">Last Name</label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className={`el-input ${profileErrors.lastName ? 'el-input-error' : ''}`}
                    disabled={isProfileLoading}
                  />
                  {profileErrors.lastName && <span className="el-error">{profileErrors.lastName}</span>}
                </div>
              </div>
              <div>
                <label className="el-label">Username</label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                  className={`el-input ${profileErrors.username ? 'el-input-error' : ''}`}
                  disabled={isProfileLoading}
                />
                {profileErrors.username && <span className="el-error">{profileErrors.username}</span>}
              </div>
              <div>
                <label className="el-label">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className={`el-input ${profileErrors.email ? 'el-input-error' : ''}`}
                  disabled={isProfileLoading}
                />
                {profileErrors.email && <span className="el-error">{profileErrors.email}</span>}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Change Password</p>
                <div className="space-y-3">
                  <div>
                    <label className="el-label">Current Password</label>
                    <input
                      type="password"
                      value={profileForm.currentPassword}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className={`el-input ${profileErrors.currentPassword ? 'el-input-error' : ''}`}
                      placeholder="Required to change password"
                      disabled={isProfileLoading}
                    />
                    {profileErrors.currentPassword && <span className="el-error">{profileErrors.currentPassword}</span>}
                  </div>
                  <div>
                    <label className="el-label">New Password</label>
                    <input
                      type="password"
                      value={profileForm.password}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, password: e.target.value }))}
                      className={`el-input ${profileErrors.password ? 'el-input-error' : ''}`}
                      placeholder="Leave blank to keep current"
                      disabled={isProfileLoading}
                    />
                    {profileErrors.password && <span className="el-error">{profileErrors.password}</span>}
                  </div>
                  <div>
                    <label className="el-label">Confirm New Password</label>
                    <input
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className={`el-input ${profileErrors.confirmPassword ? 'el-input-error' : ''}`}
                      placeholder="Confirm new password"
                      disabled={isProfileLoading}
                    />
                    {profileErrors.confirmPassword && <span className="el-error">{profileErrors.confirmPassword}</span>}
                  </div>
                </div>
              </div>

              {profileMessage && (
                <div className={`rounded-lg px-3 py-2 text-sm ${profileMessage.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {profileMessage}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowProfileModal(false); setProfileMessage(''); }}
                  className="el-btn el-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProfileLoading}
                  className="el-btn el-btn-primary flex-1"
                >
                  {isProfileLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Session Confirmation Modal */}
      {leaveSessionModal.show && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Leave Testing Session</h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              Are you sure you want to leave <strong className="text-slate-700">{leaveSessionModal.sessionName}</strong>? You will lose access to this session and all its content.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveSessionModal({ show: false, sessionId: null, sessionName: '' })}
                className="el-btn el-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={confirmLeaveSession} className="el-btn el-btn-danger flex-1">
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Collaborator Confirmation Modal */}
      {removeCollaboratorModal.show && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Remove Collaborator</h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              Are you sure you want to remove <strong className="text-slate-700">{removeCollaboratorModal.username}</strong> from <strong className="text-slate-700">{removeCollaboratorModal.sessionName}</strong>? They will lose access to this session.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveCollaboratorModal({ show: false, sessionId: null, sessionName: '', userId: null, username: '' })}
                className="el-btn el-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={confirmRemoveCollaborator} className="el-btn el-btn-danger flex-1">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModal.show && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">{errorModal.title}</h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">{errorModal.message}</p>
            <button
              onClick={() => setErrorModal({ show: false, title: '', message: '' })}
              className="el-btn el-btn-primary w-full"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard 