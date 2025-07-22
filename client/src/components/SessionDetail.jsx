import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { testingAPI } from '../services/api'

function SessionDetail({ onBack }) {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddRoomModal, setShowAddRoomModal] = useState(false)
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [showAddSectionToRoomModal, setShowAddSectionToRoomModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newSectionNumber, setNewSectionNumber] = useState('')
  const [newSectionStudentCount, setNewSectionStudentCount] = useState('1')
  const [selectedRoomForSection, setSelectedRoomForSection] = useState(null)
  const [availableSections, setAvailableSections] = useState([])
  const [selectedSectionsForRoom, setSelectedSectionsForRoom] = useState([])
  const [editingRoom, setEditingRoom] = useState(null)
  const [editRoomName, setEditRoomName] = useState('')
  const [editingSection, setEditingSection] = useState(null)
  const [editSectionNumber, setEditSectionNumber] = useState('')
  const [editSectionStudentCount, setEditSectionStudentCount] = useState('')
  const [sessionUpdates, setSessionUpdates] = useState({
    name: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    status: ''
  })
  // Add state for selected sections and rooms
  const [selectedSectionIds, setSelectedSectionIds] = useState([])
  const [selectedRoomIds, setSelectedRoomIds] = useState([])
  const [roomSortDescending, setRoomSortDescending] = useState(false)
  const [sectionSortDescending, setSectionSortDescending] = useState(false)
  // Add state for accommodations
  const ACCOMMODATIONS = [
    '1.5× Time',
    '2× Time',
    'Unlimited Time',
    'Next-Day Completion (if two exams same day)',
    'Separate Location',
    'Test Read Aloud (Full Exam)',
    'Large Print / Braille',
    'Scribe / Speech-to-Text',
    'Use of Computer / Assistive Technology',
    'Breaks Not Counted Against Time',
    'Translated Exam (Written Version): Chinese',
    'Translated Exam (Written Version): Haitian Creole',
    'Translated Exam (Written Version): Korean',
    'Translated Exam (Written Version): Russian',
    'Translated Exam (Written Version): Spanish',
    'Oral Translation (e.g., Ukrainian, other languages)',
    'Bilingual Glossary (Word-to-Word Translation)',
    'Answer in Native Language (Short/Essay Responses)'
  ];
  const [selectedAccommodations, setSelectedAccommodations] = useState([])
  // Add state for notes
  const [newSectionNotes, setNewSectionNotes] = useState('')
  // Add state for editing accommodations and notes
  const [editSectionAccommodations, setEditSectionAccommodations] = useState([])
  const [editSectionNotes, setEditSectionNotes] = useState('')

  useEffect(() => {
    fetchSessionData()
  }, [sessionId])

  const fetchSessionData = async () => {
    try {
      setIsLoading(true)
      const sessionData = await testingAPI.getSession(sessionId)
      
      console.log('Session data received:', sessionData.session)
      console.log('Rooms with sections:', sessionData.session.rooms?.map(room => ({
        name: room.name,
        sections: room.sections?.map(section => ({
          number: section.number,
          studentCount: section.studentCount,
          accommodations: section.accommodations,
          notes: section.notes
        }))
      })))
      
      setSession(sessionData.session)
      
      // Pre-fill update form
      setSessionUpdates({
        name: sessionData.session.name,
        description: sessionData.session.description || '',
        date: sessionData.session.date.split('T')[0],
        startTime: sessionData.session.startTime,
        endTime: sessionData.session.endTime,
        status: sessionData.session.status
      })
    } catch (error) {
      console.error('Error fetching session data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return
    
    try {
      // Create a new room with selected sections
      const roomResponse = await testingAPI.createRoomWithSections({
        name: newRoomName.trim(),
        supplies: [],
        sectionIds: selectedSectionsForRoom
      })
      
      // Add the new room to the session
      await testingAPI.addRoomToSession(sessionId, roomResponse.room._id)
      
      setShowAddRoomModal(false)
      setNewRoomName('')
      setSelectedSectionsForRoom([])
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error adding room to session:', error)
    }
  }

  const handleAddSection = async () => {
    if (!newSectionNumber.trim() || !newSectionStudentCount.trim()) return
    const input = newSectionNumber.trim()
    let numbers = []
    if (/^\d+$/.test(input)) {
      // Single number
      numbers = [parseInt(input)]
    } else if (/^(\d+)-(\d+)$/.test(input)) {
      // Range
      const [, start, end] = input.match(/(\d+)-(\d+)/)
      const s = parseInt(start)
      const e = parseInt(end)
      if (s > e) {
        alert('Start of range must be less than or equal to end.')
        return
      }
      numbers = Array.from({length: e - s + 1}, (_, i) => s + i)
    } else {
      alert('Please enter a valid section number or range (e.g., 25 or 20-30).')
      return
    }
    // Validate all numbers
    if (numbers.some(n => isNaN(n) || n < 1 || n > 99)) {
      alert('All section numbers must be between 1 and 99.')
      return
    }
    const studentCount = parseInt(newSectionStudentCount)
    if (isNaN(studentCount) || studentCount < 1) {
      alert('Student count must be at least 1')
      return
    }
    try {
      console.log('Creating sections with accommodations:', selectedAccommodations)
      for (const sectionNum of numbers) {
        const sectionData = {
          number: sectionNum,
          studentCount: studentCount,
          accommodations: selectedAccommodations,
          notes: newSectionNotes.trim()
        }
        console.log('Creating section with data:', sectionData)
        const sectionResponse = await testingAPI.createSection(sectionData)
        console.log('Section created:', sectionResponse)
        await testingAPI.addSectionToSession(sessionId, sectionResponse.section._id)
      }
      setShowAddSectionModal(false)
      setNewSectionNumber('')
      setNewSectionStudentCount('1')
      setSelectedAccommodations([])
      setNewSectionNotes('')
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error adding section(s) to session:', error)
      alert('Error adding section(s) to session. Some sections may have been created.')
    }
  }

  const handleAddSectionToRoom = async () => {
    if (!selectedRoomForSection || !availableSections.length) return
    
    try {
      await testingAPI.addSectionToRoom(selectedRoomForSection._id, availableSections[0]._id)
      setShowAddSectionToRoomModal(false)
      setSelectedRoomForSection(null)
      setAvailableSections([])
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error adding section to room:', error)
    }
  }

  const handleRemoveRoom = async (roomId) => {
    if (window.confirm('Are you sure you want to remove this room from the session?')) {
      try {
        await testingAPI.removeRoomFromSession(sessionId, roomId)
        fetchSessionData() // Refresh data
      } catch (error) {
        console.error('Error removing room from session:', error)
      }
    }
  }

  const handleRemoveSection = async (sectionId) => {
    if (window.confirm('Are you sure you want to remove this section from the session?')) {
      try {
        await testingAPI.removeSectionFromSession(sessionId, sectionId)
        fetchSessionData() // Refresh data
      } catch (error) {
        console.error('Error removing section from session:', error)
      }
    }
  }

  const handleRemoveSectionFromRoom = async (roomId, sectionId) => {
    if (window.confirm('Are you sure you want to remove this section from the room?')) {
      try {
        await testingAPI.removeSectionFromRoom(roomId, sectionId)
        fetchSessionData() // Refresh data
      } catch (error) {
        console.error('Error removing section from room:', error)
      }
    }
  }

  const handleStartEditRoom = (room) => {
    setEditingRoom(room._id)
    setEditRoomName(room.name)
  }

  const handleSaveRoomName = async () => {
    if (!editRoomName.trim()) return
    
    try {
      await testingAPI.updateRoom(editingRoom, { name: editRoomName.trim() })
      setEditingRoom(null)
      setEditRoomName('')
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error updating room:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingRoom(null)
    setEditRoomName('')
  }

  const handleStartEditSection = (section) => {
    setEditingSection(section._id)
    setEditSectionNumber(section.number.toString())
    setEditSectionStudentCount(section.studentCount.toString())
    setEditSectionAccommodations(Array.isArray(section.accommodations) ? section.accommodations : [])
    setEditSectionNotes(section.notes || '')
  }

  const handleSaveSectionNumber = async () => {
    if (!editSectionNumber.trim() || !editSectionStudentCount.trim()) return
    const sectionNum = parseInt(editSectionNumber)
    const studentCount = parseInt(editSectionStudentCount)
    if (isNaN(sectionNum) || sectionNum < 1 || sectionNum > 99) {
      alert('Section number must be between 1 and 99')
      return
    }
    if (isNaN(studentCount) || studentCount < 1) {
      alert('Student count must be at least 1')
      return
    }
    try {
      await testingAPI.updateSection(editingSection, {
        number: sectionNum,
        studentCount: studentCount,
        accommodations: editSectionAccommodations,
        notes: editSectionNotes.trim(),
      })
      setEditingSection(null)
      setEditSectionNumber('')
      setEditSectionStudentCount('')
      setEditSectionAccommodations([])
      setEditSectionNotes('')
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error updating section:', error)
    }
  }

  const handleCancelEditSection = () => {
    setEditingSection(null)
    setEditSectionNumber('')
    setEditSectionStudentCount('')
    setEditSectionAccommodations([])
    setEditSectionNotes('')
  }

  const handleOpenAddSectionToRoom = (room) => {
    setSelectedRoomForSection(room)
    // Get available sections (sections in session but not assigned to any room)
    const allAssignedSectionIds = session.rooms?.flatMap(r => r.sections?.map(s => s._id) || []) || []
    const availableSections = session.sections?.filter(s => !allAssignedSectionIds.includes(s._id)) || []
    setAvailableSections(availableSections)
    setShowAddSectionToRoomModal(true)
  }

  const calculateTotalStudents = (sections) => {
    return sections?.reduce((total, section) => total + (section.studentCount || 0), 0) || 0
  }



  const handleUpdateSession = async (e) => {
    e.preventDefault()
    try {
      await testingAPI.updateSession(sessionId, sessionUpdates)
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error updating session:', error)
    }
  }

  // Batch delete handlers
  const handleDeleteSelectedSections = async () => {
    if (selectedSectionIds.length === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedSectionIds.length} section(s)? This cannot be undone.`)) return
    try {
      for (const sectionId of selectedSectionIds) {
        await testingAPI.removeSectionFromSession(sessionId, sectionId)
      }
      setSelectedSectionIds([])
      fetchSessionData()
    } catch {
      alert('Error deleting selected sections.')
    }
  }
  const handleDeleteSelectedRooms = async () => {
    if (selectedRoomIds.length === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedRoomIds.length} room(s)? This cannot be undone.`)) return
    try {
      for (const roomId of selectedRoomIds) {
        await testingAPI.removeRoomFromSession(sessionId, roomId)
      }
      setSelectedRoomIds([])
      fetchSessionData()
    } catch {
      alert('Error deleting selected rooms.')
    }
  }


  const getStatusColor = (status) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800'
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Helper to extract room number and name for sorting
  const getRoomSortKey = (roomName) => {
    const match = roomName.match(/(\d+)([A-Za-z]*)/)
    if (match) {
      const number = parseInt(match[1])
      const letter = match[2] || ''
      return { number, letter, full: roomName }
    }
    return { number: 999, letter: '', full: roomName }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h2>
          <p className="text-gray-600 mb-6">The session you're looking for doesn't exist or you don't have permission to view it.</p>
          <button
            onClick={onBack}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800 transition duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{session.name}</h1>
                <p className="text-gray-600">Session Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(session.status)}`}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Session Information */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Session Information</h2>
              
              <form onSubmit={handleUpdateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={sessionUpdates.name}
                    onChange={(e) => setSessionUpdates({...sessionUpdates, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={sessionUpdates.description}
                    onChange={(e) => setSessionUpdates({...sessionUpdates, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={sessionUpdates.date}
                    onChange={(e) => setSessionUpdates({...sessionUpdates, date: e.target.value})}
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
                      value={sessionUpdates.startTime}
                      onChange={(e) => setSessionUpdates({...sessionUpdates, startTime: e.target.value})}
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
                      value={sessionUpdates.endTime}
                      onChange={(e) => setSessionUpdates({...sessionUpdates, endTime: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={sessionUpdates.status}
                    onChange={(e) => setSessionUpdates({...sessionUpdates, status: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Update Session
                </button>
              </form>
            </div>
          </div>

          {/* Rooms Management */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Session Rooms</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteSelectedRooms}
                    disabled={selectedRoomIds.length === 0}
                    className={`bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 ${selectedRoomIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setShowAddRoomModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Room
                  </button>
                </div>
              </div>
              {/* Room Sort Button */}
              <div className="mb-4">
                <button
                  onClick={() => setRoomSortDescending(v => !v)}
                  className="px-2 py-1 text-xs font-medium rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  Sort: {roomSortDescending ? '↓' : '↑'}
                </button>
              </div>

              {session.rooms && session.rooms.length > 0 ? (
                <div className="space-y-4">
                  {[...session.rooms].sort((a, b) => {
                    const aKey = getRoomSortKey(a.name)
                    const bKey = getRoomSortKey(b.name)
                    // If both have numbers, sort by number first, then by letter
                    if (aKey.number !== 999 && bKey.number !== 999) {
                      if (aKey.number !== bKey.number) {
                        return roomSortDescending ? bKey.number - aKey.number : aKey.number - bKey.number
                      }
                      // Same number, sort by letter
                      return roomSortDescending ? bKey.letter.localeCompare(aKey.letter) : aKey.letter.localeCompare(bKey.letter)
                    }
                    // If one has number and other doesn't, numbers come first
                    if (aKey.number !== 999 && bKey.number === 999) return -1
                    if (aKey.number === 999 && bKey.number !== 999) return 1
                    // If neither has numbers, sort alphabetically
                    return roomSortDescending ? bKey.full.localeCompare(aKey.full) : aKey.full.localeCompare(bKey.full)
                  }).map((room) => (
                    <div key={room._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={selectedRoomIds.includes(room._id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedRoomIds([...selectedRoomIds, room._id])
                            } else {
                              setSelectedRoomIds(selectedRoomIds.filter(id => id !== room._id))
                            }
                          }}
                          className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <span className="text-xs text-gray-500">Select</span>
                      </div>
                      <div className="flex justify-between items-start mb-3">
                        {editingRoom === room._id ? (
                          <div className="flex-1 mr-3">
                            <input
                              type="text"
                              value={editRoomName}
                              onChange={(e) => setEditRoomName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <h3 className="font-semibold text-gray-900 flex-1">Room {room.name}</h3>
                        )}
                        
                        <div className="flex space-x-2">
                          {editingRoom === room._id ? (
                            <>
                              <button
                                onClick={handleSaveRoomName}
                                className="text-green-500 hover:text-green-700 transition duration-200"
                                title="Save"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-gray-500 hover:text-gray-700 transition duration-200"
                                title="Cancel"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEditRoom(room)}
                                className="text-blue-500 hover:text-blue-700 transition duration-200"
                                title="Edit Room Name"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleOpenAddSectionToRoom(room)}
                                className="text-purple-500 hover:text-purple-700 transition duration-200"
                                title="Add Section to Room"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRemoveRoom(room._id)}
                                className="text-red-500 hover:text-red-700 transition duration-200"
                                title="Remove Room"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            {room.sections?.length || 0} sections • {calculateTotalStudents(room.sections)} students
                          </span>
                        </div>
                        
                        {room.sections && room.sections.length > 0 && (
                          <div>
                            <span className="font-medium">Sections:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                                             {room.sections.map((section) => (
                                 <div key={section._id} className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                   <span>Section {section.number}</span>
                                   <span className="text-blue-600">({section.studentCount})</span>
                                   {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                                     <span className="text-purple-600 ml-1">• {section.accommodations.join(', ')}</span>
                                   )}
                                   {section.notes && (
                                     <span className="text-blue-600 ml-1">• {section.notes}</span>
                                   )}
                                   <button
                                     onClick={() => handleRemoveSectionFromRoom(room._id, section._id)}
                                     className="text-red-500 hover:text-red-700 ml-1"
                                     title="Remove Section"
                                   >
                                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                     </svg>
                                   </button>
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}
                        

                        
                        {room.supplies && room.supplies.length > 0 && (
                          <div>
                            <span className="font-medium">Supplies:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {room.supplies.map((supply, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {supply}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rooms Added</h3>
                  <p className="text-gray-600 mb-4">Add rooms to this session</p>
                  <button
                    onClick={() => setShowAddRoomModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                  >
                    Add First Room
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sections Management */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Session Sections</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteSelectedSections}
                    disabled={selectedSectionIds.length === 0}
                    className={`bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 ${selectedSectionIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setShowAddSectionModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Section
                  </button>
                </div>
              </div>
              {/* Section Sort Button */}
              <div className="mb-4">
                <button
                  onClick={() => setSectionSortDescending(v => !v)}
                  className="px-2 py-1 text-xs font-medium rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  Sort: {sectionSortDescending ? '↓' : '↑'}
                </button>
              </div>

              {session.sections && session.sections.length > 0 ? (
                <div className="space-y-4">
                  {[...session.sections].sort((a, b) => sectionSortDescending ? b.number - a.number : a.number - b.number).map((section) => (
                    <div key={section._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={selectedSectionIds.includes(section._id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedSectionIds([...selectedSectionIds, section._id])
                            } else {
                              setSelectedSectionIds(selectedSectionIds.filter(id => id !== section._id))
                            }
                          }}
                          className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <span className="text-xs text-gray-500">Select</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {editingSection === section._id ? (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Section Number
                                </label>
                                <input
                                  type="number"
                                  value={editSectionNumber}
                                  onChange={(e) => setEditSectionNumber(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                  min="1"
                                  max="99"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Student Count
                                </label>
                                <input
                                  type="number"
                                  value={editSectionStudentCount}
                                  onChange={(e) => setEditSectionStudentCount(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                  min="1"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Accommodations
                                </label>
                                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded p-2">
                                  {ACCOMMODATIONS.map(option => (
                                    <label key={option} className="flex items-center space-x-2 py-1">
                                      <input
                                        type="checkbox"
                                        checked={editSectionAccommodations.includes(option)}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setEditSectionAccommodations([...editSectionAccommodations, option])
                                          } else {
                                            setEditSectionAccommodations(editSectionAccommodations.filter(a => a !== option))
                                          }
                                        }}
                                        className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                      />
                                      <span className="text-xs text-gray-900">{option}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Notes
                                </label>
                                <textarea
                                  value={editSectionNotes}
                                  onChange={(e) => setEditSectionNotes(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                  rows="2"
                                  placeholder="Add notes (optional)"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-semibold text-gray-900">Section {section.number}</h3>
                              <p className="text-sm text-gray-600">{section.studentCount} students</p>
                              {Array.isArray(section.accommodations) && section.accommodations.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs font-medium text-purple-700">Accommodations:</span>
                                  <ul className="list-disc list-inside text-xs text-gray-700 mt-1">
                                    {section.accommodations.map(acc => (
                                      <li key={acc}>{acc}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {section.notes && (
                                <div className="text-xs text-gray-500 mt-1">
                                  <span className="font-medium">Notes:</span> {section.notes}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {editingSection === section._id ? (
                            <>
                              <button
                                onClick={handleSaveSectionNumber}
                                className="text-green-500 hover:text-green-700 transition duration-200"
                                title="Save"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={handleCancelEditSection}
                                className="text-gray-500 hover:text-gray-700 transition duration-200"
                                title="Cancel"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEditSection(section)}
                                className="text-purple-500 hover:text-purple-700 transition duration-200"
                                title="Edit Section"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRemoveSection(section._id)}
                                className="text-red-500 hover:text-red-700 transition duration-200"
                                title="Remove Section"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sections Added</h3>
                  <p className="text-gray-600 mb-4">Add numbered sections to this session</p>
                  <button
                    onClick={() => setShowAddSectionModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                  >
                    Add First Section
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Room</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter room name"
                  autoFocus
                />
              </div>
              
              {session.sections && session.sections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Sections (Optional)
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {session.sections
                      .filter(section => {
                        // Filter out sections that are already assigned to other rooms
                        const isAssignedToOtherRoom = session.rooms?.some(room => 
                          room.sections?.some(roomSection => roomSection._id === section._id)
                        );
                        return !isAssignedToOtherRoom;
                      })
                      .map((section) => (
                        <label key={section._id} className="flex items-center space-x-3 py-2 hover:bg-gray-50 rounded px-2">
                          <input
                            type="checkbox"
                            checked={selectedSectionsForRoom.includes(section._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSectionsForRoom([...selectedSectionsForRoom, section._id])
                              } else {
                                setSelectedSectionsForRoom(selectedSectionsForRoom.filter(id => id !== section._id))
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="text-sm text-gray-900">
                            <div>Section {section.number} ({section.studentCount} students)</div>
                            {section.description && (
                              <div className="text-xs text-gray-500 mt-1">{section.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                  {selectedSectionsForRoom.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: {selectedSectionsForRoom.length} section(s)
                    </p>
                  )}
                  {session.sections.filter(section => {
                    const isAssignedToOtherRoom = session.rooms?.some(room => 
                      room.sections?.some(roomSection => roomSection._id === section._id)
                    );
                    return isAssignedToOtherRoom;
                  }).length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Some sections are already assigned to other rooms and cannot be selected.
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddRoomModal(false)
                    setNewRoomName('')
                    setSelectedSectionsForRoom([])
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Section</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section Number(s) (1-99 or 20-30)
                </label>
                <input
                  type="text"
                  value={newSectionNumber}
                  onChange={(e) => setNewSectionNumber(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g. 25 or 20-30"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Students
                </label>
                <input
                  type="number"
                  min="1"
                  value={newSectionStudentCount}
                  onChange={(e) => setNewSectionStudentCount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter number of students"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accommodations (Select all that apply)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {ACCOMMODATIONS.map(option => (
                    <label key={option} className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedAccommodations.includes(option)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedAccommodations([...selectedAccommodations, option])
                          } else {
                            setSelectedAccommodations(selectedAccommodations.filter(a => a !== option))
                          }
                        }}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-900">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newSectionNotes}
                  onChange={e => setNewSectionNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Add any notes for this section (optional)"
                  rows="2"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddSectionModal(false)
                    setNewSectionNumber('')
                    setNewSectionStudentCount('1')
                    setSelectedAccommodations([])
                    setNewSectionNotes('')
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSection}
                  disabled={!newSectionNumber.trim() || !newSectionStudentCount.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Section(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Section to Room Modal */}
      {showAddSectionToRoomModal && selectedRoomForSection && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Section to Room</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room: {selectedRoomForSection.name}
                </label>
                {availableSections.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Section
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                                             {availableSections.map(section => (
                         <option key={section._id} value={section._id}>
                           Section {section.number} ({section.studentCount} students) {section.description ? `- ${section.description}` : ''}
                         </option>
                       ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-gray-600">No available sections to add to this room.</p>
                )}
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddSectionToRoomModal(false)
                    setSelectedRoomForSection(null)
                    setAvailableSections([])
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSectionToRoom}
                  disabled={availableSections.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Section
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionDetail 