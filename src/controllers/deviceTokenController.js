const pool = require('../config/database');
const logger = require('../config/logger');

const registerMyDeviceToken = async (req, res) => {
  const userId = req.databaseUser.id;
  const { token, platform } = req.validatedBody;

  try {
    await pool.query(
      `
      INSERT INTO user_device_tokens (
        user_id,
        token,
        platform
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = NOW(),
        last_seen_at = NOW()
      `,
      [userId, token, platform]
    );

    return res.status(200).json({
      success: true,
      message: 'Device registered successfully',
    });
  } catch (error) {
    // Avoid logging the token or database error details
    // that might contain its value.
    logger.error(
      { userId, errorCode: error.code },
      'Device token registration failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to register device',
    });
  }
};

const unregisterMyDeviceToken = async (req, res) => {
  const userId = req.databaseUser.id;
  const { token, platform } = req.validatedBody;

  try {
    await pool.query(
      `
      DELETE FROM user_device_tokens
      WHERE token = $1
        AND user_id = $2
        AND platform = $3
      `,
      [token, userId, platform]
    );

    return res.status(200).json({
      success: true,
      message: 'Device unregistered successfully',
    });
  } catch (error) {
    logger.error(
      { userId, errorCode: error.code },
      'Device token removal failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to unregister device',
    });
  }
};

module.exports = {
  registerMyDeviceToken,
  unregisterMyDeviceToken,
};