// API service for T-Testing application

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Authentication API calls
export const authAPI = {
  // Login user
  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    return handleResponse(response);
  },

  // Register user
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  // Logout user
  logout: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Verify token
  verifyToken: async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
};

// Testing sessions API calls
export const testingAPI = {
  // Get all testing sessions
  getSessions: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Create new testing session
  createSession: async (sessionData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData),
    });
    return handleResponse(response);
  },

  // Get specific session
  getSession: async (sessionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Update session
  updateSession: async (sessionId, sessionData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData),
    });
    return handleResponse(response);
  },

  // Search users for invitation
  searchUsers: async (query, sessionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}&sessionId=${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Send invitation
  sendInvitation: async (sessionId, invitedUserId, permissions) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invitedUserId, permissions }),
    });
    return handleResponse(response);
  },

  // Get pending invitations
  getPendingInvitations: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/invitations/pending`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get sent invitations
  getSentInvitations: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/invitations/sent`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Accept invitation
  acceptInvitation: async (invitationId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/accept`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Decline invitation
  declineInvitation: async (invitationId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/decline`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Cancel/revoke an invitation
  cancelInvitation: async (invitationId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to cancel invitation');
    }
    
    return response.json();
  },

  // Clear/delete an accepted or declined invitation
  clearInvitation: async (invitationId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/clear`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to clear invitation');
    }
    
    return response.json();
  },

  // Get session collaborators
  getSessionCollaborators: async (sessionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/collaborators`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Update collaborator permissions
  updateCollaboratorPermissions: async (sessionId, userId, permissions) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/collaborators/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ permissions }),
    });
    return handleResponse(response);
  },

  // Remove collaborator
  removeCollaborator: async (sessionId, userId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Leave session (for invited users)
  leaveSession: async (sessionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/leave`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Delete session
  deleteSession: async (sessionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Add room to session
  addRoomToSession: async (sessionId, roomId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomId }),
    });
    return handleResponse(response);
  },

  // Remove room from session
  removeRoomFromSession: async (sessionId, roomId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Create new section
  createSection: async (sectionData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sectionData),
    });
    return handleResponse(response);
  },

  // Update section
  updateSection: async (sectionId, sectionData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sections/${sectionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sectionData),
    });
    return handleResponse(response);
  },

  // Add section to room
  addSectionToRoom: async (roomId, sectionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/sections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sectionId }),
    });
    return handleResponse(response);
  },

  // Remove section from room
  removeSectionFromRoom: async (roomId, sectionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/sections/${sectionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Add section to session
  addSectionToSession: async (sessionId, sectionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/sections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sectionId }),
    });
    return handleResponse(response);
  },

  // Remove section from session
  removeSectionFromSession: async (sessionId, sectionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/sections/${sectionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Delete section completely (removes from all rooms and sessions)
  deleteSection: async (sectionId) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/sections/${sectionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get all testing rooms
  getRooms: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Create new room
  createRoom: async (roomData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roomData),
    });
    return handleResponse(response);
  },

  // Create room with sections
  createRoomWithSections: async (roomData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms/with-sections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roomData),
    });
    return handleResponse(response);
  },

  // Update room
  updateRoom: async (roomId, roomData) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roomData),
    });
    return handleResponse(response);
  },

  // Update room status
  updateRoomStatus: async (roomId, status) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  // Get supplies needed
  getSupplies: async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/supplies`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
};

// Utility functions
export const apiUtils = {
  // Get auth token
  getToken: () => localStorage.getItem('authToken'),
  
  // Set auth token
  setToken: (token) => localStorage.setItem('authToken', token),
  
  // Remove auth token
  removeToken: () => localStorage.removeItem('authToken'),
  
  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('authToken');
    return !!token;
  },
  
  // Clear all auth data
  clearAuth: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  },
}; 