const pool = require('../config/database');
const logger = require('../config/logger');

const syncUser = async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const email = req.user.email || null;
    const name = req.user.name || null;

    const result = await pool.query(
      `
      INSERT INTO users (
        firebase_uid,
        name,
        email
      )
      VALUES ($1, $2, $3)

      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        email = COALESCE(EXCLUDED.email, users.email),
        updated_at = NOW()

      RETURNING
        id,
        firebase_uid,
        name,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `,
      [firebaseUid, name, email]
    );

    return res.status(200).json({
      success: true,
      message: 'User synced successfully',
      user: result.rows[0],
    });
  } catch (error) {
    logger.error({ err: error }, 'User sync failed');

    return res.status(500).json({
      success: false,
      message: 'Failed to sync user',
    });
  }
};
const getMyProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.databaseUser,
  });
};
module.exports = {
  syncUser,
  getMyProfile,
};
