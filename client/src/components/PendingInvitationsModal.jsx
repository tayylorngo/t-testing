import { useState, useEffect, useRef } from 'react'
import { testingAPI } from '../services/api'

function PendingInvitationsModal({ user, isOpen, onClose, onInvitationResponded }) {
  const [invitations, setInvitations] = useState([])
  const [sentInvitations, setSentInvitations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState(null)
  const [activeTab, setActiveTab] = useState('received') // 'received' or 'sent'
  
  // Use ref to preserve tab state across re-renders
  const activeTabRef = useRef(activeTab)
  
  // Update ref whenever activeTab changes
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  
  // Restore tab state if it gets reset unexpectedly
  const restoreTabState = () => {
    if (activeTabRef.current && activeTabRef.current !== activeTab) {
      console.log('Restoring tab state from:', activeTab, 'to:', activeTabRef.current)
      setActiveTab(activeTabRef.current)
    }
  }
  
  // Check and restore tab state after component mounts
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure state is stable
      const timer = setTimeout(() => {
        restoreTabState()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, activeTab])
  
  // Check and restore tab state after invitation state changes
  useEffect(() => {
    if (isOpen && (invitations.length > 0 || sentInvitations.length > 0)) {
      restoreTabState()
    }
  }, [invitations.length, sentInvitations.length, isOpen])

  useEffect(() => {
    if (isOpen) {
      console.log('Modal opened, fetching invitations, current activeTab:', activeTab)
      fetchInvitations()
    }
  }, [isOpen]) // Only depend on isOpen, not on activeTab

  const fetchInvitations = async () => {
    setIsLoading(true)
    try {
      console.log('Fetching invitations...')
      // Fetch received invitations
      const receivedResponse = await testingAPI.getPendingInvitations()
      console.log('Received invitations response:', receivedResponse)
      console.log('First received invitation structure:', receivedResponse.invitations?.[0])
      setInvitations(receivedResponse.invitations || [])
      
      // Fetch sent invitations
      const sentResponse = await testingAPI.getSentInvitations()
      console.log('Sent invitations response:', sentResponse)
      console.log('First sent invitation structure:', sentResponse.invitations?.[0])
      setSentInvitations(sentResponse.invitations || [])
    } catch (error) {
      console.error('Error fetching invitations:', error)
      setInvitations([])
      setSentInvitations([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptInvitation = async (invitationId) => {
    setRespondingTo(invitationId)
    try {
      await testingAPI.acceptInvitation(invitationId)
      
      // Update local state directly instead of refetching
      setInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation._id !== invitationId)
      )
      
      if (onInvitationResponded) onInvitationResponded()
    } catch (error) {
      console.error('Error accepting invitation:', error)
    } finally {
      setRespondingTo(null)
    }
  }

  const handleDeclineInvitation = async (invitationId) => {
    setRespondingTo(invitationId)
    try {
      await testingAPI.declineInvitation(invitationId)
      
      // Update local state directly instead of refetching
      setInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation._id !== invitationId)
      )
      
      if (onInvitationResponded) onInvitationResponded()
    } catch (error) {
      console.error('Error declining invitation:', error)
    } finally {
      setRespondingTo(null)
    }
  }

  const handleCancelInvitation = async (invitationId) => {
    try {
      await testingAPI.cancelInvitation(invitationId)
      
      // Update local state directly instead of refetching
      setSentInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation._id !== invitationId)
      )
      
      // Don't call onInvitationResponded for canceling - it's not needed and can cause tab switching
    } catch (error) {
      console.error('Error cancelling invitation:', error)
    }
  }

  const handleClearInvitation = async (invitationId) => {
    try {
      console.log('Clearing invitation:', invitationId, 'Current activeTab:', activeTab, 'Ref activeTab:', activeTabRef.current)
      await testingAPI.clearInvitation(invitationId)
      console.log('Invitation cleared successfully')
      
      // Update local state directly instead of refetching
      setSentInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation._id !== invitationId)
      )
      
      console.log('State updated, activeTab should remain:', activeTab, 'Ref activeTab:', activeTabRef.current)
      
      // Don't call onInvitationResponded for clearing - it's not needed and causes tab switching
    } catch (error) {
      console.error('Error clearing invitation:', error)
      // Prevent page reload by handling the error gracefully
      alert('Failed to clear invitation. Please try again.')
    }
  }

  const handleLeaveSession = async (sessionId) => {
    try {
      await testingAPI.leaveSession(sessionId)
      
      // Update local state directly instead of refetching
      setInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation.sessionId?._id !== sessionId)
      )
      
      if (onInvitationResponded) onInvitationResponded()
    } catch (error) {
      console.error('Error leaving session:', error)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      return date.toLocaleDateString()
    } catch (error) {
      console.error('Error formatting date:', dateString, error)
      return 'Invalid date'
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return 'No time set'
    try {
      // Parse time string like "09:00" or "14:30"
      const [hours, minutes] = timeString.split(':').map(Number)
      if (isNaN(hours) || isNaN(minutes)) return 'Invalid time'
      
      const date = new Date(2000, 0, 1, hours, minutes)
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    } catch (error) {
      console.error('Error formatting time:', timeString, error)
      return 'Invalid time'
    }
  }

  const getPermissionText = (permissions) => {
    const perms = []
    if (permissions.view) perms.push('View')
    if (permissions.edit) perms.push('Edit')
    if (permissions.manage) perms.push('Manage')
    return perms.join(', ')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Invitations</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`px-6 py-3 font-medium transition-all duration-200 ${
              activeTab === 'received' 
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => {
              console.log('Switching to received tab, current:', activeTab)
              setActiveTab('received')
            }}
          >
            Received ({invitations.length})
          </button>
          <button
            className={`px-6 py-3 font-medium transition-all duration-200 ${
              activeTab === 'sent' 
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => {
              console.log('Switching to sent tab, current:', activeTab)
              setActiveTab('sent')
            }}
          >
            Sent ({sentInvitations.length})
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading invitations...</p>
          </div>
        ) : activeTab === 'received' ? (
          // Received Invitations Tab
          <div>
                         {invitations.length === 0 ? (
               <div className="text-center py-12">
                 <div className="text-gray-400 mb-4">
                   <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                   </svg>
                 </div>
                 <p className="text-gray-500 text-lg">No pending invitations received</p>
                 <p className="text-gray-400 text-sm">When someone invites you to a session, it will appear here</p>
               </div>
             ) : (
              <div className="space-y-4">
                                 {invitations.map((invitation) => (
                   <div key={invitation._id} className="border border-gray-200 rounded-xl p-6 bg-gray-50 hover:bg-white hover:shadow-md transition-all duration-200">
                     <div className="flex justify-between items-start">
                       <div className="flex-1">
                         <h3 className="text-lg font-semibold text-gray-900 mb-3">{invitation.sessionId?.name || 'Session'}</h3>
                         <div className="space-y-2 text-sm text-gray-600">
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Invited by:</span>
                             <span className="ml-2">{invitation.invitedBy?.username || 'Unknown'}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Test Date:</span>
                             <span className="ml-2">{formatDate(invitation.sessionId?.date)} at {formatTime(invitation.sessionId?.startTime)}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Invitation sent:</span>
                             <span className="ml-2">{formatDate(invitation.createdAt)} at {new Date(invitation.createdAt).toLocaleTimeString()}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Permissions:</span>
                             <span className="ml-2">{getPermissionText(invitation.permissions)}</span>
                           </div>
                         </div>
                       </div>
                       <div className="flex space-x-3 ml-6">
                         <button
                           onClick={() => handleAcceptInvitation(invitation._id)}
                           disabled={respondingTo === invitation._id}
                           className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                         >
                           {respondingTo === invitation._id ? 'Accepting...' : 'Accept'}
                         </button>
                         <button
                           onClick={() => handleDeclineInvitation(invitation._id)}
                           disabled={respondingTo === invitation._id}
                           className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                         >
                           {respondingTo === invitation._id ? 'Declining...' : 'Decline'}
                         </button>
                         {/* Leave Session button for accepted invitations */}
                         {invitation.sessionId?.collaborators?.some(collab => collab.userId === user?._id) && (
                           <button
                             onClick={() => handleLeaveSession(invitation.sessionId._id)}
                             className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200 font-medium"
                           >
                             Leave Session
                           </button>
                         )}
                       </div>
                     </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        ) : (
          // Sent Invitations Tab
          <div>
                         {sentInvitations.length === 0 ? (
               <div className="text-center py-12">
                 <div className="text-gray-400 mb-4">
                   <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                   </svg>
                 </div>
                 <p className="text-gray-500 text-lg">No invitations sent</p>
                 <p className="text-gray-400 text-sm">When you invite someone to a session, it will appear here</p>
               </div>
             ) : (
              <div className="space-y-4">
                                 {sentInvitations.map((invitation) => (
                   <div key={invitation._id} className="border border-gray-200 rounded-xl p-6 bg-gray-50 hover:bg-white hover:shadow-md transition-all duration-200">
                     <div className="flex justify-between items-start">
                       <div className="flex-1">
                         <h3 className="text-lg font-semibold text-gray-900 mb-3">{invitation.sessionId?.name || 'Session'}</h3>
                         <div className="space-y-2 text-sm text-gray-600">
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Invited:</span>
                             <span className="ml-2">{invitation.invitedUserId?.username || 'Unknown'}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Test Date:</span>
                             <span className="ml-2">{formatDate(invitation.sessionId?.date)} at {formatTime(invitation.sessionId?.startTime)}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Invitation sent:</span>
                             <span className="ml-2">{formatDate(invitation.createdAt)} at {new Date(invitation.createdAt).toLocaleTimeString()}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Permissions:</span>
                             <span className="ml-2">{getPermissionText(invitation.permissions)}</span>
                           </div>
                           <div className="flex items-center">
                             <span className="font-medium text-gray-700">Status:</span>
                             <span className={`ml-2 font-medium px-2 py-1 rounded-full text-xs ${
                               invitation.status === 'pending' 
                                 ? 'bg-yellow-100 text-yellow-800' 
                                 : invitation.status === 'accepted' 
                                 ? 'bg-green-100 text-green-800' 
                                 : 'bg-red-100 text-red-800'
                             }`}>
                               {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                             </span>
                           </div>
                         </div>
                       </div>
                                               <div className="flex space-x-2">
                                                     {invitation.status === 'pending' && (
                             <button
                               type="button"
                               onClick={() => handleCancelInvitation(invitation._id)}
                               className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium"
                             >
                               Cancel
                             </button>
                           )}
                                                     {(invitation.status === 'accepted' || invitation.status === 'declined') && (
                             <button
                               type="button"
                               onClick={() => handleClearInvitation(invitation._id)}
                               className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors duration-200 font-medium"
                             >
                               Clear
                             </button>
                           )}
                        </div>
                     </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PendingInvitationsModal
