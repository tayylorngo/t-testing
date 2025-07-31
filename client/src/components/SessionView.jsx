import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { testingAPI } from '../services/api'
import confetti from 'canvas-confetti'

function SessionView({ onBack }) {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(null)
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

  // Sort state
  const [sortBy, setSortBy] = useState('roomNumber') // roomNumber, status, studentCount
  const [sortDescending, setSortDescending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTableView, setIsTableView] = useState(true)
  const [expandedRooms, setExpandedRooms] = useState(new Set()) // Track which rooms are expanded
  const [expandedCards, setExpandedCards] = useState(new Set())

  // Preset supplies options
  const PRESET_SUPPLIES = ['Pencils', 'Pens', 'Calculators', 'Protractor/Ruler', 'Compass']

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
      console.log('SessionView - Session data received:', sessionData.session)
      console.log('SessionView - Rooms with sections:', sessionData.session.rooms?.map(room => ({
        name: room.name,
        sections: room.sections?.map(section => ({
          number: section.number,
          studentCount: section.studentCount,
          accommodations: section.accommodations,
          notes: section.notes
        }))
      })))
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
    } catch (error) {
      console.error('Error marking room complete:', error)
    }
  }

  const handleMarkRoomIncomplete = async (roomId) => {
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
    } catch (error) {
      console.error('Error marking room incomplete:', error)
    }
  }

  const handleAddSupply = async () => {
    if (!selectedPresetSupply || !selectedRoom || newSupplyQuantity < 1) return
    
    try {
      const currentSupplies = selectedRoom.supplies || []
      const newSupplyName = selectedPresetSupply
      const newQuantity = newSupplyQuantity
      
      // Check if the supply already exists
      const existingSupplyIndex = currentSupplies.findIndex(supply => {
        const supplyName = supply.split(' (')[0]
        return supplyName === newSupplyName
      })
      
      let updatedSupplies
      if (existingSupplyIndex !== -1) {
        // Supply exists, combine quantities
        const existingSupply = currentSupplies[existingSupplyIndex]
        const existingQuantity = parseInt(existingSupply.match(/\((\d+)\)/)?.[1] || 0)
        const combinedQuantity = existingQuantity + newQuantity
        const combinedSupply = `${newSupplyName} (${combinedQuantity})`
        
        updatedSupplies = [...currentSupplies]
        updatedSupplies[existingSupplyIndex] = combinedSupply
      } else {
        // Supply doesn't exist, add new one
        const supplyWithQuantity = `${newSupplyName} (${newQuantity})`
        updatedSupplies = [...currentSupplies, supplyWithQuantity]
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
      
      setShowAddSupplyModal(false)
      setSelectedPresetSupply('')
      setNewSupplyQuantity(1)
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

  const handleEditSupply = async () => {
    if (!editingSupply || !selectedRoom || editSupplyQuantity < 1) return
    
    try {
      const room = session.rooms.find(r => r._id === selectedRoom._id)
      const updatedSupplies = room.supplies.map(supply => {
        if (supply === editingSupply.original) {
          const supplyName = editingSupply.name
          return `${supplyName} (${editSupplyQuantity})`
        }
        return supply
      })
      
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
    } catch (error) {
      console.error('Error editing supply:', error)
    }
  }

  const handleMoveStudents = async () => {
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
                
                console.log('Creating new section with data:', newSectionData)
                
                // Create the new section
                const newSectionResponse = await testingAPI.createSection(newSectionData)
                console.log('New section created:', newSectionResponse)
                
                // Add the new section to the destination room
                await testingAPI.addSectionToRoom(moveInfo.destinationRoom, newSectionResponse.section._id)
                console.log(`Added section to room ${moveInfo.destinationRoom}`)
              }
              
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
        }
      }
      
      console.log('All moves completed, updating local state...')
      
      // Update local state to reflect the changes
      setSession(prevSession => {
        const updatedSession = { ...prevSession }
        
        // Update rooms based on the moves that were made
        updatedSession.rooms = updatedSession.rooms.map(room => {
          // Check if this room was involved in any moves
          const wasSourceRoom = room._id === moveFromRoom._id
          const wasDestinationRoom = Object.values(studentMoveData).some(moveInfo => 
            moveInfo.destinationRoom === room._id
          )
          
          if (wasSourceRoom || wasDestinationRoom) {
            // This room was involved in moves, we need to update its sections
            const updatedRoom = { ...room }
            
            // For source room: reduce student counts or remove sections
            if (wasSourceRoom) {
              updatedRoom.sections = room.sections.map(section => {
                const moveInfo = studentMoveData[section._id]
                if (moveInfo && moveInfo.studentsToMove > 0) {
                  const newStudentCount = section.studentCount - moveInfo.studentsToMove
                  if (newStudentCount === 0) {
                    return null // Remove this section
                  } else {
                    return { ...section, studentCount: newStudentCount }
                  }
                }
                return section
              }).filter(Boolean) // Remove null sections
            }
            
            // For destination room: add new sections or update existing ones
            if (wasDestinationRoom) {
              // Add new sections that were created
              const newSections = []
              Object.entries(studentMoveData).forEach(([sectionId, moveInfo]) => {
                if (moveInfo.destinationRoom === room._id && moveInfo.studentsToMove > 0) {
                  const sourceSection = moveFromRoom.sections.find(s => s._id === sectionId)
                  if (sourceSection) {
                    // Check if section with same number already exists
                    const existingSection = room.sections.find(s => s.number === sourceSection.number)
                    if (existingSection) {
                      // Update existing section
                      existingSection.studentCount += moveInfo.studentsToMove
                    } else {
                      // Add new section
                      newSections.push({
                        _id: `temp_${Date.now()}_${Math.random()}`, // Temporary ID
                        number: sourceSection.number,
                        studentCount: moveInfo.studentsToMove,
                        accommodations: sourceSection.accommodations || [],
                        notes: sourceSection.notes || ''
                      })
                    }
                  }
                }
              })
              
              updatedRoom.sections = [...room.sections, ...newSections]
            }
            
            return updatedRoom
          }
          
          return room
        })
        
        return updatedSession
      })
      
      setShowMoveStudentsModal(false)
      setMoveFromRoom(null)
      setStudentMoveData({})
      
      console.log('Move students process completed successfully')
    } catch (error) {
      console.error('Error moving students:', error)
      alert('Error moving students. Please try again.')
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
      default: return 'bg-blue-500' // Default to active (in progress)
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed'
      case 'active': return 'In Progress'
      default: return 'In Progress' // Default to active (in progress)
    }
  }

  const calculateTotalStudents = (sections) => {
    if (!sections || sections.length === 0) return 0
    return sections.reduce((total, section) => total + (section.studentCount || 0), 0)
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
    
    let sortedRooms = [...session.rooms]
    
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
  }



  const calculateRoomTimeRemaining = (room) => {
    if (!session || !timeRemaining || timeRemaining.isOver) return null
    
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
  }

  const toggleRoomExpansion = (roomId) => {
    setExpandedRooms(prev => {
      const newSet = new Set(prev)
      if (newSet.has(roomId)) {
        newSet.delete(roomId)
      } else {
        newSet.add(roomId)
      }
      return newSet
    })
  }

  const toggleCardExpansion = (roomId) => {
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
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(session.status)}`}>
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
            <span className="text-2xl font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
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
                    <>
                      <tr 
                        key={room._id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleRoomExpansion(room._id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{room.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(room.status)}`}>
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
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      <tr key={`${room._id}-details`} className="bg-gray-50 dark:bg-gray-700">
                        <td colSpan="7" className="px-0 py-0">
                          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedRooms.has(room._id) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
                                        {room.supplies.map((supply, index) => (
                                          <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-600 px-3 py-2 rounded-lg">
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{supply}</span>
                                            <div className="flex items-center space-x-2">
                                              <button
                                                onClick={() => {
                                                  // Parse supply name and quantity for editing
                                                  const supplyMatch = supply.match(/^(.+?)(?:\s*\((\d+)\))?$/)
                                                  const supplyName = supplyMatch ? supplyMatch[1] : supply
                                                  const quantity = supplyMatch ? parseInt(supplyMatch[2]) || 1 : 1
                                                  
                                                  setEditingSupply({
                                                    original: supply,
                                                    name: supplyName
                                                  })
                                                  setEditSupplyQuantity(quantity)
                                                  setSelectedRoom(room)
                                                  setShowEditSupplyModal(true)
                                                }}
                                                className="text-blue-500 hover:text-blue-700 text-sm"
                                                title="Edit Supply"
                                              >
                                                ✎
                                              </button>
                                              <button
                                                onClick={() => handleRemoveSupply(room._id, supply)}
                                                className="text-red-500 hover:text-red-700 text-sm"
                                                title="Remove Supply"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          </div>
                                        ))}
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
                    </>
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
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{room.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(room.status)}`}>
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
                          {room.supplies.map((supply, index) => (
                            <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{supply}</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Parse supply name and quantity for editing
                                    const supplyMatch = supply.match(/^(.+?)(?:\s*\((\d+)\))?$/)
                                    const supplyName = supplyMatch ? supplyMatch[1] : supply
                                    const quantity = supplyMatch ? parseInt(supplyMatch[2]) || 1 : 1
                                    
                                    setEditingSupply({
                                      original: supply,
                                      name: supplyName
                                    })
                                    setEditSupplyQuantity(quantity)
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
                                    handleRemoveSupply(room._id, supply)
                                  }}
                                  className="text-red-500 hover:text-red-700 text-sm"
                                  title="Remove Supply"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
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
    </div>
  )
}

export default SessionView 