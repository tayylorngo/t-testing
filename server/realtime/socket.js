import { debugLog } from '../utils/logger.js';

// Real-time session management
const activeSessions = new Map(); // sessionId -> Set of socketIds
const userSessions = new Map(); // socketId -> sessionId

// The socket.io server instance, set via initRealtime() during startup.
let io = null;

// WebSocket connection handling
export const initRealtime = (ioInstance) => {
  io = ioInstance;

  io.on('connection', (socket) => {
    debugLog('🔌 User connected:', socket.id);

    // Join a session room
    socket.on('join-session', (sessionId) => {
      debugLog(`🔌 Socket ${socket.id} joining session: ${sessionId}`);
      socket.join(`session-${sessionId}`);

      // Track user's active session
      userSessions.set(socket.id, sessionId);

      // Add to active sessions tracking
      if (!activeSessions.has(sessionId)) {
        activeSessions.set(sessionId, new Set());
      }
      activeSessions.get(sessionId).add(socket.id);

      debugLog(`🔌 User ${socket.id} joined session ${sessionId}`);
      debugLog(`🔌 Active sessions:`, Array.from(activeSessions.entries()).map(([id, sockets]) => [id, sockets.size]));
      debugLog(`🔌 Session ${sessionId} now has ${activeSessions.get(sessionId).size} users`);
    });

    // Leave a session room
    socket.on('leave-session', (sessionId) => {
      debugLog(`🔌 Socket ${socket.id} leaving session: ${sessionId}`);
      socket.leave(`session-${sessionId}`);

      // Remove from tracking
      userSessions.delete(socket.id);
      if (activeSessions.has(sessionId)) {
        activeSessions.get(sessionId).delete(socket.id);
        if (activeSessions.get(sessionId).size === 0) {
          activeSessions.delete(sessionId);
        }
      }

      debugLog(`🔌 User ${socket.id} left session ${sessionId}`);
      debugLog(`🔌 Active sessions:`, Array.from(activeSessions.entries()).map(([id, sockets]) => [id, sockets.size]));
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const sessionId = userSessions.get(socket.id);
      if (sessionId) {
        debugLog(`🔌 Socket ${socket.id} disconnected from session: ${sessionId}`);
        if (activeSessions.has(sessionId)) {
          activeSessions.get(sessionId).delete(socket.id);
          if (activeSessions.get(sessionId).size === 0) {
            activeSessions.delete(sessionId);
          }
        }
        userSessions.delete(socket.id);
      }
      debugLog('🔌 User disconnected:', socket.id);
      debugLog(`🔌 Active sessions:`, Array.from(activeSessions.entries()).map(([id, sockets]) => [id, sockets.size]));
    });

    // Handle heartbeat ping
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
};

// Helper function to emit updates to all users in a session
export const emitSessionUpdate = (sessionId, eventType, data, user = null, logEntry = null) => {
  try {
    debugLog(`🚀 emitSessionUpdate called for session: ${sessionId}`)
    debugLog(`🚀 Event type: ${eventType}`)
    debugLog(`🚀 Data:`, data)
    debugLog(`🚀 User:`, user ? `${user.firstName} ${user.lastName}` : 'Unknown User')
    debugLog(`🚀 Log entry:`, logEntry)

    const updatePayload = {
      type: eventType,
      sessionId,
      data: {
        ...data,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User'
      },
      logEntry: logEntry,
      timestamp: new Date().toISOString()
    };

    debugLog(`🚀 Final update payload:`, updatePayload)
    debugLog(`🚀 Emitting ${eventType} update to session ${sessionId}`);

    // Check how many sockets are in the session room
    const sessionRoom = io.sockets.adapter.rooms.get(`session-${sessionId}`);
    const socketCount = sessionRoom ? sessionRoom.size : 0;
    debugLog(`🚀 Number of sockets in session-${sessionId}: ${socketCount}`);

    io.to(`session-${sessionId}`).emit('session-update', updatePayload);
    debugLog(`🚀 Emitted ${eventType} update to session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Error in emitSessionUpdate:`, error);
    // Don't throw the error, just log it to prevent 500 responses
  }
};

export { activeSessions, userSessions };
