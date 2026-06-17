import React, { useState, useEffect, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { testingAPI } from '../services/api'
import { compareSectionNumbers } from '../utils/sectionNumber'
import { useRealTime } from '../contexts/RealTimeContext'

const RoomDetail = () => {
  const { sessionId, roomId } = useParams()
  const navigate = useNavigate()
  const { isConnected, joinSession, onSessionUpdate, leaveSession } = useRealTime()
  
  const [session, setSession] = useState(null)
  const [room, setRoom] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activityLog, setActivityLog] = useState([])
  const [invalidatedTests, setInvalidatedTests] = useState([])
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [editingInvalidationId, setEditingInvalidationId] = useState(null)
  const [editingInvalidationNotes, setEditingInvalidationNotes] = useState('')

  // Fetch session and room data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Fetch session data
      const sessionData = await testingAPI.getSession(sessionId)
      setSession(sessionData.session)
      
      // Find the specific room
      const foundRoom = sessionData.session.rooms?.find(r => r._id === roomId)
      if (!foundRoom) {
        setError('Room not found')
        return
      }
      setRoom(foundRoom)
      
      // Fetch activity log
      const activityLogData = await testingAPI.getActivityLog(sessionId)
      setActivityLog(activityLogData.activityLog || [])
      
      // Fetch invalidations
      const invalidationsData = await testingAPI.getInvalidations(sessionId)
      setInvalidatedTests(invalidationsData.invalidations || [])
      
    } catch (err) {
      console.error('Error fetching room data:', err)
      setError('Failed to load room data')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, roomId])

  // Real-time updates handler
  const handleRealTimeUpdate = useCallback((update) => {
    console.log('🔔 RoomDetail - Real-time update received:', update)
    
    // Update session data
    if (update.data.session) {
      setSession(update.data.session)
      const updatedRoom = update.data.session.rooms?.find(r => r._id === roomId)
      if (updatedRoom) {
        setRoom(updatedRoom)
      }
    }
    
    // Update activity log
    if (update.logEntry) {
      setActivityLog(prevLog => [update.logEntry, ...prevLog])
    }
    
    // Handle specific room updates
    if (update.type === 'room-updated' && update.data.roomId === roomId) {
      setRoom(update.data.room)
    }
  }, [roomId])

  // Set up real-time updates
  useEffect(() => {
    if (session && isConnected) {
      joinSession(sessionId)
      const cleanup = onSessionUpdate(sessionId, handleRealTimeUpdate)
      return cleanup
    }
  }, [session, isConnected, sessionId, joinSession, onSessionUpdate, handleRealTimeUpdate])

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveSession(sessionId)
    }
  }, [sessionId, leaveSession])

  // Update time remaining every second
  useEffect(() => {
    if (!session) return

    const updateTime = () => {
      const now = new Date()
      const [_startHour, _startMinute] = session.startTime.split(':')
      const [endHour, endMinute] = session.endTime.split(':')
      const sessionDate = new Date(session.date)
      // Extract UTC date parts (since date is stored at UTC midnight)
      const year = sessionDate.getUTCFullYear()
      const month = sessionDate.getUTCMonth()
      const day = sessionDate.getUTCDate()
      
      // Create local times with the correct date and user-entered times
      const endTime = new Date(year, month, day, parseInt(endHour), parseInt(endMinute), 0)
      
      const timeDiff = endTime - now
      
      if (timeDiff <= 0) {
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, isOver: true })
        return
      }
      
      const hours = Math.floor(timeDiff / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
      
      setTimeRemaining({ hours, minutes, seconds, isOver: false })
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [session])

  if (isLoading) {
    return (
      <div className="el-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="el-spinner h-9 w-9" />
          <p className="text-sm text-slate-500">Loading room details…</p>
        </div>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="el-app-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">Room Not Found</h1>
          <p className="mb-6 text-sm text-slate-500">{error || 'The requested room could not be found.'}</p>
          <button
            onClick={() => navigate(`/session/${sessionId}/view`)}
            className="el-btn el-btn-primary"
          >
            Back to Session
          </button>
        </div>
      </div>
    )
  }

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    const timeString = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
    return `${month}/${day}/${year}, ${timeString}`
  }

  // Get room status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'el-badge-green'
      case 'active':
        return 'el-badge-blue'
      default:
        return 'el-badge-slate'
    }
  }

  // Get room status text
  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Complete'
      case 'active':
        return 'Active'
      default:
        return 'Unknown'
    }
  }

  // Get activity log colors
  const getActivityLogColors = (action) => {
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
      border: 'border-slate-400',
      dot: 'bg-slate-400'
    };
  }


  // Filter invalidations for this room
  const roomInvalidations = invalidatedTests.filter(inv => inv.roomId === room._id)

  const startEditingInvalidation = (invalidation) => {
    setEditingInvalidationId(invalidation.id)
    setEditingInvalidationNotes(invalidation.notes)
  }

  const cancelEditingInvalidation = () => {
    setEditingInvalidationId(null)
    setEditingInvalidationNotes('')
  }

  const saveInvalidationNotes = async (invalidationId) => {
    if (!editingInvalidationNotes.trim()) return
    try {
      const response = await testingAPI.updateInvalidation(sessionId, invalidationId, editingInvalidationNotes.trim())
      setInvalidatedTests(prev => prev.map(inv =>
        inv.id === invalidationId ? { ...inv, notes: response.invalidation.notes } : inv
      ))
      cancelEditingInvalidation()
    } catch (err) {
      console.error('Error updating invalidation notes:', err)
    }
  }

  // Calculate room-specific time remaining directly to avoid hooks order issues
  let roomTimeRemaining = null
  if (session && timeRemaining && room) {
    // Calculate time multiplier based on section accommodations
    let timeMultiplier = 1
    if (room.sections && room.sections.length > 0) {
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
      
      if (hasTimeAccommodation) {
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
        timeMultiplier = maxMultiplier
      }
    }
    
    if (!timeRemaining.isOver) {
      // Calculate total session duration in minutes
      const [startHour, startMinute] = session.startTime.split(':')
      const [endHour, endMinute] = session.endTime.split(':')
      const sessionDate = new Date(session.date)
      // Extract UTC date parts (since date is stored at UTC midnight)
      const year = sessionDate.getUTCFullYear()
      const month = sessionDate.getUTCMonth()
      const day = sessionDate.getUTCDate()
      
      // Create local times with the correct date and user-entered times
      const startTime = new Date(year, month, day, parseInt(startHour), parseInt(startMinute), 0)
      const endTime = new Date(year, month, day, parseInt(endHour), parseInt(endMinute), 0)
      
      const totalSessionMinutes = (endTime - startTime) / (1000 * 60)
      
      // Calculate room-specific end time based on multiplier
      const roomEndTime = new Date(startTime.getTime() + (totalSessionMinutes * timeMultiplier * 60 * 1000))
      
      // Calculate remaining time for this room
      const now = new Date()
      const roomTimeDiff = roomEndTime - now
      
      if (roomTimeDiff <= 0) {
        roomTimeRemaining = { hours: 0, minutes: 0, seconds: 0, isOver: true, multiplier: timeMultiplier }
      } else {
        const hours = Math.floor(roomTimeDiff / (1000 * 60 * 60))
        const minutes = Math.floor((roomTimeDiff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((roomTimeDiff % (1000 * 60)) / 1000)
        
        roomTimeRemaining = { hours, minutes, seconds, isOver: false, multiplier: timeMultiplier }
      }
    } else {
      roomTimeRemaining = { hours: 0, minutes: 0, seconds: 0, isOver: true, multiplier: timeMultiplier }
    }
  }

  return (
    <div className="el-app-bg pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/session/${sessionId}/view`)}
                className="el-icon-btn"
                title="Back to session"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="leading-tight">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">{room.name}</h1>
                <p className="text-xs text-slate-400">
                  {session?.name} • Room Details
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Time Remaining */}
              {timeRemaining && roomTimeRemaining && (
                <div className={`time-transition rounded-lg border px-3 py-1.5 ${roomTimeRemaining.isOver ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex flex-col items-center">
                    <span className={`text-base font-bold ${roomTimeRemaining.isOver ? 'text-rose-600' : 'text-amber-600'}`}>
                      {roomTimeRemaining.isOver ? 'TIME UP' : `${String(roomTimeRemaining.hours).padStart(2, '0')}:${String(roomTimeRemaining.minutes).padStart(2, '0')}:${String(roomTimeRemaining.seconds).padStart(2, '0')}`}
                    </span>
                    {roomTimeRemaining.multiplier > 1 && (
                      <span className="text-[11px] text-slate-400">
                        ({roomTimeRemaining.multiplier}x time)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <span className={`el-badge room-status-badge ${getStatusColor(room.status)}`}>
                {getStatusText(room.status)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Room Statistics Overview */}
        <div className="mb-6">
          <div className="el-card el-fade-up p-6">
            <h2 className="mb-6 text-lg font-semibold text-slate-900">Room Overview</h2>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {/* Total Students */}
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                  <svg className="h-8 w-8 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="student-count-transition text-2xl font-bold text-slate-900">
                  {room.sections?.reduce((total, section) => total + (section.studentCount || 0), 0) || 0}
                </div>
                <div className="el-stat-label mt-1">Total Students</div>
              </div>

              {/* Present Students */}
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="student-count-transition text-2xl font-bold text-slate-900">
                  {room.status === 'completed' ? (room.presentStudents || 0) : '-'}
                </div>
                <div className="el-stat-label mt-1">Present</div>
              </div>

              {/* Absent Students */}
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                  <svg className="h-8 w-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="student-count-transition text-2xl font-bold text-slate-900">
                  {room.status === 'completed'
                    ? (room.sections?.reduce((total, section) => total + (section.studentCount || 0), 0) || 0) - (room.presentStudents || 0)
                    : '-'
                  }
                </div>
                <div className="el-stat-label mt-1">
                  {room.status === 'completed' ? 'Absent' : 'Not Available'}
                </div>
              </div>

              {/* Number of Sections */}
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {room.sections?.length || 0}
                </div>
                <div className="el-stat-label mt-1">Sections</div>
              </div>
            </div>

            {/* Additional Stats Row */}
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Attendance Rate */}
                <div className="text-center">
                  <div className="text-lg font-semibold text-slate-900">
                    {room.status === 'completed' && room.sections?.reduce((total, section) => total + (section.studentCount || 0), 0) > 0
                      ? Math.round(((room.presentStudents || 0) / room.sections.reduce((total, section) => total + (section.studentCount || 0), 0)) * 100)
                      : '-'
                    }{room.status === 'completed' ? '%' : ''}
                  </div>
                  <div className="el-stat-label mt-1">
                    {room.status === 'completed' ? 'Final Attendance' : 'Not Available'}
                  </div>
                </div>

                {/* Room Status */}
                <div className="text-center">
                  <div className={`el-badge ${
                    room.status === 'completed'
                      ? 'el-badge-green'
                      : room.status === 'active'
                      ? 'el-badge-blue'
                      : 'el-badge-slate'
                  }`}>
                    {room.status === 'completed' ? 'Completed' : room.status === 'active' ? 'Active' : 'Planned'}
                  </div>
                  <div className="el-stat-label mt-1.5">Room Status</div>
                </div>

                {/* Proctors Count */}
                <div className="text-center">
                  <div className="text-lg font-semibold text-slate-900">
                    {room.proctors?.length || 0}
                  </div>
                  <div className="el-stat-label mt-1">Proctors Assigned</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column - Room Information */}
          <div className="space-y-6">
            {/* Sections */}
            <div className="el-card el-fade-up p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Sections</h2>
              {room.sections && room.sections.length > 0 ? (
                <div className="max-h-80 space-y-4 overflow-y-auto">
                  {room.sections
                    .sort((a, b) => compareSectionNumbers(a.number, b.number))
                    .map((section) => {
                      // Calculate section attendance only for completed rooms
                      const sectionPresent = room.status === 'completed' ? (room.sectionAttendance?.[section._id] || 0) : 0
                      const sectionAbsent = room.status === 'completed' 
                        ? Math.max(0, section.studentCount - sectionPresent)
                        : 0
                      const sectionAttendanceRate = room.status === 'completed' && section.studentCount > 0 
                        ? Math.round((sectionPresent / section.studentCount) * 100)
                        : 0

                      return (
                        <div key={section._id} className="section-updated rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="mb-2 flex items-start justify-between">
                            <span className="text-base font-semibold text-slate-900">
                              Section {section.number}
                            </span>
                            <span className="text-sm text-slate-500">
                              {section.studentCount} students
                            </span>
                          </div>

                          {/* Section Attendance - Only show for completed rooms */}
                          {room.status === 'completed' && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                              <h4 className="el-stat-label mb-2">Attendance</h4>
                              <div className="grid grid-cols-3 gap-3 text-center">
                                <div>
                                  <div className="text-lg font-bold text-emerald-600">
                                    {sectionPresent}
                                  </div>
                                  <div className="text-xs text-slate-500">Present</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-rose-600">
                                    {sectionAbsent}
                                  </div>
                                  <div className="text-xs text-slate-500">Absent</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-brand-600">
                                    {sectionAttendanceRate}%
                                  </div>
                                  <div className="text-xs text-slate-500">Rate</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accommodations:</span>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {section.accommodations.map((acc, index) => (
                                  <span key={index} className="el-badge el-badge-brand">
                                    {acc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {section.notes && (
                            <div className="mt-2 text-sm text-slate-500">
                              <span className="font-semibold">Notes:</span> {section.notes}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No sections assigned to this room</p>
              )}
            </div>



            {/* Proctors */}
            <div className="el-card el-fade-up p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Proctors</h2>
              {room.proctors && room.proctors.length > 0 ? (
                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {room.proctors.map((proctor, index) => (
                    <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <h3 className="text-base font-semibold text-slate-900">
                          {proctor.name || `${proctor.firstName} ${proctor.lastName}`}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <span className="mr-2 text-sm font-semibold text-slate-700">Time:</span>
                          <span className="text-sm font-medium text-emerald-700">
                            {proctor.startTime} - {proctor.endTime}
                          </span>
                        </div>
                        {proctor.email && (
                          <div className="flex items-center">
                            <span className="mr-2 text-sm font-semibold text-slate-700">Email:</span>
                            <span className="text-sm text-slate-500">{proctor.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No proctors assigned to this room.</p>
              )}
            </div>

            {/* Invalidated Tests */}
            {roomInvalidations.length > 0 && (
              <div className="el-card el-fade-up p-6">
                <h2 className="mb-4 flex items-center text-lg font-semibold text-rose-700">
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Invalidated Tests ({roomInvalidations.length})
                </h2>
                <div className="space-y-3">
                  {roomInvalidations.map((invalidation) => (
                    <div key={invalidation.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-rose-800">
                            Section {invalidation.sectionNumber}
                          </p>
                          {editingInvalidationId === invalidation.id ? (
                            <div className="mt-2">
                              <textarea
                                value={editingInvalidationNotes}
                                onChange={(e) => setEditingInvalidationNotes(e.target.value)}
                                className="el-input"
                                rows={2}
                              />
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  onClick={cancelEditingInvalidation}
                                  className="el-btn el-btn-secondary px-3 py-1 text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveInvalidationNotes(invalidation.id)}
                                  disabled={!editingInvalidationNotes.trim() || editingInvalidationNotes.trim() === invalidation.notes}
                                  className="el-btn el-btn-primary px-3 py-1 text-sm"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-rose-600">
                              {invalidation.notes}
                            </p>
                          )}
                        </div>
                        <div className="ml-3 text-right">
                          <p className="text-xs text-rose-500">
                            {formatTimestamp(invalidation.timestamp)}
                          </p>
                          <p className="text-xs text-rose-500">
                            by {invalidation.invalidatedBy}
                          </p>
                          {editingInvalidationId !== invalidation.id && (
                            <button
                              onClick={() => startEditingInvalidation(invalidation)}
                              className="mt-1 text-xs font-medium text-rose-600 hover:text-rose-800"
                            >
                              Edit notes
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Activity Log and Room Notes */}
          <div className="space-y-6">
            {/* Activity Log */}
            <div className="el-card el-fade-up p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Activity Log</h2>
              {activityLog.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">No activity recorded yet</p>
                  <p className="mt-1 text-xs text-slate-400">Actions will appear here as they happen</p>
                </div>
              ) : (
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {activityLog
                    .filter(log => log.roomName === room.name)
                    .map((log, index) => {
                      const colors = getActivityLogColors(log.action);
                      return (
                      <div key={index} className={`flex items-start gap-3 rounded-lg border border-slate-200 border-l-4 bg-slate-50 p-3 ${colors.border}`}>
                        <div className={`mt-2 h-2 w-2 flex-shrink-0 ${colors.dot} rounded-full`}></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">
                              {log.action}
                            </p>
                            <span className="text-xs text-slate-400">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              User: <span className="font-semibold">{log.userName}</span>
                            </span>
                            {log.details && (
                              <span className="text-xs text-slate-500">
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
            
            {/* Room Notes */}
            {room.notes && (
              <div className="el-card el-fade-up p-6">
                <h2 className="mb-4 flex items-center text-lg font-semibold text-slate-900">
                  <svg className="mr-2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Room Notes
                </h2>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                    {room.notes}
                  </p>
                </div>
              </div>
            )}

            {/* Supplies */}
            <div className="el-card el-fade-up p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Supplies</h2>
              {room.supplies && room.supplies.length > 0 ? (
                <div className="space-y-3">
                  {/* Initial Supplies */}
                  {(() => {
                    const initialSupplies = room.supplies.filter(supply => supply.startsWith('INITIAL_'))
                    if (initialSupplies.length > 0) {
                      const initialSupplyCounts = {}
                      initialSupplies.forEach(supply => {
                        const cleanName = supply.replace('INITIAL_', '')
                        initialSupplyCounts[cleanName] = (initialSupplyCounts[cleanName] || 0) + 1
                      })
                      
                      return (
                        <div>
                          <h3 className="el-stat-label mb-2">Initial Supplies</h3>
                          <div className="space-y-2">
                            {Object.entries(initialSupplyCounts).map(([supplyName, count], index) => (
                              <div key={`initial-${index}`} className="supply-transition flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <span className="text-sm font-medium text-emerald-700">
                                  {supplyName} ({count})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Added Supplies */}
                  {(() => {
                    const addedSupplies = room.supplies.filter(supply => !supply.startsWith('INITIAL_'))
                    if (addedSupplies.length > 0) {
                      const addedSupplyCounts = {}
                      addedSupplies.forEach(supply => {
                        addedSupplyCounts[supply] = (addedSupplyCounts[supply] || 0) + 1
                      })
                      
                      return (
                        <div>
                          <h3 className="el-stat-label mb-2">Added Supplies</h3>
                          <div className="space-y-2">
                            {Object.entries(addedSupplyCounts).map(([supplyName, count], index) => (
                              <div key={`added-${index}`} className="supply-transition flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                                <span className="text-sm font-medium text-brand-700">
                                  {supplyName} ({count})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No supplies added to this room</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(RoomDetail)
