import { useEffect } from 'react'

// Encapsulates the real-time subscription wiring for a session: joins the session
// room and registers the onSessionUpdate listener whenever the session loads or the
// connection state changes. All collaborators (context fns, the update handler) are
// passed in so the hook stays decoupled from SessionView's state.
export function useSessionRealtime({ sessionId, isConnected, session, user, joinSession, onSessionUpdate, handleRealTimeUpdate }) {
  useEffect(() => {
    console.log('🔄 SessionView useEffect - Setting up real-time updates for session:', sessionId)
    console.log('🔄 SessionView useEffect - isConnected:', isConnected)
    console.log('🔄 SessionView useEffect - Current user:', user ? `${user.firstName} ${user.lastName}` : 'Unknown')
    console.log('🔄 SessionView useEffect - Session loaded:', !!session)

    // Only set up real-time updates if we have session data
    if (!session) {
      console.log('⏳ Session not loaded yet, skipping real-time setup')
      return
    }

    const attemptJoinSession = () => {
      console.log('🔄 SessionView useEffect - Attempting to join session:', sessionId)
      const success = joinSession(sessionId)
      if (!success) {
        console.log('⏳ Session join failed, will retry when connected...')
      }
    }

    attemptJoinSession()

    // Set up real-time update listener
    console.log('🔄 SessionView useEffect - Registering onSessionUpdate callback for session:', sessionId)
    const cleanup = onSessionUpdate(sessionId, handleRealTimeUpdate)
    console.log('🔄 SessionView useEffect - Callback registered successfully')

    return () => {
      console.log('🔄 SessionView useEffect - Cleaning up real-time updates for session:', sessionId)
      cleanup()
      // Don't leave session here as it can cause connection issues
      // The RealTimeContext will handle session management
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- register handler when session loads
  }, [sessionId, isConnected, session])
}
