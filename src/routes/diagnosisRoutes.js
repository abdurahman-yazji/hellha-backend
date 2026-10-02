const express = require('express');

const verifyFirebaseToken = require(
  '../middleware/authMiddleware'
);
const attachDatabaseUser = require(
  '../middleware/databaseUserMiddleware'
);
const requireRole = require(
  '../middleware/roleMiddleware'
);
const {
  validateDiagnosisRequest,
} = require(
  '../middleware/diagnosisValidationMiddleware'
);
const {
  getMyDiagnoses,
  diagnoseIssue,
} = require(
  '../controllers/diagnosisController'
);
const diagnosisRateLimiter = require(
  '../middleware/diagnosisRateLimitMiddleware'
);

const router = express.Router();

router.get(
  '/',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  getMyDiagnoses
);

router.post(
  '/',
  verifyFirebaseToken,
  diagnosisRateLimiter,
  attachDatabaseUser,
  requireRole('user'),
  validateDiagnosisRequest,
  diagnoseIssue
);

module.exports = router;