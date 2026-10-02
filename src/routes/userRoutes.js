const express = require('express');

const verifyFirebaseToken = require('../middleware/authMiddleware');
const attachDatabaseUser = require('../middleware/databaseUserMiddleware');
const {
  requireEmptyBody,
} = require('../middleware/validationMiddleware');
const {
  syncUser,
  getMyProfile,
} = require('../controllers/userController');

const router = express.Router();

router.post(
  '/sync',
  verifyFirebaseToken,
  requireEmptyBody,
  syncUser
);

router.get(
  '/me',
  verifyFirebaseToken,
  attachDatabaseUser,
  getMyProfile
);

module.exports = router;