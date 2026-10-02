const pool = require('../config/database');
const logger = require('../config/logger');

const attachDatabaseUser = async (req, res, next) => {
  const firebaseUid = req.user?.uid;

  if (!firebaseUid) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Authentication is required',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        firebase_uid,
        name,
        email,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE firebase_uid = $1
      `,
      [firebaseUid]
    );

    const databaseUser = result.rows[0];

    if (!databaseUser) {
      return res.status(404).json({
        success: false,
        message: 'User profile was not found. Sync the user first.',
      });
    }

    if (databaseUser.is_active !== true) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - User account is inactive',
      });
    }

    req.databaseUser = databaseUser;

    return next();
  } catch (error) {
    logger.error(
      { err: error, firebaseUid },
      'Database user lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to load user profile',
    });
  }
};

module.exports = attachDatabaseUser;