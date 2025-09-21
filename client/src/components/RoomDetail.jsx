import React, { useState, useEffect, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { testingAPI } from '../services/api'
import { useRealTime } from '../contexts/RealTimeContext'

const RoomDetail = ({ user }) => {
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
      const [startHour, startMinute] = session.startTime.split(':')
      const [endHour, endMinute] = session.endTime.split(':')
      const sessionDate = new Date(session.date)
      
      const startTime = new Date(sessionDate)
      startTime.setHours(parseInt(startHour), parseInt(startMinute), 0)
      
      const endTime = new Date(sessionDate)
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0)
      
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading room details...</p>
        </div>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Room Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'The requested room could not be found.'}</p>
          <button
            onClick={() => navigate(`/session/${sessionId}/view`)}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-200"
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
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'active':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
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
      border: 'border-gray-500',
      dot: 'bg-gray-500'
    };
  }


  // Filter invalidations for this room
  const roomInvalidations = invalidatedTests.filter(inv => inv.roomId === room._id)

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
            if (acc.includes('1.5x time') || acc.includes('2x time') || 
                acc.includes('1.5x') || acc.includes('2x') ||
                acc.includes('1.5× Time') || acc.includes('2× Time') ||
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
              if (acc.includes('2x time') || acc.includes('2x') || acc.includes('2× Time') || acc.includes('2×') || acc.includes('double time')) {
                maxMultiplier = Math.max(maxMultiplier, 2)
              } 
              // Check for 1.5x time accommodations (various formats)
              else if (acc.includes('1.5x time') || acc.includes('1.5x') || acc.includes('1.5× Time') || acc.includes('1.5×') || acc.includes('extended time')) {
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/session/${sessionId}/view`)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition duration-200"
                title="Back to session"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{room.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {session?.name} • Room Details
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Time Remaining */}
              {timeRemaining && roomTimeRemaining && (
                <div className={`px-3 py-2 rounded-lg border ${roomTimeRemaining.isOver ? 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700' : 'bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-700'}`}>
                  <div className="flex flex-col items-center">
                    <span className={`text-lg font-bold ${roomTimeRemaining.isOver ? 'text-red-600' : 'text-orange-600'}`}>
                      {roomTimeRemaining.isOver ? 'TIME UP' : `${String(roomTimeRemaining.hours).padStart(2, '0')}:${String(roomTimeRemaining.minutes).padStart(2, '0')}:${String(roomTimeRemaining.seconds).padStart(2, '0')}`}
                    </span>
                    {roomTimeRemaining.multiplier > 1 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({roomTimeRemaining.multiplier}x time)
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(room.status)}`}>
                {getStatusText(room.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Room Information */}
          <div className="space-y-6">
            {/* Sections */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Sections</h2>
              {room.sections && room.sections.length > 0 ? (
                <div className="space-y-4">
                  {room.sections
                    .sort((a, b) => a.number - b.number)
                    .map((section) => (
                      <div key={section._id} className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-lg font-medium text-gray-900 dark:text-white">
                            Section {section.number}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {section.studentCount} students
                          </span>
                        </div>
                        {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                          <div className="mt-2">
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Accommodations:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {section.accommodations.map((acc, index) => (
                                <span key={index} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs rounded">
                                  {acc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {section.notes && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            <span className="font-medium">Notes:</span> {section.notes}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No sections assigned to this room</p>
              )}
            </div>

            {/* Room Notes */}
            {room.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <span className="mr-2">📝</span>
                  Room Notes
                </h2>
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {room.notes}
                  </p>
                </div>
              </div>
            )}

            {/* Supplies */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Supplies</h2>
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
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Initial Supplies</h3>
                          <div className="space-y-2">
                            {Object.entries(initialSupplyCounts).map(([supplyName, count], index) => (
                              <div key={`initial-${index}`} className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                                <span className="text-sm text-green-700 dark:text-green-300">
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
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Added Supplies</h3>
                          <div className="space-y-2">
                            {Object.entries(addedSupplyCounts).map(([supplyName, count], index) => (
                              <div key={`added-${index}`} className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                                <span className="text-sm text-blue-700 dark:text-blue-300">
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
                <p className="text-gray-500 dark:text-gray-400">No supplies added to this room</p>
              )}
            </div>

            {/* Invalidated Tests */}
            {roomInvalidations.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-4 flex items-center">
                  <span className="mr-2">⚠</span>
                  Invalidated Tests ({roomInvalidations.length})
                </h2>
                <div className="space-y-3">
                  {roomInvalidations.map((invalidation) => (
                    <div key={invalidation.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Section {invalidation.sectionNumber}
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {invalidation.notes}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-red-500 dark:text-red-400">
                            {formatTimestamp(invalidation.timestamp)}
                          </p>
                          <p className="text-xs text-red-500 dark:text-red-400">
                            by {invalidation.invalidatedBy}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Activity Log */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h2>
            {activityLog.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No activity recorded yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Actions will appear here as they happen</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3">
                {activityLog
                  .filter(log => log.roomName === room.name)
                  .map((log, index) => {
                    const colors = getActivityLogColors(log.action);
                    return (
                    <div key={index} className={`flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 ${colors.border}`}>
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
        </div>
      </div>
    </div>
  )
}

export default memo(RoomDetail)
