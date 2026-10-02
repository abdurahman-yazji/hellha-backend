const pool = require('../config/database');
const logger = require('../config/logger');

const getMyNotifications = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        maintenance_request_id,
        type,
        title,
        body,
        read_at,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 50
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      notifications: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Notifications lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications',
    });
  }
};

const getUnreadNotificationCount = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS unread_count
      FROM notifications
      WHERE user_id = $1
        AND read_at IS NULL
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      unread_count: result.rows[0].unread_count,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Unread notification count failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to count unread notifications',
    });
  }
};

const markMyNotificationRead = async (req, res) => {
  const userId = req.databaseUser.id;
  const notificationId = req.params.notificationId;

  if (
    typeof notificationId !== 'string' ||
    !/^[1-9]\d{0,18}$/.test(notificationId) ||
    BigInt(notificationId) > 9223372036854775807n
  ) {
    return res.status(400).json({
      success: false,
      message: 'A valid notification ID is required',
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
      RETURNING id, read_at
      `,
      [notificationId, userId]
    );

    const notification = result.rows[0];

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification was not found',
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    logger.error(
      { err: error, userId, notificationId },
      'Mark notification read failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
};

const markAllMyNotificationsRead = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET read_at = NOW()
      WHERE user_id = $1
        AND read_at IS NULL
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      updated_count: result.rowCount,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Mark all notifications read failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
    });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
};