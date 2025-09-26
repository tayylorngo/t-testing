import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { testingAPI } from '../services/api'
import { useRealTime } from '../contexts/RealTimeContext'
import { useCustomAlert } from '../hooks/useCustomAlert'
import CustomAlert from './CustomAlert'
import ExcelImportModal from './ExcelImportModal'

function SessionDetail({ onBack }) {
  const { sessionId } = useParams()
  const { joinSession, leaveSession, onSessionUpdate, isConnected } = useRealTime()
  const { alertState, showError, hideAlert } = useCustomAlert()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddRoomModal, setShowAddRoomModal] = useState(false)
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [showAddSectionToRoomModal, setShowAddSectionToRoomModal] = useState(false)
  const [showExcelImportModal, setShowExcelImportModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomSupplies, setNewRoomSupplies] = useState({})
  const [newSectionNumber, setNewSectionNumber] = useState('')
  const [newSectionStudentCount, setNewSectionStudentCount] = useState('1')
  // State for creating sections within room modal
  const [roomSectionsToCreate, setRoomSectionsToCreate] = useState([])
  const [newRoomSectionNumber, setNewRoomSectionNumber] = useState('')
  const [newRoomSectionStudentCount, setNewRoomSectionStudentCount] = useState('1')
  const [newRoomSectionDescription, setNewRoomSectionDescription] = useState('')
  const [newRoomSectionAccommodations, setNewRoomSectionAccommodations] = useState([])
  const [selectedRoomForSection, setSelectedRoomForSection] = useState(null)
  const [availableSections, setAvailableSections] = useState([])
  const [selectedSectionsForRoom, setSelectedSectionsForRoom] = useState([])
  const [selectedSectionsToAdd, setSelectedSectionsToAdd] = useState([])
  const [editRoomName, setEditRoomName] = useState('')
  const [editRoomSupplies, setEditRoomSupplies] = useState({})
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
    // Time Accommodations
    '1.5x',
    '2x',
    
    // Bilingual Accommodations
    'Bilingual – Chinese',
    'Bilingual – Bengali',
    'Bilingual – French',
    'Bilingual – Georgian',
    'Bilingual – Russian',
    'Bilingual – Spanish',
    'Bilingual – Tadzhik',
    'Bilingual – Arabic',
    'Bilingual – Armenian',
    'Bilingual – Haitian',
    'Bilingual – Ukrainian',
    'Bilingual – Urdu',
    'Bilingual – Uzbek',
    
    // Other Testing Supports
    '504\'s',
    '2-tech',
    'Reader',
    'Vision',
    'Scribe'
  ];

  // Helper function to group accommodations by category
  const getAccommodationGroups = () => {
    return {
      'Time Accommodations': ACCOMMODATIONS.filter(acc => acc === '1.5x' || acc === '2x'),
      'Bilingual Accommodations': ACCOMMODATIONS.filter(acc => acc.startsWith('Bilingual –')),
      'Other Testing Supports': ACCOMMODATIONS.filter(acc => 
        acc === '504\'s' || acc === '2-tech' || acc === 'Reader' || acc === 'Vision' || acc === 'Scribe'
      )
    }
  };
  const [selectedAccommodations, setSelectedAccommodations] = useState([])
  // Add state for custom accommodations
  const [customAccommodation, setCustomAccommodation] = useState('')
  
  // Preset supplies options (matching SessionView)
  const PRESET_SUPPLIES = ['Pencils', 'Pens', 'Calculators', 'Protractor/Ruler', 'Compass'];
  // Add state for notes
  const [newSectionNotes, setNewSectionNotes] = useState('')
  // Add state for editing accommodations and notes
  const [editSectionAccommodations, setEditSectionAccommodations] = useState([])
  const [editCustomAccommodation, setEditCustomAccommodation] = useState('')
  const [editSectionNotes, setEditSectionNotes] = useState('')
  
  // Proctor management state
  const [showProctorModal, setShowProctorModal] = useState(false)
  const [selectedRoomForProctors, setSelectedRoomForProctors] = useState(null)
  const [proctors, setProctors] = useState([])
  const [newProctor, setNewProctor] = useState({
    firstName: '',
    lastName: '',
    startTime: '',
    endTime: '',
    email: ''
  })
  const [editingProctor, setEditingProctor] = useState(null)
  const [editingIndex, setEditingIndex] = useState(-1)
  
  // Custom confirm delete modals
  const [showDeleteRoomModal, setShowDeleteRoomModal] = useState(false)
  const [showDeleteSectionModal, setShowDeleteSectionModal] = useState(false)
  const [showDeleteSelectedSectionsModal, setShowDeleteSelectedSectionsModal] = useState(false)
  const [showDeleteSelectedRoomsModal, setShowDeleteSelectedRoomsModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  
  // Custom edit modals
  const [showEditRoomModal, setShowEditRoomModal] = useState(false)
  const [showEditSectionModal, setShowEditSectionModal] = useState(false)
  const [itemToEdit, setItemToEdit] = useState(null)

  useEffect(() => {
    fetchSessionData()
    
    // Join real-time session
    joinSession(sessionId)
    
    // Set up real-time update listener
    const cleanup = onSessionUpdate(sessionId, handleRealTimeUpdate)
    
    return () => {
      cleanup()
      leaveSession()
    }
  }, [sessionId])

  // Update page title when session loads
        useEffect(() => {
          if (session) {
            document.title = `Elmira | ${session.name}`
          } else {
            document.title = 'Elmira'
          }

          // Cleanup function to reset title when component unmounts
          return () => {
            document.title = 'Elmira'
          }
        }, [session])

  // Handle real-time updates from other users
  const handleRealTimeUpdate = (update) => {
    console.log('Received real-time update:', update)
    
    switch (update.type) {
      case 'room-added':
        console.log('Room added by another user:', update.data.room)
        // Refresh session data to get the latest state
        fetchSessionData()
        break
        
      case 'room-removed':
        console.log('Room removed by another user:', update.data.roomId)
        // Refresh session data to get the latest state
        fetchSessionData()
        break
        
      case 'section-added':
        console.log('Section added by another user:', update.data.section)
        // Refresh session data to get the latest state
        fetchSessionData()
        break
        
      case 'section-removed':
        console.log('Section removed by another user:', update.data.sectionId)
        // Refresh session data to get the latest state
        fetchSessionData()
        break
        
      case 'session-updated':
        console.log('Session updated by another user:', update.data.session)
        // Update local session state with new data
        setSession(update.data.session)
        // Also update the session updates form
        setSessionUpdates({
          name: update.data.session.name,
          description: update.data.session.description || '',
          date: update.data.session.date.split('T')[0],
          startTime: update.data.session.startTime,
          endTime: update.data.session.endTime,
          status: update.data.session.status
        })
        break
        
      default:
        console.log('Unknown update type:', update.type)
    }
  }

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

  // Helper functions for room section management
  const addRoomSection = () => {
    if (!newRoomSectionNumber.trim() || !newRoomSectionStudentCount.trim()) return
    
    const input = newRoomSectionNumber.trim()
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
      numbers = Array.from({ length: e - s + 1 }, (_, i) => s + i)
    } else {
      alert('Please enter a valid section number or range (e.g., 25 or 20-30).')
      return
    }
    
    const studentCount = parseInt(newRoomSectionStudentCount)
    if (studentCount < 1) {
      alert('Student count must be at least 1.')
      return
    }
    
    // Check for duplicate section numbers
    const existingNumbers = roomSectionsToCreate.map(s => s.number)
    const duplicates = numbers.filter(num => existingNumbers.includes(num))
    if (duplicates.length > 0) {
      alert(`Section number(s) ${duplicates.join(', ')} already added.`)
      return
    }
    
    // Check against existing sections in session
    const sessionSectionNumbers = session.sections?.map(s => s.number) || []
    const sessionDuplicates = numbers.filter(num => sessionSectionNumbers.includes(num))
    if (sessionDuplicates.length > 0) {
      alert(`Section number(s) ${sessionDuplicates.join(', ')} already exist in the session.`)
      return
    }
    
    // Create section objects
    const newSections = numbers.map(number => ({
      number,
      studentCount,
      description: newRoomSectionDescription.trim() || '',
      accommodations: [...newRoomSectionAccommodations],
      notes: ''
    }))
    
    setRoomSectionsToCreate([...roomSectionsToCreate, ...newSections])
    setNewRoomSectionNumber('')
    setNewRoomSectionStudentCount('1')
    setNewRoomSectionDescription('')
    setNewRoomSectionAccommodations([])
  }
  
  const removeRoomSection = (index) => {
    setRoomSectionsToCreate(roomSectionsToCreate.filter((_, i) => i !== index))
  }
  
  const toggleRoomSectionAccommodation = (accommodation) => {
    setNewRoomSectionAccommodations(prev => 
      prev.includes(accommodation) 
        ? prev.filter(acc => acc !== accommodation)
        : [...prev, accommodation]
    )
  }

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return
    
    try {
      // Parse supplies from input
      const supplies = parseSupplies(newRoomSupplies)
      
      // Create sections first if any are being created
      let createdSectionIds = [...selectedSectionsForRoom]
      if (roomSectionsToCreate.length > 0) {
        try {
          for (const sectionData of roomSectionsToCreate) {
            const sectionResponse = await testingAPI.createSection({
              number: sectionData.number,
              studentCount: sectionData.studentCount,
              description: sectionData.description,
              accommodations: sectionData.accommodations,
              notes: sectionData.notes
            })
            createdSectionIds.push(sectionResponse.section._id)
          }
        } catch (sectionError) {
          console.error('Error creating sections for room:', sectionError)
          showError(sectionError.message || 'Error creating sections. Please check for duplicate section numbers.')
          return // Stop room creation if section creation fails
        }
      }
      
      // Create a new room with selected sections and initial supplies
      const roomResponse = await testingAPI.createRoomWithSections({
        name: newRoomName.trim(),
        supplies: supplies,
        sectionIds: createdSectionIds,
        sessionId: sessionId
      })
      
      // Add the new room to the session
      await testingAPI.addRoomToSession(sessionId, roomResponse.room._id)
      
      // Store initial supplies with special prefix for distinction
      if (supplies.length > 0) {
        const initialSupplies = supplies.map(supply => `INITIAL_${supply}`)
        await testingAPI.updateRoom(roomResponse.room._id, { 
          supplies: [...supplies, ...initialSupplies]
        })
      }
      
      setShowAddRoomModal(false)
      setNewRoomName('')
      setNewRoomSupplies({})
      setSelectedSectionsForRoom([])
      setRoomSectionsToCreate([])
      setNewRoomSectionNumber('')
      setNewRoomSectionStudentCount('1')
      setNewRoomSectionDescription('')
      setNewRoomSectionAccommodations([])
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error adding room to session:', error)
      showError(error.message || 'Error adding room to session. Please try again.')
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
      setCustomAccommodation('')
      setNewSectionNotes('')
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error adding section(s) to session:', error)
      showError(error.message || 'Error adding section(s) to session. Please try again.')
    }
  }

  const handleAddSectionToRoom = async () => {
    if (!selectedRoomForSection || selectedSectionsToAdd.length === 0) return
    
    try {
      // Add all selected sections to the room
      for (const sectionId of selectedSectionsToAdd) {
        await testingAPI.addSectionToRoom(selectedRoomForSection._id, sectionId)
      }
      setShowAddSectionToRoomModal(false)
      setSelectedRoomForSection(null)
      setAvailableSections([])
      setSelectedSectionsToAdd([])
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error adding sections to room:', error)
    }
  }

  const handleExcelImport = async (importData) => {
    try {
      const createdRooms = [];
      const createdSections = [];
      
      // First, create all sections
      for (const sectionData of importData.sections) {
        try {
          const sectionResponse = await testingAPI.createSection({
            number: sectionData.number,
            studentCount: sectionData.studentCount,
            description: '',
            accommodations: [],
            notes: ''
          });
          createdSections.push(sectionResponse.section);
        } catch (sectionError) {
          console.error('Error creating section:', sectionError);
          // Continue with other sections even if one fails
        }
      }
      
      // Group sections by room
      const sectionsByRoom = new Map();
      importData.rooms.forEach(room => {
        sectionsByRoom.set(room.name, []);
        room.sections.forEach(section => {
          const createdSection = createdSections.find(s => s.number === section.number);
          if (createdSection) {
            sectionsByRoom.get(room.name).push(createdSection._id);
          }
        });
      });
      
      // Create rooms with their sections
      for (const roomData of importData.rooms) {
        try {
          const sectionIds = sectionsByRoom.get(roomData.name) || [];
          
          const roomResponse = await testingAPI.createRoomWithSections({
            name: roomData.name,
            supplies: [],
            sectionIds: sectionIds,
            sessionId: sessionId
          });
          
          // Add room to session
          await testingAPI.addRoomToSession(sessionId, roomResponse.room._id);
          
          createdRooms.push(roomResponse.room);
        } catch (roomError) {
          console.error('Error creating room:', roomError);
          // Continue with other rooms even if one fails
        }
      }
      
      // Show success message
      const successMessage = `Successfully imported ${createdRooms.length} rooms and ${createdSections.length} sections`;
      alert(successMessage);
      
      // Refresh session data
      fetchSessionData();
      
    } catch (error) {
      console.error('Error importing Excel data:', error);
      throw new Error(error.message || 'Failed to import Excel data');
    }
  };

  const handleRemoveRoom = async (roomId) => {
    const room = session.rooms.find(r => r._id === roomId)
    setItemToDelete({ type: 'room', id: roomId, name: room?.name || 'Room' })
    setShowDeleteRoomModal(true)
  }

  const confirmDeleteRoom = async () => {
    if (!itemToDelete || itemToDelete.type !== 'room') return
    
    try {
      await testingAPI.removeRoomFromSession(sessionId, itemToDelete.id)
      setShowDeleteRoomModal(false)
      setItemToDelete(null)
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error removing room from session:', error)
    }
  }

  const handleRemoveSection = async (sectionId) => {
    // Find the section in any room to get its number
    let sectionNumber = 'Section'
    for (const room of session.rooms) {
      const section = room.sections?.find(s => s._id === sectionId)
      if (section) {
        sectionNumber = `Section ${section.number}`
        break
      }
    }
    
    setItemToDelete({ type: 'section', id: sectionId, name: sectionNumber })
    setShowDeleteSectionModal(true)
  }

  const confirmDeleteSection = async () => {
    if (!itemToDelete || itemToDelete.type !== 'section') return
    
    try {
      await testingAPI.deleteSection(itemToDelete.id)
      setShowDeleteSectionModal(false)
      setItemToDelete(null)
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error deleting section:', error)
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
    setItemToEdit({ type: 'room', id: room._id, name: room.name })
    setEditRoomName(room.name)
    
    // Only load initial supplies for editing
    const initialSupplies = room.supplies?.filter(supply => supply.startsWith('INITIAL_')) || []
    const cleanInitialSupplies = initialSupplies.map(supply => supply.replace('INITIAL_', ''))
    setEditRoomSupplies(parseSuppliesFromRoom(cleanInitialSupplies))
    setShowEditRoomModal(true)
  }

  const handleSaveRoomName = async () => {
    if (!editRoomName.trim() || !itemToEdit || itemToEdit.type !== 'room') return
    
    try {
      // Get current room data to preserve added supplies
      const currentRoom = session.rooms.find(r => r._id === itemToEdit.id)
      if (!currentRoom) return
      
      // Separate added supplies (non-INITIAL_ prefixed)
      const addedSupplies = currentRoom.supplies?.filter(supply => !supply.startsWith('INITIAL_')) || []
      
      // Convert new initial supplies to array format
      const newInitialSupplies = []
      Object.entries(editRoomSupplies).forEach(([supply, quantity]) => {
        for (let i = 0; i < quantity; i++) {
          newInitialSupplies.push(`INITIAL_${supply}`)
        }
      })
      
      // Combine added supplies with new initial supplies
      const allSupplies = [...addedSupplies, ...newInitialSupplies]
      
      await testingAPI.updateRoom(itemToEdit.id, { 
        name: editRoomName.trim(),
        supplies: allSupplies
      })
      setShowEditRoomModal(false)
      setItemToEdit(null)
      setEditRoomName('')
      setEditRoomSupplies({})
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error updating room:', error)
      showError(error.message || 'Error updating room. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    setShowEditRoomModal(false)
    setItemToEdit(null)
    setEditRoomName('')
    setEditRoomSupplies({})
  }

  const handleStartEditSection = (section) => {
    setItemToEdit({ 
      type: 'section', 
      id: section._id, 
      number: section.number,
      studentCount: section.studentCount,
      accommodations: Array.isArray(section.accommodations) ? section.accommodations : [],
      notes: section.notes || ''
    })
    setEditSectionNumber(section.number.toString())
    setEditSectionStudentCount(section.studentCount.toString())
    setEditSectionAccommodations(Array.isArray(section.accommodations) ? section.accommodations : [])
    setEditSectionNotes(section.notes || '')
    setShowEditSectionModal(true)
  }

  const handleSaveSectionNumber = async () => {
    if (!editSectionNumber.trim() || !editSectionStudentCount.trim() || !itemToEdit || itemToEdit.type !== 'section') return
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
      await testingAPI.updateSection(itemToEdit.id, {
        number: sectionNum,
        studentCount: studentCount,
        accommodations: editSectionAccommodations,
        notes: editSectionNotes.trim(),
      })
      setShowEditSectionModal(false)
      setItemToEdit(null)
      setEditSectionNumber('')
      setEditSectionStudentCount('')
      setEditSectionAccommodations([])
      setEditCustomAccommodation('')
      setEditSectionNotes('')
      fetchSessionData() // Refresh data
    } catch (error) {
      console.error('Error updating section:', error)
      showError(error.message || 'Error updating section. Please try again.')
    }
  }

  const handleCancelEditSection = () => {
    setShowEditSectionModal(false)
    setItemToEdit(null)
    setEditSectionNumber('')
    setEditSectionStudentCount('')
    setEditSectionAccommodations([])
    setEditCustomAccommodation('')
    setEditSectionNotes('')
  }

  const handleOpenAddSectionToRoom = (room) => {
    setSelectedRoomForSection(room)
    // Get available sections (sections in session but not assigned to any room)
    const allAssignedSectionIds = session.rooms?.flatMap(r => r.sections?.map(s => s._id) || []) || []
    const availableSections = session.sections?.filter(s => !allAssignedSectionIds.includes(s._id)) || []
    setAvailableSections(availableSections)
    setSelectedSectionsToAdd([]) // Reset selected sections
    setShowAddSectionToRoomModal(true)
  }

  const calculateTotalStudents = (sections) => {
    return sections?.reduce((total, section) => total + (section.studentCount || 0), 0) || 0
  }

  // Helper function to add custom accommodation
  const addCustomAccommodation = (accommodation, isEdit = false) => {
    if (!accommodation.trim()) return
    
    const trimmedAccommodation = accommodation.trim()
    
    if (isEdit) {
      if (!editSectionAccommodations.includes(trimmedAccommodation)) {
        setEditSectionAccommodations([...editSectionAccommodations, trimmedAccommodation])
      }
      setEditCustomAccommodation('')
    } else {
      if (!selectedAccommodations.includes(trimmedAccommodation)) {
        setSelectedAccommodations([...selectedAccommodations, trimmedAccommodation])
      }
      setCustomAccommodation('')
    }
  }

  // Helper function to remove accommodation
  const removeAccommodation = (accommodation, isEdit = false) => {
    if (isEdit) {
      setEditSectionAccommodations(editSectionAccommodations.filter(acc => acc !== accommodation))
    } else {
      setSelectedAccommodations(selectedAccommodations.filter(acc => acc !== accommodation))
    }
  }

  // Helper function to parse supplies with quantities
  const parseSupplies = (suppliesObject) => {
    const supplies = []
    Object.entries(suppliesObject).forEach(([supply, quantity]) => {
      if (quantity && quantity > 0) {
        supplies.push(`${supply} (${quantity})`)
      }
    })
    return supplies
  }

  // Helper function to update supply quantity
  const updateSupplyQuantity = (supply, quantity) => {
    setNewRoomSupplies(prev => ({
      ...prev,
      [supply]: quantity
    }))
  }

  // Helper function to update edit room supply quantity
  const updateEditRoomSupplyQuantity = (supply, quantity) => {
    setEditRoomSupplies(prev => ({
      ...prev,
      [supply]: quantity
    }))
  }

  // Helper function to parse supplies from room data
  const parseSuppliesFromRoom = (supplies) => {
    if (!supplies || !Array.isArray(supplies)) {
      return {}
    }
    const supplyCounts = {}
    supplies.forEach(supply => {
      supplyCounts[supply] = (supplyCounts[supply] || 0) + 1
    })
    return supplyCounts
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
    setItemToDelete({ type: 'selectedSections', count: selectedSectionIds.length })
    setShowDeleteSelectedSectionsModal(true)
  }

  const confirmDeleteSelectedSections = async () => {
    if (!itemToDelete || itemToDelete.type !== 'selectedSections') return
    
    try {
      for (const sectionId of selectedSectionIds) {
        await testingAPI.deleteSection(sectionId)
      }
      setSelectedSectionIds([])
      setShowDeleteSelectedSectionsModal(false)
      setItemToDelete(null)
      fetchSessionData()
    } catch {
      alert('Error deleting selected sections.')
    }
  }

  const handleDeleteSelectedRooms = async () => {
    if (selectedRoomIds.length === 0) return
    setItemToDelete({ type: 'selectedRooms', count: selectedRoomIds.length })
    setShowDeleteSelectedRoomsModal(true)
  }

  const confirmDeleteSelectedRooms = async () => {
    if (!itemToDelete || itemToDelete.type !== 'selectedRooms') return
    
    try {
      for (const roomId of selectedRoomIds) {
        await testingAPI.removeRoomFromSession(sessionId, roomId)
      }
      setSelectedRoomIds([])
      setShowDeleteSelectedRoomsModal(false)
      setItemToDelete(null)
      fetchSessionData()
    } catch {
      alert('Error deleting selected rooms.')
    }
  }

  // Proctor management handlers
  const handleManageProctors = (room) => {
    setSelectedRoomForProctors(room)
    // Ensure proctors have the correct structure
    const normalizedProctors = (room.proctors || []).map(proctor => {
      // If proctor has old 'name' field, split it into firstName and lastName
      if (proctor.name && !proctor.firstName && !proctor.lastName) {
        const nameParts = proctor.name.split(' ')
        return {
          ...proctor,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          name: proctor.name // Keep the original name for display
        }
      }
      // If proctor has firstName/lastName, create name for display
      if (proctor.firstName && proctor.lastName && !proctor.name) {
        return {
          ...proctor,
          name: `${proctor.firstName} ${proctor.lastName}`
        }
      }
      return proctor
    })
    setProctors(normalizedProctors)
    setShowProctorModal(true)
  }

  const handleAddProctor = () => {
    if (!newProctor.firstName.trim() || !newProctor.lastName.trim() || !newProctor.startTime || !newProctor.endTime) {
      alert('Please fill in first name, last name, start time, and end time.')
      return
    }
    
    // Create full name for display
    const proctorWithFullName = {
      ...newProctor,
      name: `${newProctor.firstName.trim()} ${newProctor.lastName.trim()}`
    }
    
    setProctors([...proctors, proctorWithFullName])
    setNewProctor({
      firstName: '',
      lastName: '',
      startTime: '',
      endTime: '',
      email: ''
    })
    // Reset editing state when adding new proctor
    setEditingProctor(null)
    setEditingIndex(-1)
  }

  const handleRemoveProctor = (index) => {
    setProctors(proctors.filter((_, i) => i !== index))
  }

  const handleEditProctor = (index) => {
    const proctor = proctors[index]
    setEditingProctor({
      firstName: proctor.firstName || '',
      lastName: proctor.lastName || '',
      startTime: proctor.startTime || '',
      endTime: proctor.endTime || '',
      email: proctor.email || ''
    })
    setEditingIndex(index)
  }

  const handleSaveEditProctor = () => {
    if (!editingProctor.firstName.trim() || !editingProctor.lastName.trim() || !editingProctor.startTime || !editingProctor.endTime) {
      alert('Please fill in first name, last name, start time, and end time.')
      return
    }
    
    const updatedProctor = {
      ...editingProctor,
      name: `${editingProctor.firstName.trim()} ${editingProctor.lastName.trim()}`
    }
    
    const updatedProctors = [...proctors]
    updatedProctors[editingIndex] = updatedProctor
    setProctors(updatedProctors)
    setEditingProctor(null)
    setEditingIndex(-1)
  }

  const handleCancelEditProctor = () => {
    setEditingProctor(null)
    setEditingIndex(-1)
  }

  const handleSaveProctors = async () => {
    if (!selectedRoomForProctors) return
    
    try {
      await testingAPI.updateRoom(selectedRoomForProctors._id, {
        proctors: proctors
      })
      setShowProctorModal(false)
      setSelectedRoomForProctors(null)
      setProctors([])
      fetchSessionData()
    } catch (error) {
      console.error('Error saving proctors:', error)
      alert('Error saving proctors.')
    }
  }

  const handleCancelProctors = () => {
    setShowProctorModal(false)
    setSelectedRoomForProctors(null)
    setProctors([])
    setNewProctor({
      firstName: '',
      lastName: '',
      startTime: '',
      endTime: '',
      email: ''
    })
    // Reset editing state when canceling
    setEditingProctor(null)
    setEditingIndex(-1)
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
              {/* Real-time connection status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
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
                  <button
                    onClick={() => setShowExcelImportModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import Excel
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
                        <h3 className="font-semibold text-gray-900 flex-1">Room {room.name}</h3>
                        
                        <div className="flex space-x-2">
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
                            onClick={() => handleManageProctors(room)}
                            className="text-green-500 hover:text-green-700 transition duration-200"
                            title="Manage Proctors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
                        
                        {/* Proctors */}
                        {room.proctors && room.proctors.length > 0 && (
                          <div>
                            <span className="font-medium">Proctors:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {room.proctors.map((proctor, index) => (
                                <div key={index} className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                  <span>{proctor.name || `${proctor.firstName} ${proctor.lastName}`}</span>
                                  <span className="text-green-600">({proctor.startTime} - {proctor.endTime})</span>
                                  {proctor.email && (
                                    <span className="text-green-600 ml-1">• {proctor.email}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {room.supplies && room.supplies.length > 0 && (
                          <div>
                            <span className="font-medium">Supplies:</span>
                            
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
                                  <div className="mt-1">
                                    <span className="text-xs text-gray-600 font-medium">Initial:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Object.entries(initialSupplyCounts).map(([supplyName, count], index) => (
                                        <span key={`initial-${index}`} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                          {supplyName} ({count})
                                        </span>
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
                                  <div className="mt-2">
                                    <span className="text-xs text-gray-600 font-medium">Added:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Object.entries(addedSupplyCounts).map(([supplyName, count], index) => (
                                        <span key={`added-${index}`} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                          {supplyName} ({count})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            })()}
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
                        </div>
                        <div className="flex space-x-2">
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
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Room</h2>
            
            <div className="space-y-6">
              {/* Room Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Name *
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Supplies (Optional)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    <div className="grid grid-cols-1 gap-2">
                      {PRESET_SUPPLIES.slice(0, 8).map((supply) => (
                        <div key={supply} className="flex items-center space-x-2 py-1">
                          <label className="flex-1 text-sm text-gray-700 min-w-0">
                            <span className="truncate">{supply}</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={newRoomSupplies[supply] || ''}
                            onChange={(e) => updateSupplyQuantity(supply, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Create New Sections */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Sections for This Room</h3>
                
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Section Number(s) *
                      </label>
                      <input
                        type="text"
                        value={newRoomSectionNumber}
                        onChange={(e) => setNewRoomSectionNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g. 25 or 20-30"
                      />
                      <p className="text-xs text-gray-500 mt-1">Single number or range</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student Count *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newRoomSectionStudentCount}
                        onChange={(e) => setNewRoomSectionStudentCount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Number of students"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={newRoomSectionDescription}
                        onChange={(e) => setNewRoomSectionDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Section description"
                      />
                    </div>
                  </div>
                  
                  {/* Accommodations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Accommodations (Optional)
                    </label>
                    <div className="space-y-4">
                      {Object.entries(getAccommodationGroups()).map(([category, accommodations]) => (
                        <div key={category}>
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">{category}</h4>
                          <div className="flex flex-wrap gap-2">
                            {accommodations.map((accommodation) => (
                              <label key={accommodation} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={newRoomSectionAccommodations.includes(accommodation)}
                                  onChange={() => toggleRoomSectionAccommodation(accommodation)}
                                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">{accommodation}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={addRoomSection}
                    disabled={!newRoomSectionNumber.trim() || !newRoomSectionStudentCount.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:cursor-not-allowed"
                  >
                    Add Section to Room
                  </button>
                </div>
                
                {/* List of sections to be created */}
                {roomSectionsToCreate.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Sections to be created:</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {roomSectionsToCreate.map((section, index) => (
                        <div key={index} className="flex items-center justify-between bg-purple-50 p-3 rounded-lg">
                          <div>
                            <span className="font-medium text-purple-900">Section {section.number}</span>
                            <span className="text-sm text-purple-700 ml-2">({section.studentCount} students)</span>
                            {section.description && (
                              <div className="text-xs text-purple-600 mt-1">{section.description}</div>
                            )}
                            {section.accommodations.length > 0 && (
                              <div className="text-xs text-purple-600 mt-1">
                                Accommodations: {section.accommodations.join(', ')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeRoomSection(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Select Existing Sections */}
              {session.sections && session.sections.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Existing Sections (Optional)</h3>
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
                      Selected: {selectedSectionsForRoom.length} existing section(s)
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
              
              <div className="flex space-x-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAddRoomModal(false)
                    setNewRoomName('')
                    setNewRoomSupplies({})
                    setSelectedSectionsForRoom([])
                    setRoomSectionsToCreate([])
                    setNewRoomSectionNumber('')
                    setNewRoomSectionStudentCount('1')
                    setNewRoomSectionDescription('')
                    setNewRoomSectionAccommodations([])
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
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Section</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section Number(s)
                  </label>
                  <input
                    type="text"
                    value={newSectionNumber}
                    onChange={(e) => setNewSectionNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g. 25 or 20-30"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter single number (1-99) or range (e.g. 20-30)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student Count
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accommodations
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  <div className="space-y-4">
                    {Object.entries(getAccommodationGroups()).map(([category, accommodations]) => (
                      <div key={category}>
                        <h4 className="text-sm font-semibold text-gray-800 mb-2">{category}</h4>
                        <div className="space-y-1">
                          {accommodations.map((accommodation) => (
                            <label key={accommodation} className="flex items-center space-x-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedAccommodations.includes(accommodation)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAccommodations([...selectedAccommodations, accommodation])
                                  } else {
                                    setSelectedAccommodations(selectedAccommodations.filter(acc => acc !== accommodation))
                                  }
                                }}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-sm text-gray-700">{accommodation}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Custom Accommodation Input */}
                <div className="mt-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={customAccommodation}
                      onChange={(e) => setCustomAccommodation(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addCustomAccommodation(customAccommodation, false)
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      placeholder="Add custom accommodation..."
                    />
                    <button
                      type="button"
                      onClick={() => addCustomAccommodation(customAccommodation, false)}
                      disabled={!customAccommodation.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition duration-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
                
                {/* Selected Accommodations Display */}
                {selectedAccommodations.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">Selected Accommodations:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAccommodations.map((accommodation) => (
                        <span
                          key={accommodation}
                          className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                        >
                          {accommodation}
                          <button
                            type="button"
                            onClick={() => removeAccommodation(accommodation, false)}
                            className="ml-1 text-purple-600 hover:text-purple-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newSectionNotes}
                  onChange={(e) => setNewSectionNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Add any notes for this section (optional)"
                  rows="3"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddSectionModal(false)
                    setNewSectionNumber('')
                    setNewSectionStudentCount('1')
                    setSelectedAccommodations([])
                    setCustomAccommodation('')
                    setNewSectionNotes('')
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSection}
                  disabled={!newSectionNumber.trim() || !newSectionStudentCount.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
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
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Sections to Room</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room: {selectedRoomForSection.name}
                </label>
                {availableSections.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select Sections (Multiple Selection)
                    </label>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                      {availableSections.map(section => (
                        <label key={section._id} className="flex items-center space-x-3 py-2 hover:bg-gray-50 rounded px-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSectionsToAdd.includes(section._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSectionsToAdd([...selectedSectionsToAdd, section._id])
                              } else {
                                setSelectedSectionsToAdd(selectedSectionsToAdd.filter(id => id !== section._id))
                              }
                            }}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <div className="text-sm text-gray-900">
                            <div>Section {section.number} ({section.studentCount} students)</div>
                            {section.description && (
                              <div className="text-xs text-gray-500 mt-1">{section.description}</div>
                            )}
                            {section.accommodations && section.accommodations.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">
                                Accommodations: {section.accommodations.join(', ')}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedSectionsToAdd.length > 0 && (
                      <p className="text-sm text-gray-600 mt-2">
                        Selected: {selectedSectionsToAdd.length} section(s)
                      </p>
                    )}
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
                    setSelectedSectionsToAdd([])
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSectionToRoom}
                  disabled={selectedSectionsToAdd.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {selectedSectionsToAdd.length > 0 ? `${selectedSectionsToAdd.length} ` : ''}Section{selectedSectionsToAdd.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {showDeleteRoomModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Delete Room</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to remove <span className="font-semibold">{itemToDelete.name}</span> from this session?
              </p>
              <p className="text-sm text-gray-600">
                This action cannot be undone.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteRoomModal(false)
                    setItemToDelete(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRoom}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Delete Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Section Confirmation Modal */}
      {showDeleteSectionModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Delete Section</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <span className="font-semibold">{itemToDelete.name}</span>?
              </p>
              <p className="text-sm text-gray-600">
                This will remove the section from all rooms and sessions. This action cannot be undone.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteSectionModal(false)
                    setItemToDelete(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSection}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Delete Section
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Sections Confirmation Modal */}
      {showDeleteSelectedSectionsModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Delete Selected Sections</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <span className="font-semibold">{itemToDelete.count} section(s)</span>?
              </p>
              <p className="text-sm text-gray-600">
                This will remove the sections from all rooms and sessions. This action cannot be undone.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteSelectedSectionsModal(false)
                    setItemToDelete(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSelectedSections}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Delete Sections
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Rooms Confirmation Modal */}
      {showDeleteSelectedRoomsModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Delete Selected Rooms</h2>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <span className="font-semibold">{itemToDelete.count} room(s)</span>?
              </p>
              <p className="text-sm text-gray-600">
                This action cannot be undone.
              </p>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteSelectedRoomsModal(false)
                    setItemToDelete(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSelectedRooms}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Delete Rooms
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {showEditRoomModal && itemToEdit && itemToEdit.type === 'room' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Room</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={editRoomName}
                  onChange={(e) => setEditRoomName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter room name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Supplies
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  <div className="grid grid-cols-1 gap-2">
                    {PRESET_SUPPLIES.map((supply) => (
                      <div key={supply} className="flex items-center space-x-2 py-1">
                        <label className="flex-1 text-sm text-gray-700 min-w-0">
                          <span className="truncate">{supply}</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editRoomSupplies[supply] || ''}
                          onChange={(e) => updateEditRoomSupplyQuantity(supply, parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Edit initial supplies for this room. Additional supplies can be added later in the room view.
                </p>
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoomName}
                  disabled={!editRoomName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {showEditSectionModal && itemToEdit && itemToEdit.type === 'section' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Section</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={editSectionNumber}
                    onChange={(e) => setEditSectionNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter section number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editSectionStudentCount}
                    onChange={(e) => setEditSectionStudentCount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter student count"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accommodations
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  <div className="space-y-4">
                    {Object.entries(getAccommodationGroups()).map(([category, accommodations]) => (
                      <div key={category}>
                        <h4 className="text-sm font-semibold text-gray-800 mb-2">{category}</h4>
                        <div className="space-y-1">
                          {accommodations.map((accommodation) => (
                            <label key={accommodation} className="flex items-center space-x-2 py-1">
                              <input
                                type="checkbox"
                                checked={editSectionAccommodations.includes(accommodation)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditSectionAccommodations([...editSectionAccommodations, accommodation])
                                  } else {
                                    setEditSectionAccommodations(editSectionAccommodations.filter(acc => acc !== accommodation))
                                  }
                                }}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-sm text-gray-700">{accommodation}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Custom Accommodation Input */}
                <div className="mt-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={editCustomAccommodation}
                      onChange={(e) => setEditCustomAccommodation(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addCustomAccommodation(editCustomAccommodation, true)
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      placeholder="Add custom accommodation..."
                    />
                    <button
                      type="button"
                      onClick={() => addCustomAccommodation(editCustomAccommodation, true)}
                      disabled={!editCustomAccommodation.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition duration-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
                
                {/* Selected Accommodations Display */}
                {editSectionAccommodations.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">Selected Accommodations:</div>
                    <div className="flex flex-wrap gap-2">
                      {editSectionAccommodations.map((accommodation) => (
                        <span
                          key={accommodation}
                          className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                        >
                          {accommodation}
                          <button
                            type="button"
                            onClick={() => removeAccommodation(accommodation, true)}
                            className="ml-1 text-purple-600 hover:text-purple-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={editSectionNotes}
                  onChange={(e) => setEditSectionNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Add any notes for this section (optional)"
                  rows="3"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCancelEditSection}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSectionNumber}
                  disabled={!editSectionNumber.trim() || !editSectionStudentCount.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proctor Management Modal */}
      {showProctorModal && selectedRoomForProctors && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Manage Proctors - Room {selectedRoomForProctors.name}
            </h2>
            
            {/* Current Proctors */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Current Proctors</h3>
              {proctors.length > 0 ? (
                <div className="space-y-2">
                  {proctors.map((proctor, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      {editingIndex === index ? (
                        // Edit mode
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                First Name *
                              </label>
                              <input
                                type="text"
                                value={editingProctor.firstName}
                                onChange={(e) => setEditingProctor({...editingProctor, firstName: e.target.value})}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                placeholder="First name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Last Name *
                              </label>
                              <input
                                type="text"
                                value={editingProctor.lastName}
                                onChange={(e) => setEditingProctor({...editingProctor, lastName: e.target.value})}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Last name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Start Time *
                              </label>
                              <input
                                type="time"
                                value={editingProctor.startTime}
                                onChange={(e) => setEditingProctor({...editingProctor, startTime: e.target.value})}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                End Time *
                              </label>
                              <input
                                type="time"
                                value={editingProctor.endTime}
                                onChange={(e) => setEditingProctor({...editingProctor, endTime: e.target.value})}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                value={editingProctor.email}
                                onChange={(e) => setEditingProctor({...editingProctor, email: e.target.value})}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                placeholder="proctor@example.com"
                              />
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={handleSaveEditProctor}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition duration-200"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditProctor}
                              className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded transition duration-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{proctor.name}</div>
                            <div className="text-sm text-gray-600">
                              {proctor.startTime} - {proctor.endTime}
                              {proctor.email && ` • ${proctor.email}`}
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEditProctor(index)}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Edit Proctor"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveProctor(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove Proctor"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No proctors assigned yet.</p>
              )}
            </div>

            {/* Add New Proctor */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Add New Proctor</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newProctor.firstName}
                    onChange={(e) => setNewProctor({...newProctor, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newProctor.lastName}
                    onChange={(e) => setNewProctor({...newProctor, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={newProctor.startTime}
                    onChange={(e) => setNewProctor({...newProctor, startTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={newProctor.endTime}
                    onChange={(e) => setNewProctor({...newProctor, endTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newProctor.email}
                    onChange={(e) => setNewProctor({...newProctor, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="proctor@example.com"
                  />
                </div>
              </div>
              <button
                onClick={handleAddProctor}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 mb-4"
              >
                Add Proctor
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex space-x-3 pt-6 border-t">
              <button
                onClick={handleCancelProctors}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProctors}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={showExcelImportModal}
        onClose={() => setShowExcelImportModal(false)}
        onImport={handleExcelImport}
        sessionId={sessionId}
      />

      {/* Custom Alert */}
      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={hideAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </div>
  )
}

export default SessionDetail 