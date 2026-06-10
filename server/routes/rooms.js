import express from 'express';
import { debugLog } from '../utils/logger.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Section from '../models/Section.js';
import Session from '../models/Session.js';
import { authenticateToken } from '../middleware/auth.js';
import { emitSessionUpdate } from '../realtime/socket.js';
import { addActivityLogEntry } from '../utils/activityLog.js';
import { normalizeSupplyName, getSupplySummary, pluralize, getPluralForm } from '../utils/supplies.js';

const router = express.Router();

router.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('sections', 'number studentCount accommodations notes')
      .sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/rooms/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Get the old room data to check previous presentStudents
    const oldRoom = await Room.findById(id);
    if (!oldRoom) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Prepare update data
    const updateData = { status, updatedAt: new Date() };
    
    // If marking room incomplete, clear presentStudents and sectionAttendance
    if (status === 'active') {
      updateData.presentStudents = undefined;
      updateData.sectionAttendance = {};
    }

    const room = await Room.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('sections', 'number studentCount accommodations notes');
    
    // Ensure sectionAttendance is included in the response
    const roomResponse = room.toObject();
    if (!roomResponse.sectionAttendance) {
      roomResponse.sectionAttendance = {};
    }

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: id });
    debugLog(`Room status update - Found session:`, session ? session._id : 'None');
    if (session) {
      debugLog(`Room status update - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
      // Add activity log entry with room name
      let action, details;
      if (status === 'active' && oldRoom.presentStudents !== undefined && oldRoom.presentStudents > 0) {
        action = `${user.firstName} ${user.lastName} marked Room ${room.name} incomplete (${oldRoom.presentStudents} students were present)`;
        details = `Room status changed from completed to active. Present students count cleared.`;
      } else {
        action = `${user.firstName} ${user.lastName} marked Room ${room.name} ${status === 'completed' ? 'complete' : 'incomplete'}`;
        details = status === 'active' ? 'Present students count cleared.' : null;
      }
      
      const logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
      
      emitSessionUpdate(session._id, 'room-status-updated', { roomId: id, room: roomResponse, status }, user, logEntry);
    } else {
      debugLog(`Room status update - No session found containing room: ${id}`);
    }

    res.json({ message: 'Room status updated', room: roomResponse });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, supplies = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    // Check for duplicate room name within the same session
    const sessionId = req.body.sessionId;
    
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

    const newRoom = new Room({
      name: name.trim(),
      supplies
    });

    await newRoom.save();
    
    const populatedRoom = await Room.findById(newRoom._id)
      .populate('sections', 'number studentCount');
    
    res.status(201).json({ message: 'Room created successfully', room: populatedRoom });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/rooms/:roomId/section-returns', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { sectionId, returned, clear } = req.body;

    if (!sectionId) {
      return res.status(400).json({ message: 'sectionId is required' });
    }
    const returnedNum = Number(returned);
    // When not clearing, `returned` must be a valid non-negative number.
    if (!clear && (!Number.isFinite(returnedNum) || returnedNum < 0)) {
      return res.status(400).json({ message: 'returned must be a non-negative number' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // The section must belong to this room
    const belongsToRoom = (room.sections || []).some(s => s.toString() === sectionId);
    if (!belongsToRoom) {
      return res.status(400).json({ message: 'Section does not belong to this room' });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // The recorded number is the count of students PRESENT for the section, used as
    // the fast tally when collecting exams. It can't exceed the section roster.
    const cap = section.studentCount || 0;
    const clamped = Math.min(Math.max(Math.round(returnedNum), 0), cap);

    const sectionReturns = { ...(room.sectionReturns || {}) };
    if (clear) {
      // Unmark the section — remove its record entirely so it reads as "not recorded".
      delete sectionReturns[sectionId];
    } else {
      sectionReturns[sectionId] = clamped;
    }

    // A section is "recorded" once it has an entry here. When every section in the
    // room has a recorded present count, the room is fully accounted for and auto-completes.
    const sectionIds = (room.sections || []).map(s => s.toString());
    const allRecorded = sectionIds.length > 0 && sectionIds.every(id => sectionReturns[id] !== undefined);
    const presentTotal = sectionIds.reduce((sum, id) => sum + (Number(sectionReturns[id]) || 0), 0);
    const wasCompleted = room.status === 'completed';

    const update = {
      sectionReturns,
      // Mirror the per-section present counts into the attendance fields so stats/exports stay correct.
      sectionAttendance: sectionReturns,
      presentStudents: presentTotal,
      updatedAt: new Date(),
    };
    // Keep room status in sync: complete when everything is recorded, otherwise active.
    if (allRecorded) {
      update.status = 'completed';
    } else if (wasCompleted) {
      update.status = 'active';
    }
    const becameComplete = allRecorded && !wasCompleted;
    const becameIncomplete = !allRecorded && wasCompleted;

    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      update,
      { new: true, runValidators: true }
    ).populate('sections', 'number studentCount accommodations notes');

    const roomResponse = updatedRoom.toObject();
    if (!roomResponse.sectionReturns) roomResponse.sectionReturns = {};

    const session = await Session.findOne({ rooms: roomId });
    if (session) {
      // If recording just completed this room, complete the session when every room is done.
      if (becameComplete) {
        const allRooms = await Room.find({ _id: { $in: session.rooms } });
        if (allRooms.every(r => r.status === 'completed') && session.status !== 'completed') {
          await Session.findByIdAndUpdate(
            session._id,
            { status: 'completed', updatedAt: new Date() },
            { new: true, runValidators: true }
          );
        }
      }
      // If unmarking re-opened this room, re-open the session too.
      if (becameIncomplete && session.status === 'completed') {
        await Session.findByIdAndUpdate(
          session._id,
          { status: 'active', updatedAt: new Date() },
          { new: true, runValidators: true }
        );
      }
      const user = await User.findById(req.user.id);
      let action;
      if (clear) {
        action = `${user.firstName} ${user.lastName} unmarked section ${section.number} in ${room.name}`;
      } else {
        const completeNote = becameComplete ? ' — room complete' : '';
        action = `${user.firstName} ${user.lastName} recorded ${clamped} present for section ${section.number} in ${room.name}${completeNote}`;
      }
      const logEntry = await addActivityLogEntry(session._id, action, room.name, null, `${user.firstName} ${user.lastName}`);
      emitSessionUpdate(session._id, 'room-updated', { roomId, room: roomResponse }, user, logEntry);
    }

    res.json({ message: 'Section present count updated successfully', room: roomResponse });
  } catch (error) {
    console.error('Update section returns error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
      const { id } = req.params;
  const { name, supplies, status, presentStudents, sectionAttendance, sectionReturns, proctors } = req.body;
  const updateData = {};

  if (name !== undefined) {
    // Check for duplicate room name (excluding current room)
    const existingRoom = await Room.findOne({ name: name.trim(), _id: { $ne: id } });
    if (existingRoom) {
      return res.status(400).json({ message: 'A room with this name already exists' });
    }
    updateData.name = name.trim();
  }
  if (supplies !== undefined) updateData.supplies = supplies;
  if (status !== undefined) updateData.status = status;
  if (presentStudents !== undefined) updateData.presentStudents = presentStudents;
  if (sectionAttendance !== undefined) updateData.sectionAttendance = sectionAttendance;
  if (sectionReturns !== undefined) updateData.sectionReturns = sectionReturns;
  if (proctors !== undefined) updateData.proctors = proctors;

    // Get the old room data BEFORE updating to compare supplies
    const oldRoom = await Room.findById(id);
    if (!oldRoom) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = await Room.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('sections', 'number studentCount accommodations notes');
    
    // Ensure sectionAttendance is included in the response
    const roomResponse = room.toObject();
    if (!roomResponse.sectionAttendance) {
      roomResponse.sectionAttendance = {};
    }

    // Find the session that contains this room to emit real-time update
    const session = await Session.findOne({ rooms: id });
    if (session) {
      // Check if room completion should trigger session completion
      if (status === 'completed') {
        // Get all rooms in the session to check if all are completed
        const allRooms = await Room.find({ _id: { $in: session.rooms } });
        const allRoomsCompleted = allRooms.every(r => r.status === 'completed');
        
        if (allRoomsCompleted && session.status !== 'completed') {
          debugLog('All rooms completed, updating session status to completed');
          await Session.findByIdAndUpdate(
            session._id,
            { status: 'completed', updatedAt: new Date() },
            { new: true, runValidators: true }
          );
          debugLog('Session status updated to completed');
        }
      }
      debugLog(`Room update - Emitting real-time update for session: ${session._id}`);
      // Get user information for the real-time update
      const user = await User.findById(req.user.id);
      
      // Add activity log entry for supply changes or room completion
      let logEntry = null;
      if (supplies !== undefined) {
        debugLog(`🔍 Supply update detected for room ${id}`);
        debugLog(`🔍 Old supplies:`, oldRoom.supplies);
        debugLog(`🔍 New supplies:`, supplies);
        
        if (JSON.stringify(oldRoom.supplies) !== JSON.stringify(supplies)) {
          debugLog(`🔍 Supplies changed, creating log entry`);
          // Compare old and new supplies to create a more descriptive log message
          const oldSupplies = oldRoom.supplies || [];
          const newSupplies = supplies || [];
          
          // Find added and removed supplies by comparing counts
          const oldSupplyCounts = {};
          const newSupplyCounts = {};
          
          // Count old supplies
          oldSupplies.forEach(supply => {
            const normalized = normalizeSupplyName(supply);
            oldSupplyCounts[normalized] = (oldSupplyCounts[normalized] || 0) + 1;
          });
          
          // Count new supplies
          newSupplies.forEach(supply => {
            const normalized = normalizeSupplyName(supply);
            newSupplyCounts[normalized] = (newSupplyCounts[normalized] || 0) + 1;
          });
          
          // Find supplies that were added or removed
          const allSupplyNames = new Set([...Object.keys(oldSupplyCounts), ...Object.keys(newSupplyCounts)]);
          
          const addedSupplies = [];
          const removedSupplies = [];
          
          allSupplyNames.forEach(supplyName => {
            const oldCount = oldSupplyCounts[supplyName] || 0;
            const newCount = newSupplyCounts[supplyName] || 0;
            
            if (newCount > oldCount) {
              // Supply was added (or quantity increased)
              const addedCount = newCount - oldCount;
              for (let i = 0; i < addedCount; i++) {
                addedSupplies.push(supplyName);
              }
            } else if (oldCount > newCount) {
              // Supply was removed (or quantity decreased)
              const removedCount = oldCount - newCount;
              for (let i = 0; i < removedCount; i++) {
                removedSupplies.push(supplyName);
              }
            }
          });
          
          debugLog(`🔍 Added supplies:`, addedSupplies);
          debugLog(`🔍 Removed supplies:`, removedSupplies);
          
          let action = '';
          let details = '';
          
          if (addedSupplies.length > 0 && removedSupplies.length > 0) {
            // Format: "{user name} added {summary} and removed {summary} in Room {room name}"
            const addedSummary = getSupplySummary(addedSupplies);
            const removedSummary = getSupplySummary(removedSupplies);
            action = `${user.firstName} ${user.lastName} added ${addedSummary.summary} and removed ${removedSummary.summary} in Room ${room.name}`;
            details = `Added: ${addedSummary.summary}. Removed: ${removedSummary.summary}`;
          } else if (addedSupplies.length > 0) {
            // Format: "{user name} added {summary} to Room {room name}"
            const addedSummary = getSupplySummary(addedSupplies);
            action = `${user.firstName} ${user.lastName} added ${addedSummary.summary} to Room ${room.name}`;
            details = `Added: ${addedSummary.summary}`;
          } else if (removedSupplies.length > 0) {
            // Format: "{user name} removed {summary} from Room {room name}"
            const removedSummary = getSupplySummary(removedSupplies);
            action = `${user.firstName} ${user.lastName} removed ${removedSummary.summary} from Room ${room.name}`;
            details = `Removed: ${removedSummary.summary}`;
          }
          
          debugLog(`🔍 Action:`, action);
          debugLog(`🔍 Details:`, details);
          
          if (action) {
            logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
            debugLog(`🔍 Log entry created:`, logEntry);
          }
        } else {
          debugLog(`🔍 No supply changes detected`);
        }
      } else if (status === 'completed' && presentStudents !== undefined) {
        // Room completion with present students
        const action = `${user.firstName} ${user.lastName} marked Room ${room.name} complete with ${presentStudents} students present`;
        const details = `Present students: ${presentStudents}`;
        logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
        debugLog(`🔍 Room completion log entry created:`, logEntry);
      } else if (status === 'active' && presentStudents === undefined) {
        // Room marked incomplete - clear present students
        const previousPresentStudents = oldRoom.presentStudents;
        let action, details;
        
        if (previousPresentStudents !== undefined && previousPresentStudents > 0) {
          action = `${user.firstName} ${user.lastName} marked Room ${room.name} incomplete (${previousPresentStudents} students were present)`;
          details = `Room status changed from completed to active. Present students count cleared.`;
        } else {
          action = `${user.firstName} ${user.lastName} marked Room ${room.name} incomplete`;
          details = `Room status changed from completed to active. Present students count cleared.`;
        }
        
        // Clear presentStudents and sectionAttendance when marking room incomplete
        await Room.findByIdAndUpdate(id, { 
          presentStudents: undefined,
          sectionAttendance: {}
        });
        room.presentStudents = undefined;
        room.sectionAttendance = {};
        
        logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
        debugLog(`🔍 Room incomplete log entry created:`, logEntry);
      } else if (proctors !== undefined) {
        debugLog(`🔍 Proctors update detected for room ${id}`);
        const oldProctors = oldRoom.proctors || [];
        const newProctors = proctors || [];
        
        if (JSON.stringify(oldProctors) !== JSON.stringify(newProctors)) {
          debugLog(`🔍 Proctors changed, creating log entry`);
          let action, details;
          
          const oldCount = oldProctors.length;
          const newCount = newProctors.length;
          
          if (newCount > oldCount) {
            action = `${user.firstName} ${user.lastName} added proctor(s) to Room ${room.name}`;
            details = `Proctors updated: ${newCount} proctor(s) assigned`;
          } else if (newCount < oldCount) {
            action = `${user.firstName} ${user.lastName} removed proctor(s) from Room ${room.name}`;
            details = `Proctors updated: ${newCount} proctor(s) assigned`;
          } else {
            action = `${user.firstName} ${user.lastName} updated proctor assignments for Room ${room.name}`;
            details = `Proctors updated: ${newCount} proctor(s) assigned`;
          }
          
          logEntry = await addActivityLogEntry(session._id, action, room.name, details, `${user.firstName} ${user.lastName}`);
          debugLog(`🔍 Room proctors log entry created:`, logEntry);
        }
      } else {
        debugLog(`🔍 No supplies in request body`);
      }
      
      emitSessionUpdate(session._id, 'room-updated', { roomId: id, room: roomResponse }, user, logEntry);
    } else {
      debugLog(`Room update - No session found containing room: ${id}`);
    }

    res.json({ message: 'Room updated successfully', room: roomResponse });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findByIdAndDelete(id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/supplies', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find();
    const allSupplies = rooms
      .flatMap(room => room.supplies)
      .filter((supply, index, arr) => arr.indexOf(supply) === index);
    
    res.json({ supplies: allSupplies });
  } catch (error) {
    console.error('Get supplies error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
