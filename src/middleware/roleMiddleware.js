const supportedRoles = new Set([
  'user',
  'technician',
  'admin',
]);

const requireRole = (...allowedRoles) => {
  if (allowedRoles.length === 0) {
    throw new TypeError(
      'requireRole needs at least one allowed role'
    );
  }

  const hasUnsupportedRole = allowedRoles.some(
    (role) => !supportedRoles.has(role)
  );

  if (hasUnsupportedRole) {
    throw new TypeError(
      'requireRole received an unsupported role'
    );
  }

  return (req, res, next) => {
    const databaseUser = req.databaseUser;

    if (!databaseUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User profile is not loaded',
      });
    }

    if (databaseUser.is_active !== true) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - User account is inactive',
      });
    }

    if (!allowedRoles.includes(databaseUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - Insufficient permissions',
      });
    }

    return next();
  };
};

module.exports = requireRole;