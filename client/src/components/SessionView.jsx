import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { testingAPI } from '../services/api'
import confetti from 'canvas-confetti'
import { useRealTime } from '../contexts/RealTimeContext'
import { exportSessionToExcel } from '../utils/excelExport'

function SessionView({ user, onBack }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { joinSession, onSessionUpdate, isConnected, reconnect, connectionAttempts } = useRealTime()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(null)
  
  // Memoize session data to prevent unnecessary re-renders
  const memoizedSession = useMemo(() => session, [session?._id, session?.status, session?.rooms?.length])
  
  // Debounced session update to prevent rapid successive updates
  const [debouncedSession, setDebouncedSession] = useState(null)
  
  // Ref to store fetchSessionData function to avoid dependency issues
  const fetchSessionDataRef = useRef()
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSession(session)
    }, 25) // Further reduced to 25ms for more responsive feel
    
    return () => clearTimeout(timer)
  }, [session])
  
  const [showAddSupplyModal, setShowAddSupplyModal] = useState(false)
  const [showEditSupplyModal, setShowEditSupplyModal] = useState(false)
  const [showEditSuppliesModal, setShowEditSuppliesModal] = useState(false)
  const [showMoveStudentsModal, setShowMoveStudentsModal] = useState(false)
  const [showPresentStudentsModal, setShowPresentStudentsModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [newSupplyQuantity, setNewSupplyQuantity] = useState(1)
  const [selectedPresetSupply, setSelectedPresetSupply] = useState('')
  const [editingSupply, setEditingSupply] = useState(null)
  const [editSupplyQuantity, setEditSupplyQuantity] = useState(1)
  const [moveFromRoom, setMoveFromRoom] = useState(null)
  const [studentMoveData, setStudentMoveData] = useState({}) // { sectionId: { studentsToMove: number, destinationRoom: roomId } }
  // const [roomTimeMultipliers] = useState({}) // For future 1.5x, 2x time features
  const [presentStudentsCount, setPresentStudentsCount] = useState('')
  const [roomToComplete, setRoomToComplete] = useState(null)
  const [sectionPresentCounts, setSectionPresentCounts] = useState({})

  // Activity log state
  const [activityLog, setActivityLog] = useState([])
  const [showActivityLog, setShowActivityLog] = useState(true)
  const [showClearLogModal, setShowClearLogModal] = useState(false)
  const [showIncompleteConfirmModal, setShowIncompleteConfirmModal] = useState(false)
  const [roomToMarkIncomplete, setRoomToMarkIncomplete] = useState(null)
  const [showDropdown, setShowDropdown] = useState(null)
  const [preventClickOutside, setPreventClickOutside] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  // const buttonRef = useRef(null) // Not currently used // roomId for which dropdown is open
  const [showInvalidateModal, setShowInvalidateModal] = useState(false)
  const [roomToInvalidate, setRoomToInvalidate] = useState(null)
  const [invalidationNotes, setInvalidationNotes] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [invalidatedTests, setInvalidatedTests] = useState([]) // Array of {roomId, sectionNumber, notes, timestamp, invalidatedBy}
  const [showRemoveInvalidationModal, setShowRemoveInvalidationModal] = useState(false)
  const [invalidationToRemove, setInvalidationToRemove] = useState(null)
  const [showRoomNotesModal, setShowRoomNotesModal] = useState(false)
  const [selectedRoomForNotes, setSelectedRoomForNotes] = useState(null)
  const [roomNotes, setRoomNotes] = useState('')



  const confirmClearActivityLog = useCallback(async () => {
    try {
      await testingAPI.clearActivityLog(sessionId)
      setActivityLog([])
      setShowClearLogModal(false)
      console.log('Activity log cleared successfully')
    } catch (error) {
      console.error('Error clearing activity log:', error)
      // You could show a toast notification here if you have one
    }
  }, [sessionId])

  // Permission checking functions
  const canEditSession = useCallback(() => {
    if (!memoizedSession || !user) return false
    return memoizedSession.createdBy._id === user._id || 
           memoizedSession.collaborators?.some(collab => 
             collab.userId._id === user._id && (collab.permissions.edit || collab.permissions.manage)
           )
  }, [memoizedSession?.createdBy?._id, memoizedSession?.collaborators, user?._id])


  const isViewerOnly = useCallback(() => {
    if (!memoizedSession || !user) return false
    if (memoizedSession.createdBy._id === user._id) return false // Owner has full access
    const collaborator = memoizedSession.collaborators?.find(collab => collab.userId._id === user._id)
    return collaborator && collaborator.permissions.view && !collaborator.permissions.edit && !collaborator.permissions.manage
  }, [memoizedSession?.createdBy?._id, memoizedSession?.collaborators, user?._id])

  const getSessionRole = useCallback(() => {
    if (!memoizedSession || !user) return 'Unknown'
    if (memoizedSession.createdBy._id === user._id) return 'Owner'
    const collaborator = memoizedSession.collaborators?.find(collab => collab.userId._id === user._id)
    if (collaborator) {
      const permissions = []
      if (collaborator.permissions.view) permissions.push('View')
      if (collaborator.permissions.edit) permissions.push('Edit')
      if (collaborator.permissions.manage) permissions.push('Manage')
      return `Collaborator (${permissions.join(', ')})`
    }
    return 'Unknown'
  }, [memoizedSession?.createdBy?._id, memoizedSession?.collaborators, user?._id])

  // Sort state
  const [sortBy, setSortBy] = useState('roomNumber') // roomNumber, status, studentCount
  const [sortDescending, setSortDescending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTableView, setIsTableView] = useState(true)
  const [expandedRooms, setExpandedRooms] = useState(new Set()) // Track which rooms are expanded
  const [expandedCards, setExpandedCards] = useState(new Set())
  
  // Pagination for large room lists
  const [currentPage, setCurrentPage] = useState(1)
  const roomsPerPage = 20 // Show 20 rooms per page for better performance

  // Preset supplies options
  const PRESET_SUPPLIES = ['Pencils', 'Pens', 'Calculators', 'Protractor/Ruler', 'Compass']

  const fetchSessionData = useCallback(async () => {
    try {
      setIsLoading(true)
      const sessionData = await testingAPI.getSession(sessionId)
      console.log('SessionView - Session data received:', sessionData.session)
      console.log('SessionView - Rooms count:', sessionData.session.rooms?.length || 0)
      setSession(sessionData.session)
      
      // Check if user has permission to view this session
      if (sessionData.session) {
        const hasAccess = sessionData.session.createdBy._id === user._id || 
                         sessionData.session.collaborators?.some(collab => 
                           collab.userId._id === user._id && collab.permissions.view
                         )
        if (!hasAccess) {
          console.error('User does not have permission to view this session')
          // Redirect back to dashboard or show access denied message
          onBack()
          return
        }

        // Fetch the persistent activity log
        try {
          const activityLogData = await testingAPI.getActivityLog(sessionId)
          console.log('SessionView - Activity log data received:', activityLogData.activityLog)
          setActivityLog(activityLogData.activityLog || [])
        } catch (error) {
          console.error('Error fetching activity log:', error)
          // If we can't fetch the activity log, start with an empty array
          setActivityLog([])
        }

        // Fetch invalidations
        try {
          const invalidationsData = await testingAPI.getInvalidations(sessionId)
          console.log('SessionView - Invalidations data received:', invalidationsData.invalidations)
          setInvalidatedTests(invalidationsData.invalidations || [])
        } catch (error) {
          console.error('Error fetching invalidations:', error)
          // If we can't fetch invalidations, start with an empty array
          setInvalidatedTests([])
        }
      }
    } catch (error) {
      console.error('Error fetching session data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, user, onBack])

  // Silent refresh function that doesn't show loading state
  const silentRefreshSession = useCallback(async () => {
    try {
      const sessionData = await testingAPI.getSession(sessionId)
      console.log('SessionView - Silent refresh: Session data received:', sessionData.session)
      setSession(sessionData.session)
    } catch (error) {
      console.error('Error in silent refresh:', error)
    }
  }, [sessionId])
  
  // Store fetchSessionData in ref to avoid dependency issues in handleRealTimeUpdate
  useEffect(() => {
    fetchSessionDataRef.current = fetchSessionData
  }, [fetchSessionData])

  // Store silentRefreshSession in ref for handleRealTimeUpdate
  const silentRefreshRef = useRef()
  useEffect(() => {
    silentRefreshRef.current = silentRefreshSession
  }, [silentRefreshSession])
  
  // Function to add temporary CSS class for real-time updates
  const addUpdateAnimation = useCallback((elementId, animationClass, duration = 1500) => {
    const element = document.querySelector(`[data-room-id="${elementId}"]`)
    if (element) {
      element.classList.add(animationClass)
      setTimeout(() => {
        element.classList.remove(animationClass)
      }, duration)
    }
  }, [])

  useEffect(() => {
    console.log('🔄 SessionView useEffect - Setting up real-time updates for session:', sessionId)
    console.log('🔄 SessionView useEffect - isConnected:', isConnected)
    console.log('🔄 SessionView useEffect - Current user:', user ? `${user.firstName} ${user.lastName}` : 'Unknown')
    console.log('🔄 SessionView useEffect - Session loaded:', !!session)
    
    // Only set up real-time updates if we have session data
    if (!session) {
      console.log('⏳ Session not loaded yet, skipping real-time setup')
      return
    }
    
    const attemptJoinSession = () => {
      console.log('🔄 SessionView useEffect - Attempting to join session:', sessionId)
      const success = joinSession(sessionId)
      if (!success) {
        console.log('⏳ Session join failed, will retry when connected...')
      }
    }
    
    attemptJoinSession()
    
    // Set up real-time update listener
    console.log('🔄 SessionView useEffect - Registering onSessionUpdate callback for session:', sessionId)
    const cleanup = onSessionUpdate(sessionId, handleRealTimeUpdate)
    console.log('🔄 SessionView useEffect - Callback registered successfully')
    
    return () => {
      console.log('🔄 SessionView useEffect - Cleaning up real-time updates for session:', sessionId)
      cleanup()
      // Don't leave session here as it can cause connection issues
      // The RealTimeContext will handle session management
    }
  }, [sessionId, isConnected, session])

  // Fetch session data when component mounts or sessionId changes
  useEffect(() => {
    console.log('📥 SessionView useEffect - Fetching session data for session:', sessionId)
    fetchSessionData()
  }, [sessionId])

  // Debug session state changes
  useEffect(() => {
    // console.log('🔍 SessionView - Session state changed:', {
    //   sessionId,
    //   sessionExists: !!session,
    //   sessionObjectId: session?._id,
    //   roomsCount: session?.rooms?.length || 0
    // })
  }, [session, sessionId])

  // Handle real-time updates from other users
  const handleRealTimeUpdate = useCallback((update) => {
    console.log('🔔 SessionView - Received real-time update:', update)
    console.log('🔔 SessionView - Update type:', update.type)
    console.log('🔔 SessionView - Update data:', update.data)
    console.log('🔔 SessionView - Current user:', user ? `${user.firstName} ${user.lastName}` : 'Unknown')
    console.log('🔔 SessionView - Current session ID:', sessionId)
    console.log('🔔 SessionView - Update session ID:', update.sessionId)
    console.log('🔔 SessionView - Session exists:', !!session)
    
    // Add log entry to local state if provided in the update
    if (update.logEntry) {
      console.log('🔔 SessionView - Adding log entry to local state:', update.logEntry)
      setActivityLog(prevLog => [update.logEntry, ...prevLog])
    }
    
    switch (update.type) {
      case 'room-status-updated':
        console.log('🔔 Room status updated by another user:', update.data)
        console.log('🔔 SessionView - Current session:', session)
        // Update the specific room in the local session state
        if (session) {
          const updatedSession = { ...session }
          const roomIndex = updatedSession.rooms.findIndex(room => room._id === update.data.roomId)
          console.log('🔔 SessionView - Room index found:', roomIndex)
          if (roomIndex !== -1) {
            console.log('🔔 SessionView - Updating room at index:', roomIndex)
            console.log('🔔 SessionView - Old room:', updatedSession.rooms[roomIndex])
            // Update the status and presentStudents fields from the room data
            updatedSession.rooms[roomIndex] = { 
              ...updatedSession.rooms[roomIndex], 
              status: update.data.status,
              presentStudents: update.data.room?.presentStudents,
              // Add a flag to trigger status-specific animations
              statusUpdatedAt: new Date().toISOString()
            }
            console.log('🔔 SessionView - New room:', updatedSession.rooms[roomIndex])
            setSession(updatedSession)
            console.log('🔔 SessionView - Session state updated')
            
            // Add animation for room status updates
            addUpdateAnimation(update.data.roomId, 'room-status-updated')
          } else {
            console.log('🔔 SessionView - Room not found in current session, performing silent refresh')
            silentRefreshRef.current()
          }
        } else {
          console.log('🔔 SessionView - No session available, performing silent refresh')
          silentRefreshRef.current()
        }
        break
        
      case 'room-added':
        console.log('Room added by another user:', update.data.room)
        // For room additions, we can update local state if we have the complete room data
        if (session && update.data.room) {
          const updatedSession = { ...session }
          updatedSession.rooms = [...updatedSession.rooms, update.data.room]
          setSession(updatedSession)
          console.log('SessionView - Room added to local state')

          // Activity log entry is now handled by the server
        } else {
          // Fallback to silent refresh if we don't have complete room data
          silentRefreshRef.current()
        }
        break
        
      case 'room-removed':
        console.log('Room removed by another user:', update.data.roomId)
        // For room removals, we can update local state if we have the roomId
        if (session && update.data.roomId) {
          const updatedSession = { ...session }
          updatedSession.rooms = updatedSession.rooms.filter(room => room._id !== update.data.roomId)
          setSession(updatedSession)
          console.log('SessionView - Room removed from local state')

          // Activity log entry is now handled by the server
        } else {
          // Fallback to refresh if we can't update locally
          fetchSessionDataRef.current()
        }
        break
        
      case 'section-added':
        console.log('Section added by another user:', update.data.section)
        // For section additions, we can update local state if we have the complete section data
        if (session && update.data.section && update.data.roomId) {
          const updatedSession = { ...session }
          const roomIndex = updatedSession.rooms.findIndex(room => room._id === update.data.roomId)
          if (roomIndex !== -1) {
            if (!updatedSession.rooms[roomIndex].sections) {
              updatedSession.rooms[roomIndex].sections = []
            }
            updatedSession.rooms[roomIndex].sections.push(update.data.section)
            setSession(updatedSession)
            console.log('SessionView - Section added to local state')

            // Activity log entry is now handled by the server
          } else {
            silentRefreshRef.current()
          }
        } else {
          // Fallback to silent refresh if we don't have complete section data
          silentRefreshRef.current()
        }
        break
        
      case 'section-removed':
        console.log('Section removed by another user:', update.data.sectionId)
        // For section removals, we can try to update local state
        if (session && update.data.sectionId) {
          const updatedSession = { ...session }
          
          updatedSession.rooms = updatedSession.rooms.map(room => ({
            ...room,
            sections: room.sections?.filter(section => section._id !== update.data.sectionId) || []
          }))
          setSession(updatedSession)
          console.log('SessionView - Section removed from local state')

          // Activity log entry is now handled by the server
        } else {
          // Fallback to silent refresh if we can't update locally
          silentRefreshRef.current()
        }
        break
        
      case 'room-updated':
        console.log('Room updated by another user:', update.data.room)
        // For room updates (like supplies), we can update local state
        if (session && update.data.room && update.data.roomId) {
          const updatedSession = { ...session }
          const roomIndex = updatedSession.rooms.findIndex(room => room._id === update.data.roomId)
          if (roomIndex !== -1) {
            updatedSession.rooms[roomIndex] = update.data.room
            setSession(updatedSession)
            console.log('SessionView - Room updated in local state')
            // Add animation for room updates
            addUpdateAnimation(update.data.roomId, 'room-updated')

            // Activity log entry is now handled by the server
          } else {
            silentRefreshRef.current()
          }
        } else {
          silentRefreshRef.current()
        }
        break
        
      case 'section-updated':
        console.log('Section updated by another user:', update.data.section)
        // For section updates (like student count), we can update local state
        if (session && update.data.section && update.data.sectionId) {
          const updatedSession = { ...session }
          // Find which room contains this section to animate it
          let roomToAnimate = null
          updatedSession.rooms = updatedSession.rooms.map(room => ({
            ...room,
            sections: room.sections?.map(section => 
              section._id === update.data.sectionId ? update.data.section : section
            ) || []
          }))
          // Find the room that contains this section
          roomToAnimate = updatedSession.rooms.find(room => 
            room.sections?.some(section => section._id === update.data.sectionId)
          )
          setSession(updatedSession)
          console.log('SessionView - Section updated in local state')
          // Add animation for section updates
          if (roomToAnimate) {
            addUpdateAnimation(roomToAnimate._id, 'section-updated')
          }

          // Activity log entry is now handled by the server
        } else {
          silentRefreshRef.current()
        }
        break
        
      case 'section-added-to-room':
        console.log('Section added to room by another user:', update.data)
        // For section additions to rooms, we can update local state
        if (session && update.data.room && update.data.roomId) {
          const updatedSession = { ...session }
          const roomIndex = updatedSession.rooms.findIndex(room => room._id === update.data.roomId)
          if (roomIndex !== -1) {
            updatedSession.rooms[roomIndex] = update.data.room
            setSession(updatedSession)
            console.log('SessionView - Section added to room in local state')
            // Add animation for section added to room
            addUpdateAnimation(update.data.roomId, 'section-added-to-room')
            
            // Activity log entry is now handled by the server
          } else {
            silentRefreshRef.current()
          }
        } else {
          silentRefreshRef.current()
        }
        break
        
      case 'section-removed-from-room':
        console.log('Section removed from room by another user:', update.data)
        // For section removals from rooms, we can update local state
        if (session && update.data.room && update.data.roomId) {
          const updatedSession = { ...session }
          const roomIndex = updatedSession.rooms.findIndex(room => room._id === update.data.roomId)
          if (roomIndex !== -1) {
            updatedSession.rooms[roomIndex] = update.data.room
            setSession(updatedSession)
            console.log('SessionView - Section removed from room in local state')
            // Add animation for section removed from room
            addUpdateAnimation(update.data.roomId, 'section-removed-from-room')
            
            // Activity log entry is now handled by the server
          } else {
            silentRefreshRef.current()
          }
        } else {
          silentRefreshRef.current()
        }
        break
        
      case 'students-moved':
        console.log('Students moved by another user:', update.data)
        // For student movements, update local state smoothly without page refresh
        if (session && update.data.sourceRoomId && update.data.destinationRoomId && update.data.sourceRoom && update.data.destinationRoom) {
          // Update local session state with the new room data
          setSession(prevSession => {
            if (!prevSession) return prevSession;
            
            const updatedRooms = prevSession.rooms.map(room => {
              if (room._id === update.data.sourceRoomId) {
                return update.data.sourceRoom;
              } else if (room._id === update.data.destinationRoomId) {
                return update.data.destinationRoom;
              }
              return room;
            });
            
            return {
              ...prevSession,
              rooms: updatedRooms
            };
          });
          
          // Log entry is already handled by the general mechanism above
        } else {
          // Fallback to silent refresh if data is incomplete
          silentRefreshRef.current();
        }
        break
        
      case 'session-updated':
        console.log('Session updated by another user:', update.data.session)
        // Update local session state with new data
        setSession(update.data.session)
        
        // Activity log entry is now handled by the server
        break
        
      case 'activity-log-cleared':
        console.log('Activity log cleared by another user:', update.data)
        // Clear the local activity log state
        setActivityLog([])
        break
        
      default:
        console.log('Unknown update type:', update.type)
    }
  }, [session, sessionId, user, addUpdateAnimation, silentRefreshRef, fetchSessionDataRef])

  useEffect(() => {
    if (memoizedSession) {
      const timer = setInterval(() => {
        updateTimeRemaining()
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [memoizedSession?._id, memoizedSession?.date, memoizedSession?.endTime]) // Only depend on specific session properties that affect time calculation

  const updateTimeRemaining = useCallback(() => {
    if (!memoizedSession) return

    const now = new Date()
    const sessionDate = new Date(memoizedSession.date)
    const [endHour, endMinute] = memoizedSession.endTime.split(':')
    const endTime = new Date(sessionDate)
    endTime.setHours(parseInt(endHour), parseInt(endMinute), 0)

    const timeDiff = endTime - now
    if (timeDiff <= 0) {
      setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, isOver: true })
    } else {
      const hours = Math.floor(timeDiff / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
      setTimeRemaining({ hours, minutes, seconds, isOver: false })
    }
  }, [memoizedSession?.date, memoizedSession?.endTime])

  const calculateProgress = useCallback(() => {
    if (!debouncedSession || !debouncedSession.rooms) return 0
    
    const totalRooms = debouncedSession.rooms.length
    if (totalRooms === 0) return 0
    
    const completedRooms = debouncedSession.rooms.filter(room => room.status === 'completed').length
    return Math.round((completedRooms / totalRooms) * 100)
  }, [debouncedSession?.rooms])

  const handleMarkRoomComplete = useCallback((roomId) => {
    // Find the room to get its name and total students
    const room = session?.rooms?.find(r => r._id === roomId)
    if (!room) return
    
    setRoomToComplete(room)
    setPresentStudentsCount('')
    
    // Initialize per-section counts if room has multiple sections
    if (room.sections && room.sections.length > 1) {
      const initialCounts = {}
      room.sections.forEach(section => {
        initialCounts[section._id] = ''
      })
      setSectionPresentCounts(initialCounts)
    } else {
      setSectionPresentCounts({})
    }
    
    setShowPresentStudentsModal(true)
  }, [session?.rooms])

  const calculateTotalStudents = useCallback((sections) => {
    if (!sections || sections.length === 0) return 0
    return sections.reduce((total, section) => total + (section.studentCount || 0), 0)
  }, [])

  const handleConfirmRoomComplete = useCallback(async () => {
    if (!roomToComplete) return
    
    let presentCount = 0
    let sectionPresentData = {}
    
    // Handle per-section data for multiple sections
    if (roomToComplete.sections && roomToComplete.sections.length > 1) {
      // Validate all section counts are provided and valid
      
      for (const section of roomToComplete.sections) {
        const sectionCount = sectionPresentCounts[section._id]
        if (!sectionCount || isNaN(parseInt(sectionCount))) {
          alert(`Please enter a valid number for Section ${section.number}`)
          return
        }
        
        const count = parseInt(sectionCount)
        if (count < 0 || count > section.studentCount) {
          alert(`Section ${section.number} present count must be between 0 and ${section.studentCount}`)
          return
        }
        
        sectionPresentData[section._id] = count
        presentCount += count
      }
    } else {
      // Handle single section or no sections
      if (!presentStudentsCount || isNaN(parseInt(presentStudentsCount))) return
      
      presentCount = parseInt(presentStudentsCount)
      const totalStudents = calculateTotalStudents(roomToComplete.sections)
      
      if (presentCount < 0 || presentCount > totalStudents) {
        alert(`Present students must be between 0 and ${totalStudents}`)
        return
      }
    }
    
    try {
      console.log('Marking room complete with present students:', presentCount)
      if (Object.keys(sectionPresentData).length > 0) {
        console.log('Per-section data:', sectionPresentData)
      }
      
      // Update room with present students count and per-section data
      const updateData = { 
        status: 'completed',
        presentStudents: presentCount
      }
      
      // Add per-section data if available
      if (Object.keys(sectionPresentData).length > 0) {
        updateData.sectionPresentStudents = sectionPresentData
      }
      
      const response = await testingAPI.updateRoom(roomToComplete._id, updateData)
      console.log('Room status update response:', response)
      
      // Update local state immediately
      setSession(prevSession => {
        const updatedSession = {
          ...prevSession,
          rooms: prevSession.rooms.map(room => 
            room._id === roomToComplete._id 
              ? { 
                  ...room, 
                  status: 'completed', 
                  presentStudents: presentCount,
                  sectionPresentStudents: sectionPresentData
                }
              : room
          )
        }
        
        // Note: Session completion is now handled server-side to prevent race conditions
        // Check if all rooms are completed for confetti animation
        const allRoomsCompleted = updatedSession.rooms.every(room => room.status === 'completed')
        if (allRoomsCompleted && updatedSession.status !== 'completed') {
          console.log('All rooms completed, session completion will be handled by server')
          
          // Trigger confetti animation when all rooms are completed
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })
        }
        
        return updatedSession
      })

      // Close modal
      setShowPresentStudentsModal(false)
      setRoomToComplete(null)
      setPresentStudentsCount('')
      setSectionPresentCounts({})

      // Activity log entry is now handled by the server
    } catch (error) {
      console.error('Error marking room complete:', error)
    }
  }, [roomToComplete, presentStudentsCount, sectionPresentCounts, sessionId, calculateTotalStudents])

  const handleMarkRoomIncomplete = useCallback((roomId) => {
    setRoomToMarkIncomplete(roomId)
    setShowIncompleteConfirmModal(true)
  }, [])

  const confirmMarkRoomIncomplete = useCallback(async () => {
    if (!roomToMarkIncomplete) return
    
    try {
      // Update room status to active and clear present students
      await testingAPI.updateRoom(roomToMarkIncomplete, { 
        status: 'active',
        presentStudents: undefined
      })
      
      // Update local state immediately
      setSession(prevSession => {
        const updatedSession = {
          ...prevSession,
          rooms: prevSession.rooms.map(room => 
            room._id === roomToMarkIncomplete 
              ? { ...room, status: 'active', presentStudents: undefined }
              : room
          )
        }
        
        // If session was completed but now a room is active, change session back to active
        if (updatedSession.status === 'completed') {
          console.log('Room marked incomplete, updating session status to active')
          testingAPI.updateSession(sessionId, { status: 'active' })
          updatedSession.status = 'active'
        }
        
        return updatedSession
      })

      // Activity log entry is now handled by the server
      
      // Close modal and reset state
      setShowIncompleteConfirmModal(false)
      setRoomToMarkIncomplete(null)
    } catch (error) {
      console.error('Error marking room incomplete:', error)
    }
  }, [roomToMarkIncomplete, sessionId])

  const cancelMarkRoomIncomplete = useCallback(() => {
    setShowIncompleteConfirmModal(false)
    setRoomToMarkIncomplete(null)
  }, [])

  const toggleDropdown = useCallback((roomId, event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    if (showDropdown === roomId) {
      setShowDropdown(null)
    } else {
      // Calculate position for dropdown
      if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect()
        const dropdownWidth = 192
        const dropdownHeight = 200 // Approximate height for all options
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        // Calculate position with viewport bounds checking
        let left = rect.right - dropdownWidth
        let top = rect.bottom + 8
        
        // Ensure dropdown stays within viewport bounds
        if (left < 8) {
          left = rect.left
        }
        if (left + dropdownWidth > viewportWidth - 8) {
          left = viewportWidth - dropdownWidth - 8
        }
        if (top + dropdownHeight > viewportHeight - 8) {
          top = rect.top - dropdownHeight - 8
        }
        if (top < 8) {
          top = 8
        }
        
        const position = { top, left }
        setDropdownPosition(position)
      }
      setShowDropdown(roomId)
    }
  }, [showDropdown])


  // Debug modal states
  useEffect(() => {
    console.log('Modal states changed:', {
      showAddSupplyModal,
      showMoveStudentsModal,
      showRoomNotesModal,
      showInvalidateModal,
      selectedRoom: selectedRoom?.name,
      moveFromRoom: moveFromRoom?.name,
      selectedRoomForNotes: selectedRoomForNotes?.name,
      roomToInvalidate: roomToInvalidate?.name
    })
  }, [showAddSupplyModal, showMoveStudentsModal, showRoomNotesModal, showInvalidateModal, selectedRoom, moveFromRoom, selectedRoomForNotes, roomToInvalidate])

  // Debug Add Supply Modal rendering
  useEffect(() => {
    if (showAddSupplyModal && selectedRoom) {
      console.log('Add Supply Modal should be rendering for room:', selectedRoom.name)
    }
  }, [showAddSupplyModal, selectedRoom])

  const handleAddSupplyClick = useCallback((room) => {
    console.log('Add Supply clicked for room:', room.name)
    console.log('Setting selectedRoom to:', room)
    console.log('Setting showAddSupplyModal to true')
    setSelectedRoom(room)
    setShowAddSupplyModal(true)
    console.log('Add Supply modal should now be open')
    // Don't close dropdown immediately, let the modal handle it
  }, [])

  const handleMoveStudentsClick = useCallback((room) => {
    console.log('Move Students clicked for room:', room.name)
    console.log('Setting moveFromRoom to:', room)
    console.log('Setting showMoveStudentsModal to true')
    setMoveFromRoom(room)
    setShowMoveStudentsModal(true)
    console.log('Move Students modal should now be open')
    // Don't close dropdown immediately, let the modal handle it
  }, [])

  const handleInvalidateTestClick = useCallback((room) => {
    console.log('Invalidate Test clicked for room:', room.name)
    console.log('Setting roomToInvalidate to:', room)
    console.log('Setting showInvalidateModal to true')
    setRoomToInvalidate(room)
    setInvalidationNotes('')
    setSelectedSection('')
    setShowInvalidateModal(true)
    console.log('Invalidate Test modal should now be open')
    // Don't close dropdown immediately, let the modal handle it
  }, [])

  const handleInvalidateTest = useCallback(async () => {
    if (!roomToInvalidate || !invalidationNotes.trim() || !selectedSection) return
    
    try {
      // Send to server to persist
      const response = await testingAPI.addInvalidation(
        session._id,
        roomToInvalidate._id,
        selectedSection,
        invalidationNotes.trim()
      )
      
      // Add to local state
      setInvalidatedTests(prev => [...prev, response.invalidation])
      
      // Close modal and reset state
      setShowInvalidateModal(false)
      setRoomToInvalidate(null)
      setInvalidationNotes('')
      setSelectedSection('')
      
      console.log('Test invalidated:', response.invalidation)
    } catch (error) {
      console.error('Error invalidating test:', error)
    }
  }, [roomToInvalidate, invalidationNotes, selectedSection, session?._id])

  const handleRemoveInvalidatedTestClick = useCallback((invalidation) => {
    setInvalidationToRemove(invalidation)
    setShowRemoveInvalidationModal(true)
  }, [])

  const confirmRemoveInvalidatedTest = useCallback(async () => {
    if (!invalidationToRemove) return
    
    try {
      // Send to server to remove
      await testingAPI.removeInvalidation(session._id, invalidationToRemove.id)
      
      // Remove from local state
      setInvalidatedTests(prev => prev.filter(inv => inv.id !== invalidationToRemove.id))
      
      // Close modal and reset state
      setShowRemoveInvalidationModal(false)
      setInvalidationToRemove(null)
      
      console.log('Invalidated test removed:', invalidationToRemove.id)
    } catch (error) {
      console.error('Error removing invalidation:', error)
    }
  }, [invalidationToRemove, session?._id])

  const cancelRemoveInvalidatedTest = useCallback(() => {
    setShowRemoveInvalidationModal(false)
    setInvalidationToRemove(null)
  }, [])

  const handleRoomNotesClick = useCallback((room) => {
    console.log('Room Notes clicked for room:', room.name)
    console.log('Setting selectedRoomForNotes to:', room)
    console.log('Setting showRoomNotesModal to true')
    setSelectedRoomForNotes(room)
    setRoomNotes(room.notes || '')
    setShowRoomNotesModal(true)
    console.log('Room Notes modal should now be open')
    // Don't close dropdown immediately, let the modal handle it
  }, [])

  const handleEditSuppliesClick = useCallback((room) => {
    console.log('Edit Supplies clicked for room:', room.name)
    console.log('Setting selectedRoom to:', room)
    console.log('Setting showEditSuppliesModal to true')
    setSelectedRoom(room)
    setShowEditSuppliesModal(true)
    console.log('Edit Supplies modal should now be open')
    // Don't close dropdown immediately, let the modal handle it
  }, [])

  const handleRemoveSupply = useCallback(async (roomId, supplyName) => {
    try {
      const room = session.rooms.find(r => r._id === roomId)
      if (!room) return
      
      // Remove all instances of this supply
      const updatedSupplies = room.supplies.filter(s => s !== supplyName)
      
      await testingAPI.updateRoom(roomId, { supplies: updatedSupplies })
      
      // Update the room in the session state
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(r => 
          r._id === roomId 
            ? { ...r, supplies: updatedSupplies }
            : r
        )
      }))
      
      // Update the selectedRoom in the modal to reflect the changes
      setSelectedRoom(prevSelectedRoom => {
        if (prevSelectedRoom && prevSelectedRoom._id === roomId) {
          return { ...prevSelectedRoom, supplies: updatedSupplies }
        }
        return prevSelectedRoom
      })
      
      console.log(`Removed all instances of ${supplyName} from room ${room.name}`)
    } catch (error) {
      console.error('Error removing supply:', error)
    }
  }, [session?.rooms])

  const handleAdjustSupplyQuantity = useCallback(async (roomId, supplyName, adjustment) => {
    try {
      const room = session.rooms.find(r => r._id === roomId)
      if (!room) return
      
      const currentSupplies = room.supplies || []
      const currentCount = currentSupplies.filter(s => s === supplyName).length
      
      if (adjustment < 0 && currentCount <= 0) return // Can't go below 0
      
      let updatedSupplies
      if (adjustment > 0) {
        // Add more supplies
        updatedSupplies = [...currentSupplies]
        for (let i = 0; i < adjustment; i++) {
          updatedSupplies.push(supplyName)
        }
      } else {
        // Remove supplies
        const removeCount = Math.abs(adjustment)
        let removed = 0
        updatedSupplies = currentSupplies.filter(supply => {
          if (supply === supplyName && removed < removeCount) {
            removed++
            return false
          }
          return true
        })
      }
      
      await testingAPI.updateRoom(roomId, { supplies: updatedSupplies })
      
      // Update the room in the session state
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(r => 
          r._id === roomId 
            ? { ...r, supplies: updatedSupplies }
            : r
        )
      }))
      
      // Update the selectedRoom in the modal to reflect the changes
      setSelectedRoom(prevSelectedRoom => {
        if (prevSelectedRoom && prevSelectedRoom._id === roomId) {
          return { ...prevSelectedRoom, supplies: updatedSupplies }
        }
        return prevSelectedRoom
      })
      
      console.log(`Adjusted ${supplyName} quantity by ${adjustment} in room ${room.name}`)
    } catch (error) {
      console.error('Error adjusting supply quantity:', error)
    }
  }, [session?.rooms])

  const handleSaveRoomNotes = useCallback(async () => {
    if (!selectedRoomForNotes || !roomNotes.trim()) return

    try {
      await testingAPI.updateRoom(selectedRoomForNotes._id, {
        notes: roomNotes.trim()
      })
      
      // Update local state
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === selectedRoomForNotes._id 
            ? { ...room, notes: roomNotes.trim() }
            : room
        )
      }))

      setShowRoomNotesModal(false)
      setSelectedRoomForNotes(null)
      setRoomNotes('')
    } catch (error) {
      console.error('Error saving room notes:', error)
    }
  }, [selectedRoomForNotes, roomNotes])

  const cancelRoomNotes = useCallback(() => {
    setShowRoomNotesModal(false)
    setSelectedRoomForNotes(null)
    setRoomNotes('')
  }, [])

  const cancelInvalidateTest = useCallback(() => {
    setShowInvalidateModal(false)
    setRoomToInvalidate(null)
    setInvalidationNotes('')
    setSelectedSection('')
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('[data-dropdown-menu]') && !event.target.closest('button[title="More Actions"]')) {
        setShowDropdown(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  // Helper function to format supplies for logging
  // const formatSuppliesForLog = (supplies) => {
  //   if (!supplies || supplies.length === 0) return []
    
  //   const supplyCounts = {}
  //   supplies.forEach(supply => {
  //     if (supply.startsWith('INITIAL_')) {
  //       const cleanName = supply.replace('INITIAL_', '')
  //       const key = `${cleanName} (initial)`
  //       supplyCounts[key] = (supplyCounts[key] || 0) + 1
  //     } else {
  //       supplyCounts[supply] = (supplyCounts[supply] || 0) + 1
  //     }
  //   })
    
  //   return Object.entries(supplyCounts).map(([name, count]) => `${name} (${count})`)
  // }

  const handleAddSupply = useCallback(async () => {
    if (!selectedPresetSupply || !selectedRoom || newSupplyQuantity < 1) return
    
    try {
      
      const currentSupplies = selectedRoom.supplies || []
      const newSupplyName = selectedPresetSupply
      const newQuantity = newSupplyQuantity
      
      
      // Check if the supply already exists
      const existingSupplyIndex = currentSupplies.findIndex(supply => supply === newSupplyName)
      
      // console.log('🔍 existingSupplyIndex:', existingSupplyIndex);
      
      let updatedSupplies
      if (existingSupplyIndex !== -1) {
        // Supply exists, add more of the same supply
        // Just add the supply name multiple times (backend will count them)
        updatedSupplies = [...currentSupplies]
        for (let i = 0; i < newQuantity; i++) {
          updatedSupplies.push(newSupplyName)
        }
      } else {
        // Supply doesn't exist, add new one
        // Add the supply name multiple times based on quantity
        updatedSupplies = [...currentSupplies]
        for (let i = 0; i < newQuantity; i++) {
          updatedSupplies.push(newSupplyName)
        }
      }
      
      // console.log('🔍 updatedSupplies:', formatSuppliesForLog(updatedSupplies));
      // console.log('🔍 Calling testingAPI.updateRoom with:', { supplies: formatSuppliesForLog(updatedSupplies) });
      
      await testingAPI.updateRoom(selectedRoom._id, { supplies: updatedSupplies })
      
      // console.log('🔍 testingAPI.updateRoom completed successfully');
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === selectedRoom._id 
            ? { ...room, supplies: updatedSupplies }
            : room
        )
      }))
      
      setShowAddSupplyModal(false)
      setSelectedPresetSupply('')
      setNewSupplyQuantity(1)
      setSelectedRoom(null)

      // Activity log entry is now handled by the server
    } catch (error) {
      console.error('Error adding supply:', error)
    }
  }, [selectedPresetSupply, selectedRoom, newSupplyQuantity])

  // const handleRemoveSupply = useCallback(async (roomId, supply) => {
  //   try {
  //     // console.log('🔍 handleRemoveSupply called');
  //     // console.log('🔍 roomId:', roomId);
  //     // console.log('🔍 supply to remove:', supply);
      
  //     const room = session.rooms.find(r => r._id === roomId)
  //     const updatedSupplies = room.supplies.filter(s => s !== supply)
      
  //     // console.log('🔍 room:', room);
  //     // console.log('🔍 updatedSupplies:', formatSuppliesForLog(updatedSupplies));
  //     // console.log('🔍 Calling testingAPI.updateRoom with:', { supplies: formatSuppliesForLog(updatedSupplies) });
      
  //     await testingAPI.updateRoom(roomId, { supplies: updatedSupplies })
      
  //     // console.log('🔍 testingAPI.updateRoom completed successfully');
      
  //     // Update local state immediately
  //     setSession(prevSession => ({
  //       ...prevSession,
  //       rooms: prevSession.rooms.map(room => 
  //         room._id === roomId 
  //           ? { ...room, supplies: updatedSupplies }
  //           : room
  //       )
  //     }))

  //     // Activity log entry is now handled by the server
  //   } catch (error) {
  //     console.error('Error removing supply:', error)
  //   }
  // }, [session?.rooms])

  const handleEditSupply = useCallback(async () => {
    if (!editingSupply || !selectedRoom || editSupplyQuantity < 1) return
    
    try {
      const room = session.rooms.find(r => r._id === selectedRoom._id)
      
      // Remove the old supply and add the new quantity as individual items
      const updatedSupplies = room.supplies.filter(supply => supply !== editingSupply.original)
      
      // Add the new quantity as individual supply names
      for (let i = 0; i < editSupplyQuantity; i++) {
        updatedSupplies.push(editingSupply.name)
      }
      
      await testingAPI.updateRoom(selectedRoom._id, { supplies: updatedSupplies })
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === selectedRoom._id 
            ? { ...room, supplies: updatedSupplies }
            : room
        )
      }))
      
      setShowEditSupplyModal(false)
      setEditingSupply(null)
      setEditSupplyQuantity(1)
      setSelectedRoom(null)

      // Activity log entry is now handled by the server
    } catch (error) {
      console.error('Error editing supply:', error)
    }
  }, [editingSupply, selectedRoom, editSupplyQuantity, session?.rooms])

  const handleMoveStudents = useCallback(async () => {
    if (!moveFromRoom || Object.keys(studentMoveData).length === 0) return
    
    try {
      console.log('Starting student move process...')
      console.log('Student move data:', studentMoveData)
      
      // Process each section that has students to move
      for (const [sectionId, moveInfo] of Object.entries(studentMoveData)) {
        if (moveInfo.studentsToMove > 0 && moveInfo.destinationRoom) {
          console.log(`Processing section ${sectionId}:`, moveInfo)
          
          const section = moveFromRoom.sections.find(s => s._id === sectionId)
          if (section && moveInfo.studentsToMove <= section.studentCount) {
            console.log(`Moving ${moveInfo.studentsToMove} students from section ${section.number}`)
            
            // Use the server endpoint to move students (handles both same-room and cross-room moves)
            try {
              await testingAPI.logStudentMovement(
                session._id,
                moveFromRoom._id,
                moveInfo.destinationRoom,
                sectionId,
                moveInfo.studentsToMove
              )
              console.log('Student movement logged successfully')
            } catch (error) {
              console.error('Error logging student movement:', error)
            }
          } else {
            console.error(`Invalid move: ${moveInfo.studentsToMove} students cannot be moved from section with ${section?.studentCount || 0} students`)
          }
        }
      }
      
      // Reset the modal state
      setShowMoveStudentsModal(false)
      setMoveFromRoom(null)
      setStudentMoveData({})
      
      // Real-time updates will handle the state changes automatically
      console.log('Student move process completed successfully')
    } catch (error) {
      console.error('Error moving students:', error)
    }
  }, [moveFromRoom, studentMoveData, session?.rooms])

  const formatTime = useCallback((timeString) => {
    if (!timeString) return ''
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    
    // Format date as MM/DD/YYYY
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear()
    
    // Format time as HH:MM:SS AM/PM
    const timeString = date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
    
    // Return date first, then time: MM/DD/YYYY, HH:MM:SS AM/PM
    return `${month}/${day}/${year}, ${timeString}`
  }, [])


    // Helper function to get activity log colors based on action type
  const getActivityLogColors = useCallback((action) => {
    const lowerAction = action.toLowerCase();

    // Test invalidation actions - check first for specificity
    if (lowerAction.includes('invalidated test') || lowerAction.includes('removed test invalidation')) {
      return {
        border: 'border-red-500',
        dot: 'bg-red-500'
      };
    }

    // Room status updates - check incomplete first to avoid substring conflicts
    if (lowerAction.includes('marked room') && lowerAction.includes('incomplete')) {
      return {
        border: 'border-yellow-500',
        dot: 'bg-yellow-500'
      };
    }
    if (lowerAction.includes('marked room') && lowerAction.includes('complete')) {
      return {
        border: 'border-green-500',
        dot: 'bg-green-500'
      };
    }
    
    // Supply actions
    if (lowerAction.includes('added')) {
      return {
        border: 'border-blue-500',
        dot: 'bg-blue-500'
      };
    }
    if (lowerAction.includes('removed')) {
      return {
        border: 'border-red-500',
        dot: 'bg-red-500'
      };
    }
    
    // Student movement
    if (lowerAction.includes('moved') && lowerAction.includes('students')) {
      return {
        border: 'border-purple-500',
        dot: 'bg-purple-500'
      };
    }
    
    // Room notes actions
    if (lowerAction.includes('notes') && (lowerAction.includes('added') || lowerAction.includes('updated') || lowerAction.includes('removed'))) {
      return {
        border: 'border-orange-500',
        dot: 'bg-orange-500'
      };
    }
    
    // Default color for other actions
    return {
      border: 'border-gray-500',
      dot: 'bg-gray-500'
    };
  }, [])

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'active': return 'bg-blue-500'
      default: return 'bg-blue-500' // Default to active (in progress)
    }
  }, [])

  const getStatusText = useCallback((status) => {
    switch (status) {
      case 'completed': return 'Completed'
      case 'active': return 'In Progress'
      default: return 'In Progress' // Default to active (in progress)
    }
  }, [])


  const calculateTotalStudentsInSession = useCallback(() => {
    if (!session?.rooms) return 0
    return session.rooms.reduce((total, room) => {
      return total + calculateTotalStudents(room.sections)
    }, 0)
  }, [session?.rooms, calculateTotalStudents])

  const calculateTotalSectionsInSession = useCallback(() => {
    if (!session?.rooms) return 0
    return session.rooms.reduce((total, room) => {
      return total + (room.sections?.length || 0)
    }, 0)
  }, [session?.rooms])

  const calculateTotalPresentStudents = useCallback(() => {
    if (!session?.rooms) return 0
    return session.rooms.reduce((total, room) => {
      return total + (room.status === 'completed' ? (room.presentStudents || 0) : 0)
    }, 0)
  }, [session?.rooms])

  const calculateTotalAbsentStudents = useCallback(() => {
    if (!session?.rooms) return 0
    return session.rooms.reduce((total, room) => {
      if (room.status === 'completed' && room.presentStudents !== undefined) {
        const totalStudents = calculateTotalStudents(room.sections)
        const presentStudents = room.presentStudents || 0
        return total + (totalStudents - presentStudents)
      }
      return total
    }, 0)
  }, [session?.rooms, calculateTotalStudents])

  const getRoomSortKey = useCallback((roomName) => {
    const match = roomName.match(/(\d+)([A-Za-z]*)/)
    if (match) {
      const number = parseInt(match[1])
      const letter = match[2] || ''
      return { number, letter, full: roomName }
    }
    return { number: 999, letter: '', full: roomName }
  }, [])

  const getSortedRooms = useCallback(() => {
    if (!debouncedSession || !debouncedSession.rooms) return []
    
    let sortedRooms = [...debouncedSession.rooms]
    
    // Filter by search query first
    if (searchQuery.trim()) {
      sortedRooms = sortedRooms.filter(room => 
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return sortedRooms.sort((a, b) => {
      let aValue, bValue
      let comparison = 0
      
      switch (sortBy) {
        case 'roomNumber': {
          const aKey = getRoomSortKey(a.name)
          const bKey = getRoomSortKey(b.name)
          
          // If both have numbers, sort by number first, then by letter
          if (aKey.number !== 999 && bKey.number !== 999) {
            if (aKey.number !== bKey.number) {
              comparison = aKey.number - bKey.number
            } else {
              // Same number, sort by letter
              comparison = aKey.letter.localeCompare(bKey.letter)
            }
          } else {
            // If one has number and other doesn't, numbers come first
            if (aKey.number !== 999 && bKey.number === 999) comparison = -1
            else if (aKey.number === 999 && bKey.number !== 999) comparison = 1
            else {
              // If neither has numbers, sort alphabetically
              comparison = aKey.full.localeCompare(bKey.full)
            }
          }
          break
        }
          
        case 'status':
          aValue = a.status
          bValue = b.status
          comparison = aValue.localeCompare(bValue)
          
          // If status is the same, sort by room number in ascending order
          if (comparison === 0) {
            const aKey = getRoomSortKey(a.name)
            const bKey = getRoomSortKey(b.name)
            
            // If both have numbers, sort by number first, then by letter
            if (aKey.number !== 999 && bKey.number !== 999) {
              if (aKey.number !== bKey.number) {
                comparison = aKey.number - bKey.number
              } else {
                // Same number, sort by letter
                comparison = aKey.letter.localeCompare(bKey.letter)
              }
            } else {
              // If one has number and other doesn't, numbers come first
              if (aKey.number !== 999 && bKey.number === 999) comparison = -1
              else if (aKey.number === 999 && bKey.number !== 999) comparison = 1
              else {
                // If neither has numbers, sort alphabetically
                comparison = aKey.full.localeCompare(bKey.full)
              }
            }
          }
          break
          
        case 'studentCount':
          aValue = calculateTotalStudents(a.sections)
          bValue = calculateTotalStudents(b.sections)
          comparison = aValue - bValue
          break
          
        default: {
          // Default to room number sorting
          const aKeyDefault = getRoomSortKey(a.name)
          const bKeyDefault = getRoomSortKey(b.name)
          comparison = aKeyDefault.number - bKeyDefault.number
          break
        }
      }
      
      // Apply sort direction
      return sortDescending ? -comparison : comparison
    })
  }, [debouncedSession?.rooms, searchQuery, sortBy, sortDescending])

  // Get paginated rooms for better performance with large lists
  const getPaginatedRooms = useCallback(() => {
    const sortedRooms = getSortedRooms()
    const startIndex = (currentPage - 1) * roomsPerPage
    const endIndex = startIndex + roomsPerPage
    return sortedRooms.slice(startIndex, endIndex)
  }, [getSortedRooms, currentPage, roomsPerPage])

  // Calculate total pages
  const totalPages = useMemo(() => {
    const sortedRooms = getSortedRooms()
    return Math.ceil(sortedRooms.length / roomsPerPage)
  }, [getSortedRooms, roomsPerPage])

  // Reset pagination when search or sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy, sortDescending])

  // Calculate time multiplier for a room based on section accommodations
  const calculateRoomTimeMultiplier = useCallback((room) => {
    if (!room.sections || room.sections.length === 0) {
      return 1
    }
    
    // Check if any section has 1.5x or 2x time accommodation
    let hasTimeAccommodation = false
    room.sections.forEach(section => {
      if (section.accommodations) {
        section.accommodations.forEach(acc => {
          // Check for various formats of time accommodations
          if (acc.includes('1.5x') || acc.includes('2x') ||
              acc.includes('1.5×') || acc.includes('2×') ||
              acc.includes('extended time') || acc.includes('double time')) {
            hasTimeAccommodation = true
          }
        })
      }
    })
    
    if (!hasTimeAccommodation) {
      return 1
    }
    
    // Find the highest time multiplier in the room
    let maxMultiplier = 1
    room.sections.forEach(section => {
      if (section.accommodations) {
        section.accommodations.forEach(acc => {
          // Check for 2x time accommodations (various formats)
          if (acc.includes('2x') || acc.includes('2×') || acc.includes('double time')) {
            maxMultiplier = Math.max(maxMultiplier, 2)
          } 
          // Check for 1.5x time accommodations (various formats)
          else if (acc.includes('1.5x') || acc.includes('1.5×') || acc.includes('extended time')) {
            maxMultiplier = Math.max(maxMultiplier, 1.5)
          }
        })
      }
    })
    
    return maxMultiplier
  }, [])

  const calculateRoomTimeRemaining = useCallback((room) => {
    if (!memoizedSession || !timeRemaining || timeRemaining.isOver) {
      return null
    }
    
    // Calculate time multiplier based on section accommodations
    const timeMultiplier = calculateRoomTimeMultiplier(room)
    
    // Calculate total session duration in minutes
    const [startHour, startMinute] = session.startTime.split(':')
    const [endHour, endMinute] = session.endTime.split(':')
    const sessionDate = new Date(session.date)
    
    const startTime = new Date(sessionDate)
    startTime.setHours(parseInt(startHour), parseInt(startMinute), 0)
    
    const endTime = new Date(sessionDate)
    endTime.setHours(parseInt(endHour), parseInt(endMinute), 0)
    
    const totalSessionMinutes = (endTime - startTime) / (1000 * 60)
    
    // Calculate room-specific end time based on multiplier
    const roomEndTime = new Date(startTime.getTime() + (totalSessionMinutes * timeMultiplier * 60 * 1000))
    
    // Calculate remaining time for this room
    const now = new Date()
    const roomTimeDiff = roomEndTime - now
    
    if (roomTimeDiff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isOver: true }
    }
    
    const hours = Math.floor(roomTimeDiff / (1000 * 60 * 60))
    const minutes = Math.floor((roomTimeDiff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((roomTimeDiff % (1000 * 60)) / 1000)
    
    return { hours, minutes, seconds, isOver: false, multiplier: timeMultiplier }
  }, [session?.startTime, session?.endTime, session?.date, timeRemaining, calculateRoomTimeMultiplier])

  // Only calculate time for visible/expanded rooms to improve performance with many rooms
  const roomTimeCalculations = useMemo(() => {
    if (!debouncedSession?.rooms) return {}
    
    const calculations = {}
    // Only calculate time for expanded rooms or first 10 rooms (for initial display)
    const roomsToCalculate = debouncedSession.rooms.filter((room, index) => 
      expandedRooms.has(room._id) || expandedCards.has(room._id) || index < 10
    )
    
    roomsToCalculate.forEach(room => {
      calculations[room._id] = calculateRoomTimeRemaining(room)
    })
    return calculations
  }, [debouncedSession?.rooms, timeRemaining, calculateRoomTimeMultiplier, expandedRooms, expandedCards])

  // Lazy time calculation function for rooms not in the main calculations
  const getRoomTimeRemaining = useCallback((room) => {
    // First check if we already have it calculated
    if (roomTimeCalculations[room._id]) {
      return roomTimeCalculations[room._id]
    }
    
    // Only calculate if the room is expanded or we're in the first 10 rooms
    const roomIndex = debouncedSession?.rooms?.findIndex(r => r._id === room._id) ?? -1
    const shouldCalculate = expandedRooms.has(room._id) || expandedCards.has(room._id) || roomIndex < 10
    
    if (shouldCalculate) {
      return calculateRoomTimeRemaining(room)
    }
    
    // Return a placeholder for non-visible rooms
    return null
  }, [roomTimeCalculations, debouncedSession?.rooms, expandedRooms, expandedCards, calculateRoomTimeRemaining])

  const toggleRoomExpansion = useCallback((roomId) => {
    setExpandedRooms(prev => {
      const newSet = new Set(prev)
      if (newSet.has(roomId)) {
        newSet.delete(roomId)
      } else {
        newSet.add(roomId)
      }
      return newSet
    })
  }, [])

  const toggleCardExpansion = useCallback((roomId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(roomId)) {
        // If the card is already expanded, collapse it
        newSet.delete(roomId)
      } else {
        // If the card is collapsed, expand it
        newSet.add(roomId)
      }
      return newSet
    })
  }, [])

  // Memoized component for room sections to prevent unnecessary re-renders
  const RoomSections = memo(({ sections }) => {
    if (!sections || sections.length === 0) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">No sections assigned</p>
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {sections
          .sort((a, b) => a.number - b.number)
          .map((section) => (
            <div key={section._id} className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-white">
                  Section {section.number} ({section.studentCount} students)
                </span>
              </div>
              {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Accommodations:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {section.accommodations.map((acc, index) => (
                      <span key={index} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs rounded">
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {section.notes && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  <span className="font-medium">Notes:</span> {section.notes}
                </div>
              )}
            </div>
          ))}
      </div>
    )
  })

  // Memoized component for room proctors
  const RoomProctors = memo(({ proctors }) => {
    if (!proctors || proctors.length === 0) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">No proctors assigned</p>
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {proctors.map((proctor, index) => (
          <div key={index} className="bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
            <div className="flex justify-between items-start mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-white">
                {proctor.name || `${proctor.firstName} ${proctor.lastName}`}
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div className="font-medium text-green-700 dark:text-green-300">
                {proctor.startTime} - {proctor.endTime}
              </div>
              {proctor.email && (
                <div className="mt-1">
                  <span className="font-medium">Email:</span> {proctor.email}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  })

  // Memoized component for room supplies with optimized counting
  const RoomSupplies = memo(({ supplies }) => {
    const supplyData = useMemo(() => {
      if (!supplies || supplies.length === 0) {
        return { initialSupplies: [], addedSupplies: [], hasSupplies: false }
      }

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

      return {
        initialSupplies: Object.entries(initialSupplyCounts),
        addedSupplies: Object.entries(addedSupplyCounts),
        hasSupplies: true
      }
    }, [supplies])

    if (!supplyData.hasSupplies) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">No supplies assigned</p>
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {/* Initial Supplies */}
        {supplyData.initialSupplies.length > 0 && (
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Initial:</span>
            <div className="space-y-1 mt-1">
              {supplyData.initialSupplies.map(([supplyName, count], index) => (
                <div key={`initial-${index}`} className="flex justify-between items-center bg-green-50 dark:bg-green-900 px-3 py-2 rounded-lg">
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {supplyName}
                  </span>
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Added Supplies */}
        {supplyData.addedSupplies.length > 0 && (
          <div className={supplyData.initialSupplies.length > 0 ? 'mt-3' : ''}>
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Added:</span>
            <div className="space-y-1 mt-1">
              {supplyData.addedSupplies.map(([supplyName, count], index) => (
                <div key={`added-${index}`} className="flex justify-between items-center bg-blue-50 dark:bg-blue-900 px-3 py-2 rounded-lg">
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {supplyName}
                  </span>
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  })


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-gray-600">Session not found</p>
          <button
            onClick={onBack}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const progress = calculateProgress()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 page-container" style={{ overflow: 'visible' }}>
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{session.name}</h1>
              <p className="text-gray-600">Session Progress View</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {getSessionRole()}
                </span>
                {/* Real-time connection status */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <span className="text-sm text-gray-600">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                  {!isConnected && connectionAttempts > 0 && (
                    <span className="text-xs text-red-600">
                      (Attempt {connectionAttempts}/5)
                    </span>
                  )}
                  {!isConnected && (
                    <button
                      onClick={() => {
                        console.log('🔄 Manual reconnect requested')
                        reconnect()
                      }}
                      className="ml-2 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                      title="Click to reconnect"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportSessionToExcel(session, session.name)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
                title="Export session data to Excel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
              <button
                onClick={onBack}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ overflow: 'visible' }}>
        {/* Permission Info Message */}
        {!canEditSession() && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">View-Only Access</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>You have view-only access to this session. You can see all session information, room statuses, and progress, but you cannot make any changes.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Session Info and Timer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Session Details */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Session Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="font-medium dark:text-white">{new Date(session.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Time</p>
                <p className="font-medium dark:text-white">{formatTime(session.startTime)} - {formatTime(session.endTime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white room-status-transition ${getStatusColor(session.status)}`}>
                  {getStatusText(session.status)}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
                <p className="font-medium dark:text-white">{calculateTotalStudentsInSession()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Rooms</p>
                <p className="font-medium dark:text-white">{session.rooms?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Sections</p>
                <p className="font-medium dark:text-white">{calculateTotalSectionsInSession()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Present Students</p>
                <p className="font-medium dark:text-white">{calculateTotalPresentStudents()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Absent Students</p>
                <p className="font-medium dark:text-white">{calculateTotalAbsentStudents()}</p>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Time Remaining</h2>
            <div className="flex-1 flex items-center justify-center">
              {timeRemaining ? (
                <div className="text-center">
                  {timeRemaining.isOver ? (
                    <div className="text-red-600 font-bold text-4xl">EXAM ENDED</div>
                  ) : (
                    <div className="text-5xl font-bold text-orange-600">
                      {String(timeRemaining.hours).padStart(2, '0')}:{String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Until exam ends</p>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">Loading timer...</div>
              )}
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Overall Progress</h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600">{progress}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div 
              className="bg-blue-600 h-4 rounded-full progress-bar-transition"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {session.rooms?.filter(room => room.status === 'completed').length || 0} of {session.rooms?.length || 0} rooms completed
          </p>
        </div>

        {/* Testing In Progress with Circular Bars */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Testing In Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-4">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-600 transition-all duration-1000 ease-out"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${(() => {
                      if (!session || !session.rooms) return 0;
                      const totalStudents = session.rooms.reduce((total, room) =>
                        total + (room.sections ? room.sections.reduce((s, section) => s + (section.studentCount || 0), 0) : 0)
                      , 0);
                      const remainingStudents = session.rooms
                        .filter(room => room.status !== 'completed')
                        .reduce((total, room) =>
                          total + (room.sections ? room.sections.reduce((s, section) => s + (section.studentCount || 0), 0) : 0)
                        , 0);
                      return totalStudents > 0 ? (remainingStudents / totalStudents) * 100 : 0;
                    })()} 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white transition-all duration-1000 ease-out transform scale-100">
                    {(() => {
                      if (!session || !session.rooms) return 0;
                      return session.rooms
                        .filter(room => room.status !== 'completed')
                        .reduce((total, room) =>
                          total + (room.sections ? room.sections.reduce((s, section) => s + (section.studentCount || 0), 0) : 0)
                        , 0)
                    })()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Students Still Testing</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-4">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200 dark:text-gray-700"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-green-600 transition-all duration-1000 ease-out"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${(() => {
                      if (!session || !session.rooms) return 0;
                      const totalSections = session.rooms.reduce((total, room) => total + (room.sections ? room.sections.length : 0), 0);
                      const remainingSections = session.rooms
                        .filter(room => room.status !== 'completed')
                        .reduce((total, room) => total + (room.sections ? room.sections.length : 0), 0);
                      return totalSections > 0 ? (remainingSections / totalSections) * 100 : 0;
                    })()} 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white transition-all duration-1000 ease-out transform scale-100">
                    {(() => {
                      if (!session || !session.rooms) return 0;
                      return session.rooms
                        .filter(room => room.status !== 'completed')
                        .reduce((total, room) => total + (room.sections ? room.sections.length : 0), 0)
                    })()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Sections Remaining</p>
            </div>
          </div>
        </div>

        {/* Sort Controls and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Sort Criteria and Direction */}
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="roomNumber">Room Number</option>
                  <option value="status">Status</option>
                  <option value="studentCount">Student Count</option>
                </select>
              </div>
              
              {/* Sort Direction Toggle Button */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort Direction
                </label>
                <button
                  onClick={() => setSortDescending(!sortDescending)}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition duration-200 bg-gray-300 hover:bg-gray-400 text-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 dark:text-gray-200 flex items-center gap-2"
                >
                  {sortDescending ? 'Descending ↓' : 'Ascending ↑'}
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex-1 max-w-md">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Rooms
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search by room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* View Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                View Mode
              </label>
              <button
                onClick={() => setIsTableView(!isTableView)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition duration-200 bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
              >
                {isTableView ? 'Card View' : 'Table View'}
              </button>
            </div>
          </div>
        </div>

        {/* Rooms Display */}
        {isTableView ? (
          /* Table View */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
            <div className="overflow-x-auto" style={{ touchAction: 'pan-x', overflowY: 'visible', position: 'relative' }}>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Students
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Present
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Absent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Sections
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Time Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {getPaginatedRooms().map((room) => (
                    <React.Fragment key={room._id}>
                      <tr 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={(e) => {
                          // Don't expand if clicking on action buttons
                          if (!e.target.closest('.dropdown-container') && !e.target.closest('button')) {
                            toggleRoomExpansion(room._id)
                          }
                        }}
                        data-room-id={room._id}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{room.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white room-status-transition ${getStatusColor(room.status)}`}>
                            {getStatusText(room.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white font-medium">
                            {calculateTotalStudents(room.sections)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {room.status === 'completed' ? (room.presentStudents || 0) : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {room.status === 'completed' && room.presentStudents !== undefined 
                              ? calculateTotalStudents(room.sections) - room.presentStudents 
                              : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {room.sections ? room.sections.length : 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getRoomTimeRemaining(room)?.isOver ? 'text-red-600' : 'text-orange-600'}`}>
                            {(() => {
                              const timeData = getRoomTimeRemaining(room)
                              if (!timeData) return '--:--:--'
                              if (timeData.isOver) return 'TIME UP'
                              const timeString = `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}`
                              const multiplier = timeData.multiplier
                              if (multiplier > 1) {
                                return (
                                  <div className="flex flex-col">
                                    <span>{timeString}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      ({multiplier}x time)
                                    </span>
                                  </div>
                                )
                              }
                              return timeString
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {canEditSession() && (
                              <>
                                {room.status === 'completed' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleMarkRoomIncomplete(room._id)
                                    }}
                                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg font-medium transition-colors duration-200 border border-amber-200 dark:border-amber-800"
                                    title="Mark Incomplete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleMarkRoomComplete(room._id)
                                    }}
                                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg font-medium transition-colors duration-200 border border-emerald-200 dark:border-emerald-800"
                                    title="Mark Complete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/sessions/${sessionId}/rooms/${room._id}`)
                              }}
                              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-medium transition-colors duration-200 border border-blue-200 dark:border-blue-800"
                              title="View Room Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                            {canEditSession() && (
                              <div className="relative dropdown-container">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    toggleDropdown(room._id, e)
                                  }}
                                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors duration-200"
                                  title="More Actions"
                                >
                                  ⋯
                                </button>
                                
                                {showDropdown === room._id && (
                                  <div 
                                    data-dropdown-menu
                                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
                                    style={{ 
                                      position: 'absolute',
                                      top: '100%',
                                      right: '0',
                                      zIndex: 99999,
                                      minHeight: 'auto',
                                      maxHeight: 'none',
                                      width: '192px'
                                    }}
                                  >
                                    <div className="py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          console.log('Add Supply button clicked')
                                          handleAddSupplyClick(room)
                                          setShowDropdown(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                        style={{ 
                                          pointerEvents: 'auto',
                                          zIndex: 99999,
                                          position: 'relative'
                                        }}
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        Add Supply
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          console.log('Move Students button clicked')
                                          handleMoveStudentsClick(room)
                                          setShowDropdown(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                        style={{ 
                                          pointerEvents: 'auto',
                                          zIndex: 99999,
                                          position: 'relative'
                                        }}
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Move Students
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          console.log('Add Notes button clicked')
                                          handleRoomNotesClick(room)
                                          setShowDropdown(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Add Notes
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          console.log('Edit Supplies button clicked')
                                          handleEditSuppliesClick(room)
                                          setShowDropdown(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                        style={{ 
                                          pointerEvents: 'auto',
                                          zIndex: 99999,
                                          position: 'relative'
                                        }}
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit Supplies
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          console.log('Invalidate Test button clicked')
                                          handleInvalidateTestClick(room)
                                          setShowDropdown(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        Invalidate Test
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      <tr key={`${room._id}-details`} className="bg-gray-50 dark:bg-gray-700">
                        <td colSpan="9" className="px-0 py-0">
                          <div className={`overflow-hidden room-expansion-transition ${expandedRooms.has(room._id) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="px-6 py-3">
                              <div className="grid grid-cols-3 gap-4">
                                {/* Sections Column */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sections</h4>
                                  <RoomSections sections={room.sections} />
                                </div>

                                {/* Proctors Column */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proctors</h4>
                                  <RoomProctors proctors={room.proctors} />
                                </div>

                                {/* Supplies and Time Column */}
                                <div className="flex flex-col h-full justify-between">
                                  {/* Supplies Section */}
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Supplies</h4>
                                    <RoomSupplies supplies={room.supplies} />
                                  </div>

                                  {/* Invalidated Tests Section */}
                                  {(() => {
                                    const roomInvalidatedTests = invalidatedTests.filter(inv => inv.roomId === room._id)
                                    if (roomInvalidatedTests.length > 0) {
                                      return (
                                        <div className="mt-4">
                                          <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                            Invalidated Tests ({roomInvalidatedTests.length})
                                          </h4>
                                          <div className="space-y-2 max-h-32 overflow-y-auto">
                                            {roomInvalidatedTests.map((invalidation) => (
                                              <div key={invalidation.id} className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-2">
                                                <div className="flex justify-between items-start">
                                                  <div className="flex-1">
                                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                                      Section {invalidation.sectionNumber}
                                                    </p>
                                                    <p className="text-xs text-red-600 dark:text-red-400">
                                                      {invalidation.notes}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center space-x-2">
                                                    <span className="text-xs text-red-500 dark:text-red-400">
                                                      {new Date(invalidation.timestamp).toLocaleTimeString()}
                                                    </span>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRemoveInvalidatedTestClick(invalidation)
                                                      }}
                                                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                                                      title="Remove invalidation"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}

                                  {/* Room Notes Section */}
                                  {room.notes && (
                                    <div className="mt-4">
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Room Notes
                                      </h4>
                                      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                          {room.notes}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card View */
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getPaginatedRooms().map((room) => (
              <div 
                key={room._id} 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow duration-200"
                onClick={() => toggleCardExpansion(room._id)}
                data-room-id={room._id}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{room.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white room-status-transition ${getStatusColor(room.status)}`}>
                    {getStatusText(room.status)}
                  </span>
                </div>

                {/* Total Students */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Students:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {calculateTotalStudents(room.sections)}
                    </span>
                  </div>
                </div>

                {/* Present Students */}
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Present Students:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {room.status === 'completed' ? (room.presentStudents || 0) : '-'}
                    </span>
                  </div>
                </div>

                {/* Absent Students */}
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Absent Students:</span>
                    <span className="text-2xl font-bold text-red-600">
                      {room.status === 'completed' && room.presentStudents !== undefined 
                        ? calculateTotalStudents(room.sections) - room.presentStudents 
                        : '-'}
                    </span>
                  </div>
                </div>

                {/* Room Actions */}
                <div className="space-y-3 mb-4">
                  {isViewerOnly() ? (
                    /* Viewer Only - Show only View Details button */
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/sessions/${sessionId}/rooms/${room._id}`)
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Details
                    </button>
                  ) : canEditSession() ? (
                    /* Editor/Manager - Show all management buttons */
                    <>
                      {room.status === 'completed' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkRoomIncomplete(room._id)
                          }}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Mark Incomplete
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkRoomComplete(room._id)
                          }}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Mark Complete
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/sessions/${sessionId}/rooms/${room._id}`)
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Details
                      </button>

                      <div className="relative dropdown-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleDropdown(room._id)
                          }}
                          className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                        >
                          <span className="mr-2">⋯</span>
                          More Actions
                        </button>
                        
                        {showDropdown === room._id && (
                          <div data-dropdown-menu className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Add Supply button clicked (card view)')
                                  handleAddSupplyClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                Add Supply
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Move Students button clicked (card view)')
                                  handleMoveStudentsClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Move Students
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Add Notes button clicked (card view)')
                                  handleRoomNotesClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Add Notes
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Edit Supplies button clicked (card view)')
                                  handleEditSuppliesClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Supplies
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Invalidate Test button clicked (card view)')
                                  handleInvalidateTestClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                Invalidate Test
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* No permissions - Show only View Details button */
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/sessions/${sessionId}/rooms/${room._id}`)
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Details
                    </button>
                  )}
                </div>



                {/* Expanded Content */}
                {expandedCards.has(room._id) && (
                  <div className="mt-4 space-y-4">
                    {/* Sections */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sections</h4>
                      <RoomSections sections={room.sections} />
                    </div>

                    {/* Proctors */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proctors</h4>
                      <RoomProctors proctors={room.proctors} />
                    </div>

                    {/* Supplies */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Supplies</h4>
                      <RoomSupplies supplies={room.supplies} />
                    </div>

                    {/* Room Notes */}
                    {room.notes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Room Notes
                        </h4>
                        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {room.notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Estimated Time */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estimated Time:</span>
                        <div className={`text-lg font-bold ${getRoomTimeRemaining(room)?.isOver ? 'text-red-600' : 'text-orange-600'}`}>
                          {(() => {
                            const timeData = getRoomTimeRemaining(room)
                            if (!timeData) return '--:--:--'
                            if (timeData.isOver) return 'TIME UP'
                            const timeString = `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}`
                            const multiplier = timeData.multiplier
                            if (multiplier > 1) {
                              return (
                                <div className="flex flex-col items-end">
                                  <span>{timeString}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                    ({multiplier}x time)
                                  </span>
                                </div>
                              )
                            }
                            return timeString
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * roomsPerPage) + 1} to {Math.min(currentPage * roomsPerPage, getSortedRooms().length)} of {getSortedRooms().length} rooms
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Supply Modal */}
      {showAddSupplyModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add Supply to {selectedRoom.name}</h2>
            
            <div className="space-y-4">
              {/* Preset Supplies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Supply
                </label>
                <select
                  value={selectedPresetSupply}
                  onChange={(e) => setSelectedPresetSupply(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Choose a supply</option>
                  {PRESET_SUPPLIES.map(supply => (
                    <option key={supply} value={supply}>{supply}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={newSupplyQuantity}
                  onChange={(e) => setNewSupplyQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddSupplyModal(false)
                    setSelectedPresetSupply('')
                    setNewSupplyQuantity(1)
                    setSelectedRoom(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSupply}
                  disabled={!selectedPresetSupply}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Add Supply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supply Modal */}
      {showEditSupplyModal && selectedRoom && editingSupply && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Supply in {selectedRoom.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Supply Name
                </label>
                <input
                  type="text"
                  value={editingSupply.name}
                  onChange={(e) => setEditingSupply({...editingSupply, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={editSupplyQuantity}
                  onChange={(e) => setEditSupplyQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowEditSupplyModal(false)
                    setEditingSupply(null)
                    setEditSupplyQuantity(1)
                    setSelectedRoom(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSupply}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Update Supply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Students Modal */}
      {showMoveStudentsModal && moveFromRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Move Students</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Room
                </label>
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg dark:text-white">
                  {moveFromRoom.name}
                </div>
              </div>

              {moveFromRoom.sections && moveFromRoom.sections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Students to Move
                  </label>
                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {moveFromRoom.sections
                      .sort((a, b) => a.number - b.number)
                      .map((section) => (
                        <div key={section._id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <div className="text-sm font-medium text-gray-700 dark:text-white">
                                Section {section.number} ({section.studentCount} students)
                              </div>
                              {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                  Accommodations: {section.accommodations.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Students to move from this section:
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={section.studentCount}
                                value={studentMoveData[section._id]?.studentsToMove || 0}
                                onChange={(e) => {
                                  const studentsToMove = parseInt(e.target.value) || 0
                                  setStudentMoveData(prev => ({
                                    ...prev,
                                    [section._id]: {
                                      ...prev[section._id],
                                      studentsToMove
                                    }
                                  }))
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                (0-{section.studentCount})
                              </span>
                            </div>
                            
                            {(studentMoveData[section._id]?.studentsToMove || 0) > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Destination room:
                                </label>
                                <select
                                  value={studentMoveData[section._id]?.destinationRoom || ''}
                                  onChange={(e) => {
                                    setStudentMoveData(prev => ({
                                      ...prev,
                                      [section._id]: {
                                        ...prev[section._id],
                                        destinationRoom: e.target.value
                                      }
                                    }))
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                                >
                                  <option value="">Select destination room</option>
                                  {session.rooms
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(room => (
                                      <option key={room._id} value={room._id}>
                                        {room.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowMoveStudentsModal(false)
                    setMoveFromRoom(null)
                    setStudentMoveData({})
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveStudents}
                  disabled={Object.keys(studentMoveData).filter(key => 
                    studentMoveData[key].studentsToMove > 0 && 
                    studentMoveData[key].destinationRoom
                  ).length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Move Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplies Modal */}
      {showEditSuppliesModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Supplies for {selectedRoom.name}</h2>
            
            <div className="space-y-4">
              {(() => {
                const supplies = selectedRoom.supplies || []
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Initial Supplies</h3>
                        <div className="space-y-2">
                          {Object.entries(initialSupplyCounts).map(([supplyName, count]) => (
                            <div key={supplyName} className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                              <div className="flex items-center">
                                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <span className="text-green-700 dark:text-green-300 font-medium">{supplyName}</span>
                              </div>
                              <span className="text-green-800 dark:text-green-200 font-semibold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Added Supplies */}
                    {Object.keys(addedSupplyCounts).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Added Supplies</h3>
                        <div className="space-y-2">
                          {Object.entries(addedSupplyCounts).map(([supplyName, count]) => (
                            <div key={supplyName} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                              <div className="flex items-center">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <span className="text-blue-700 dark:text-blue-300 font-medium">{supplyName}</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleAdjustSupplyQuantity(selectedRoom._id, supplyName, -1)}
                                    disabled={count <= 0}
                                    className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition duration-200"
                                    title="Remove 1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                  </button>
                                  <span className="text-blue-800 dark:text-blue-200 font-semibold min-w-[2rem] text-center">{count}</span>
                                  <button
                                    onClick={() => handleAdjustSupplyQuantity(selectedRoom._id, supplyName, 1)}
                                    className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition duration-200"
                                    title="Add 1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleRemoveSupply(selectedRoom._id, supplyName)}
                                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 ml-2"
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
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400">No supplies assigned to this room</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            
            <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowEditSuppliesModal(false)
                  setSelectedRoom(null)
                }}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Activity Log</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowActivityLog(!showActivityLog)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition duration-200 bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
              >
                {showActivityLog ? 'Hide Log' : 'Show Log'}
              </button>
              {getSessionRole() === 'Owner' && (
                <button
                  onClick={() => setShowClearLogModal(true)}
                  className="px-3 py-2 text-sm font-medium rounded-lg transition duration-200 bg-gray-300 hover:bg-gray-400 text-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 dark:text-gray-200"
                  title="Clear activity log (Owner only)"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {showActivityLog && (
            <div className="space-y-4">
              {activityLog.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2">No activity recorded yet</p>
                  <p className="text-sm">Actions will appear here as they happen</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {activityLog.map((log, index) => {
                    const colors = getActivityLogColors(log.action);
                    return (
                      <div 
                        key={index} 
                        className={`flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 ${colors.border}`}
                      >
                        <div className={`flex-shrink-0 w-2 h-2 ${colors.dot} rounded-full mt-2`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.action}
                            </p>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              User: <span className="font-medium">{log.userName}</span>
                            </span>
                            {log.roomName && (
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                Room: <span className="font-medium">{log.roomName}</span>
                              </span>
                            )}
                            {log.details && (
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                {log.details}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invalidated Tests Section */}
      {invalidatedTests.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Invalidated Tests
              </h2>
              <span className="bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 text-sm font-medium px-3 py-1 rounded-full">
                {invalidatedTests.length}
              </span>
            </div>
            
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {invalidatedTests.map((invalidation) => {
                const room = session?.rooms?.find(r => r._id === invalidation.roomId)
                return (
                  <div key={invalidation.id} className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          Section {invalidation.sectionNumber} - {room?.name || 'Unknown Room'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Invalidated by {invalidation.invalidatedBy}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(invalidation.timestamp).toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleRemoveInvalidatedTestClick(invalidation)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                          title="Remove invalidation"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/30 rounded p-3">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        <strong>Notes:</strong> {invalidation.notes}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Present Students Modal */}
      {showPresentStudentsModal && roomToComplete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Mark Room Complete</h2>
            
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Room: {roomToComplete.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Total Students: {calculateTotalStudents(roomToComplete.sections)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Sections: {roomToComplete.sections?.length || 0}
                </p>
              </div>
              
              {roomToComplete.sections && roomToComplete.sections.length > 1 ? (
                // Per-section input for multiple sections
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Students Present by Section
                  </h3>
                  <div className="space-y-4">
                    {roomToComplete.sections
                      .sort((a, b) => a.number - b.number)
                      .map((section) => (
                        <div key={section._id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Section {section.number}
                            </h4>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Total: {section.studentCount} students
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={section.studentCount}
                            value={sectionPresentCounts[section._id] || ''}
                            onChange={(e) => setSectionPresentCounts(prev => ({
                              ...prev,
                              [section._id]: e.target.value
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-600 dark:text-white"
                            placeholder={`Enter present students (0-${section.studentCount})`}
                          />
                        </div>
                      ))}
                  </div>
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Total Present:</span> {
                        Object.values(sectionPresentCounts).reduce((total, count) => {
                          const num = parseInt(count) || 0
                          return total + num
                        }, 0)
                      } / {calculateTotalStudents(roomToComplete.sections)}
                    </p>
                  </div>
                </div>
              ) : (
                // Single input for single section or no sections
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    How many students were present?
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={calculateTotalStudents(roomToComplete.sections)}
                    value={presentStudentsCount}
                    onChange={(e) => setPresentStudentsCount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter number of present students"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter a number between 0 and {calculateTotalStudents(roomToComplete.sections)}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowPresentStudentsModal(false)
                    setRoomToComplete(null)
                    setPresentStudentsCount('')
                    setSectionPresentCounts({})
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRoomComplete}
                  disabled={roomToComplete.sections && roomToComplete.sections.length > 1 
                    ? !Object.values(sectionPresentCounts).every(count => count !== '' && !isNaN(parseInt(count)))
                    : (!presentStudentsCount || isNaN(parseInt(presentStudentsCount)))
                  }
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Activity Log Confirmation Modal */}
      {showClearLogModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Clear Activity Log</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to clear the activity log for this session?
              </p>
              <p className="text-sm text-gray-600">
                This action cannot be undone. All activity history will be permanently removed.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => setShowClearLogModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearActivityLog}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Clear Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Room Incomplete Confirmation Modal */}
      {showIncompleteConfirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Mark Room Incomplete</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to mark this room as incomplete?
              </p>
              <p className="text-sm text-gray-600">
                This will change the room status back to active and clear the present students count. The session status may also change back to active if all rooms become incomplete.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={cancelMarkRoomIncomplete}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMarkRoomIncomplete}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Mark Incomplete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invalidate Test Modal */}
      {showInvalidateModal && roomToInvalidate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Invalidate Test</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Invalidate 1 test in <strong>{roomToInvalidate.name}</strong>
              </p>
              
              {/* Section Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Choose a section...</option>
                  {roomToInvalidate.sections?.map(section => (
                    <option key={section._id} value={section.number}>
                      Section {section.number} ({section.studentCount} students)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={invalidationNotes}
                  onChange={(e) => setInvalidationNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Enter notes about the test invalidation..."
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={cancelInvalidateTest}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvalidateTest}
                  disabled={!invalidationNotes.trim() || !selectedSection}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Invalidate Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Invalidation Confirmation Modal */}
      {showRemoveInvalidationModal && invalidationToRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Remove Invalidation</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to remove this test invalidation?
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Section {invalidationToRemove.sectionNumber}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {invalidationToRemove.notes}
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                  Invalidated by {invalidationToRemove.invalidatedBy} on {new Date(invalidationToRemove.timestamp).toLocaleString()}
                </p>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action will be recorded in the activity log.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={cancelRemoveInvalidatedTest}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveInvalidatedTest}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Remove Invalidation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Notes Modal */}
      {showRoomNotesModal && selectedRoomForNotes && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add Notes to {selectedRoomForNotes.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room Notes
                </label>
                <textarea
                  value={roomNotes}
                  onChange={(e) => setRoomNotes(e.target.value)}
                  placeholder="Enter notes for this room..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>
            </div>
            
            <div className="flex space-x-4 pt-6">
              <button
                onClick={cancelRoomNotes}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoomNotes}
                disabled={!roomNotes.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SessionView) 