const pool = require('../config/database');
const logger = require('../config/logger');
const {
  saveCertificateImage,
  deleteCertificateImage,
  getCertificateImagePath,

} = require('../services/certificateImageService');

const createMyCertificate = async (req, res) => {
  const userId = req.databaseUser.id;

  const {
    certificateName,
    issuingOrganization,
    issueDate,
    expiryDate,
    documentUrl,
  } = req.validatedBody;

  let imageFilename = null;
  let certificateSaved = false;

  try {
    const profileResult = await pool.query(
      `
      SELECT id
      FROM technician_profiles
      WHERE user_id = $1
      `,
      [userId]
    );

    const profile = profileResult.rows[0];

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Technician profile was not found',
      });
    }

    if (req.file) {
      imageFilename = await saveCertificateImage(
        req.file.buffer
      );
    }

    const result = await pool.query(
      `
      INSERT INTO technician_certificates (
        technician_profile_id,
        certificate_name,
        issuing_organization,
        issue_date,
        expiry_date,
        document_url,
        image_filename
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        technician_profile_id,
        certificate_name,
        issuing_organization,
        TO_CHAR(issue_date, 'YYYY-MM-DD') AS issue_date,
        TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
        document_url,
        (image_filename IS NOT NULL) AS has_image,
        is_verified,
        created_at,
        updated_at
      `,
      [
        profile.id,
        certificateName,
        issuingOrganization,
        issueDate,
        expiryDate,
        documentUrl,
        imageFilename,
      ]
    );

    certificateSaved = true;

    return res.status(201).json({
      success: true,
      message: 'Certificate created successfully',
      certificate: result.rows[0],
    });
  } catch (error) {
    if (imageFilename && !certificateSaved) {
      try {
        await deleteCertificateImage(imageFilename);
      } catch (cleanupError) {
        logger.error(
          {
            err: cleanupError,
            userId,
            imageFilename,
          },
          'Certificate image cleanup failed'
        );
      }
    }

    if (error.code === 'INVALID_CERTIFICATE_IMAGE') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    logger.error(
      { err: error, userId },
      'Certificate creation failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to create certificate',
    });
  }
};

const getMyCertificates = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        tc.id,
        tc.technician_profile_id,
        tc.certificate_name,
        tc.issuing_organization,
        TO_CHAR(tc.issue_date, 'YYYY-MM-DD') AS issue_date,
        TO_CHAR(tc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
        tc.document_url,
        (tc.image_filename IS NOT NULL) AS has_image,
        tc.is_verified,
        tc.created_at,
        tc.updated_at
      FROM technician_certificates AS tc
      INNER JOIN technician_profiles AS tp
        ON tp.id = tc.technician_profile_id
      WHERE tp.user_id = $1
      ORDER BY tc.created_at DESC, tc.id DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      certificates: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Certificates lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to get certificates',
    });
  }
};

const deleteMyCertificate = async (req, res) => {
  const userId = req.databaseUser.id;
  const certificateId = req.validatedCertificateId;

  try {
    const result = await pool.query(
      `
      DELETE FROM technician_certificates AS tc
      USING technician_profiles AS tp
      WHERE tc.id = $1
        AND tc.technician_profile_id = tp.id
        AND tp.user_id = $2
      RETURNING tc.id, tc.image_filename
      `,
      [certificateId, userId]
    );

    const certificate = result.rows[0];

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate was not found',
      });
    }

    // The record is already deleted.
    // A file cleanup failure should not report deletion as failed.
    if (certificate.image_filename) {
      try {
        await deleteCertificateImage(
          certificate.image_filename
        );
      } catch (cleanupError) {
        logger.error(
          {
            err: cleanupError,
            certificateId,
            imageFilename: certificate.image_filename,
          },
          'Deleted certificate image cleanup failed'
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Certificate deleted successfully',
    });
  } catch (error) {
    logger.error(
      { err: error, userId, certificateId },
      'Certificate deletion failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to delete certificate',
    });
  }
};

const getCertificateImage = async (req, res, next) => {
  const userId = req.databaseUser.id;
  const isAdmin = req.databaseUser.role === 'admin';
  const certificateId = req.validatedCertificateId;

  try {
    const result = await pool.query(
      `
      SELECT tc.image_filename
      FROM technician_certificates AS tc
      INNER JOIN technician_profiles AS tp
        ON tp.id = tc.technician_profile_id
      WHERE tc.id = $1
        AND (
          tp.user_id = $2
          OR $3::boolean = TRUE
        )
      `,
      [certificateId, userId, isAdmin]
    );

    const certificate = result.rows[0];

    if (!certificate || !certificate.image_filename) {
      return res.status(404).json({
        success: false,
        message: 'Certificate image was not found',
      });
    }

    const imagePath = getCertificateImagePath(
      certificate.image_filename
    );

    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    return res.sendFile(
      imagePath,
      {
        headers: {
          'Content-Type': 'image/webp',
        },
      },
      (error) => {
        if (!error) return;

        if (res.headersSent) {
          return next(error);
        }

        // The response is JSON if sending the image failed.
        res.removeHeader('Content-Type');
        res.removeHeader('Content-Length');

        if (
          error.code === 'ENOENT' ||
          error.status === 404
        ) {
          return res.status(404).json({
            success: false,
            message: 'Certificate image was not found',
          });
        }

        logger.error(
          { err: error, userId, certificateId },
          'Certificate image delivery failed'
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to load certificate image',
        });
      }
    );
  } catch (error) {
    logger.error(
      { err: error, userId, certificateId },
      'Certificate image lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load certificate image',
    });
  }
};

module.exports = {
  createMyCertificate,
  getMyCertificates,
  deleteMyCertificate,
  getCertificateImage,
};