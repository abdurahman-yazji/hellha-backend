const pool = require('../config/database');
const logger = require('../config/logger');

const getPendingTechnicians = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        tp.id AS technician_profile_id,
        u.id AS user_id,
        u.name,
        u.email,
        tp.phone,
        tp.profile_image_url,
        tp.bio,
        tp.work_area,
        tp.years_of_experience,
        tp.service_radius_km,
        tp.availability_status,
        tp.is_verified,
        tp.created_at,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', s.id,
                'name_ar', s.name_ar,
                'name_en', s.name_en
              )
              ORDER BY s.id
            )
            FROM technician_specializations AS ts
            INNER JOIN specializations AS s
              ON s.id = ts.specialization_id
            WHERE ts.technician_profile_id = tp.id
          ),
          '[]'::json
        ) AS specializations,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', tc.id,
                'certificate_name', tc.certificate_name,
                'issuing_organization',
                  tc.issuing_organization,
                'issue_date',
                  TO_CHAR(tc.issue_date, 'YYYY-MM-DD'),
                'expiry_date',
                  TO_CHAR(tc.expiry_date, 'YYYY-MM-DD'),
                'document_url', tc.document_url,
'has_image', (tc.image_filename IS NOT NULL),
'is_verified', tc.is_verified
              )
              ORDER BY tc.created_at DESC
            )
            FROM technician_certificates AS tc
            WHERE tc.technician_profile_id = tp.id
          ),
          '[]'::json
        ) AS certificates
      FROM technician_profiles AS tp
      INNER JOIN users AS u
        ON u.id = tp.user_id
      WHERE tp.is_verified = FALSE
        AND u.role = 'technician'
        AND u.is_active = TRUE
      ORDER BY tp.created_at ASC, tp.id ASC
      `
    );

    return res.status(200).json({
      success: true,
      technicians: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error },
      'Pending technicians lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to get pending technicians',
    });
  }
};

const updateTechnicianVerification = async (req, res) => {
  const profileId = req.validatedTechnicianProfileId;
  const { isVerified } = req.validatedBody;

  try {
    const result = await pool.query(
      `
      UPDATE technician_profiles
      SET
        is_verified = $2,
        verification_date = CASE
          WHEN $2 = TRUE THEN NOW()
          ELSE NULL
        END,
        availability_status = CASE
          WHEN $2 = FALSE THEN 'unavailable'
          ELSE availability_status
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        user_id,
        phone,
        work_area,
        years_of_experience,
        service_radius_km,
        availability_status,
        is_verified,
        verification_date,
        updated_at
      `,
      [profileId, isVerified]
    );

    const technicianProfile = result.rows[0];

    if (!technicianProfile) {
      return res.status(404).json({
        success: false,
        message: 'Technician profile was not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: isVerified
        ? 'Technician verified successfully'
        : 'Technician verification revoked successfully',
      technician: technicianProfile,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        profileId,
        isVerified,
      },
      'Technician verification update failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to update technician verification',
    });
  }
};
const getVerifiedTechnicians = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        tp.id AS technician_profile_id,
        u.id AS user_id,
        u.name,
        u.email,
        u.is_active,
        tp.phone,
        tp.work_area,
        tp.is_verified,
        tp.availability_status,
        tp.verification_date
      FROM technician_profiles AS tp
      INNER JOIN users AS u
        ON u.id = tp.user_id
      WHERE tp.is_verified = TRUE
        AND u.role = 'technician'
      ORDER BY
        tp.verification_date DESC NULLS LAST,
        tp.id DESC
      `
    );

    return res.status(200).json({
      success: true,
      technicians: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error },
      'Verified technicians lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to get verified technicians',
    });
  }
};

module.exports = {
  getPendingTechnicians,
  getVerifiedTechnicians,
  updateTechnicianVerification,
};