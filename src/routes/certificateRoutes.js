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
  validateCreateCertificate,
  validateCertificateId,
} = require(
  '../middleware/certificateValidationMiddleware'
);
const {
  uploadCertificateImage,
} = require(
  '../middleware/certificateImageUploadMiddleware'
);
const {
  createMyCertificate,
  getMyCertificates,
  deleteMyCertificate,
  getCertificateImage,
} = require('../controllers/certificateController');

const router = express.Router();

router.use(
  verifyFirebaseToken,
  attachDatabaseUser
);

// The controller checks ownership or admin permission.
router.get(
  '/:certificateId/image',
  requireRole('technician', 'admin'),
  validateCertificateId,
  getCertificateImage
);

// All remaining operations are for technicians only.
router.use(requireRole('technician'));

router.get('/', getMyCertificates);

router.post(
  '/',
  uploadCertificateImage,
  validateCreateCertificate,
  createMyCertificate
);

router.delete(
  '/:certificateId',
  validateCertificateId,
  deleteMyCertificate
);

module.exports = router;