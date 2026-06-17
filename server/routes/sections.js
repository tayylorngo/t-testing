import express from 'express';
import { debugLog } from '../utils/logger.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Section from '../models/Section.js';
import Session from '../models/Session.js';
import { authenticateToken } from '../middleware/auth.js';
import { emitSessionUpdate } from '../realtime/socket.js';
import { addActivityLogEntry } from '../utils/activityLog.js';

const router = express.Router();

// Section numbers are 1-99 with an optional single trailing letter (e.g. "99A").
const SECTION_NUMBER_REGEX = /^([1-9]|[1-9][0-9])[A-Za-z]?$/;
const normalizeSectionNumber = (value) => String(value ?? '').trim().toUpperCase();
const isValidSectionNumber = (value) => SECTION_NUMBER_REGEX.test(normalizeSectionNumber(value));
const SECTION_NUMBER_ERROR = 'Section number must be 1-99 with an optional single letter (e.g. 99A)';

router.post('/api/sections', authenticateToken, async (req, res) => {
  try {
    const { number, studentCount = 1, accommodations = [], notes = '' } = req.body;

    if (!isValidSectionNumber(number)) {
      return res.status(400).json({ message: SECTION_NUMBER_ERROR });
    }
    const normalizedNumber = normalizeSectionNumber(number);

    if (!studentCount || studentCount < 1) {
      return res.status(400).json({ message: 'Student count must be at least 1' });
    }

    // Note: Section numbers can be duplicated across different rooms/sessions
    // Duplicate checking is done at the room level when adding sections to rooms

    const newSection = new Section({
      number: normalizedNumber,
      studentCount,
      accommodations,
      notes
    });

    await newSection.save();
    res.status(201).json({ message: 'Section created successfully', section: newSection });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/sections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { number, studentCount, accommodations, notes } = req.body;
    const updateData = {};

    if (number !== undefined) {
      if (!isValidSectionNumber(number)) {
        return res.status(400).json({ message: SECTION_NUMBER_ERROR });
      }
      const normalizedNumber = normalizeSectionNumber(number);
      // Check if any room containing this section already has another section with the same number
      const roomsWithThisSection = await Room.find({ sections: id }).populate('sections', 'number');
      for (const room of roomsWithThisSection) {
        const duplicateSection = room.sections.find(s => s._id.toString() !== id && s.number === normalizedNumber);
        if (duplicateSection) {
          return res.status(400).json({ message: `A section with number ${normalizedNumber} already exists in room "${room.name}"` });
        }
      }
      updateData.number = normalizedNumber;
    }
    if (studentCount !== undefined) {
      if (studentCount < 1) {
        return res.status(400).json({ message: 'Student count must be at least 1' });
      }
      updateData.studentCount = studentCount;
    }
    if (accommodations !== undefined) {
      updateData.accommodations = accommodations;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const section = await Section.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Find the session that contains this section to emit real-time update
    const session = await Session.findOne({ sections: id });
    if (session) {
      debugLog(`Section update - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
      // Add activity log entry for section update
      const action = `${user.firstName} ${user.lastName} updated section ${section.number} to ${section.studentCount} students`;
      const logEntry = await addActivityLogEntry(session._id, action, null, null, `${user.firstName} ${user.lastName}`);
      
      emitSessionUpdate(session._id, 'section-updated', { sectionId: id, section }, user, logEntry);
    } else {
      debugLog(`Section update - No session found containing section: ${id}`);
    }

    res.json({ message: 'Section updated successfully', section });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/sessions/:sessionId/sections', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sectionId } = req.body;

    if (!sectionId) {
      return res.status(400).json({ message: 'Section ID is required' });
    }

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if section exists
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Check if section is already in session
    if (session.sections.includes(sectionId)) {
      return res.status(400).json({ message: 'Section is already in this session' });
    }

    // Add section to session
    session.sections.push(sectionId);
    await session.save();

    // Return updated session with populated sections
    const updatedSession = await Session.findById(sessionId)
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for section addition
    const user = await User.findById(req.user.id);
    const action = `${user.firstName} ${user.lastName} added section ${section.number} with ${section.studentCount} students to the session`;
    const logEntry = await addActivityLogEntry(sessionId, action, null, null, `${user.firstName} ${user.lastName}`);

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'section-added', { section, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Section added to session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Add section to session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/sections', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Clear all sections from session
    const sectionCount = session.sections.length;
    session.sections = [];
    await session.save();

    debugLog(`Cleared ${sectionCount} sections from session ${sessionId}`);

    res.json({ 
      message: `Successfully cleared ${sectionCount} sections from session`,
      clearedCount: sectionCount
    });
  } catch (error) {
    console.error('Clear all sections error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/sections/:sectionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, sectionId } = req.params;

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Remove section from session
    session.sections = session.sections.filter(section => section.toString() !== sectionId);
    await session.save();

    // Return updated session with populated sections
    const updatedSession = await Session.findById(sessionId)
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for section removal
    const user = await User.findById(req.user.id);
    const section = await Section.findById(sectionId);
    let logEntry = null;
    if (section) {
      const action = `${user.firstName} ${user.lastName} removed section ${section.number} with ${section.studentCount} students from the session`;
      logEntry = await addActivityLogEntry(sessionId, action, null, null, `${user.firstName} ${user.lastName}`);
    }

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'section-removed', { sectionId, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Section removed from session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Remove section from session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/rooms/:roomId/sections', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { roomId } = req.params;
      const { sectionId } = req.body;

      if (!sectionId) {
        throw new Error('Section ID is required');
      }

      // Check if room exists
      const room = await Room.findById(roomId).session(session);
      if (!room) {
        throw new Error('Room not found');
      }

      // Check if section exists
      const section = await Section.findById(sectionId).session(session);
      if (!section) {
        throw new Error('Section not found');
      }

      // Check if section is already in room (atomic check)
      if (room.sections.includes(sectionId)) {
        throw new Error('Section is already in this room');
      }

      // Check if a section with the same number already exists in this room
      const roomWithSections = await Room.findById(roomId)
        .populate('sections', 'number')
        .session(session);
      if (roomWithSections.sections.some(s => s._id.toString() !== sectionId && s.number === section.number)) {
        throw new Error(`A section with number ${section.number} already exists in this room`);
      }

      // Add section to room atomically
      await Room.findByIdAndUpdate(
        roomId,
        { $addToSet: { sections: sectionId } },
        { session }
      );

      // Return updated room with populated sections
      const updatedRoom = await Room.findById(roomId)
        .populate('sections', 'number studentCount accommodations notes')
        .session(session);

      // Find the session that contains this room to emit real-time update
      const sessionDoc = await Session.findOne({ rooms: roomId }).session(session);
      if (sessionDoc) {
        debugLog(`Section added to room - Emitting real-time update for session: ${sessionDoc._id}`);
        // Get user information for the real-time update
        const user = await User.findById(req.user.id);
        
        emitSessionUpdate(sessionDoc._id, 'section-added-to-room', { roomId, sectionId, room: updatedRoom }, user, null);
      } else {
        debugLog(`Section added to room - No session found containing room: ${roomId}`);
      }

      res.json({ 
        message: 'Section added to room successfully', 
        room: updatedRoom 
      });
    });
  } catch (error) {
    console.error('Add section to room error:', error);
    if (error.message) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  } finally {
    await session.endSession();
  }
});
router.post('/api/rooms/with-sections', authenticateToken, async (req, res) => {
  try {
    const { name, supplies = [], sectionIds = [], sessionId } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Room name is required' });
    }

    // Check for duplicate room name within the same session
    if (sessionId) {
      // Check if room name already exists in this session
      const session = await Session.findById(sessionId).populate('rooms');
      if (session) {
        const existingRoomInSession = session.rooms.find(r => r.name === name.trim());
        if (existingRoomInSession) {
          return res.status(400).json({ message: 'A room with this name already exists in this session' });
        }
      }
    } else {
      // If no sessionId provided, use global check (backward compatibility)
      const existingRoom = await Room.findOne({ name: name.trim() });
      if (existingRoom) {
        return res.status(400).json({ message: 'A room with this name already exists' });
      }
    }

    // Create the room
    const newRoom = new Room({
      name: name.trim(),
      supplies
    });

    // Add sections if provided
    if (sectionIds.length > 0) {
      // Verify all sections exist
      const sections = await Section.find({ _id: { $in: sectionIds } });
      if (sections.length !== sectionIds.length) {
        return res.status(400).json({ message: 'One or more sections not found' });
      }
      
      // Check for duplicate section numbers within this room
      const sectionNumbers = sections.map(s => s.number);
      const duplicateNumbers = sectionNumbers.filter((num, index) => sectionNumbers.indexOf(num) !== index);
      if (duplicateNumbers.length > 0) {
        return res.status(400).json({ message: `Duplicate section numbers found: ${[...new Set(duplicateNumbers)].join(', ')}. Section numbers must be unique within a room.` });
      }
      
      newRoom.sections = sectionIds;
    }

    await newRoom.save();
    
    // If sessionId is provided, add sections to the session
    if (sessionId && sectionIds.length > 0) {
      const session = await Session.findById(sessionId);
      if (session) {
        // Add sections to session if they're not already there
        const newSectionIds = sectionIds.filter(id => !session.sections.includes(id));
        if (newSectionIds.length > 0) {
          session.sections.push(...newSectionIds);
          await session.save();
        }
      }
    }
    
    // Return populated room
    const populatedRoom = await Room.findById(newRoom._id)
      .populate('sections', 'number studentCount accommodations notes');
    
    res.status(201).json({ message: 'Room created successfully', room: populatedRoom });
  } catch (error) {
    console.error('Create room with sections error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if section exists
    const section = await Section.findById(id);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Remove section from all rooms
    await Room.updateMany(
      { sections: id },
      { $pull: { sections: id } }
    );

    // Remove section from all sessions
    await Session.updateMany(
      { sections: id },
      { $pull: { sections: id } }
    );

    // Delete the section from the database
    await Section.findByIdAndDelete(id);

    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/rooms/:roomId/sections/:sectionId', authenticateToken, async (req, res) => {
  try {
    const { roomId, sectionId } = req.params;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove section from room
    room.sections = room.sections.filter(section => section.toString() !== sectionId);
    await room.save();

    // Return updated room with populated sections
    const updatedRoom = await Room.findById(roomId)
      .populate('sections', 'number studentCount accommodations notes');

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: roomId });
    if (session) {
      debugLog(`Section removed from room - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
             emitSessionUpdate(session._id, 'section-removed-from-room', { roomId, sectionId, room: updatedRoom }, user, null);
    } else {
      debugLog(`Section removed from room - No session found containing room: ${roomId}`);
    }

    res.json({ 
      message: 'Section removed from room successfully', 
      room: updatedRoom 
    });
  } catch (error) {
    console.error('Remove section from room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/sessions/:sessionId/move-students', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { sessionId } = req.params;
      const { sourceRoomId, destinationRoomId, sectionId, studentsToMove } = req.body;

      if (!sourceRoomId || !destinationRoomId || !sectionId || !studentsToMove) {
        throw new Error('All fields are required: sourceRoomId, destinationRoomId, sectionId, studentsToMove');
      }

      // Check if session exists and user has permission
      const sessionDoc = await Session.findOne({ 
        _id: sessionId,
        $or: [
          { createdBy: req.user.id },
          { 'collaborators.userId': req.user.id }
        ]
      }).session(session);

      if (!sessionDoc) {
        throw new Error('Session not found');
      }

      // Check if source and destination rooms exist and are in the session
      const sourceRoom = await Room.findById(sourceRoomId).session(session);
      const destinationRoom = await Room.findById(destinationRoomId).session(session);
      
      if (!sourceRoom || !destinationRoom) {
        throw new Error('Source or destination room not found');
      }

      if (!sessionDoc.rooms.includes(sourceRoomId) || !sessionDoc.rooms.includes(destinationRoomId)) {
        throw new Error('Both rooms must be in the session');
      }

      // Check if section exists in source room
      const sourceSection = sourceRoom.sections.find(s => s.toString() === sectionId);
      if (!sourceSection) {
        throw new Error('Section not found in source room');
      }

      // Get user information for logging
      const user = await User.findById(req.user.id);

      // Get the section details
      const section = await Section.findById(sectionId).session(session);
      if (!section) {
        throw new Error('Section not found');
      }

      // Check if destination room already has a section with the same number
      const destinationRoomSections = await Room.findById(destinationRoomId)
        .populate('sections', 'number studentCount accommodations notes')
        .session(session);
      
      const existingSection = destinationRoomSections.sections.find(s => s.number === section.number);
      
      if (existingSection) {
        // Combine sections - add students to existing section
        const newStudentCount = existingSection.studentCount + studentsToMove;
        await Section.findByIdAndUpdate(existingSection._id, { 
          studentCount: newStudentCount 
        }, { session });
        
        // Remove the source section from source room
        await Room.findByIdAndUpdate(sourceRoomId, {
          $pull: { sections: sectionId }
        }, { session });
        
        // Delete the source section since we combined it
        await Section.findByIdAndDelete(sectionId, { session });
        
        debugLog(`Combined section ${section.number}: ${existingSection.studentCount} + ${studentsToMove} = ${newStudentCount} students`);
      } else {
        // No existing section with same number - move the entire section
        // Remove section from source room
        await Room.findByIdAndUpdate(sourceRoomId, {
          $pull: { sections: sectionId }
        }, { session });

        // Add section to destination room
        await Room.findByIdAndUpdate(destinationRoomId, {
          $push: { sections: sectionId }
        }, { session });
        
        debugLog(`Moved entire section ${section.number} with ${studentsToMove} students`);
      }

      // Get updated rooms with populated sections
      const updatedSourceRoom = await Room.findById(sourceRoomId)
        .populate('sections', 'number studentCount accommodations notes')
        .session(session);
      const updatedDestinationRoom = await Room.findById(destinationRoomId)
        .populate('sections', 'number studentCount accommodations notes')
        .session(session);

      // Add comprehensive activity log entry for student movement
      let action;
      if (existingSection) {
        action = `${user.firstName} ${user.lastName} combined ${studentsToMove} students from Room ${sourceRoom.name} into existing Section ${section.number} in Room ${destinationRoom.name}`;
      } else {
        action = `${user.firstName} ${user.lastName} moved ${studentsToMove} students from Room ${sourceRoom.name} to Room ${destinationRoom.name}`;
      }
      const logEntry = await addActivityLogEntry(sessionId, action, null, null, `${user.firstName} ${user.lastName}`);

      // Emit real-time update with the log entry and updated room data
      emitSessionUpdate(sessionId, 'students-moved', { 
        sourceRoomId, 
        destinationRoomId, 
        sectionId, 
        studentsToMove,
        sourceRoom: updatedSourceRoom,
        destinationRoom: updatedDestinationRoom
      }, user, logEntry);

      res.json({ 
        message: 'Students moved successfully',
        logEntry,
        sourceRoom: updatedSourceRoom,
        destinationRoom: updatedDestinationRoom
      });
    });
  } catch (error) {
    console.error('Move students error:', error);
    if (error.message) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  } finally {
    await session.endSession();
  }
});

export default router;
