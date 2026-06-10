import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, memo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { testingAPI } from '../services/api'
import confetti from 'canvas-confetti'
import { useRealTime } from '../contexts/RealTimeContext'
import { exportSessionToExcel } from '../utils/excelExport'
import { exportSessionToPDF } from '../utils/pdfExport'
import ExportMenu from './session/ExportMenu'
import NotesSheetControl from './session/NotesSheetControl'
import ClearLogModal from './session/ClearLogModal'
import IncompleteConfirmModal from './session/IncompleteConfirmModal'
import AttendanceErrorModal from './session/AttendanceErrorModal'
import MarkRoomCompleteModal from './session/MarkRoomCompleteModal'
import QuickCompleteModal from './session/QuickCompleteModal'
import PresentStudentsModal from './session/PresentStudentsModal'
import InvalidateTestModal from './session/InvalidateTestModal'
import RemoveInvalidationModal from './session/RemoveInvalidationModal'
import AddSupplyModal from './session/AddSupplyModal'
import EditSupplyModal from './session/EditSupplyModal'
import EditSuppliesModal from './session/EditSuppliesModal'
import MoveStudentsModal from './session/MoveStudentsModal'
import ActivityLogPanel from './session/ActivityLogPanel'
import InvalidatedTestsSection from './session/InvalidatedTestsSection'
import { useSessionRealtime } from '../hooks/useSessionRealtime'

