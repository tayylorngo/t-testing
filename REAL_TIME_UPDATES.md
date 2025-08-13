# Real-Time Updates for T-Testing System

## Overview

The T-Testing system now supports real-time updates across all connected users. When one user makes changes to a testing session, those changes are automatically reflected on other users' screens without requiring a page refresh.

## Features

### 🔌 WebSocket Connection

- **Real-time bidirectional communication** between server and clients
- **Automatic reconnection** if connection is lost
- **Fallback to polling** if WebSocket is unavailable

### 📡 Live Session Updates

- **Room additions/removals** - instantly visible to all users
- **Section changes** - real-time updates for all collaborators
- **Session modifications** - live updates for name, date, time, status
- **Permission changes** - immediate reflection across all users

### 🎯 Smart Update Handling

- **Event-based updates** - only relevant data is transmitted
- **Efficient broadcasting** - updates sent only to users in the same session
- **Automatic state synchronization** - keeps all users on the same page

## How It Works

### Server-Side (WebSocket)

1. **Socket.io server** handles real-time connections
2. **Session rooms** group users by testing session
3. **Event emission** sends updates to all users in a session
4. **Automatic cleanup** when users leave sessions

### Client-Side (React)

1. **RealTimeContext** manages WebSocket connections
2. **Automatic session joining** when viewing a session
3. **Event listeners** handle incoming updates
4. **State synchronization** updates UI without manual refresh

## Implementation Details

### Server Endpoints with Real-Time Updates

- `POST /api/sessions/:sessionId/rooms` - Room added
- `DELETE /api/sessions/:sessionId/rooms/:roomId` - Room removed
- `POST /api/sessions/:sessionId/sections` - Section added
- `DELETE /api/sessions/:sessionId/sections/:sectionId` - Section removed
- `PUT /api/sessions/:id` - Session updated

### Update Types

- `room-added` - New room added to session
- `room-removed` - Room removed from session
- `section-added` - New section added to session
- `section-removed` - Section removed from session
- `session-updated` - Session details modified

### Client Usage

```jsx
import { useRealTime } from "../contexts/RealTimeContext";

function MyComponent() {
  const { joinSession, leaveSession, onSessionUpdate, isConnected } =
    useRealTime();

  useEffect(() => {
    // Join a session room
    joinSession(sessionId);

    // Listen for updates
    const cleanup = onSessionUpdate(sessionId, (update) => {
      console.log("Real-time update:", update);
      // Handle the update
    });

    return () => {
      cleanup();
      leaveSession();
    };
  }, [sessionId]);

  return (
    <div>
      {/* Show connection status */}
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? "bg-green-500" : "bg-red-500"
        }`}
      ></div>
      <span>{isConnected ? "Live" : "Offline"}</span>
    </div>
  );
}
```

## Benefits

### 🚀 Performance

- **No page refreshes** required for updates
- **Instant feedback** for collaborative work
- **Reduced server load** from polling requests

### 👥 Collaboration

- **Real-time coordination** between team members
- **Immediate visibility** of changes
- **Better workflow** for testing sessions

### 🎯 User Experience

- **Seamless updates** without interruption
- **Live status indicators** show connection health
- **Automatic synchronization** keeps everyone in sync

## Technical Requirements

### Server Dependencies

- `socket.io` - WebSocket server implementation

### Client Dependencies

- `socket.io-client` - WebSocket client implementation

### Environment Variables

```env
VITE_API_URL=http://localhost:3001  # WebSocket server URL
```

## Future Enhancements

### Planned Features

- **Typing indicators** - Show when users are editing
- **Presence indicators** - Show who's currently viewing a session
- **Conflict resolution** - Handle simultaneous edits gracefully
- **Offline support** - Queue updates when disconnected

### Potential Use Cases

- **Live testing coordination** - Real-time test administration
- **Collaborative planning** - Team session planning
- **Emergency updates** - Instant notification of changes
- **Audit trails** - Track who made what changes when

## Troubleshooting

### Common Issues

1. **Connection lost** - Check network connectivity
2. **Updates not showing** - Verify session room membership
3. **Performance issues** - Check WebSocket connection health

### Debug Information

- Browser console shows real-time connection status
- Server logs display WebSocket events
- Connection indicators show live/offline status

## Security Considerations

### Authentication

- WebSocket connections require valid JWT tokens
- Session membership verified before updates
- Permission-based access control maintained

### Data Validation

- All updates validated server-side
- No direct client-to-client communication
- Sanitized data transmission

---

This real-time update system transforms the T-Testing platform from a static application into a dynamic, collaborative environment where multiple users can work together seamlessly on testing sessions.
