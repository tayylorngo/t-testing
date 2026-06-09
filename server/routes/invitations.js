import express from 'express';
import { debugLog } from '../utils/logger.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import SessionInvitation from '../models/SessionInvitation.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkSessionPermission } from '../middleware/permissions.js';
import { emitSessionUpdate } from '../realtime/socket.js';
import { addActivityLogEntry } from '../utils/activityLog.js';

const router = express.Router();

router.post('/api/sessions/:sessionId/invite', authenticateToken, checkSessionPermission('manage'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { invitedUserId, permissions } = req.body;

    if (!invitedUserId) {
      return res.status(400).json({ message: 'Invited user ID is required' });
    }

    // Get the session to check if the current user is the owner
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is already a collaborator
    const existingCollaborator = session.collaborators.find(
      collab => collab.userId.toString() === invitedUserId
    );

    if (existingCollaborator) {
      return res.status(400).json({ message: 'User is already a collaborator on this session' });
    }

    // Check if invitation already exists
    const existingInvitation = await SessionInvitation.findOne({
      sessionId,
      invitedUserId,
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({ message: 'Invitation already sent to this user' });
    }

    // Determine permissions based on whether user is owner or manager
    let finalPermissions = { view: true, edit: false, manage: false }; // Default
    const isOwner = session.createdBy.toString() === req.user.id;

    if (isOwner) {
      // Owners can set any permissions
      finalPermissions = permissions || { view: true, edit: false, manage: false };
    } else {
      // Non-owners (managers) can only invite as viewers
      finalPermissions = { view: true, edit: false, manage: false };
    }

    // Create invitation
    const invitation = new SessionInvitation({
      sessionId,
      invitedUserId,
      invitedBy: req.user.id,
      permissions: finalPermissions
    });

    await invitation.save();

    // Populate user details for response
    await invitation.populate('invitedUserId', 'username firstName lastName');

    res.status(201).json({ 
      message: 'Invitation sent successfully', 
      invitation 
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/api/invitations/pending', authenticateToken, async (req, res) => {
  try {
    const invitations = await SessionInvitation.find({
      invitedUserId: req.user.id,
      status: 'pending'
    }).populate('sessionId').populate('invitedBy', 'username firstName lastName');
    
    debugLog('Pending invitations with populated data:', JSON.stringify(invitations, null, 2));
    
    res.json({ invitations });
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});
router.get('/api/invitations/sent', authenticateToken, async (req, res) => {
  try {
    const invitations = await SessionInvitation.find({
      invitedBy: req.user.id
    }).populate('sessionId').populate('invitedUserId', 'username firstName lastName');
    
    debugLog('Sent invitations with populated data:', JSON.stringify(invitations, null, 2));
    
    res.json({ invitations });
  } catch (error) {
    console.error('Error fetching sent invitations:', error);
    res.status(500).json({ error: 'Failed to fetch sent invitations' });
  }
});
router.put('/api/invitations/:invitationId/accept', authenticateToken, async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await SessionInvitation.findOne({
      _id: invitationId,
      invitedUserId: req.user.id,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found or expired' });
    }

    // Add user as collaborator
    await Session.findByIdAndUpdate(
      invitation.sessionId,
      {
        $push: {
          collaborators: {
            userId: req.user.id,
            permissions: invitation.permissions,
            addedAt: new Date()
          }
        }
      }
    );

    // Update invitation status
    invitation.status = 'accepted';
    await invitation.save();

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/api/invitations/:invitationId/decline', authenticateToken, async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await SessionInvitation.findOne({
      _id: invitationId,
      invitedUserId: req.user.id,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    invitation.status = 'declined';
    await invitation.save();

    res.json({ message: 'Invitation declined successfully' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/api/invitations/:invitationId', authenticateToken, async (req, res) => {
  try {
    const invitation = await SessionInvitation.findById(req.params.invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    // Only the person who sent the invitation can cancel it
    if (invitation.invitedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel invitations you sent' });
    }
    
    // Only pending invitations can be cancelled
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending invitations can be cancelled' });
    }
    
    await SessionInvitation.findByIdAndDelete(req.params.invitationId);
    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});
router.delete('/api/invitations/:invitationId/clear', authenticateToken, async (req, res) => {
  try {
    const invitation = await SessionInvitation.findById(req.params.invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    // Only the person who sent the invitation can clear it
    if (invitation.invitedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only clear invitations you sent' });
    }
    
    // Only accepted or declined invitations can be cleared
    if (invitation.status === 'pending') {
      return res.status(400).json({ error: 'Pending invitations cannot be cleared. Use cancel instead.' });
    }
    
    await SessionInvitation.findByIdAndDelete(req.params.invitationId);
    res.json({ message: 'Invitation cleared successfully' });
  } catch (error) {
    console.error('Error clearing invitation:', error);
    res.status(500).json({ error: 'Failed to clear invitation' });
  }
});

export default router;
