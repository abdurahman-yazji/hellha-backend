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
  validateCreateMaintenanceRequest,
  validateReassignMaintenanceRequest,
} = require(
  '../middleware/maintenanceRequestValidationMiddleware'
);
const {
  validateMaintenanceRequestStatus,
  validateMaintenanceRequestId,
} = require(
  '../middleware/maintenanceRequestStatusValidationMiddleware'
);
const {
  requireEmptyBody,
} = require('../middleware/validationMiddleware');
const {
  validateMaintenanceRequestReview,
} = require(
  '../middleware/maintenanceRequestReviewValidationMiddleware'
);
const {
  createMaintenanceRequest,
  getMyMaintenanceRequests,
  getMyAssignedMaintenanceRequests,
  updateMyMaintenanceRequestStatus,
  declineMyMaintenanceRequest,
  reassignMyMaintenanceRequest,
  reviewMyMaintenanceRequest,
  cancelMyMaintenanceRequest,
  getMyMaintenanceRequestById,
} = require('../controllers/maintenanceRequestController');

const router = express.Router();

router.get(
  '/technician',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  getMyAssignedMaintenanceRequests
);

router.patch(
  '/technician/:requestId/status',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  validateMaintenanceRequestStatus,
  updateMyMaintenanceRequestStatus
);
router.patch(
  '/technician/:requestId/decline',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('technician'),
  validateMaintenanceRequestId,
  declineMyMaintenanceRequest
);
router.get(
  '/',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  getMyMaintenanceRequests
);

router.post(
  '/',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  validateCreateMaintenanceRequest,
  createMaintenanceRequest
);
router.patch(
  '/:requestId/reassign',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  validateMaintenanceRequestId,
  validateReassignMaintenanceRequest,
  reassignMyMaintenanceRequest
);
router.post(
  '/:requestId/review',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  validateMaintenanceRequestId,
  validateMaintenanceRequestReview,
  reviewMyMaintenanceRequest
);
router.patch(
  '/:requestId/cancel',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user'),
  validateMaintenanceRequestId,
  requireEmptyBody,
  cancelMyMaintenanceRequest
);

router.get(
  '/:requestId',
  verifyFirebaseToken,
  attachDatabaseUser,
  requireRole('user', 'technician'),
  validateMaintenanceRequestId,
  getMyMaintenanceRequestById
);
module.exports = router;