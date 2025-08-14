import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { testingAPI } from '../services/api'
import confetti from 'canvas-confetti'
import { useRealTime } from '../contexts/RealTimeContext'

function SessionView({ user, onBack }) {
  const { sessionId } = useParams()
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
    }, 50) // Reduced to 50ms for more responsive feel
    
    return () => clearTimeout(timer)
  }, [session])
  
  const [showAddSupplyModal, setShowAddSupplyModal] = useState(false)
  const [showEditSupplyModal, setShowEditSupplyModal] = useState(false)
  const [showMoveStudentsModal, setShowMoveStudentsModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [newSupplyQuantity, setNewSupplyQuantity] = useState(1)
  const [selectedPresetSupply, setSelectedPresetSupply] = useState('')
  const [editingSupply, setEditingSupply] = useState(null)
  const [editSupplyQuantity, setEditSupplyQuantity] = useState(1)
  const [moveFromRoom, setMoveFromRoom] = useState(null)
  const [studentMoveData, setStudentMoveData] = useState({}) // { sectionId: { studentsToMove: number, destinationRoom: roomId } }
  const [roomTimeMultipliers] = useState({}) // For future 1.5x, 2x time features

  // Activity log state
  const [activityLog, setActivityLog] = useState([])
  const [showActivityLog, setShowActivityLog] = useState(true)



  const clearActivityLog = useCallback(async () => {
    try {
      await testingAPI.clearActivityLog(sessionId)
      setActivityLog([])
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
    console.log('🔍 SessionView - Session state changed:', {
      sessionId,
      sessionExists: !!session,
      sessionObjectId: session?._id,
      roomsCount: session?.rooms?.length || 0
    })
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
            // Only update the status field to avoid overwriting other properties
            updatedSession.rooms[roomIndex] = { 
              ...updatedSession.rooms[roomIndex], 
              status: update.data.status,
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
        // For student movements, we can update local state
        if (session && update.data.sourceRoomId && update.data.destinationRoomId) {
          // Refresh session data to get the updated state after student movement
          silentRefreshRef.current()
          
          // Activity log entry is now handled by the server
        } else {
          silentRefreshRef.current()
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

  const handleMarkRoomComplete = useCallback(async (roomId) => {
    try {
      console.log('Marking room complete:', roomId)
      const response = await testingAPI.updateRoomStatus(roomId, 'completed')
      console.log('Room status update response:', response)
      
      // Update local state immediately
      setSession(prevSession => {
        const updatedSession = {
          ...prevSession,
          rooms: prevSession.rooms.map(room => 
            room._id === roomId 
              ? { ...room, status: 'completed' }
              : room
          )
        }
        
        // Check if all rooms are completed and update session status
        const allRoomsCompleted = updatedSession.rooms.every(room => room.status === 'completed')
        if (allRoomsCompleted && updatedSession.status !== 'completed') {
          console.log('All rooms completed, updating session status to completed')
          testingAPI.updateSession(sessionId, { status: 'completed' })
          updatedSession.status = 'completed'
          
          // Trigger confetti animation when all rooms are completed
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })
        }
        
        return updatedSession
      })

      // Activity log entry is now handled by the server
    } catch (error) {
      console.error('Error marking room complete:', error)
    }
  }, [sessionId, session?.rooms])

  const handleMarkRoomIncomplete = useCallback(async (roomId) => {
    try {
      await testingAPI.updateRoomStatus(roomId, 'active')
      
      // Update local state immediately
      setSession(prevSession => {
        const updatedSession = {
          ...prevSession,
          rooms: prevSession.rooms.map(room => 
            room._id === roomId 
              ? { ...room, status: 'active' }
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
    } catch (error) {
      console.error('Error marking room incomplete:', error)
    }
  }, [sessionId, session?.rooms])

  const handleAddSupply = useCallback(async () => {
    if (!selectedPresetSupply || !selectedRoom || newSupplyQuantity < 1) return
    
    try {
      console.log('🔍 handleAddSupply called');
      console.log('🔍 selectedPresetSupply:', selectedPresetSupply);
      console.log('🔍 selectedRoom:', selectedRoom);
      console.log('🔍 newSupplyQuantity:', newSupplyQuantity);
      
      const currentSupplies = selectedRoom.supplies || []
      const newSupplyName = selectedPresetSupply
      const newQuantity = newSupplyQuantity
      
      console.log('🔍 currentSupplies:', currentSupplies);
      
      // Check if the supply already exists
      const existingSupplyIndex = currentSupplies.findIndex(supply => supply === newSupplyName)
      
      console.log('🔍 existingSupplyIndex:', existingSupplyIndex);
      
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
      
      console.log('🔍 updatedSupplies:', updatedSupplies);
      console.log('🔍 Calling testingAPI.updateRoom with:', { supplies: updatedSupplies });
      
      await testingAPI.updateRoom(selectedRoom._id, { supplies: updatedSupplies })
      
      console.log('🔍 testingAPI.updateRoom completed successfully');
      
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

  const handleRemoveSupply = useCallback(async (roomId, supply) => {
    try {
      console.log('🔍 handleRemoveSupply called');
      console.log('🔍 roomId:', roomId);
      console.log('🔍 supply to remove:', supply);
      
      const room = session.rooms.find(r => r._id === roomId)
      const updatedSupplies = room.supplies.filter(s => s !== supply)
      
      console.log('🔍 room:', room);
      console.log('🔍 updatedSupplies:', updatedSupplies);
      console.log('🔍 Calling testingAPI.updateRoom with:', { supplies: updatedSupplies });
      
      await testingAPI.updateRoom(roomId, { supplies: updatedSupplies })
      
      console.log('🔍 testingAPI.updateRoom completed successfully');
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === roomId 
            ? { ...room, supplies: updatedSupplies }
            : room
        )
      }))

      // Activity log entry is now handled by the server
    } catch (error) {
      console.error('Error removing supply:', error)
    }
  }, [session?.rooms])

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
            
            // Log the student movement action first (only when moving to a different room)
            if (moveInfo.destinationRoom !== moveFromRoom._id) {
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
            }
            
            // Check if moving to the same room
            if (moveInfo.destinationRoom === moveFromRoom._id) {
              // If moving within the same room, find a section with the same number and merge
              console.log('Moving within the same room - looking for section to merge into')
              
              // Find a section with the same number in the same room (excluding current section)
              const targetSection = moveFromRoom.sections.find(s => s.number === section.number && s._id !== sectionId)
              
              if (targetSection) {
                // Merge students into the existing section
                const newTotalStudents = targetSection.studentCount + moveInfo.studentsToMove
                await testingAPI.updateSection(targetSection._id, { studentCount: newTotalStudents })
                
                // Remove the current section from the room (since we merged its students)
                await testingAPI.removeSectionFromRoom(moveFromRoom._id, sectionId)
              } else {
                // No matching section found, create a new one
                console.log('No matching section found, creating new section in same room')
                
                // Find a unique section number for the destination room (same room)
                let newSectionNumber = section.number
                const existingNumbers = moveFromRoom.sections?.map(s => s.number) || []
                let counter = 1
                while (existingNumbers.includes(newSectionNumber)) {
                  newSectionNumber = section.number + counter
                  counter++
                }
                
                console.log(`Using section number ${newSectionNumber} for same room (original was ${section.number})`)
                
                // Create a new section in the same room
                const newSectionData = {
                  number: newSectionNumber,
                  studentCount: moveInfo.studentsToMove,
                  accommodations: section.accommodations || [],
                  notes: section.notes || ''
                }
                
                console.log('Creating new section in same room with data:', newSectionData)
                
                // Create the new section
                const newSectionResponse = await testingAPI.createSection(newSectionData)
                console.log('New section created in same room:', newSectionResponse)
                
                // Add the new section to the same room
                await testingAPI.addSectionToRoom(moveFromRoom._id, newSectionResponse.section._id)
                console.log(`Added section to same room ${moveFromRoom._id}`)
                
                // Update the original section in the source room
                const newStudentCount = section.studentCount - moveInfo.studentsToMove
                
                if (newStudentCount === 0) {
                  // If all students are moved, remove the section from the room
                  console.log(`All students moved from section ${sectionId}, removing section from room`)
                  await testingAPI.removeSectionFromRoom(moveFromRoom._id, sectionId)
                } else {
                  // Update the section with the remaining students
                  await testingAPI.updateSection(sectionId, { studentCount: newStudentCount })
                  console.log(`Updated original section ${sectionId} to have ${newStudentCount} students`)
                }
              }
            } else {
              // Moving to a different room
              console.log('Moving to different room')
              
              // Find the destination room to check existing section numbers
              const destinationRoom = session.rooms.find(r => r._id === moveInfo.destinationRoom)
              if (!destinationRoom) {
                console.error('Destination room not found')
                continue
              }
              
              // Check if destination room already has a section with the same number
              const existingSection = destinationRoom.sections?.find(s => s.number === section.number)
              
              if (existingSection) {
                // Merge students into the existing section
                console.log(`Merging ${moveInfo.studentsToMove} students into existing section ${existingSection.number} in destination room`)
                const newTotalStudents = existingSection.studentCount + moveInfo.studentsToMove
                await testingAPI.updateSection(existingSection._id, { studentCount: newTotalStudents })
                console.log(`Updated existing section ${existingSection._id} to have ${newTotalStudents} students`)
              } else {
                // Create a new section in the destination room
                console.log('Creating new section in destination room')
                
                // Find a unique section number for the destination room
                let newSectionNumber = section.number
                const existingNumbers = destinationRoom.sections?.map(s => s.number) || []
                let counter = 1
                while (existingNumbers.includes(newSectionNumber)) {
                  newSectionNumber = section.number + counter
                  counter++
                }
                
                console.log(`Using section number ${newSectionNumber} for destination room (original was ${section.number})`)
                
                // Create a new section in the destination room
                const newSectionData = {
                  number: newSectionNumber,
                  studentCount: moveInfo.studentsToMove,
                  accommodations: section.accommodations || [],
                  notes: section.notes || ''
                }
                
                console.log('Creating new section in destination room with data:', newSectionData)
                
                // Create the new section
                const newSectionResponse = await testingAPI.createSection(newSectionData)
                console.log('New section created in destination room:', newSectionResponse)
                
                // Add the new section to the destination room
                await testingAPI.addSectionToRoom(moveInfo.destinationRoom, newSectionResponse.section._id)
                console.log(`Added section to destination room ${moveInfo.destinationRoom}`)
                
                // Update the original section in the source room
                const newStudentCount = section.studentCount - moveInfo.studentsToMove
                
                if (newStudentCount === 0) {
                  // If all students are moved, remove the section from the room
                  console.log(`All students moved from section ${sectionId}, removing section from room`)
                  await testingAPI.removeSectionFromRoom(moveFromRoom._id, sectionId)
                } else {
                  // Update the section with the remaining students
                  await testingAPI.updateSection(sectionId, { studentCount: newStudentCount })
                  console.log(`Updated original section ${sectionId} to have ${newStudentCount} students`)
                }
              }
            }
          } else {
            console.error(`Invalid move: ${moveInfo.studentsToMove} students cannot be moved from section with ${section?.studentCount || 0} students`)
          }
        }
      }
      
      // Refresh session data to get the updated state
      await fetchSessionData()
      
      // Reset the modal state
      setShowMoveStudentsModal(false)
      setMoveFromRoom(null)
      setStudentMoveData({})
      
      // Activity log entry is now handled by the server
      console.log('Student move process completed successfully')
    } catch (error) {
      console.error('Error moving students:', error)
    }
  }, [moveFromRoom, studentMoveData, session?.rooms, fetchSessionData])

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

  // Helper function to get the correct plural form of a supply name
  const getPluralForm = useCallback((supplyName) => {
    // Handle common irregular plurals
    const irregularPlurals = {
      'pencil': 'pencils',
      'pen': 'pens',
      'calculator': 'calculators',
      'protractor': 'protractors',
      'ruler': 'rulers',
      'notebook': 'notebooks',
      'textbook': 'textbooks',
      'paper': 'papers',
      'marker': 'markers',
      'eraser': 'erasers',
      'scissors': 'scissors',
      'tape': 'tape',
      'stapler': 'staplers',
      'folder': 'folders',
      'binder': 'binders'
    };
    
    // Check if we have an irregular plural
    if (irregularPlurals[supplyName.toLowerCase()]) {
      return irregularPlurals[supplyName.toLowerCase()];
    }
    
    // Handle regular plurals
    if (supplyName.toLowerCase().endsWith('s')) {
      // If it already ends with 's', just return as is
      return supplyName;
    }
    
    // Add 's' for regular plurals
    return supplyName + 's';
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

  const calculateTotalStudents = useCallback((sections) => {
    if (!sections || sections.length === 0) return 0
    return sections.reduce((total, section) => total + (section.studentCount || 0), 0)
  }, [])

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



  const calculateRoomTimeRemaining = useCallback((room) => {
    if (!memoizedSession || !timeRemaining || timeRemaining.isOver) return null
    
    // Get time multiplier for this room (default 1x, future: 1.5x, 2x, etc.)
    const timeMultiplier = roomTimeMultipliers[room._id] || 1
    
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
  }, [session?.startTime, session?.endTime, session?.date, timeRemaining, roomTimeMultipliers])

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 page-container">
      
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
            <button
              onClick={onBack}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Rooms</p>
                <p className="font-medium dark:text-white">{session.rooms?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Time Remaining</h2>
            {timeRemaining ? (
              <div className="text-center">
                {timeRemaining.isOver ? (
                  <div className="text-red-600 font-bold text-2xl">EXAM ENDED</div>
                ) : (
                  <div className="text-3xl font-bold text-blue-600">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
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
                      Sections
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Supplies
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
                  {getSortedRooms().map((room) => (
                    <React.Fragment key={room._id}>
                      <tr 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleRoomExpansion(room._id)}
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
                            {room.sections ? room.sections.length : 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {room.supplies && room.supplies.length > 0 ? room.supplies.length : 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${calculateRoomTimeRemaining(room)?.isOver ? 'text-red-600' : 'text-orange-600'}`}>
                            {(() => {
                              const timeData = calculateRoomTimeRemaining(room)
                              if (!timeData) return '--:--:--'
                              if (timeData.isOver) return 'TIME UP'
                              return `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}`
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
                                    className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-lg font-medium transition-colors duration-200"
                                    title="Mark Incomplete"
                                  >
                                    ↺
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleMarkRoomComplete(room._id)
                                    }}
                                    className="px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg font-medium transition-colors duration-200"
                                    title="Mark Complete"
                                  >
                                    ✓
                                  </button>
                                )}
                              </>
                            )}
                            {canEditSession() && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedRoom(room)
                                    setShowAddSupplyModal(true)
                                  }}
                                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg font-medium transition-colors duration-200"
                                  title="Add Supply"
                                >
                                  +
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setMoveFromRoom(room)
                                    setShowMoveStudentsModal(true)
                                  }}
                                  className="px-3 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg font-medium transition-colors duration-200"
                                  title="Move Students"
                                >
                                  →
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      <tr key={`${room._id}-details`} className="bg-gray-50 dark:bg-gray-700">
                        <td colSpan="7" className="px-0 py-0">
                          <div className={`overflow-hidden room-expansion-transition ${expandedRooms.has(room._id) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="px-6 py-3">
                              <div className="grid grid-cols-2 gap-4">
                                {/* Sections Column */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sections</h4>
                                  {room.sections && room.sections.length > 0 ? (
                                    <div className="space-y-2">
                                      {room.sections
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
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No sections assigned</p>
                                  )}
                                </div>

                                {/* Supplies and Time Column */}
                                <div className="flex flex-col h-full justify-between">
                                  {/* Supplies Section */}
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Supplies</h4>
                                    {room.supplies && room.supplies.length > 0 ? (
                                      <div className="space-y-1">
                                        {(() => {
                                          // Group supplies by name and count them
                                          const supplyCounts = {}
                                          room.supplies.forEach(supply => {
                                            supplyCounts[supply] = (supplyCounts[supply] || 0) + 1
                                          })
                                          
                                          return Object.entries(supplyCounts).map(([supplyName, count], index) => (
                                            <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-600 px-3 py-2 rounded-lg">
                                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {count > 1 ? `${count} ${getPluralForm(supplyName)}` : supplyName}
                                              </span>
                                              <div className="flex items-center space-x-2">
                                                {canEditSession() && (
                                                  <>
                                                    <button
                                                      onClick={() => {
                                                        setEditingSupply({
                                                          original: supplyName,
                                                          name: supplyName
                                                        })
                                                        setEditSupplyQuantity(count)
                                                        setSelectedRoom(room)
                                                        setShowEditSupplyModal(true)
                                                      }}
                                                      className="text-blue-500 hover:text-blue-700 text-sm"
                                                      title="Edit Supply"
                                                    >
                                                      ✎
                                                    </button>
                                                    <button
                                                      onClick={() => handleRemoveSupply(room._id, supplyName)}
                                                      className="text-red-500 hover:text-red-700 text-sm"
                                                      title="Remove Supply"
                                                    >
                                                      ×
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          ))
                                        })()}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 dark:text-gray-400">No supplies added</p>
                                    )}
                                  </div>

                                  {/* Minimum spacing between sections */}
                                  <div className="min-h-[2rem]"></div>

                                  {/* Time Remaining Section */}
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Remaining</h4>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-700 dark:text-gray-300">Estimated Time:</span>
                                      <span className={`text-lg font-bold ${calculateRoomTimeRemaining(room)?.isOver ? 'text-red-600' : 'text-orange-600'}`}>
                                        {(() => {
                                          const timeData = calculateRoomTimeRemaining(room)
                                          if (!timeData) return '--:--:--'
                                          if (timeData.isOver) return 'TIME UP'
                                          return `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}`
                                        })()}
                                      </span>
                                    </div>
                                  </div>
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
            {getSortedRooms().map((room) => (
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

                {/* Room Actions */}
                <div className="space-y-3 mb-4">
                  {canEditSession() && (
                    <>
                      {room.status === 'completed' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkRoomIncomplete(room._id)
                          }}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                        >
                          Mark Incomplete
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkRoomComplete(room._id)
                          }}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                        >
                          Mark Complete
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRoom(room)
                          setShowAddSupplyModal(true)
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                      >
                        Add Supply
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMoveFromRoom(room)
                          setShowMoveStudentsModal(true)
                        }}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                      >
                        Move Students
                      </button>
                    </>
                  )}
                </div>



                {/* Expanded Content */}
                {expandedCards.has(room._id) && (
                  <div className="mt-4 space-y-4">
                    {/* Sections */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sections</h4>
                      {room.sections && room.sections.length > 0 ? (
                        <div className="space-y-2">
                          {room.sections
                            .sort((a, b) => a.number - b.number)
                            .map((section) => (
                              <div key={section._id} className="bg-blue-50 dark:bg-blue-900/20 px-3 py-3 rounded-lg">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-sm font-medium text-gray-700 dark:text-white">
                                    Section {section.number} ({section.studentCount} students)
                                  </span>
                                </div>
                                {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                                  <div className="mt-2">
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
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No sections assigned</p>
                      )}
                    </div>

                    {/* Supplies */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Supplies</h4>
                      {room.supplies && room.supplies.length > 0 ? (
                        <div className="space-y-1">
                          {(() => {
                            // Group supplies by name and count them
                            const supplyCounts = {}
                            room.supplies.forEach(supply => {
                              supplyCounts[supply] = (supplyCounts[supply] || 0) + 1
                            })
                            
                            return Object.entries(supplyCounts).map(([supplyName, count], index) => (
                              <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {count > 1 ? `${count} ${getPluralForm(supplyName)}` : supplyName}
                                </span>
                                <div className="flex items-center space-x-2">
                                  {canEditSession() && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingSupply({
                                            original: supplyName,
                                            name: supplyName
                                          })
                                          setEditSupplyQuantity(count)
                                          setSelectedRoom(room)
                                          setShowEditSupplyModal(true)
                                        }}
                                        className="text-blue-500 hover:text-blue-700 text-sm"
                                        title="Edit Supply"
                                      >
                                        ✎
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveSupply(room._id, supplyName)
                                        }}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                        title="Remove Supply"
                                      >
                                        ×
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No supplies added</p>
                      )}
                    </div>

                    {/* Estimated Time */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estimated Time:</span>
                        <span className={`text-lg font-bold ${calculateRoomTimeRemaining(room)?.isOver ? 'text-red-600' : 'text-orange-600'}`}>
                          {(() => {
                            const timeData = calculateRoomTimeRemaining(room)
                            if (!timeData) return '--:--:--'
                            if (timeData.isOver) return 'TIME UP'
                            return `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}`
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
                  onClick={clearActivityLog}
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
                  {activityLog.map((log, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-blue-500"
                    >
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(SessionView) 