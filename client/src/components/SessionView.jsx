import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { testingAPI } from '../services/api'

function SessionView({ onBack }) {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [showAddSupplyModal, setShowAddSupplyModal] = useState(false)
  const [showMoveStudentsModal, setShowMoveStudentsModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [newSupply, setNewSupply] = useState('')
  const [moveFromRoom, setMoveFromRoom] = useState(null)
  const [moveToRoom, setMoveToRoom] = useState(null)
  const [selectedSections, setSelectedSections] = useState([])
  const [sortDescending, setSortDescending] = useState(false)

  useEffect(() => {
    fetchSessionData()
  }, [sessionId])

  useEffect(() => {
    if (session) {
      const timer = setInterval(() => {
        updateTimeRemaining()
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [session])

  const fetchSessionData = async () => {
    try {
      setIsLoading(true)
      const sessionData = await testingAPI.getSession(sessionId)
      setSession(sessionData.session)
    } catch (error) {
      console.error('Error fetching session data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateTimeRemaining = () => {
    if (!session) return

    const now = new Date()
    const sessionDate = new Date(session.date)
    const [endHour, endMinute] = session.endTime.split(':')
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
  }

  const calculateProgress = () => {
    if (!session || !session.rooms) return 0
    
    const totalRooms = session.rooms.length
    if (totalRooms === 0) return 0
    
    const completedRooms = session.rooms.filter(room => room.status === 'completed').length
    return Math.round((completedRooms / totalRooms) * 100)
  }

  const handleMarkRoomComplete = async (roomId) => {
    try {
      console.log('Marking room complete:', roomId)
      const response = await testingAPI.updateRoomStatus(roomId, 'completed')
      console.log('Room status update response:', response)
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === roomId 
            ? { ...room, status: 'completed' }
            : room
        )
      }))
    } catch (error) {
      console.error('Error marking room complete:', error)
    }
  }

  const handleMarkRoomIncomplete = async (roomId) => {
    try {
      await testingAPI.updateRoomStatus(roomId, 'active')
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === roomId 
            ? { ...room, status: 'active' }
            : room
        )
      }))
    } catch (error) {
      console.error('Error marking room incomplete:', error)
    }
  }

  const handleAddSupply = async () => {
    if (!newSupply.trim() || !selectedRoom) return
    
    try {
      const currentSupplies = selectedRoom.supplies || []
      const updatedSupplies = [...currentSupplies, newSupply.trim()]
      
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
      
      setShowAddSupplyModal(false)
      setNewSupply('')
      setSelectedRoom(null)
    } catch (error) {
      console.error('Error adding supply:', error)
    }
  }

  const handleRemoveSupply = async (roomId, supply) => {
    try {
      const room = session.rooms.find(r => r._id === roomId)
      const updatedSupplies = room.supplies.filter(s => s !== supply)
      
      await testingAPI.updateRoom(roomId, { supplies: updatedSupplies })
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => 
          room._id === roomId 
            ? { ...room, supplies: updatedSupplies }
            : room
        )
      }))
    } catch (error) {
      console.error('Error removing supply:', error)
    }
  }

  const handleMoveStudents = async () => {
    if (!moveFromRoom || !moveToRoom || selectedSections.length === 0) return
    
    try {
      // Remove sections from source room
      for (const sectionId of selectedSections) {
        await testingAPI.removeSectionFromRoom(moveFromRoom._id, sectionId)
      }
      
      // Add sections to destination room
      for (const sectionId of selectedSections) {
        await testingAPI.addSectionToRoom(moveToRoom._id, sectionId)
      }
      
      // Update local state immediately
      setSession(prevSession => ({
        ...prevSession,
        rooms: prevSession.rooms.map(room => {
          if (room._id === moveFromRoom._id) {
            return {
              ...room,
              sections: room.sections.filter(section => !selectedSections.includes(section._id))
            }
          } else if (room._id === moveToRoom._id) {
            // Find the sections that were moved
            const movedSections = moveFromRoom.sections.filter(section => 
              selectedSections.includes(section._id)
            )
            return {
              ...room,
              sections: [...room.sections, ...movedSections]
            }
          }
          return room
        })
      }))
      
      setShowMoveStudentsModal(false)
      setMoveFromRoom(null)
      setMoveToRoom(null)
      setSelectedSections([])
    } catch (error) {
      console.error('Error moving students:', error)
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return ''
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'active': return 'bg-blue-500'
      case 'planned': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed'
      case 'active': return 'In Progress'
      case 'planned': return 'Planned'
      default: return 'Unknown'
    }
  }

  const calculateTotalStudents = (sections) => {
    if (!sections || sections.length === 0) return 0
    return sections.reduce((total, section) => total + (section.studentCount || 0), 0)
  }

  const extractRoomNumber = (roomName) => {
    const match = roomName.match(/\d+/)
    return match ? parseInt(match[0]) : 999 // Put rooms without numbers at the end
  }

  const getRoomSortKey = (roomName) => {
    const match = roomName.match(/(\d+)([A-Za-z]*)/)
    if (match) {
      const number = parseInt(match[1])
      const letter = match[2] || ''
      return { number, letter, full: roomName }
    }
    return { number: 999, letter: '', full: roomName }
  }

  const getSortedRooms = () => {
    if (!session || !session.rooms) return []
    
    return [...session.rooms].sort((a, b) => {
      const aKey = getRoomSortKey(a.name)
      const bKey = getRoomSortKey(b.name)
      
      // If both have numbers, sort by number first, then by letter
      if (aKey.number !== 999 && bKey.number !== 999) {
        if (aKey.number !== bKey.number) {
          return sortDescending ? bKey.number - aKey.number : aKey.number - bKey.number
        }
        // Same number, sort by letter
        return sortDescending ? bKey.letter.localeCompare(aKey.letter) : aKey.letter.localeCompare(bKey.letter)
      }
      
      // If one has number and other doesn't, numbers come first
      if (aKey.number !== 999 && bKey.number === 999) return -1
      if (aKey.number === 999 && bKey.number !== 999) return 1
      
      // If neither has numbers, sort alphabetically
      return sortDescending ? bKey.full.localeCompare(aKey.full) : aKey.full.localeCompare(bKey.full)
    })
  }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{session.name}</h1>
              <p className="text-gray-600">Session Progress View</p>
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
        {/* Session Info and Timer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Session Details */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Session Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{new Date(session.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Time</p>
                <p className="font-medium">{formatTime(session.startTime)} - {formatTime(session.endTime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(session.status)}`}>
                  {getStatusText(session.status)}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Rooms</p>
                <p className="font-medium">{session.rooms?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Time Remaining</h2>
            {timeRemaining ? (
              <div className="text-center">
                {timeRemaining.isOver ? (
                  <div className="text-red-600 font-bold text-2xl">EXAM ENDED</div>
                ) : (
                  <div className="text-3xl font-bold text-blue-600">
                    {String(timeRemaining.hours).padStart(2, '0')}:{String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-2">Until exam ends</p>
              </div>
            ) : (
              <div className="text-center text-gray-500">Loading timer...</div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-2xl font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {session.rooms?.filter(room => room.status === 'completed').length || 0} of {session.rooms?.length || 0} rooms completed
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setSortDescending(!sortDescending)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition duration-200 ${
              sortDescending
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {sortDescending ? '↓' : '↑'} {sortDescending ? 'Highest to Lowest' : 'Lowest to Highest'}
          </button>
        </div>

        {/* Rooms Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {getSortedRooms().map((room) => (
            <div key={room._id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(room.status)}`}>
                  {getStatusText(room.status)}
                </span>
              </div>

              {/* Room Actions */}
              <div className="space-y-3 mb-4">
                {room.status === 'completed' ? (
                  <button
                    onClick={() => handleMarkRoomIncomplete(room._id)}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                  >
                    Mark Incomplete
                  </button>
                ) : (
                  <button
                    onClick={() => handleMarkRoomComplete(room._id)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                  >
                    Mark Complete
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedRoom(room)
                    setShowAddSupplyModal(true)
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Add Supply
                </button>

                <button
                  onClick={() => {
                    setMoveFromRoom(room)
                    setShowMoveStudentsModal(true)
                  }}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Move Students
                </button>
              </div>

              {/* Supplies */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Supplies</h4>
                {room.supplies && room.supplies.length > 0 ? (
                  <div className="space-y-1">
                    {room.supplies.map((supply, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg">
                        <span className="text-sm text-gray-700">{supply}</span>
                        <button
                          onClick={() => handleRemoveSupply(room._id, supply)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No supplies added</p>
                )}
              </div>

              {/* Sections */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Sections</h4>
                {room.sections && room.sections.length > 0 ? (
                  <div className="space-y-2">
                    {room.sections
                      .sort((a, b) => a.number - b.number)
                      .map((section) => (
                      <div key={section._id} className="bg-blue-50 px-3 py-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Section {section.number} ({section.studentCount} students)
                          </span>
                        </div>
                        {section.description && (
                          <div className="text-xs text-gray-600 mt-1">
                            {section.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No sections assigned</p>
                )}
              </div>

              {/* Total Students */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Students:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {calculateTotalStudents(room.sections)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Supply Modal */}
      {showAddSupplyModal && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Supply to {selectedRoom.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supply Name
                </label>
                <input
                  type="text"
                  value={newSupply}
                  onChange={(e) => setNewSupply(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter supply name"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddSupplyModal(false)
                    setNewSupply('')
                    setSelectedRoom(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSupply}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Add Supply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Students Modal */}
      {showMoveStudentsModal && moveFromRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Move Students</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Room
                </label>
                <div className="px-4 py-3 bg-gray-100 rounded-lg">
                  {moveFromRoom.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Room
                </label>
                <select
                  value={moveToRoom?._id || ''}
                  onChange={(e) => {
                    const room = session.rooms.find(r => r._id === e.target.value)
                    setMoveToRoom(room)
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select destination room</option>
                  {session.rooms
                    .filter(room => room._id !== moveFromRoom._id)
                    .map(room => (
                      <option key={room._id} value={room._id}>
                        {room.name}
                      </option>
                    ))}
                </select>
              </div>

              {moveFromRoom.sections && moveFromRoom.sections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Sections to Move
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {moveFromRoom.sections
                      .sort((a, b) => a.number - b.number)
                      .map((section) => (
                      <label key={section._id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSections.includes(section._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSections([...selectedSections, section._id])
                            } else {
                              setSelectedSections(selectedSections.filter(id => id !== section._id))
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-gray-700">
                            Section {section.number} ({section.studentCount} students)
                          </div>
                          {section.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {section.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowMoveStudentsModal(false)
                    setMoveFromRoom(null)
                    setMoveToRoom(null)
                    setSelectedSections([])
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveStudents}
                  disabled={!moveToRoom || selectedSections.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Move Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionView 