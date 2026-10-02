const express = require('express');

const verifyFirebaseToken = require('../middleware/authMiddleware');
const attachDatabaseUser = require(
  '../middleware/databaseUserMiddleware'
);
const requireRole = require('../middleware/roleMiddleware');
const {
  validateCreateTechnicianProfile,
  validateSpecializationSelection,
  validateUpdateTechnicianProfile,
} = require(
  '../middleware/technicianValidationMiddleware'
);
const {
  validateAvailableTechnicianSearch,
} = require(
  '../middleware/technicianSearchValidationMiddleware'
);
const {
  getMyTechnicianProfile,
  createMyTechnicianProfile,
  setMySpecializations,
  getMySpecializations,
  updateMyTechnicianProfile,
  getAvailableTechnicians,
  getMySpecializationChangeRequest,
} = require('../controllers/technicianController');

const router = express.Router();
router.get(
  '/me/specialization-change-request',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  getMySpecializationChangeRequest
);

router.get(
  '/available',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  validateAvailableTechnicianSearch,
  getAvailableTechnicians
);

router.post(
  '/',
  verifyFirebaseToken,
  attachDatabaseUser,
  validateCreateTechnicianProfile,
  createMyTechnicianProfile
);

router.get(
  '/me',
  verifyFirebaseToken,
  attachDatabaseUser,
  getMyTechnicianProfile
);

router.patch(
  '/me',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  validateUpdateTechnicianProfile,
  updateMyTechnicianProfile
);
router.get(
  '/me/specializations',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  getMySpecializations
);

router.put(
  '/me/specializations',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  validateSpecializationSelection,
  setMySpecializations
);

module.exports = router;