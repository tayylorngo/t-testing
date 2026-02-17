import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const RealTimeContext = createContext();

/* eslint-disable react-refresh/only-export-components */
export const useRealTime = () => {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
};

export const RealTimeProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const updateCallbacks = useRef(new Map()); // sessionId -> Set of callback functions
  const pendingSessionJoin = useRef(null); // Store session to join once connected
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // Start with 1 second

  // Initialize socket connection
  const initializeSocket = () => {
    // Use relative URL in production, absolute URL in development
    const apiUrl = import.meta.env.PROD 
      ? window.location.origin 
      : (import.meta.env.VITE_API_URL || 'http://localhost:3001');
    console.log('🔌 Initializing WebSocket connection to:', apiUrl);
    console.log('🔌 Environment:', import.meta.env.MODE);
    console.log('🔌 Production:', import.meta.env.PROD);
    
    // Clean up existing socket if any
    if (socket) {
      console.log('🔌 Cleaning up existing socket connection');
      // Clear heartbeat interval
      if (socket.heartbeatInterval) {
        clearInterval(socket.heartbeatInterval);
        socket.heartbeatInterval = null;
      }
      socket.close();
    }

    const newSocket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: reconnectDelay,
      timeout: 10000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to real-time server with socket ID:', newSocket.id);
      setIsConnected(true);
      setConnectionAttempts(0);
      
      // If there was a pending session join, execute it now
      if (pendingSessionJoin.current) {
        console.log('🔄 Executing pending session join:', pendingSessionJoin.current);
        const sessionId = pendingSessionJoin.current;
        pendingSessionJoin.current = null;
        joinSessionInternal(sessionId);
      }
      
      // Set up heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('ping');
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Send ping every 30 seconds
      
      // Store the interval for cleanup
      newSocket.heartbeatInterval = heartbeatInterval;
    });
    
    // Handle pong response from server
    newSocket.on('pong', () => {
      console.log('💓 Heartbeat response received from server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
      
      // Increment connection attempts
      const newAttempts = connectionAttempts + 1;
      setConnectionAttempts(newAttempts);
      
      if (newAttempts < maxReconnectAttempts) {
        console.log(`🔄 Connection attempt ${newAttempts} failed. Retrying in ${reconnectDelay}ms...`);
        // Clear any existing timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Set up reconnection attempt
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          initializeSocket();
        }, reconnectDelay);
      } else {
        console.error('❌ Max reconnection attempts reached. Please refresh the page.');
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from real-time server. Reason:', reason);
      setIsConnected(false);
      
      // Clear heartbeat interval
      if (newSocket.heartbeatInterval) {
        clearInterval(newSocket.heartbeatInterval);
        newSocket.heartbeatInterval = null;
      }
      
      // If it's not a manual disconnect, try to reconnect
      if (reason !== 'io client disconnect') {
        console.log('🔄 Disconnection was not manual, attempting to reconnect...');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          initializeSocket();
        }, reconnectDelay);
      }
    });

    newSocket.on('session-update', (update) => {
      console.log('📡 Received real-time update:', update);
      console.log('📡 Update type:', update.type);
      console.log('📡 Update session ID:', update.sessionId);
      console.log('📡 Current session ID:', currentSessionId);
      
      // Call all registered callbacks for this session
      const callbacks = updateCallbacks.current.get(update.sessionId);
      console.log('📡 Found callbacks for session:', callbacks ? callbacks.size : 0);
      
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            console.log('📡 Executing callback for update type:', update.type);
            callback(update);
          } catch (error) {
            console.error('❌ Error in real-time update callback:', error);
          }
        });
      } else {
        console.log('⚠️ No callbacks registered for session:', update.sessionId);
      }
    });

    setSocket(newSocket);
    return newSocket;
  };

  useEffect(() => {
    // Initialize socket connection on mount
    initializeSocket();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        console.log('🔌 Cleaning up socket connection on unmount');
        socket.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once on mount
  }, []);

  // Internal function to join session (used after connection is established)
  const joinSessionInternal = (sessionId) => {
    if (socket && isConnected && sessionId) {
      // Only leave previous session if it's different
      if (currentSessionId && currentSessionId !== sessionId) {
        console.log(`🔄 Leaving previous session: ${currentSessionId}`);
        socket.emit('leave-session', currentSessionId);
      }
      
      // Join new session (even if it's the same one to ensure connection)
      console.log(`🔄 Joining session: ${sessionId}`);
      socket.emit('join-session', sessionId);
      setCurrentSessionId(sessionId);
      console.log(`✅ Successfully joined real-time session: ${sessionId}`);
      return true;
    }
    return false;
  };

  // Join a session room
  const joinSession = (sessionId) => {
    console.log(`🔄 Attempting to join session: ${sessionId}`);
    console.log(`🔄 Current socket state:`, { socket: !!socket, isConnected, currentSessionId });
    
    if (!sessionId) {
      console.log('❌ Cannot join session: No session ID provided');
      return false;
    }

    if (!socket) {
      console.log('❌ Cannot join session: Socket not initialized');
      return false;
    }

    if (!isConnected) {
      console.log('⏳ Cannot join session: Socket not connected. Storing for later...');
      pendingSessionJoin.current = sessionId;
      return false;
    }

    // Always attempt to join, even if we're already in the session
    // This ensures the connection is maintained
    return joinSessionInternal(sessionId);
  };

  // Leave current session
  const leaveSession = () => {
    if (socket && currentSessionId) {
      socket.emit('leave-session', currentSessionId);
      setCurrentSessionId(null);
      console.log(`Left real-time session: ${currentSessionId}`);
    }
  };

  // Register a callback for session updates
  const onSessionUpdate = (sessionId, callback) => {
    console.log(`📝 Registering callback for session: ${sessionId}`);
    console.log(`📝 Current callbacks for this session:`, updateCallbacks.current.has(sessionId) ? updateCallbacks.current.get(sessionId).size : 0);
    
    if (!updateCallbacks.current.has(sessionId)) {
      updateCallbacks.current.set(sessionId, new Set());
    }
    updateCallbacks.current.get(sessionId).add(callback);

    console.log(`✅ Callback registered. Total callbacks for session ${sessionId}:`, updateCallbacks.current.get(sessionId).size);

    // Return cleanup function
    return () => {
      console.log(`🗑️ Unregistering callback for session: ${sessionId}`);
      const callbacks = updateCallbacks.current.get(sessionId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          updateCallbacks.current.delete(sessionId);
          console.log(`🗑️ Removed all callbacks for session: ${sessionId}`);
        } else {
          console.log(`🗑️ Removed callback. Remaining callbacks for session ${sessionId}:`, callbacks.size);
        }
      }
    };
  };

  // Unregister a callback
  const offSessionUpdate = (sessionId, callback) => {
    const callbacks = updateCallbacks.current.get(sessionId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        updateCallbacks.current.delete(sessionId);
      }
    }
  };

  // Manual reconnection function
  const reconnect = () => {
    console.log('🔄 Manual reconnection requested');
    setConnectionAttempts(0);
    initializeSocket();
  };

  const value = {
    socket,
    isConnected,
    currentSessionId,
    connectionAttempts,
    joinSession,
    leaveSession,
    onSessionUpdate,
    offSessionUpdate,
    reconnect,
  };

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  );
};
