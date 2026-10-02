const express = require('express');

const verifyFirebaseToken = require(
  '../middleware/authMiddleware'
);
const attachDatabaseUser = require(
  '../middleware/databaseUserMiddleware'
);
const {
  validateDeviceToken,
} = require(
  '../middleware/deviceTokenValidationMiddleware'
);
const {
  registerMyDeviceToken,
  unregisterMyDeviceToken,
} = require(
  '../controllers/deviceTokenController'
);

const router = express.Router();

router.use(
  verifyFirebaseToken,
  attachDatabaseUser
);

router.put(
  '/',
  validateDeviceToken,
  registerMyDeviceToken
);

router.delete(
  '/',
  validateDeviceToken,
  unregisterMyDeviceToken
);

module.exports = router;