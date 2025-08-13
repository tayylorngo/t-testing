import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const RealTimeContext = createContext();

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
  const updateCallbacks = useRef(new Map()); // sessionId -> Set of callback functions

  useEffect(() => {
    // Initialize socket connection
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log('Connecting to WebSocket server at:', apiUrl);
    
    const newSocket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to real-time server with socket ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from real-time server. Reason:', reason);
      setIsConnected(false);
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

    return () => {
      newSocket.close();
    };
  }, []);

  // Join a session room
  const joinSession = (sessionId) => {
    console.log(`🔄 Attempting to join session: ${sessionId}`);
    console.log(`🔄 Current socket state:`, { socket: !!socket, isConnected, currentSessionId });
    
    if (socket && sessionId && sessionId !== currentSessionId) {
      // Leave previous session if any
      if (currentSessionId) {
        console.log(`🔄 Leaving previous session: ${currentSessionId}`);
        socket.emit('leave-session', currentSessionId);
      }
      
      // Join new session
      console.log(`🔄 Joining new session: ${sessionId}`);
      socket.emit('join-session', sessionId);
      setCurrentSessionId(sessionId);
      console.log(`✅ Successfully joined real-time session: ${sessionId}`);
    } else {
      console.log(`❌ Cannot join session:`, { 
        hasSocket: !!socket, 
        sessionId, 
        currentSessionId,
        isConnected 
      });
    }
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

  const value = {
    socket,
    isConnected,
    currentSessionId,
    joinSession,
    leaveSession,
    onSessionUpdate,
    offSessionUpdate,
  };

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  );
};
