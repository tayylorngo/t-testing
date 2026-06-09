import express from 'express';
import { debugLog } from '../utils/logger.js';
import Room from '../models/Room.js';
import Section from '../models/Section.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import SessionInvitation from '../models/SessionInvitation.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkSessionPermission } from '../middleware/permissions.js';
import { emitSessionUpdate } from '../realtime/socket.js';
import { addActivityLogEntry } from '../utils/activityLog.js';

const router = express.Router();

router.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const sessions = await Session.find({
      $or: [
        { createdBy: req.user.id },
        { 'collaborators.userId': req.user.id }
      ],
      ...(includeArchived ? {} : { archived: { $ne: true } })
    })
      .populate([
        {
          path: 'rooms',
          select: 'name supplies status presentStudents sectionAttendance sectionReturns notes proctors',
          populate: {
            path: 'sections',
            select: 'number studentCount accommodations notes'
          }
        },
        {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        },
        {
          path: 'collaborators.userId',
          select: 'username firstName lastName'
        },
        {
          path: 'createdBy',
          select: 'username firstName lastName'
        }
      ])
      .sort({ createdAt: -1 });
    
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/sessions/:id/archive', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { createdBy: req.user.id },
          { 'collaborators.userId': req.user.id }
        ]
      },
      { archived: true, archivedAt: new Date(), archivedBy: req.user.id, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate([
      {
        path: 'rooms',
        select: 'name supplies status presentStudents sectionAttendance sectionReturns notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      },
      {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      },
      {
        path: 'collaborators.userId',
        select: 'username firstName lastName'
      },
      {
        path: 'createdBy',
        select: 'username firstName lastName'
      }
    ]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const user = await User.findById(req.user.id);
    const action = `${user.firstName} ${user.lastName} archived the session`;
    const logEntry = await addActivityLogEntry(req.params.id, action, null, null, `${user.firstName} ${user.lastName}`);
    emitSessionUpdate(req.params.id, 'session-archived', { session }, user, logEntry);

    res.json({ message: 'Session archived successfully', session });
  } catch (error) {
    console.error('Archive session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/sessions/:id/unarchive', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { createdBy: req.user.id },
          { 'collaborators.userId': req.user.id }
        ]
      },
      { archived: false, archivedAt: undefined, archivedBy: undefined, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate([
      {
        path: 'rooms',
        select: 'name supplies status presentStudents sectionAttendance sectionReturns notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      },
      {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      },
      {
        path: 'collaborators.userId',
        select: 'username firstName lastName'
      },
      {
        path: 'createdBy',
        select: 'username firstName lastName'
      }
    ]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const user = await User.findById(req.user.id);
    const action = `${user.firstName} ${user.lastName} unarchived the session`;
    const logEntry = await addActivityLogEntry(req.params.id, action, null, null, `${user.firstName} ${user.lastName}`);
    emitSessionUpdate(req.params.id, 'session-unarchived', { session }, user, logEntry);

    res.json({ message: 'Session unarchived successfully', session });
  } catch (error) {
    console.error('Unarchive session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const { name, description, date, startTime, endTime } = req.body;

    if (!name || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Name, date, start time, and end time are required' });
    }

    // Fix timezone issue by ensuring the date is stored at UTC midnight
    const [year, month, day] = date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed, UTC midnight
    
    const newSession = new Session({
      name,
      description,
      date: utcDate,
      startTime,
      endTime,
      createdBy: req.user.id
    });

    await newSession.save();
    
    const populatedSession = await Session.findById(newSession._id)
      .populate({
        path: 'rooms',
        select: 'name supplies status presentStudents sectionReturns notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes');
    
    res.status(201).json({ 
      message: 'Session created successfully', 
      session: populatedSession 
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/sessions/:id', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const session = await Session.findOne({ 
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { 'collaborators.userId': req.user.id }
      ]
    }).populate([
      {
        path: 'rooms',
        select: 'name supplies status presentStudents sectionAttendance sectionReturns notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      },
      {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      },
      {
        path: 'collaborators.userId',
        select: 'username firstName lastName'
      },
      {
        path: 'createdBy',
        select: 'username firstName lastName'
      }
    ]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/sessions/:id', authenticateToken, checkSessionPermission('edit'), async (req, res) => {
  try {
    const { name, description, date, startTime, endTime, accommodationStartTime, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (date) {
      // Fix timezone issue by ensuring the date is stored at UTC midnight
      const [year, month, day] = date.split('-').map(Number);
      updateData.date = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed, UTC midnight
    }
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (accommodationStartTime !== undefined) updateData.accommodationStartTime = accommodationStartTime || null;
    if (status) updateData.status = status;

    const session = await Session.findOneAndUpdate(
      { 
        _id: req.params.id,
        $or: [
          { createdBy: req.user.id },
          { 'collaborators.userId': req.user.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    ).populate([
      {
        path: 'rooms',
        select: 'name supplies status presentStudents sectionReturns notes proctors',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      },
      {
        path: 'sections',
        select: 'number studentCount accommodations notes'
      },
      {
        path: 'collaborators.userId',
        select: 'username firstName lastName'
      },
      {
        path: 'createdBy',
        select: 'username firstName lastName'
      }
    ]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Add activity log entry for session update (only if not just a status change)
    const user = await User.findById(req.user.id);
    let logEntry = null;
    
    // Only create log entry if more than just status was updated
    const hasNonStatusChanges = name || description !== undefined || date || startTime || endTime;
    if (hasNonStatusChanges) {
      const action = `${user.firstName} ${user.lastName} updated session details`;
      logEntry = await addActivityLogEntry(req.params.id, action, null, 'Session information was modified', `${user.firstName} ${user.lastName}`);
    }

    // Emit real-time update to all users in the session
    emitSessionUpdate(req.params.id, 'session-updated', { session }, user, logEntry);

    res.json({ message: 'Session updated successfully', session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/sessions/:id/duplicate', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { name, description, date, startTime, endTime } = req.body;
    
    // Get the original session with all populated data
    const originalSession = await Session.findById(req.params.id)
      .populate([
        {
          path: 'rooms',
          populate: {
            path: 'sections',
            select: 'number studentCount accommodations notes'
          }
        },
        {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      ]);

    if (!originalSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Create new sections based on original sections
    const newSections = [];
    for (const section of originalSession.sections) {
      const newSection = new Section({
        number: section.number,
        studentCount: section.studentCount,
        accommodations: [...section.accommodations],
        notes: section.notes || ''
      });
      await newSection.save();
      newSections.push(newSection._id);
    }

    // Create new rooms based on original rooms
    const newRooms = [];
    for (const room of originalSession.rooms) {
      // Find sections for this room
      const roomSectionIds = room.sections.map(section => section._id);
      const roomSections = originalSession.sections.filter(section => 
        roomSectionIds.includes(section._id)
      );
      
      // Create new sections for this room
      const newRoomSections = [];
      for (const section of roomSections) {
        const newRoomSection = new Section({
          number: section.number,
          studentCount: section.studentCount,
          accommodations: [...section.accommodations],
          notes: section.notes || ''
        });
        await newRoomSection.save();
        newRoomSections.push(newRoomSection._id);
      }

      // Create new room
      const newRoom = new Room({
        name: room.name,
        supplies: [...room.supplies],
        sections: newRoomSections,
        status: 'planned', // Reset status for new session
        notes: room.notes || ''
      });
      await newRoom.save();
      newRooms.push(newRoom._id);
    }

    // Create the new session
    const newSession = new Session({
      name: name || `${originalSession.name} (Copy)`,
      description: description || originalSession.description || '',
      date: date ? (() => {
        // Fix timezone issue by ensuring the date is stored at UTC midnight
        const [year, month, day] = date.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed, UTC midnight
      })() : originalSession.date,
      startTime: startTime || originalSession.startTime,
      endTime: endTime || originalSession.endTime,
      createdBy: req.user.id,
      rooms: newRooms,
      sections: newSections,
      status: 'planned' // Reset status for new session
    });

    await newSession.save();

    // Return populated session
    const populatedSession = await Session.findById(newSession._id)
      .populate([
        {
          path: 'rooms',
          select: 'name supplies status presentStudents sectionAttendance sectionReturns notes proctors',
          populate: {
            path: 'sections',
            select: 'number studentCount accommodations notes'
          }
        },
        {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        },
        {
          path: 'createdBy',
          select: 'username firstName lastName'
        }
      ]);

    res.status(201).json({ 
      message: 'Session duplicated successfully', 
      session: populatedSession 
    });
  } catch (error) {
    console.error('Duplicate session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/sessions/:sessionId/collaborators', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId)
      .populate('collaborators.userId', 'username firstName lastName')
      .populate('createdBy', 'username firstName lastName');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ 
      owner: session.createdBy,
      collaborators: session.collaborators 
    });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/sessions/:sessionId/collaborators/:userId', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const { sessionId, userId } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ message: 'Valid permissions object is required' });
    }

    // Get the session to check if the current user is the owner
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Only session owners can change permissions
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'Only session owners can change collaborator permissions' 
      });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          'collaborators.$[collab].permissions': permissions
        }
      },
      {
        arrayFilters: [{ 'collab.userId': userId }],
        new: true
      }
    ).populate('collaborators.userId', 'username firstName lastName');

    res.json({ 
      message: 'Collaborator permissions updated successfully',
      collaborators: updatedSession.collaborators
    });
  } catch (error) {
    console.error('Update collaborator permissions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/collaborators/:userId', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const { sessionId, userId } = req.params;

    // Get the session to check if the current user is the owner
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Only session owners can remove collaborators
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'Only session owners can remove collaborators' 
      });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $pull: {
          collaborators: { userId }
        }
      },
      { new: true }
    ).populate('collaborators.userId', 'username firstName lastName');

    res.json({ 
      message: 'Collaborator removed successfully',
      collaborators: updatedSession.collaborators
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/leave', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is a collaborator (not the owner)
    const isCollaborator = session.collaborators.some(collab => collab.userId.toString() === userId);
    if (!isCollaborator) {
      return res.status(403).json({ message: 'You can only leave sessions you were invited to' });
    }

    // Remove user from collaborators
    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $pull: {
          collaborators: { userId }
        }
      },
      { new: true }
    ).populate('collaborators.userId', 'username firstName lastName');

    res.json({ 
      message: 'Successfully left the session',
      collaborators: updatedSession.collaborators
    });
  } catch (error) {
    console.error('Leave session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/sessions/:sessionId/rooms', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required' });
    }

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room is already in session
    if (session.rooms.includes(roomId)) {
      return res.status(400).json({ message: 'Room is already in this session' });
    }

    // Add room to session
    session.rooms.push(roomId);
    await session.save();

    // Return updated session with populated rooms
    const updatedSession = await Session.findById(sessionId)
      .populate({
        path: 'rooms',
        select: 'name supplies',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for room addition
    const user = await User.findById(req.user.id);
    const action = `${user.firstName} ${user.lastName} added Room ${room.name} to the session`;
    const logEntry = await addActivityLogEntry(sessionId, action, room.name, null, `${user.firstName} ${user.lastName}`);

    // Emit real-time update to all users in the session
    emitSessionUpdate(sessionId, 'room-added', { room: room, session: updatedSession }, user, logEntry);

    res.json({ 
      message: 'Room added to session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Add room to session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/rooms', authenticateToken, async (req, res) => {
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

    // Clear all rooms from session
    const roomCount = session.rooms.length;
    session.rooms = [];
    await session.save();

    debugLog(`Cleared ${roomCount} rooms from session ${sessionId}`);

    res.json({ 
      message: `Successfully cleared ${roomCount} rooms from session`,
      clearedCount: roomCount
    });
  } catch (error) {
    console.error('Clear all rooms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, roomId } = req.params;

    // Check if session exists and belongs to user
    const session = await Session.findOne({ 
      _id: sessionId, 
      createdBy: req.user.id 
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Remove room from session
    session.rooms = session.rooms.filter(room => room.toString() !== roomId);
    await session.save();

    // Return updated session with populated rooms
    const updatedSession = await Session.findById(sessionId)
      .populate({
        path: 'rooms',
        select: 'name supplies',
        populate: {
          path: 'sections',
          select: 'number studentCount accommodations notes'
        }
      })
      .populate('sections', 'number studentCount accommodations notes');

    // Add activity log entry for room removal
    const user = await User.findById(req.user.id);
    const room = await Room.findById(roomId);
    let logEntry = null;
    
    if (user && room) {
      const action = `${user.firstName} ${user.lastName} removed Room ${room.name} from the session`;
      logEntry = await addActivityLogEntry(sessionId, action, room.name, null, `${user.firstName} ${user.lastName}`);
    }

    // Emit real-time update to all users in the session
    if (user) {
      emitSessionUpdate(sessionId, 'room-removed', { roomId, session: updatedSession }, user, logEntry);
    } else {
      console.error('User not found for room removal, skipping real-time update');
    }

    res.json({ 
      message: 'Room removed from session successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Remove room to session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/sessions/:sessionId/activity-log', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ activityLog: session.activityLog || [] });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/activity-log', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the session owner
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the session owner can clear the activity log' });
    }

    // Clear the activity log
    session.activityLog = [];
    await session.save();

    // Emit real-time update to all users in the session
    const user = await User.findById(req.user.id);
    emitSessionUpdate(sessionId, 'activity-log-cleared', { message: 'Activity log cleared' }, user);

    res.json({ message: 'Activity log cleared successfully' });
  } catch (error) {
    console.error('Clear activity log error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/sessions/:sessionId/invalidations', authenticateToken, checkSessionPermission('view'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ invalidations: session.invalidations || [] });
  } catch (error) {
    console.error('Get invalidations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/api/sessions/:sessionId/invalidations', authenticateToken, checkSessionPermission('edit'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { roomId, sectionNumber, notes } = req.body;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const user = await User.findById(req.user.id);
    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const invalidation = {
      id: `${roomId}_${sectionNumber}_${Date.now()}`,
      roomId,
      sectionNumber,
      notes,
      timestamp: new Date().toISOString(),
      invalidatedBy: `${user.firstName} ${user.lastName}`
    };

    // Add to session invalidations
    if (!session.invalidations) {
      session.invalidations = [];
    }
    session.invalidations.push(invalidation);
    await session.save();

    // Add to activity log
    const action = `${user.firstName} ${user.lastName} invalidated test for Section ${sectionNumber}`;
    const details = `Notes: ${notes}`;
    const logEntry = await addActivityLogEntry(sessionId, action, room.name, details, `${user.firstName} ${user.lastName}`);

    // Emit real-time update
    emitSessionUpdate(sessionId, 'invalidation-added', { invalidation, session }, user, logEntry);

    res.json({ invalidation });
  } catch (error) {
    console.error('Add invalidation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/sessions/:sessionId/invalidations/:invalidationId', authenticateToken, checkSessionPermission('edit'), async (req, res) => {
  try {
    const { sessionId, invalidationId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const invalidationIndex = session.invalidations.findIndex(inv => inv.id === invalidationId);
    if (invalidationIndex === -1) {
      return res.status(404).json({ message: 'Invalidation not found' });
    }

    const invalidation = session.invalidations[invalidationIndex];
    session.invalidations.splice(invalidationIndex, 1);
    await session.save();

    const user = await User.findById(req.user.id);
    const room = await Room.findById(invalidation.roomId);

    // Add to activity log
    const action = `${user.firstName} ${user.lastName} removed test invalidation for Section ${invalidation.sectionNumber}`;
    const details = `Removed invalidation: ${invalidation.notes}`;
    const logEntry = await addActivityLogEntry(sessionId, action, room?.name || 'Unknown Room', details, `${user.firstName} ${user.lastName}`);

    // Emit real-time update
    emitSessionUpdate(sessionId, 'invalidation-removed', { invalidationId, session }, user, logEntry);

    res.json({ message: 'Invalidation removed successfully' });
  } catch (error) {
    console.error('Remove invalidation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
