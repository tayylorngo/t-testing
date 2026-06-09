import Session from '../models/Session.js';

// Permission checking middleware
export const checkSessionPermission = (requiredPermission = 'view') => {
  return async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId || req.params.id;
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Session owner has all permissions
      if (session.createdBy.toString() === req.user.id) {
        req.sessionPermissions = { view: true, edit: true, manage: true };
        return next();
      }

      // Check if user is a collaborator
      const collaboration = session.collaborators.find(
        collab => collab.userId.toString() === req.user.id
      );

      if (!collaboration) {
        return res.status(403).json({ message: 'Access denied to this session' });
      }

      // Check if user has the required permission
      if (!collaboration.permissions[requiredPermission]) {
        return res.status(403).json({
          message: `Insufficient permissions. ${requiredPermission} access required.`
        });
      }

      req.sessionPermissions = collaboration.permissions;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};
