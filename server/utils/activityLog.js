import Session from '../models/Session.js';
import { debugLog } from './logger.js';

// Helper function to add activity log entries to sessions
export const addActivityLogEntry = async (sessionId, action, roomName = null, details = null, userName = null) => {
  try {
    debugLog(`📝 addActivityLogEntry called for session: ${sessionId}`)
    debugLog(`📝 Action: ${action}, Room: ${roomName}, Details: ${details}, User: ${userName}`)

    const session = await Session.findById(sessionId);
    if (!session) {
      debugLog(`❌ Session ${sessionId} not found for activity log entry`);
      return null;
    }

    const logEntry = {
      action,
      timestamp: new Date(),
      userName: userName || 'Unknown User',
      roomName,
      details
    };

    // Add to beginning of array and keep only last 100 entries
    session.activityLog = [logEntry, ...(session.activityLog || [])].slice(0, 100);
    await session.save();

    debugLog(`✅ Activity log entry added to session ${sessionId}:`, logEntry);
    return logEntry;
  } catch (error) {
    console.error(`❌ Error adding activity log entry to session ${sessionId}:`, error);
    return null;
  }
};
