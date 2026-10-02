const express = require('express');

const verifyFirebaseToken = require('../middleware/authMiddleware');
const attachDatabaseUser = require(
  '../middleware/databaseUserMiddleware'
);
const {
  requireEmptyBody,
} = require('../middleware/validationMiddleware');

const {
  getMyNotifications,
  getUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(
  verifyFirebaseToken,
  attachDatabaseUser
);

router.get('/', getMyNotifications);

router.get(
  '/unread-count',
  getUnreadNotificationCount
);

router.patch(
  '/read-all',
  requireEmptyBody,
  markAllMyNotificationsRead
);

router.patch(
  '/:notificationId/read',
  requireEmptyBody,
  markMyNotificationRead
);

module.exports = router;