function SessionView({ user, onBack }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { joinSession, onSessionUpdate, isConnected, reconnect, connectionAttempts } = useRealTime()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(null)

  // Memoize session data to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: stable ref by key fields only
  const memoizedSession = useMemo(() => session, [session?._id, session?.status, session?.rooms?.length, session?.startTime, session?.endTime, session?.accommodationStartTime, session?.date])

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
  const [showAttendanceErrorModal, setShowAttendanceErrorModal] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [showDropdown, setShowDropdown] = useState(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  // const buttonRef = useRef(null) // Not currently used // roomId for which dropdown is open
  const [showInvalidateModal, setShowInvalidateModal] = useState(false)
  const [roomToInvalidate, setRoomToInvalidate] = useState(null)
  const [invalidationNotes, setInvalidationNotes] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [invalidatedTests, setInvalidatedTests] = useState([]) // Array of {roomId, sectionNumber, notes, timestamp, invalidatedBy}
  const [showRemoveInvalidationModal, setShowRemoveInvalidationModal] = useState(false)
  const [invalidationToRemove, setInvalidationToRemove] = useState(null)
  const [showQuickCompleteModal, setShowQuickCompleteModal] = useState(false)
  const [quickCompleteSection, setQuickCompleteSection] = useState(null) // { section, room }
  const [quickCompleteStudentsPresent, setQuickCompleteStudentsPresent] = useState('')
  const [showMarkRoomCompleteModal, setShowMarkRoomCompleteModal] = useState(false)
  const [selectedRoomForComplete, setSelectedRoomForComplete] = useState(null)



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

  // Save (or clear, when empty) the session's external notes-sheet link.
  const handleSaveNotesSheet = useCallback(async (notesSheetUrl) => {
    await testingAPI.updateSession(sessionId, { notesSheetUrl })
    setSession(prev => (prev ? { ...prev, notesSheetUrl } : prev))
  }, [sessionId])

  // Permission checking functions
  const canEditSession = useCallback(() => {
    if (!memoizedSession || !user) return false
    return memoizedSession.createdBy._id === user._id ||
      memoizedSession.collaborators?.some(collab =>
        collab.userId._id === user._id && (collab.permissions.edit || collab.permissions.manage)
      )
  // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by id only to avoid unnecessary updates
  }, [memoizedSession?.createdBy?._id, memoizedSession?.collaborators, user?._id])


  const isViewerOnly = useCallback(() => {
    if (!memoizedSession || !user) return false
    if (memoizedSession.createdBy._id === user._id) return false // Owner has full access
    const collaborator = memoizedSession.collaborators?.find(collab => collab.userId._id === user._id)
    return collaborator && collaborator.permissions.view && !collaborator.permissions.edit && !collaborator.permissions.manage
  // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by id only
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by id only
  }, [memoizedSession?.createdBy?._id, memoizedSession?.collaborators, user?._id])

  // Sort state
  const [sortBy, setSortBy] = useState('roomNumber') // roomNumber, status, studentCount
  const [sortDescending, setSortDescending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sectionSearchQuery, setSectionSearchQuery] = useState('')
  const [isTableView, setIsTableView] = useState(true)
  const [isDisplayMode, setIsDisplayMode] = useState(false) // Large screen display mode
  const [expandedRooms, setExpandedRooms] = useState(new Set()) // Track which rooms are expanded
  const [expandedCards, setExpandedCards] = useState(new Set())
  
  // Display mode filters
  const [displayFilterStatus, setDisplayFilterStatus] = useState('all') // all, not-started, active, completed
  const [displayFilterAccommodation, setDisplayFilterAccommodation] = useState('all') // all, bilingual, 1.5x, 2x
  const [displaySortBy, setDisplaySortBy] = useState('roomNumber') // roomNumber, sectionNumber

  // Exam return tracking (used in Display Mode)
  const [returnEntry, setReturnEntry] = useState(null) // { roomId, sectionId, sectionNumber, roomName, studentCount }
  const [returnEntryValue, setReturnEntryValue] = useState(0)
  const [returnEntrySaving, setReturnEntrySaving] = useState(false)

  // Pagination for large room lists
  const [currentPage, setCurrentPage] = useState(1)
  const roomsPerPage = 50 // Show 50 rooms per page

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

  // Fetch session data when component mounts or sessionId changes
  useEffect(() => {
    console.log('📥 SessionView useEffect - Fetching session data for session:', sessionId)
    fetchSessionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on sessionId only
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

  // Real-time subscription: join session + register update listener (extracted to a hook).
  // Placed after handleRealTimeUpdate so it is defined before being passed in.
  useSessionRealtime({ sessionId, isConnected, session, user, joinSession, onSessionUpdate, handleRealTimeUpdate })

  const updateTimeRemaining = useCallback(() => {
    if (!memoizedSession) return

    const now = new Date()
    const sessionDate = new Date(memoizedSession.date)
    // Extract UTC date parts (since date is stored at UTC midnight)
    const year = sessionDate.getUTCFullYear()
    const month = sessionDate.getUTCMonth()
    const day = sessionDate.getUTCDate()
    const [endHour, endMinute] = memoizedSession.endTime.split(':')
    // Create local time with the correct date and user-entered time
    const endTime = new Date(year, month, day, parseInt(endHour), parseInt(endMinute), 0)

    const timeDiff = endTime - now
    if (timeDiff <= 0) {
      setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, isOver: true })
    } else {
      const hours = Math.floor(timeDiff / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
      setTimeRemaining({ hours, minutes, seconds, isOver: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- time calc from session times only
  }, [memoizedSession?.date, memoizedSession?.endTime])

  useEffect(() => {
    if (memoizedSession) {
      // Update immediately when session times change
      updateTimeRemaining()
      // Then update every second
      const timer = setInterval(() => {
        updateTimeRemaining()
      }, 1000)
      return () => clearInterval(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- updateTimeRemaining depends on memoizedSession
  }, [memoizedSession?._id, memoizedSession?.date, memoizedSession?.startTime, memoizedSession?.endTime, memoizedSession?.accommodationStartTime, updateTimeRemaining])

  const calculateProgress = useCallback(() => {
    if (!debouncedSession || !debouncedSession.rooms) return 0

    const totalRooms = debouncedSession.rooms.length
    if (totalRooms === 0) return 0

    const completedRooms = debouncedSession.rooms.filter(room => room.status === 'completed').length
    return Math.round((completedRooms / totalRooms) * 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- debouncedSession is source of truth
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

  // Build flat list of sections from non-completed rooms for Quick Complete
  const sectionsAvailableForQuickComplete = useMemo(() => {
    if (!session?.rooms) return []
    const items = []
    session.rooms
      .filter(room => room.status !== 'completed')
      .forEach(room => {
        (room.sections || []).forEach(section => {
          items.push({ section, room })
        })
      })
    return items.sort((a, b) => (a.section.number || 0) - (b.section.number || 0))
  }, [session?.rooms])

  const handleQuickCompleteBySection = useCallback(async () => {
    if (!quickCompleteSection) return

    const { section, room } = quickCompleteSection
    const presentCount = parseInt(quickCompleteStudentsPresent, 10)

    if (isNaN(presentCount) || presentCount < 0 || presentCount > section.studentCount) {
      setAttendanceError(`Please enter a valid number between 0 and ${section.studentCount} for Section ${section.number}`)
      setShowAttendanceErrorModal(true)
      return
    }

    try {
      // Single-section room: complete directly
      if (!room.sections || room.sections.length <= 1) {
        const updateData = {
          status: 'completed',
          presentStudents: presentCount
        }
        if (room.sections?.length === 1) {
          updateData.sectionAttendance = { [section._id]: presentCount }
        }

        await testingAPI.updateRoom(room._id, updateData)

        setSession(prevSession => {
          const updatedSession = {
            ...prevSession,
            rooms: prevSession.rooms.map(r =>
              r._id === room._id
                ? { ...r, status: 'completed', presentStudents: presentCount, sectionAttendance: updateData.sectionAttendance || {} }
                : r
            )
          }
          const allRoomsCompleted = updatedSession.rooms.every(r => r.status === 'completed')
          if (allRoomsCompleted && updatedSession.status !== 'completed') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
          }
          return updatedSession
        })

        setShowQuickCompleteModal(false)
        setQuickCompleteSection(null)
        setQuickCompleteStudentsPresent('')
      } else {
        // Multi-section room: open full modal with this section pre-filled
        setRoomToComplete(room)
        const initialCounts = {}
        room.sections.forEach(s => {
          initialCounts[s._id] = s._id === section._id ? String(presentCount) : ''
        })
        setSectionPresentCounts(initialCounts)
        setPresentStudentsCount('')
        setShowQuickCompleteModal(false)
        setQuickCompleteSection(null)
        setQuickCompleteStudentsPresent('')
        setShowPresentStudentsModal(true)
      }
    } catch (error) {
      console.error('Error in quick complete by section:', error)
    }
  }, [quickCompleteSection, quickCompleteStudentsPresent])

  const calculateTotalStudents = useCallback((sections) => {
    if (!sections || sections.length === 0) return 0
    return sections.reduce((total, section) => total + (section.studentCount || 0), 0)
  }, [])

  // --- Exam return tracking helpers (Display Mode) ---
  const getSectionReturned = useCallback((room, sectionId) => {
    const val = room?.sectionReturns ? room.sectionReturns[sectionId] : 0
    return Number(val) || 0
  }, [])

  const getRoomReturnedTotal = useCallback((room) => {
    if (!room?.sections) return 0
    return room.sections.reduce((sum, s) => sum + getSectionReturned(room, s._id), 0)
  }, [getSectionReturned])

  const openReturnEntry = useCallback((room, section) => {
    if (!canEditSession()) return
    setReturnEntry({
      roomId: room._id,
      sectionId: section._id,
      sectionNumber: section.number,
      roomName: room.name,
      studentCount: section.studentCount || 0,
    })
    setReturnEntryValue(getSectionReturned(room, section._id))
  }, [canEditSession, getSectionReturned])

  const closeReturnEntry = useCallback(() => {
    setReturnEntry(null)
    setReturnEntryValue(0)
    setReturnEntrySaving(false)
  }, [])

  const adjustReturnEntry = useCallback((delta) => {
    setReturnEntryValue(prev => {
      const max = returnEntry?.studentCount ?? 0
      const next = (Number(prev) || 0) + delta
      return Math.min(Math.max(next, 0), max)
    })
  }, [returnEntry])

  const handleSaveReturnEntry = useCallback(async () => {
    if (!returnEntry) return
    setReturnEntrySaving(true)
    try {
      const value = Math.min(
        Math.max(Math.round(Number(returnEntryValue) || 0), 0),
        returnEntry.studentCount
      )
      const result = await testingAPI.updateSectionReturns(returnEntry.roomId, returnEntry.sectionId, value)
      if (result?.room) {
        setSession(prev => prev ? {
          ...prev,
          rooms: prev.rooms.map(r => r._id === returnEntry.roomId ? result.room : r)
        } : prev)
        addUpdateAnimation(returnEntry.roomId, 'room-updated')
      }
      closeReturnEntry()
    } catch (error) {
      console.error('Failed to update section returns:', error)
      setReturnEntrySaving(false)
    }
  }, [returnEntry, returnEntryValue, closeReturnEntry, addUpdateAnimation])

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
          setAttendanceError(`Please enter a valid number for Section ${section.number}`)
          setShowAttendanceErrorModal(true)
          return
        }

        const count = parseInt(sectionCount)
        if (count < 0 || count > section.studentCount) {
          setAttendanceError(`Section ${section.number} present count must be between 0 and ${section.studentCount} students`)
          setShowAttendanceErrorModal(true)
          return
        }

        sectionPresentData[section._id] = count
        presentCount += count
      }
    } else {
      // Handle single section or no sections
      if (!presentStudentsCount || isNaN(parseInt(presentStudentsCount))) {
        setAttendanceError('Please enter a valid number of present students')
        setShowAttendanceErrorModal(true)
        return
      }

      presentCount = parseInt(presentStudentsCount)
      const totalStudents = calculateTotalStudents(roomToComplete.sections)

      if (presentCount < 0 || presentCount > totalStudents) {
        setAttendanceError(`Present students must be between 0 and ${totalStudents} students`)
        setShowAttendanceErrorModal(true)
        return
      }

      // For single section, also populate sectionPresentData
      if (roomToComplete.sections && roomToComplete.sections.length === 1) {
        sectionPresentData[roomToComplete.sections[0]._id] = presentCount
      }
    }

    try {
      // Update room with present students count and per-section data
      const updateData = {
        status: 'completed',
        presentStudents: presentCount
      }

      // Add per-section data if available
      if (Object.keys(sectionPresentData).length > 0) {
        updateData.sectionAttendance = sectionPresentData
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
                sectionAttendance: sectionPresentData
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
  }, [roomToComplete, presentStudentsCount, sectionPresentCounts, calculateTotalStudents])

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
        presentStudents: undefined,
        sectionAttendance: {}
      })

      // Update local state immediately
      setSession(prevSession => {
        const updatedSession = {
          ...prevSession,
          rooms: prevSession.rooms.map(room =>
            room._id === roomToMarkIncomplete
              ? { ...room, status: 'active', presentStudents: undefined, sectionAttendance: {} }
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
      // Simple positioning - just below the button
      if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect()
        const position = {
          top: rect.bottom + 8,
          left: rect.right - 192 // Align right edge with button right edge
        }
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
      showInvalidateModal,
      selectedRoom: selectedRoom?.name,
      moveFromRoom: moveFromRoom?.name,
      roomToInvalidate: roomToInvalidate?.name
    })
  }, [showAddSupplyModal, showMoveStudentsModal, showInvalidateModal, selectedRoom, moveFromRoom, roomToInvalidate])

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

    // Use a slight delay to ensure button clicks are processed first
    const handleClick = (event) => {
      setTimeout(() => handleClickOutside(event), 10)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- session.rooms is the source list
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
    const hasTimeAccommodation = timeMultiplier > 1

    const sessionDate = new Date(memoizedSession.date)
    const year = sessionDate.getUTCFullYear()
    const month = sessionDate.getUTCMonth()
    const day = sessionDate.getUTCDate()

    // Calculate regular session duration (regular end time - regular start time)
    const [regularStartHour, regularStartMinute] = memoizedSession.startTime.split(':')
    const [endHour, endMinute] = memoizedSession.endTime.split(':')
    const regularStartTime = new Date(year, month, day, parseInt(regularStartHour), parseInt(regularStartMinute), 0)
    const regularEndTime = new Date(year, month, day, parseInt(endHour), parseInt(endMinute), 0)
    const regularDurationMinutes = (regularEndTime - regularStartTime) / (1000 * 60)

    let roomEndTime

    if (hasTimeAccommodation && memoizedSession.accommodationStartTime) {
      // For accommodations: accommodation start time + (regular duration * multiplier)
      const [accStartHour, accStartMinute] = memoizedSession.accommodationStartTime.split(':')
      const accommodationStartTime = new Date(year, month, day, parseInt(accStartHour), parseInt(accStartMinute), 0)
      roomEndTime = new Date(accommodationStartTime.getTime() + (regularDurationMinutes * timeMultiplier * 60 * 1000))
    } else {
      // For regular rooms: regular start time + (regular duration * multiplier)
      roomEndTime = new Date(regularStartTime.getTime() + (regularDurationMinutes * timeMultiplier * 60 * 1000))
    }

    // Calculate remaining time for this room
    const now = new Date()
    const roomTimeDiff = roomEndTime - now

    if (roomTimeDiff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isOver: true, multiplier: timeMultiplier }
    }

    const hours = Math.floor(roomTimeDiff / (1000 * 60 * 60))
    const minutes = Math.floor((roomTimeDiff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((roomTimeDiff % (1000 * 60)) / 1000)

    return { hours, minutes, seconds, isOver: false, multiplier: timeMultiplier }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- memoizedSession fields sufficient
  }, [memoizedSession?.startTime, memoizedSession?.endTime, memoizedSession?.accommodationStartTime, memoizedSession?.date, timeRemaining, calculateRoomTimeMultiplier])

  // Create a hash of section accommodations to detect changes (needed for roomTimeCalculations)
  const sectionAccommodationsHash = useMemo(() => {
    if (!debouncedSession?.rooms) return ''
    return debouncedSession.rooms.map(room => 
      room.sections?.map(section => 
        `${section._id}:${JSON.stringify(section.accommodations || [])}`
      ).join('|') || ''
    ).join('||')
  }, [debouncedSession?.rooms])

  // Calculate time for all rooms - moved before getSortedRooms so it can be used in sorting
  const roomTimeCalculations = useMemo(() => {
    if (!debouncedSession?.rooms || !timeRemaining) return {}

    const calculations = {}
    // Calculate time for all rooms to ensure proper display
    debouncedSession.rooms.forEach(room => {
      const timeData = calculateRoomTimeRemaining(room)
      if (timeData) {
        calculations[room._id] = timeData
      }
    })
    return calculations
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sectionAccommodationsHash derived from rooms
  }, [debouncedSession?.rooms, timeRemaining, calculateRoomTimeRemaining, sectionAccommodationsHash])

  const getSortedRooms = useCallback(() => {
    if (!debouncedSession || !debouncedSession.rooms) return []

    let sortedRooms = [...debouncedSession.rooms]

    // Filter by room name search query
    if (searchQuery.trim()) {
      sortedRooms = sortedRooms.filter(room =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by section number search query
    if (sectionSearchQuery.trim()) {
      const sectionNum = sectionSearchQuery.trim()
      sortedRooms = sortedRooms.filter(room => {
        if (!room.sections || room.sections.length === 0) return false
        return room.sections.some(section => 
          String(section.number || '').includes(sectionNum)
        )
      })
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

        case 'present':
          aValue = a.status === 'completed' ? (typeof a.presentStudents === 'number' ? a.presentStudents : 0) : 0
          bValue = b.status === 'completed' ? (typeof b.presentStudents === 'number' ? b.presentStudents : 0) : 0
          comparison = aValue - bValue
          break

        case 'absent': {
          const aTotal = calculateTotalStudents(a.sections) || 0
          const bTotal = calculateTotalStudents(b.sections) || 0
          aValue = a.status === 'completed' && typeof a.presentStudents === 'number' ? Math.max(0, aTotal - a.presentStudents) : 0
          bValue = b.status === 'completed' && typeof b.presentStudents === 'number' ? Math.max(0, bTotal - b.presentStudents) : 0
          comparison = aValue - bValue
          break
        }

        case 'sections': {
          // Sort by first section number, or by count if no sections
          const aSections = a.sections && a.sections.length > 0 
            ? [...a.sections].sort((s1, s2) => (s1.number || 0) - (s2.number || 0))
            : []
          const bSections = b.sections && b.sections.length > 0
            ? [...b.sections].sort((s1, s2) => (s1.number || 0) - (s2.number || 0))
            : []
          
          if (aSections.length === 0 && bSections.length === 0) {
            comparison = 0
          } else if (aSections.length === 0) {
            comparison = 1
          } else if (bSections.length === 0) {
            comparison = -1
          } else {
            // Compare by first section number
            const aFirst = aSections[0].number || 0
            const bFirst = bSections[0].number || 0
            comparison = aFirst - bFirst
          }
          break
        }

        case 'timeRemaining': {
          // Access roomTimeCalculations from closure (defined later in component)
          // At runtime, it will be available since hooks are called in order
          const timeCalcs = roomTimeCalculations || {}
          const aTime = timeCalcs[a._id]
          const bTime = timeCalcs[b._id]
          
          // Handle cases where time data is not available
          if (!aTime && !bTime) {
            // Both have no time data, sort by room number
            const aKey = getRoomSortKey(a.name)
            const bKey = getRoomSortKey(b.name)
            comparison = aKey.number - bKey.number
          } else if (!aTime) {
            comparison = 1 // Rooms without time data go to end
          } else if (!bTime) {
            comparison = -1 // Rooms with time data come first
          } else if (aTime.isOver && !bTime.isOver) {
            comparison = 1 // Over rooms go to end
          } else if (!aTime.isOver && bTime.isOver) {
            comparison = -1 // Active rooms come first
          } else if (aTime.isOver && bTime.isOver) {
            comparison = 0 // Both over, equal
          } else {
            // Compare by total seconds remaining (least time first when ascending)
            const aTotalSeconds = aTime.hours * 3600 + aTime.minutes * 60 + aTime.seconds
            const bTotalSeconds = bTime.hours * 3600 + bTime.minutes * 60 + bTime.seconds
            comparison = aTotalSeconds - bTotalSeconds
          }
          break
        }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getRoomSortKey/calculateTotalStudents are stable
  }, [debouncedSession?.rooms, searchQuery, sectionSearchQuery, sortBy, sortDescending, roomTimeCalculations])

  // Handle table header click for sorting
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      // Toggle sort direction if clicking the same column
      setSortDescending(!sortDescending)
    } else {
      // Set new column and default to ascending
      setSortBy(column)
      setSortDescending(false)
    }
  }, [sortBy, sortDescending])

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
  }, [searchQuery, sectionSearchQuery, sortBy, sortDescending])

  // Helper function to get accommodation summary for a room
  const getRoomAccommodationSummary = useCallback((room) => {
    if (!room.sections || room.sections.length === 0) {
      return null
    }

    const accommodationTypes = new Set()

    room.sections.forEach(section => {
      if (section.accommodations && section.accommodations.length > 0) {
        section.accommodations.forEach(acc => {
          // Check for bilingual accommodations (case insensitive)
          if (acc.toLowerCase().includes('bilingual')) {
            accommodationTypes.add('bilingual')
          }
          // Check for extra time accommodations
          else if (acc.includes('1.5x') || acc.includes('2x') ||
            acc.includes('1.5×') || acc.includes('2×') ||
            acc.toLowerCase().includes('extended time') ||
            acc.toLowerCase().includes('double time') ||
            acc.toLowerCase().includes('extra time')) {
            accommodationTypes.add('extra-time')
          }
        })
      }
    })

    return accommodationTypes.size > 0 ? Array.from(accommodationTypes) : null
  }, [])

  // Calculate time remaining for 1.5x accommodations
  const [timeRemaining15x, setTimeRemaining15x] = useState(null)
  // Calculate time remaining for 2x accommodations
  const [timeRemaining2x, setTimeRemaining2x] = useState(null)

  // Helper function to check if a room has 1.5x accommodations
  const roomHas15xAccommodation = useCallback((room) => {
    if (!room.sections || room.sections.length === 0) return false
    return room.sections.some(section => 
      section.accommodations?.some(acc => 
        acc.includes('1.5x') || acc.includes('1.5×') || acc.toLowerCase().includes('extended time')
      )
    )
  }, [])

  // Helper function to check if a room has 2x accommodations
  const roomHas2xAccommodation = useCallback((room) => {
    if (!room.sections || room.sections.length === 0) return false
    return room.sections.some(section => 
      section.accommodations?.some(acc => 
        acc.includes('2x') || acc.includes('2×') || acc.toLowerCase().includes('double time')
      )
    )
  }, [])

  // Check if all rooms with 1.5x accommodations are completed
  const all15xRoomsCompleted = useMemo(() => {
    if (!debouncedSession?.rooms) return false
    const rooms15x = debouncedSession.rooms.filter(room => roomHas15xAccommodation(room))
    if (rooms15x.length === 0) return false
    return rooms15x.every(room => room.status === 'completed')
  }, [debouncedSession?.rooms, roomHas15xAccommodation])

  // Check if all rooms with 2x accommodations are completed
  const all2xRoomsCompleted = useMemo(() => {
    if (!debouncedSession?.rooms) return false
    const rooms2x = debouncedSession.rooms.filter(room => roomHas2xAccommodation(room))
    if (rooms2x.length === 0) return false
    return rooms2x.every(room => room.status === 'completed')
  }, [debouncedSession?.rooms, roomHas2xAccommodation])

  const updateAccommodationTimeRemaining = useCallback(() => {
    if (!memoizedSession || !memoizedSession.accommodationStartTime) {
      setTimeRemaining15x(null)
      setTimeRemaining2x(null)
      return
    }

    const now = new Date()
    const sessionDate = new Date(memoizedSession.date)
    const year = sessionDate.getUTCFullYear()
    const month = sessionDate.getUTCMonth()
    const day = sessionDate.getUTCDate()

    // Calculate regular exam duration
    const [regularStartHour, regularStartMinute] = memoizedSession.startTime.split(':')
    const [endHour, endMinute] = memoizedSession.endTime.split(':')
    const regularStartTime = new Date(year, month, day, parseInt(regularStartHour), parseInt(regularStartMinute), 0)
    const regularEndTime = new Date(year, month, day, parseInt(endHour), parseInt(endMinute), 0)
    const regularDurationMinutes = (regularEndTime - regularStartTime) / (1000 * 60)

    // Accommodation start time
    const [accStartHour, accStartMinute] = memoizedSession.accommodationStartTime.split(':')
    const accStartTime = new Date(year, month, day, parseInt(accStartHour), parseInt(accStartMinute), 0)

    // Calculate 1.5x end time: accommodationStartTime + (regularDuration * 1.5)
    const endTime15x = new Date(accStartTime.getTime() + (regularDurationMinutes * 1.5 * 60 * 1000))
    const timeDiff15x = endTime15x - now
    
    // Check if all 1.5x rooms are completed
    const has15xRooms = debouncedSession?.rooms?.some(room => roomHas15xAccommodation(room)) || false
    if (all15xRoomsCompleted && has15xRooms) {
      setTimeRemaining15x({ hours: 0, minutes: 0, seconds: 0, isOver: true })
    } else if (timeDiff15x <= 0) {
      setTimeRemaining15x({ hours: 0, minutes: 0, seconds: 0, isOver: true })
    } else {
      const hours = Math.floor(timeDiff15x / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff15x % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeDiff15x % (1000 * 60)) / 1000)
      setTimeRemaining15x({ hours, minutes, seconds, isOver: false })
    }

    // Calculate 2x end time: accommodationStartTime + (regularDuration * 2)
    const endTime2x = new Date(accStartTime.getTime() + (regularDurationMinutes * 2 * 60 * 1000))
    const timeDiff2x = endTime2x - now

    // Check if all 2x rooms are completed
    const has2xRooms = debouncedSession?.rooms?.some(room => roomHas2xAccommodation(room)) || false
    if (all2xRoomsCompleted && has2xRooms) {
      setTimeRemaining2x({ hours: 0, minutes: 0, seconds: 0, isOver: true })
    } else if (timeDiff2x <= 0) {
      setTimeRemaining2x({ hours: 0, minutes: 0, seconds: 0, isOver: true })
    } else {
      const hours = Math.floor(timeDiff2x / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff2x % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeDiff2x % (1000 * 60)) / 1000)
      setTimeRemaining2x({ hours, minutes, seconds, isOver: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- accommodation timer update
  }, [memoizedSession?.accommodationStartTime, memoizedSession?.startTime, memoizedSession?.endTime, memoizedSession?.date, debouncedSession?.rooms, all15xRoomsCompleted, all2xRoomsCompleted, roomHas15xAccommodation, roomHas2xAccommodation])

  // Create a hash of room statuses to detect changes
  const roomStatusHash = useMemo(() => {
    if (!debouncedSession?.rooms) return ''
    return debouncedSession.rooms.map(room => `${room._id}:${room.status}`).join('|')
  }, [debouncedSession?.rooms])

  // Update accommodation time remaining every second
  useEffect(() => {
    if (memoizedSession && memoizedSession.accommodationStartTime) {
      // Immediate update when dependencies change
      updateAccommodationTimeRemaining()
      const timer = setInterval(() => {
        updateAccommodationTimeRemaining()
      }, 1000)
      return () => clearInterval(timer)
    } else {
      setTimeRemaining15x(null)
      setTimeRemaining2x(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- interval for accommodation timer
  }, [memoizedSession?.accommodationStartTime, memoizedSession?.startTime, memoizedSession?.endTime, memoizedSession?.date, updateAccommodationTimeRemaining, roomStatusHash, all15xRoomsCompleted, all2xRoomsCompleted])
  
  // Also update immediately when completion status changes
  useEffect(() => {
    if (memoizedSession && memoizedSession.accommodationStartTime) {
      updateAccommodationTimeRemaining()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run when completion status changes
  }, [all15xRoomsCompleted, all2xRoomsCompleted, updateAccommodationTimeRemaining, memoizedSession?.accommodationStartTime])


  // Get time remaining for a room - always returns calculated value
  const getRoomTimeRemaining = useCallback((room) => {
    // First check if we already have it calculated
    if (roomTimeCalculations[room._id]) {
      return roomTimeCalculations[room._id]
    }

    // If not in cache, calculate it now (shouldn't happen often due to useMemo)
    return calculateRoomTimeRemaining(room)
  }, [roomTimeCalculations, calculateRoomTimeRemaining])

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

  // Global scroll position store to persist across re-renders
  const scrollPositions = useRef(new Map())

  // Memoized component for room sections to prevent unnecessary re-renders
  const RoomSections = memo(({ sections, roomId }) => {
    const containerRef = useRef(null)

    const sortedSections = useMemo(() => {
      if (!sections || sections.length === 0) return []
      return [...sections].sort((a, b) => a.number - b.number)
    }, [sections])

    // Restore scroll position synchronously before paint to prevent glitch
    useLayoutEffect(() => {
      if (containerRef.current) {
        let savedScrollTop = scrollPositions.current.get(roomId)
        if (!savedScrollTop) {
          // Try to get from localStorage
          const stored = localStorage.getItem(`scroll-${roomId}`)
          savedScrollTop = stored ? parseInt(stored, 10) : 0
        }

        if (savedScrollTop > 0) {
          // Set scroll position synchronously before paint
          containerRef.current.scrollTop = savedScrollTop
        }
      }
    })

    const handleScroll = useCallback((e) => {
      const scrollTop = e.target.scrollTop
      scrollPositions.current.set(roomId, scrollTop)
      // Also store in localStorage for persistence
      localStorage.setItem(`scroll-${roomId}`, scrollTop.toString())
    }, [roomId])

    if (!sections || sections.length === 0) {
      return <p className="text-sm text-slate-500">No sections assigned</p>
    }

    return (
      <div
        ref={containerRef}
        className="max-h-64 overflow-y-auto space-y-2"
        style={{
          scrollBehavior: 'auto',
          scrollbarGutter: 'stable'
        }}
        onScroll={handleScroll}
      >
        {sortedSections.map((section) => (
          <div key={section._id} className="bg-brand-50 px-3 py-2 rounded-lg">
            <div className="flex justify-between items-start mb-1">
              <span className="text-sm font-medium text-slate-700">
                Section {section.number} ({section.studentCount} students)
              </span>
            </div>
            {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
              <div className="mt-1">
                <span className="text-xs font-medium text-brand-700">Accommodations:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {section.accommodations.map((acc, index) => (
                    <span key={index} className="px-2 py-1 bg-brand-100 text-brand-700 text-xs rounded">
                      {acc}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {section.notes && (
              <div className="text-xs text-slate-600 mt-1">
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
      return <p className="text-sm text-slate-500">No proctors assigned</p>
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {proctors.map((proctor, index) => (
          <div key={index} className="bg-emerald-50 px-3 py-2 rounded-lg">
            <div className="flex justify-between items-start mb-1">
              <span className="text-sm font-medium text-slate-700">
                {proctor.name || `${proctor.firstName} ${proctor.lastName}`}
              </span>
            </div>
            <div className="text-xs text-slate-600">
              <div className="font-medium text-emerald-700">
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
      return <p className="text-sm text-slate-500">No supplies assigned</p>
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {/* Initial Supplies */}
        {supplyData.initialSupplies.length > 0 && (
          <div>
            <span className="text-xs text-slate-600 font-medium">Initial:</span>
            <div className="space-y-1 mt-1">
              {supplyData.initialSupplies.map(([supplyName, count], index) => (
                <div key={`initial-${index}`} className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg">
                  <span className="text-sm text-emerald-700">
                    {supplyName}
                  </span>
                  <span className="text-sm font-medium text-emerald-700">
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
            <span className="text-xs text-slate-600 font-medium">Added:</span>
            <div className="space-y-1 mt-1">
              {supplyData.addedSupplies.map(([supplyName, count], index) => (
                <div key={`added-${index}`} className="flex justify-between items-center bg-brand-50 px-3 py-2 rounded-lg">
                  <span className="text-sm text-brand-700">
                    {supplyName}
                  </span>
                  <span className="text-sm font-medium text-brand-700">
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
      <div className="el-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="el-spinner h-9 w-9" />
          <p className="text-sm text-slate-500">Loading session…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="el-app-bg flex items-center justify-center">
        <div className="el-card el-fade-up p-8 max-w-md w-full text-center">
          <p className="text-sm text-slate-600">Session not found</p>
          <button
            onClick={onBack}
            className="el-btn el-btn-primary mt-4"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const progress = calculateProgress()

  return (
    <div className="el-app-bg page-container" style={{ overflow: 'visible' }}>

      {/* Header */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6 gap-4">
            <div className="min-w-0 flex-1 pr-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">{session.name}</h1>
              <p className="text-sm text-slate-500">Session Progress View</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="el-badge el-badge-brand">
                  {getSessionRole()}
                </span>
                {/* Real-time connection status */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                  <span className="text-sm text-slate-600">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                  {!isConnected && connectionAttempts > 0 && (
                    <span className="text-xs text-rose-600">
                      (Attempt {connectionAttempts}/5)
                    </span>
                  )}
                  {!isConnected && (
                    <button
                      onClick={() => {
                        console.log('🔄 Manual reconnect requested')
                        reconnect()
                      }}
                      className="el-btn el-btn-secondary el-btn-sm ml-2"
                      title="Click to reconnect"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <NotesSheetControl
                url={session?.notesSheetUrl}
                canEdit={canEditSession()}
                onSave={handleSaveNotesSheet}
              />
              <ExportMenu
                onExcel={() => exportSessionToExcel(session, session.name)}
                onPdf={() => exportSessionToPDF(session, session.name)}
              />
              <button
                onClick={onBack}
                className="el-btn el-btn-secondary"
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
          <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-semibold text-brand-800">View-Only Access</h3>
                <div className="mt-2 text-sm text-brand-700">
                  <p>You have view-only access to this session. You can see all session information, room statuses, and progress, but you cannot make any changes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Info and Timer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Session Details */}
          <div className="lg:col-span-2 el-card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Session Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="el-stat-label">Date</p>
                <p className="font-medium text-slate-900">{new Date(session.date).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
              </div>
              <div>
                <p className="el-stat-label">Time</p>
                <p className="font-medium text-slate-900">{formatTime(session.startTime)} - {formatTime(session.endTime)}</p>
              </div>
              <div>
                <p className="el-stat-label">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white room-status-transition ${getStatusColor(session.status)}`}>
                  {getStatusText(session.status)}
                </span>
              </div>
              <div>
                <p className="el-stat-label">Total Students</p>
                <p className="font-medium text-slate-900">{calculateTotalStudentsInSession()}</p>
              </div>
              <div>
                <p className="el-stat-label">Total Rooms</p>
                <p className="font-medium text-slate-900">{session.rooms?.length || 0}</p>
              </div>
              <div>
                <p className="el-stat-label">Total Sections</p>
                <p className="font-medium text-slate-900">{calculateTotalSectionsInSession()}</p>
              </div>
              <div>
                <p className="el-stat-label">Present Students</p>
                <p className="font-medium text-slate-900">{calculateTotalPresentStudents()}</p>
              </div>
              <div>
                <p className="el-stat-label">Absent Students</p>
                <p className="font-medium text-slate-900">{calculateTotalAbsentStudents()}</p>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="el-card p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Time Remaining</h2>
            <div className="flex-1 flex items-center justify-center">
              {timeRemaining ? (
                <div className="text-center">
                  {timeRemaining.isOver ? (
                    <div className="text-rose-600 font-bold text-4xl">EXAM ENDED</div>
                  ) : (
                    <div className="text-5xl font-bold text-amber-600">
                      {String(timeRemaining.hours).padStart(2, '0')}:{String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-2">Until exam ends</p>
                </div>
              ) : (
                <div className="text-center text-slate-500">Loading timer...</div>
              )}
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="el-card p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Overall Progress</h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-brand-600">{progress}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-4">
            <div
              className="bg-brand-600 h-4 rounded-full progress-bar-transition"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {session.rooms?.filter(room => room.status === 'completed').length || 0} of {session.rooms?.length || 0} rooms completed
          </p>
        </div>

        {/* Testing In Progress */}
        <div className="el-card p-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Testing In Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-brand-50 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-1">Students Still Testing</p>
              <p className="text-2xl font-bold text-brand-600">
                    {(() => {
                      if (!session || !session.rooms) return 0;
                      return session.rooms
                        .filter(room => room.status !== 'completed')
                        .reduce((total, room) =>
                          total + (room.sections ? room.sections.reduce((s, section) => s + (section.studentCount || 0), 0) : 0)
                          , 0)
                    })()}
              </p>
                </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-1">Sections Remaining</p>
              <p className="text-2xl font-bold text-emerald-600">
                    {(() => {
                      if (!session || !session.rooms) return 0;
                      return session.rooms
                        .filter(room => room.status !== 'completed')
                        .reduce((total, room) => total + (room.sections ? room.sections.length : 0), 0)
                    })()}
              </p>
            </div>
          </div>
        </div>

        {/* Sort Controls and Search */}
        <div className="el-card p-6 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Search Inputs */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1 max-w-md">
              <label htmlFor="search" className="el-label">
                Search Rooms
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search by room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="el-input"
              />
              </div>
              <div className="flex-1 max-w-md">
                <label htmlFor="sectionSearch" className="el-label">
                  Search Sections
                </label>
                <input
                  type="text"
                  id="sectionSearch"
                  placeholder="Search by section number..."
                  value={sectionSearchQuery}
                  onChange={(e) => setSectionSearchQuery(e.target.value)}
                  className="el-input"
                />
              </div>
            </div>

            {/* View Toggle */}
            <div>
              <label className="el-label">
                View Mode
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIsTableView(!isTableView)}
                  className="el-btn el-btn-primary el-btn-sm"
                >
                  {isTableView ? 'Card View' : 'Table View'}
                </button>
                <button
                  onClick={() => setIsDisplayMode(true)}
                  className="el-btn el-btn-secondary el-btn-sm"
                  title="Open large screen display mode"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Display Mode
                </button>
              </div>
            </div>
          </div>

          {/* Mark Room Complete / Mark Section Complete - bottom row, right-aligned */}
          {canEditSession() && (session?.rooms?.some(r => r.status !== 'completed') || sectionsAvailableForQuickComplete.length > 0) && (
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end gap-2">
              {session?.rooms?.some(r => r.status !== 'completed') && (
                <button
                  onClick={() => {
                    setSelectedRoomForComplete(null)
                    setShowMarkRoomCompleteModal(true)
                  }}
                  className="el-btn el-btn-success el-btn-sm"
                  title="Mark a room as complete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark Room Complete
                </button>
              )}
              {sectionsAvailableForQuickComplete.length > 0 && (
                <button
                  onClick={() => {
                    setQuickCompleteSection(null)
                    setQuickCompleteStudentsPresent('')
                    setShowQuickCompleteModal(true)
                  }}
                  className="el-btn el-btn-success el-btn-sm"
                  title="Mark a section as complete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark Section Complete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Large Screen Display Mode */}
        {isDisplayMode && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-hidden">
            {/* Exit button */}
            <button
              onClick={() => setIsDisplayMode(false)}
              className="el-btn el-btn-danger fixed top-4 right-4 z-50 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit Display
            </button>

            {/* Fixed Header Section */}
            <div className="flex-shrink-0 p-6 pb-3">
              {/* Header */}
              <div className="text-center mb-5">
                <h1 className="text-4xl font-bold text-slate-900 mb-3">{session?.name}</h1>
                <p className="text-xl text-slate-600">
                  {session?.date && new Date(session.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC'
                  })}
                  {session?.startTime && session?.endTime && (
                    <span className="mx-3">|</span>
                  )}
                  {session?.startTime && session?.endTime && (() => {
                    // Convert to 12-hour format
                    const formatTime = (time) => {
                      const [hours, minutes] = time.split(':')
                      const hour = parseInt(hours)
                      const ampm = hour >= 12 ? 'PM' : 'AM'
                      const hour12 = hour % 12 || 12
                      return `${hour12}:${minutes} ${ampm}`
                    }
                    return `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`
                  })()}
                </p>
                {session?.accommodationStartTime && (
                  <p className="text-base text-brand-600 mt-2 font-medium">
                    Accommodation Start: {(() => {
                      const formatTime = (time) => {
                        const [hours, minutes] = time.split(':')
                        const hour = parseInt(hours)
                        const ampm = hour >= 12 ? 'PM' : 'AM'
                        const hour12 = hour % 12 || 12
                        return `${hour12}:${minutes} ${ampm}`
                      }
                      return formatTime(session.accommodationStartTime)
                    })()}
                  </p>
                )}
              </div>

              {/* Main Timer */}
              <div className="text-center mb-4">
                <div className="flex flex-col md:flex-row gap-3 justify-center items-center flex-wrap">
                  <div className="inline-block el-card px-7 py-5">
                    <p className="text-sm text-slate-500 mb-2">Estimated Time Remaining</p>
                  {timeRemaining ? (
                    timeRemaining.isOver ? (
                        <div className="text-3xl font-bold text-rose-600 animate-pulse">EXAM ENDED</div>
                    ) : (
                        <div className="text-4xl font-mono font-bold text-emerald-600">
                        {String(timeRemaining.hours).padStart(2, '0')}:{String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
                      </div>
                    )
                  ) : (
                      <div className="text-xl text-slate-400">Loading...</div>
                  )}
                </div>

                  {/* 1.5x Time Remaining */}
                  {timeRemaining15x && (
                    <div className="inline-block rounded-xl border border-amber-200 bg-white shadow-sm px-7 py-5">
                      <p className="text-sm text-slate-500 mb-2">1.5x Time Remaining</p>
                      {timeRemaining15x.isOver ? (
                        <div className="text-3xl font-bold text-rose-600 animate-pulse">EXAM ENDED</div>
                      ) : (
                        <div className="text-4xl font-mono font-bold text-amber-600">
                          {String(timeRemaining15x.hours).padStart(2, '0')}:{String(timeRemaining15x.minutes).padStart(2, '0')}:{String(timeRemaining15x.seconds).padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2x Time Remaining */}
                  {timeRemaining2x && (
                    <div className="inline-block rounded-xl border border-brand-200 bg-white shadow-sm px-7 py-5">
                      <p className="text-sm text-slate-500 mb-2">2x Time Remaining</p>
                      {timeRemaining2x.isOver ? (
                        <div className="text-3xl font-bold text-rose-600 animate-pulse">EXAM ENDED</div>
                      ) : (
                        <div className="text-4xl font-mono font-bold text-brand-600">
                          {String(timeRemaining2x.hours).padStart(2, '0')}:{String(timeRemaining2x.minutes).padStart(2, '0')}:{String(timeRemaining2x.seconds).padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Exam-return progress + stats */}
              {(() => {
                const rooms = debouncedSession?.rooms || []
                const totalStudents = rooms.reduce(
                  (sum, room) => sum + (room.sections?.reduce((s, sec) => s + (sec.studentCount || 0), 0) || 0),
                  0
                )
                const totalReturned = rooms.reduce((sum, room) => sum + getRoomReturnedTotal(room), 0)
                const returnPct = totalStudents > 0 ? Math.round((totalReturned / totalStudents) * 100) : 0
                let sectionsTotal = 0
                let sectionsReturned = 0
                rooms.forEach(room => {
                  (room.sections || []).forEach(sec => {
                    sectionsTotal += 1
                    if ((sec.studentCount || 0) > 0 && getSectionReturned(room, sec._id) >= sec.studentCount) {
                      sectionsReturned += 1
                    }
                  })
                })
                const roomsCompleted = rooms.filter(r => r.status === 'completed').length

                return (
                  <div className="max-w-7xl mx-auto">
                    {/* Headline returns progress bar */}
                    <div className="el-card p-4 mb-3">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-base font-bold uppercase tracking-wide text-slate-700">
                          Exams Returned
                        </span>
                        <span className="text-2xl font-bold text-emerald-600">
                          {totalReturned}
                          <span className="text-lg font-semibold text-slate-400"> / {totalStudents}</span>
                          <span className="ml-2 text-lg font-semibold text-slate-500">({returnPct}%)</span>
                        </span>
                      </div>
                      <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${returnPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Supporting stats */}
                    <div className="grid grid-cols-5 gap-3">
                      <div className="el-card p-4 text-center">
                        <p className="text-sm text-slate-500 mb-1">Sections Returned</p>
                        <p className="text-3xl font-bold text-emerald-600">{sectionsReturned}/{sectionsTotal}</p>
                      </div>
                      <div className="el-card p-4 text-center">
                        <p className="text-sm text-slate-500 mb-1">Rooms Completed</p>
                        <p className="text-3xl font-bold text-brand-600">{roomsCompleted}/{rooms.length}</p>
                      </div>
                      <div className="el-card p-4 text-center">
                        <p className="text-sm text-slate-500 mb-1">Total Students</p>
                        <p className="text-3xl font-bold text-slate-900">{calculateTotalStudentsInSession()}</p>
                      </div>
                      <div className="el-card p-4 text-center">
                        <p className="text-sm text-slate-500 mb-1">Present</p>
                        <p className="text-3xl font-bold text-emerald-600">{calculateTotalPresentStudents()}</p>
                      </div>
                      <div className="el-card p-4 text-center">
                        <p className="text-sm text-slate-500 mb-1">Absent</p>
                        <p className="text-3xl font-bold text-rose-600">{calculateTotalAbsentStudents()}</p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Testing Rooms Title and Filters - Fixed, not scrollable */}
              <div className="mt-4 px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-slate-900">Testing Rooms</h2>
                <div className="flex flex-wrap gap-3">
                  {/* Status Filter */}
                  <div>
                    <label htmlFor="displayStatusFilter" className="el-label">
                      Status
                    </label>
                    <select
                      id="displayStatusFilter"
                      value={displayFilterStatus}
                      onChange={(e) => setDisplayFilterStatus(e.target.value)}
                      className="el-input w-auto"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  {/* Accommodation Filter */}
                  <div>
                    <label htmlFor="displayAccommodationFilter" className="el-label">
                      Accommodation
                    </label>
                    <select
                      id="displayAccommodationFilter"
                      value={displayFilterAccommodation}
                      onChange={(e) => setDisplayFilterAccommodation(e.target.value)}
                      className="el-input w-auto"
                    >
                      <option value="all">All Rooms</option>
                      <option value="bilingual">Bilingual</option>
                      <option value="1.5x">1.5x</option>
                      <option value="2x">2x</option>
                    </select>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label htmlFor="displaySortBy" className="el-label">
                      Sort By
                    </label>
                    <select
                      id="displaySortBy"
                      value={displaySortBy}
                      onChange={(e) => setDisplaySortBy(e.target.value)}
                      className="el-input w-auto"
                    >
                      <option value="roomNumber">Room Number</option>
                      <option value="sectionNumber">Section Number</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Rooms Section */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              <div className="max-w-full mx-auto">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {(() => {
                    return debouncedSession?.rooms?.slice()
                    .filter(room => {
                      // Apply status filter
                      if (displayFilterStatus !== 'all') {
                        if (displayFilterStatus === 'not-started' && room.status !== 'not-started') return false
                        if (displayFilterStatus === 'active' && room.status !== 'active') return false
                        if (displayFilterStatus === 'completed' && room.status !== 'completed') return false
                      }
                      
                      // Apply accommodation filter
                      if (displayFilterAccommodation !== 'all') {
                        const accommodations = getRoomAccommodationSummary(room)
                        if (displayFilterAccommodation === 'bilingual' && (!accommodations || !accommodations.includes('bilingual'))) return false
                        if (displayFilterAccommodation === '1.5x') {
                          // Check if room has 1.5x accommodation
                          const has15x = room.sections?.some(section => 
                            section.accommodations?.some(acc => 
                              acc.includes('1.5x') || acc.includes('1.5×') || acc.toLowerCase().includes('extended time')
                            )
                          )
                          if (!has15x) return false
                        }
                        if (displayFilterAccommodation === '2x') {
                          // Check if room has 2x accommodation
                          const has2x = room.sections?.some(section => 
                            section.accommodations?.some(acc => 
                              acc.includes('2x') || acc.includes('2×') || acc.toLowerCase().includes('double time')
                            )
                          )
                          if (!has2x) return false
                        }
                      }
                      
                      return true
                    })
                    .sort((a, b) => {
                      if (displaySortBy === 'sectionNumber') {
                        // Sort by first section number
                        const aSections = a.sections && a.sections.length > 0 
                          ? [...a.sections].sort((s1, s2) => (s1.number || 0) - (s2.number || 0))
                          : []
                        const bSections = b.sections && b.sections.length > 0
                          ? [...b.sections].sort((s1, s2) => (s1.number || 0) - (s2.number || 0))
                          : []
                        
                        if (aSections.length === 0 && bSections.length === 0) {
                          // Both have no sections, sort by room number
                          const numA = parseInt(a.name?.match(/\d+/)?.[0]) || 0
                          const numB = parseInt(b.name?.match(/\d+/)?.[0]) || 0
                          return numA - numB
                        } else if (aSections.length === 0) {
                          return 1 // Rooms without sections go to end
                        } else if (bSections.length === 0) {
                          return -1 // Rooms with sections come first
                        } else {
                          // Compare by first section number
                          const aFirst = aSections[0].number || 0
                          const bFirst = bSections[0].number || 0
                          return aFirst - bFirst
                        }
                      } else {
                        // Sort by room number (default)
                    const numA = parseInt(a.name?.match(/\d+/)?.[0]) || 0
                    const numB = parseInt(b.name?.match(/\d+/)?.[0]) || 0
                    if (numA !== numB) return numA - numB
                    // Fallback to alphabetical if no numbers or same number
                    return (a.name || '').localeCompare(b.name || '')
                      }
                  }).map((room) => {
                    const roomTimeData = getRoomTimeRemaining(room)
                    const totalStudents = room.sections?.reduce((sum, s) => sum + (s.studentCount || 0), 0) || 0
                    const roomReturned = getRoomReturnedTotal(room)
                    const roomReturnPct = totalStudents > 0 ? Math.round((roomReturned / totalStudents) * 100) : 0
                    const roomFullyReturned = totalStudents > 0 && roomReturned >= totalStudents
                    const sortedSections = [...(room.sections || [])].sort((a, b) => (a.number || 0) - (b.number || 0))
                    const canEdit = canEditSession()
                    // A room is flagged as a conflict ONLY when one of its sections has
                    // the "Conflict" accommodation explicitly set (no room-number guessing).
                    const hasConflict = room.sections?.some(section =>
                      section.accommodations?.some(acc =>
                        acc.toLowerCase().includes('conflict')
                      )
                    ) || false

                    return (
                      <div
                        key={room._id}
                        className={`flex flex-col rounded-xl p-4 shadow-sm border ${hasConflict
                          ? 'bg-amber-50 border-amber-300'
                          : roomFullyReturned
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-white border-slate-200'
                          }`}
                      >
                        {/* Room header */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div className="flex flex-col gap-1 truncate flex-1">
                            <h3 className="text-xl font-bold text-slate-900 truncate">{room.name}</h3>
                            <div className="flex gap-1 flex-wrap">
                              {getRoomAccommodationSummary(room) && (
                                <>
                                  {getRoomAccommodationSummary(room).includes('bilingual') && (
                                    <span className="el-badge el-badge-blue">🌐 Bilingual</span>
                                  )}
                                  {getRoomAccommodationSummary(room).includes('extra-time') && (
                                    <span className="el-badge el-badge-green">⏱️ Extra Time</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${room.status === 'completed'
                            ? 'bg-emerald-500 text-white'
                            : room.status === 'active'
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-400 text-white'
                            }`}>
                            {room.status?.toUpperCase()}
                          </span>
                        </div>

                        {/* Room-level return progress */}
                        <div className="mb-2">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-sm font-semibold text-slate-600">Returned</span>
                            <span className="text-lg font-bold text-slate-900">
                              {roomReturned}<span className="text-sm font-semibold text-slate-400"> / {totalStudents}</span>
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${roomFullyReturned ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${roomReturnPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Time left */}
                        {roomTimeData && !roomTimeData.isOver && (
                          <div className="flex justify-between text-sm text-slate-600 mb-1">
                            <span>{hasConflict && <span className="mr-1">⚠️</span>}Time Left</span>
                            <span className={`font-mono font-semibold ${roomTimeData.multiplier > 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {String(roomTimeData.hours).padStart(2, '0')}:{String(roomTimeData.minutes).padStart(2, '0')}:{String(roomTimeData.seconds).padStart(2, '0')}
                              {roomTimeData.multiplier > 1 && <span className="text-xs ml-1">({roomTimeData.multiplier}x)</span>}
                            </span>
                          </div>
                        )}
                        {roomTimeData?.isOver && (
                          <div className="text-rose-600 font-semibold text-center text-sm mb-1">TIME UP</div>
                        )}

                        {/* Sections — tap to record returns */}
                        {sortedSections.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sections</span>
                              {canEdit && (
                                <span className="text-[11px] text-slate-400">Tap to record returns</span>
                              )}
                            </div>
                            <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                              {sortedSections.map((section) => {
                                const count = section.studentCount || 0
                                const returned = getSectionReturned(room, section._id)
                                const pct = count > 0 ? Math.round((returned / count) * 100) : 0
                                const done = count > 0 && returned >= count
                                const started = returned > 0
                                const sortedAccommodations = Array.isArray(section.accommodations) && section.accommodations.length > 0
                                  ? [...section.accommodations].sort((a, b) => {
                                      const aIsTime = a.includes('1.5x') || a.includes('2x') ||
                                        a.includes('1.5×') || a.includes('2×') ||
                                        a.toLowerCase().includes('extended time') ||
                                        a.toLowerCase().includes('double time') ||
                                        a.toLowerCase().includes('extra time')
                                      const bIsTime = b.includes('1.5x') || b.includes('2x') ||
                                        b.includes('1.5×') || b.includes('2×') ||
                                        b.toLowerCase().includes('extended time') ||
                                        b.toLowerCase().includes('double time') ||
                                        b.toLowerCase().includes('extra time')
                                      if (aIsTime && !bIsTime) return -1
                                      if (!aIsTime && bIsTime) return 1
                                      return a.localeCompare(b)
                                    })
                                  : []

                                return (
                                  <button
                                    key={section._id}
                                    type="button"
                                    onClick={() => openReturnEntry(room, section)}
                                    disabled={!canEdit}
                                    className={`w-full rounded-lg border p-2.5 text-left transition ${
                                      done
                                        ? 'border-emerald-300 bg-emerald-50'
                                        : started
                                          ? 'border-amber-300 bg-amber-50'
                                          : 'border-slate-200 bg-slate-50'
                                    } ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-brand-300' : 'cursor-default'}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="flex items-center gap-1.5 font-bold text-slate-900">
                                        {done && (
                                          <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                        Section #{section.number}
                                      </span>
                                      <span className={`text-sm font-bold ${done ? 'text-emerald-700' : started ? 'text-amber-700' : 'text-slate-500'}`}>
                                        {returned}/{count}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    {sortedAccommodations.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {sortedAccommodations.map((acc, index) => (
                                          <span
                                            key={`${section._id}-acc-${index}`}
                                            className="rounded bg-brand-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-700"
                                          >
                                            {acc}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                  })()}
                </div>
              </div>

            </div>

            {/* Return-entry popup */}
            {returnEntry && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
                <div className="el-card el-fade-up w-full max-w-md p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Record Exam Returns</h3>
                      <p className="text-sm text-slate-500">
                        Section #{returnEntry.sectionNumber} · {returnEntry.roomName}
                      </p>
                    </div>
                    <button onClick={closeReturnEntry} className="el-icon-btn" aria-label="Close">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Big count + progress */}
                  {(() => {
                    const value = Math.min(Math.max(Number(returnEntryValue) || 0, 0), returnEntry.studentCount)
                    const pct = returnEntry.studentCount > 0 ? Math.round((value / returnEntry.studentCount) * 100) : 0
                    const done = returnEntry.studentCount > 0 && value >= returnEntry.studentCount
                    return (
                      <>
                        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                          <p className="text-5xl font-bold text-slate-900">
                            {value}
                            <span className="text-2xl font-semibold text-slate-400"> / {returnEntry.studentCount}</span>
                          </p>
                          <p className={`mt-1 text-sm font-semibold ${done ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {done ? 'All exams returned' : `${pct}% returned`}
                          </p>
                          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Quick tally */}
                        <div className="mb-4 flex items-center justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => adjustReturnEntry(-1)}
                            disabled={value <= 0}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-700 transition hover:bg-slate-300 disabled:opacity-40"
                            aria-label="Decrease"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={returnEntry.studentCount}
                            value={returnEntryValue}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10)
                              if (Number.isNaN(n)) { setReturnEntryValue(0); return }
                              setReturnEntryValue(Math.min(Math.max(n, 0), returnEntry.studentCount))
                            }}
                            className="el-input w-24 text-center text-2xl font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => adjustReturnEntry(1)}
                            disabled={value >= returnEntry.studentCount}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>

                        {/* Shortcuts */}
                        <div className="mb-5 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReturnEntryValue(0)}
                            className="el-btn el-btn-secondary el-btn-sm"
                          >
                            None
                          </button>
                          <button
                            type="button"
                            onClick={() => setReturnEntryValue(returnEntry.studentCount)}
                            className="el-btn el-btn-secondary el-btn-sm"
                          >
                            All {returnEntry.studentCount}
                          </button>
                        </div>
                      </>
                    )
                  })()}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeReturnEntry}
                      disabled={returnEntrySaving}
                      className="el-btn el-btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveReturnEntry}
                      disabled={returnEntrySaving}
                      className="el-btn el-btn-primary flex-1"
                    >
                      {returnEntrySaving ? 'Saving…' : 'Save Returns'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rooms Display */}
        {isTableView ? (
          /* Table View */
          <div className="el-card">
            <div className="overflow-x-auto" style={{ touchAction: 'pan-x', overflowY: 'visible', position: 'relative' }}>
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('roomNumber')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Room</span>
                        {sortBy === 'roomNumber' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Status</span>
                        {sortBy === 'status' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('studentCount')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Students</span>
                        {sortBy === 'studentCount' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('present')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Present</span>
                        {sortBy === 'present' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('absent')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Absent</span>
                        {sortBy === 'absent' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('sections')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Sections</span>
                        {sortBy === 'sections' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('timeRemaining')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Time Remaining</span>
                        {sortBy === 'timeRemaining' && (
                          <svg className={`w-4 h-4 ${sortDescending ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {getPaginatedRooms().map((room) => (
                    <React.Fragment key={room._id}>
                      <tr
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={(e) => {
                          // Don't expand if clicking on action buttons
                          if (!e.target.closest('.dropdown-container') && !e.target.closest('button')) {
                            toggleRoomExpansion(room._id)
                          }
                        }}
                        data-room-id={room._id}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-slate-900">{room.name}</span>
                            <div className="flex gap-1 flex-wrap">
                            {getRoomAccommodationSummary(room) && (
                                <>
                                {getRoomAccommodationSummary(room).includes('bilingual') && (
                                  <span className="el-badge el-badge-blue">
                                    🌐 Bilingual
                                  </span>
                                )}
                                {getRoomAccommodationSummary(room).includes('extra-time') && (
                                  <span className="el-badge el-badge-green">
                                    ⏱️ Extra Time
                                  </span>
                                )}
                                </>
                              )}
                              </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white room-status-transition ${getStatusColor(room.status)}`}>
                            {getStatusText(room.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900 font-medium">
                            {String(calculateTotalStudents(room.sections) || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-700">
                            {String(room.status === 'completed'
                              ? (typeof room.presentStudents === 'number' ? room.presentStudents : 0)
                              : 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-700">
                            {String((() => {
                              const total = calculateTotalStudents(room.sections) || 0;
                              if (room.status === 'completed' && typeof room.presentStudents === 'number') {
                                return Math.max(0, total - room.presentStudents);
                              }
                              // If test is in progress (not completed), show 0 for absent
                              return 0;
                            })())}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {room.sections && room.sections.length > 0
                              ? [...room.sections]
                                  .sort((a, b) => (a.number || 0) - (b.number || 0))
                                  .map(s => s.number)
                                  .join(', ')
                              : '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getRoomTimeRemaining(room)?.isOver ? 'text-rose-600' : 'text-amber-600'}`}>
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
                                    <span className="text-xs text-slate-400">
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
                                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition-colors duration-200 border border-amber-200"
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
                                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition-colors duration-200 border border-emerald-200"
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
                              className="px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-medium transition-colors duration-200 border border-brand-200"
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
                                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors duration-200"
                                  title="More Actions"
                                >
                                  ⋯
                                </button>

                                {showDropdown === room._id && createPortal(
                                  <div
                                    data-dropdown-menu
                                    className="fixed w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50"
                                    style={{
                                      position: 'fixed',
                                      top: `${dropdownPosition.top}px`,
                                      left: `${dropdownPosition.left}px`,
                                      zIndex: 99999,
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
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
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
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
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
                                          console.log('Edit Supplies button clicked')
                                          handleEditSuppliesClick(room)
                                          setShowDropdown(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
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
                                        className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center"
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        Invalidate Test
                                      </button>
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {expandedRooms.has(room._id) && (
                        <tr key={`${room._id}-details`} className="bg-slate-50">
                          <td colSpan="9" className="px-0 py-0">
                            <div className="overflow-hidden">
                              <div className="px-6 py-3">
                                <div className="grid grid-cols-3 gap-4">
                                  {/* Sections Column */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Sections</h4>
                                    <RoomSections sections={room.sections} roomId={room._id} />
                                  </div>

                                  {/* Proctors Column */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Proctors</h4>
                                    <RoomProctors proctors={room.proctors} />
                                  </div>

                                  {/* Supplies and Time Column */}
                                  <div className="flex flex-col h-full justify-between">
                                    {/* Supplies Section */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Supplies</h4>
                                      <RoomSupplies supplies={room.supplies} />
                                    </div>

                                    {/* Invalidated Tests Section */}
                                    {(() => {
                                      const roomInvalidatedTests = invalidatedTests.filter(inv => inv.roomId === room._id)
                                      if (roomInvalidatedTests.length > 0) {
                                        return (
                                          <div className="mt-4">
                                            <h4 className="text-sm font-semibold text-rose-600 mb-2 flex items-center">
                                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                              </svg>
                                              Invalidated Tests ({roomInvalidatedTests.length})
                                            </h4>
                                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                              {roomInvalidatedTests.map((invalidation) => (
                                                <div key={invalidation.id} className="bg-rose-50 border border-rose-200 rounded-lg p-2">
                                                  <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                      <p className="text-sm font-medium text-rose-700">
                                                        Section {invalidation.sectionNumber}
                                                      </p>
                                                      <p className="text-xs text-rose-600">
                                                        {invalidation.notes}
                                                      </p>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                      <span className="text-xs text-rose-500">
                                                        {new Date(invalidation.timestamp).toLocaleTimeString()}
                                                      </span>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          handleRemoveInvalidatedTestClick(invalidation)
                                                        }}
                                                        className="text-rose-500 hover:text-rose-700 text-xs"
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

                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
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
                className="el-card p-6 cursor-pointer hover:shadow-md hover:ring-1 hover:ring-brand-200 transition duration-200"
                onClick={() => toggleCardExpansion(room._id)}
                data-room-id={room._id}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{room.name}</h3>
                    <div className="flex gap-1 flex-wrap">
                    {getRoomAccommodationSummary(room) && (
                        <>
                        {getRoomAccommodationSummary(room).includes('bilingual') && (
                          <span className="el-badge el-badge-blue">
                            🌐 Bilingual
                          </span>
                        )}
                        {getRoomAccommodationSummary(room).includes('extra-time') && (
                          <span className="el-badge el-badge-green">
                            ⏱️ Extra Time
                          </span>
                        )}
                        </>
                      )}
                      </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white room-status-transition ${getStatusColor(room.status)}`}>
                    {getStatusText(room.status)}
                  </span>
                </div>

                {/* Total Students */}
                <div className="mb-4 p-3 bg-brand-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Total Students:</span>
                    <span className="text-2xl font-bold text-brand-600">
                      {calculateTotalStudents(room.sections)}
                    </span>
                  </div>
                </div>

                {/* Present Students */}
                <div className="mb-4 p-3 bg-emerald-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Present Students:</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {room.status === 'completed' ? (room.presentStudents || 0) : '-'}
                    </span>
                  </div>
                </div>

                {/* Absent Students */}
                <div className="mb-4 p-3 bg-rose-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Absent Students:</span>
                    <span className="text-2xl font-bold text-rose-600">
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
                      className="el-btn el-btn-primary w-full"
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
                          className="el-btn w-full bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500"
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
                          className="el-btn el-btn-success w-full"
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
                        className="el-btn el-btn-primary w-full"
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
                          className="el-btn el-btn-secondary w-full"
                        >
                          <span className="mr-2">⋯</span>
                          More Actions
                        </button>

                        {showDropdown === room._id && (
                          <div data-dropdown-menu className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Add Supply button clicked (card view)')
                                  handleAddSupplyClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
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
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Move Students
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Edit Supplies button clicked (card view)')
                                  handleEditSuppliesClick(room)
                                  setShowDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
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
                                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center"
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
                      className="el-btn el-btn-primary w-full"
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
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Sections</h4>
                      <RoomSections sections={room.sections} roomId={room._id} />
                    </div>

                    {/* Proctors */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Proctors</h4>
                      <RoomProctors proctors={room.proctors} />
                    </div>

                    {/* Supplies */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Supplies</h4>
                      <RoomSupplies supplies={room.supplies} />
                    </div>

                    {/* Estimated Time */}
                    <div className="border-t border-slate-200 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Estimated Time:</span>
                        <div className={`text-lg font-bold ${getRoomTimeRemaining(room)?.isOver ? 'text-rose-600' : 'text-amber-600'}`}>
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
                                  <span className="text-xs text-slate-400 font-normal">
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
            <div className="text-sm text-slate-600">
              Showing {((currentPage - 1) * roomsPerPage) + 1} to {Math.min(currentPage * roomsPerPage, getSortedRooms().length)} of {getSortedRooms().length} rooms
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="el-btn el-btn-secondary el-btn-sm"
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
                      className={`el-btn el-btn-sm ${currentPage === pageNum
                        ? 'el-btn-primary'
                        : 'el-btn-secondary'
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
                className="el-btn el-btn-secondary el-btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Supply Modal */}
      <AddSupplyModal
        show={showAddSupplyModal}
        room={selectedRoom}
        presetSupplies={PRESET_SUPPLIES}
        selectedPresetSupply={selectedPresetSupply}
        setSelectedPresetSupply={setSelectedPresetSupply}
        quantity={newSupplyQuantity}
        setQuantity={setNewSupplyQuantity}
        onCancel={() => {
          setShowAddSupplyModal(false)
          setSelectedPresetSupply('')
          setNewSupplyQuantity(1)
          setSelectedRoom(null)
        }}
        onConfirm={handleAddSupply}
      />

      {/* Edit Supply Modal */}
      <EditSupplyModal
        show={showEditSupplyModal}
        room={selectedRoom}
        editingSupply={editingSupply}
        setEditingSupply={setEditingSupply}
        quantity={editSupplyQuantity}
        setQuantity={setEditSupplyQuantity}
        onCancel={() => {
          setShowEditSupplyModal(false)
          setEditingSupply(null)
          setEditSupplyQuantity(1)
          setSelectedRoom(null)
        }}
        onConfirm={handleEditSupply}
      />

      {/* Move Students Modal */}
      <MoveStudentsModal
        show={showMoveStudentsModal}
        fromRoom={moveFromRoom}
        rooms={session?.rooms}
        studentMoveData={studentMoveData}
        setStudentMoveData={setStudentMoveData}
        onCancel={() => {
          setShowMoveStudentsModal(false)
          setMoveFromRoom(null)
          setStudentMoveData({})
        }}
        onConfirm={handleMoveStudents}
      />

      {/* Edit Supplies Modal */}
      <EditSuppliesModal
        show={showEditSuppliesModal}
        room={selectedRoom}
        onAdjustQuantity={handleAdjustSupplyQuantity}
        onRemoveSupply={handleRemoveSupply}
        onClose={() => {
          setShowEditSuppliesModal(false)
          setSelectedRoom(null)
        }}
      />

      {/* Activity Log Section */}
      <ActivityLogPanel
        show={showActivityLog}
        onToggle={() => setShowActivityLog(!showActivityLog)}
        isOwner={getSessionRole() === 'Owner'}
        onClear={() => setShowClearLogModal(true)}
        activityLog={activityLog}
        getActivityLogColors={getActivityLogColors}
        formatTimestamp={formatTimestamp}
      />

      {/* Invalidated Tests Section */}
      <InvalidatedTestsSection
        invalidatedTests={invalidatedTests}
        rooms={session?.rooms}
        onRemove={handleRemoveInvalidatedTestClick}
      />

      {/* Mark Room Complete Modal */}
      <MarkRoomCompleteModal
        show={showMarkRoomCompleteModal}
        rooms={session?.rooms}
        selectedRoom={selectedRoomForComplete}
        setSelectedRoom={setSelectedRoomForComplete}
        onCancel={() => {
          setShowMarkRoomCompleteModal(false)
          setSelectedRoomForComplete(null)
        }}
        onContinue={() => {
          if (selectedRoomForComplete) {
            setShowMarkRoomCompleteModal(false)
            handleMarkRoomComplete(selectedRoomForComplete._id)
            setSelectedRoomForComplete(null)
          }
        }}
      />

      {/* Mark Section Complete Modal */}
      <QuickCompleteModal
        show={showQuickCompleteModal}
        section={quickCompleteSection}
        setSection={setQuickCompleteSection}
        studentsPresent={quickCompleteStudentsPresent}
        setStudentsPresent={setQuickCompleteStudentsPresent}
        availableSections={sectionsAvailableForQuickComplete}
        onCancel={() => {
          setShowQuickCompleteModal(false)
          setQuickCompleteSection(null)
          setQuickCompleteStudentsPresent('')
        }}
        onConfirm={handleQuickCompleteBySection}
      />

      {/* Present Students Modal */}
      <PresentStudentsModal
        show={showPresentStudentsModal}
        room={roomToComplete}
        calculateTotalStudents={calculateTotalStudents}
        sectionPresentCounts={sectionPresentCounts}
        setSectionPresentCounts={setSectionPresentCounts}
        presentStudentsCount={presentStudentsCount}
        setPresentStudentsCount={setPresentStudentsCount}
        onCancel={() => {
          setShowPresentStudentsModal(false)
          setRoomToComplete(null)
          setPresentStudentsCount('')
          setSectionPresentCounts({})
        }}
        onConfirm={handleConfirmRoomComplete}
      />

      {/* Clear Activity Log Confirmation Modal */}
      <ClearLogModal
        show={showClearLogModal}
        onCancel={() => setShowClearLogModal(false)}
        onConfirm={confirmClearActivityLog}
      />

      {/* Mark Room Incomplete Confirmation Modal */}
      <IncompleteConfirmModal
        show={showIncompleteConfirmModal}
        onCancel={cancelMarkRoomIncomplete}
        onConfirm={confirmMarkRoomIncomplete}
      />

      {/* Attendance Error Modal */}
      <AttendanceErrorModal
        show={showAttendanceErrorModal}
        message={attendanceError}
        onClose={() => setShowAttendanceErrorModal(false)}
      />

      {/* Invalidate Test Modal */}
      <InvalidateTestModal
        show={showInvalidateModal}
        room={roomToInvalidate}
        selectedSection={selectedSection}
        setSelectedSection={setSelectedSection}
        notes={invalidationNotes}
        setNotes={setInvalidationNotes}
        onCancel={cancelInvalidateTest}
        onConfirm={handleInvalidateTest}
      />

      {/* Remove Invalidation Confirmation Modal */}
      <RemoveInvalidationModal
        show={showRemoveInvalidationModal}
        invalidation={invalidationToRemove}
        onCancel={cancelRemoveInvalidatedTest}
        onConfirm={confirmRemoveInvalidatedTest}
      />
    </div>
  )
}

export default memo(SessionView) 