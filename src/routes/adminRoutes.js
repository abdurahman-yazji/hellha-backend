const express = require('express');

const verifyFirebaseToken = require('../middleware/authMiddleware');
const attachDatabaseUser = require(
  '../middleware/databaseUserMiddleware'
);
const requireRole = require('../middleware/roleMiddleware');
const {
  validateTechnicianProfileId,
  validateVerificationUpdate,
} = require('../middleware/adminValidationMiddleware');
const {
  getPendingTechnicians,
  getVerifiedTechnicians,
  updateTechnicianVerification,
} = require('../controllers/adminTechnicianController');

const {
  getPendingSpecializationChanges,
  reviewSpecializationChange,
} = require('../controllers/adminSpecializationChangeController');
const router = express.Router();

router.use(
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('admin')
);

router.get(
  '/technicians/pending',
  getPendingTechnicians
);
router.get(
  '/technicians/verified',
  getVerifiedTechnicians
);
router.patch(
  '/technicians/:profileId/verification',
  validateTechnicianProfileId,
  validateVerificationUpdate,
  updateTechnicianVerification
);

router.get(
  '/specialization-change-requests',
  getPendingSpecializationChanges
); 
router.patch(
  '/specialization-change-requests/:requestId/review',
  reviewSpecializationChange
);

module.exports = router;