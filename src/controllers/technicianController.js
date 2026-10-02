const pool = require('../config/database');
const logger = require('../config/logger');

const getMyTechnicianProfile = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        tp.id,
        tp.user_id,
        u.name,
        u.email,
        u.role,
        tp.phone,
        tp.profile_image_url,
        tp.bio,
        tp.work_area,
        tp.years_of_experience,
        tp.service_radius_km,
        tp.availability_status,
        tp.average_rating,
        tp.total_completed_jobs,
        tp.is_verified,
        tp.verification_date,
        tp.created_at,
        tp.updated_at
      FROM technician_profiles AS tp
      INNER JOIN users AS u
        ON u.id = tp.user_id
      WHERE tp.user_id = $1
      `,
      [userId]
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
      technician: technicianProfile,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Technician profile lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to get technician profile',
    });
  }
};
const createMyTechnicianProfile = async (req, res) => {
  const userId = req.databaseUser.id;
  const {
    phone,
    bio,
    work_area: workArea,
    years_of_experience: yearsOfExperience,
    service_radius_km: serviceRadiusKm,
  } = req.validatedBody;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
      SELECT role
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'User was not found',
      });
    }

    if (user.role === 'admin') {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot create technician profiles',
      });
    }

    const existingProfileResult = await client.query(
      `
      SELECT id
      FROM technician_profiles
      WHERE user_id = $1
      `,
      [userId]
    );

    if (existingProfileResult.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message: 'Technician profile already exists',
      });
    }

    const profileResult = await client.query(
      `
      INSERT INTO technician_profiles (
        user_id,
        phone,
        bio,
        work_area,
        years_of_experience,
        service_radius_km
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        user_id,
        phone,
        profile_image_url,
        bio,
        work_area,
        years_of_experience,
        service_radius_km,
        availability_status,
        average_rating,
        total_completed_jobs,
        is_verified,
        verification_date,
        created_at,
        updated_at
      `,
      [
        userId,
        phone,
        bio,
        workArea,
        yearsOfExperience,
        serviceRadiusKm,
      ]
    );

    await client.query(
      `
      UPDATE users
      SET
        role = 'technician',
        updated_at = NOW()
      WHERE id = $1
        AND role = 'user'
      `,
      [userId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Technician profile created successfully',
      technician: {
        ...profileResult.rows[0],
        role: 'technician',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    logger.error(
      { err: error, userId },
      'Technician profile creation failed'
    );

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Technician profile already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create technician profile',
    });
  } finally {
    client.release();
  }
};

const setMySpecializations = async (req, res) => {
  const userId = req.databaseUser.id;
  const { specializationIds } = req.validatedBody;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const profileResult = await client.query(
      `
      SELECT id
      FROM technician_profiles
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    const technicianProfile = profileResult.rows[0];

    if (!technicianProfile) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الملف المهني',
      });
    }

    const pendingResult = await client.query(
      `
      SELECT id
      FROM technician_specialization_change_requests
      WHERE technician_profile_id = $1
        AND status = 'pending'
      `,
      [technicianProfile.id]
    );

    if (pendingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: 'لديك طلب تعديل تخصصات قيد المراجعة بالفعل',
      });
    }

    const specializationResult = await client.query(
      `
      SELECT id
      FROM specializations
      WHERE id = ANY($1::BIGINT[])
        AND is_active = TRUE
      ORDER BY id
      FOR SHARE
      `,
      [specializationIds]
    );

    if (
      specializationResult.rows.length !==
      specializationIds.length
    ) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'بعض التخصصات غير صالحة أو لم تعد متاحة',
      });
    }

    const currentResult = await client.query(
      `
      SELECT specialization_id
      FROM technician_specializations
      WHERE technician_profile_id = $1
      `,
      [technicianProfile.id]
    );

    const currentIds = new Set(
      currentResult.rows.map((row) =>
        row.specialization_id.toString()
      )
    );

    const requestedIds = specializationResult.rows.map(
      (row) => row.id.toString()
    );

    const hasSameSpecializations =
      currentIds.size === requestedIds.length &&
      requestedIds.every((id) => currentIds.has(id));

    if (hasSameSpecializations) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'التخصصات المختارة مطابقة لتخصصاتك الحالية',
      });
    }

    const requestResult = await client.query(
      `
      INSERT INTO technician_specialization_change_requests (
        technician_profile_id
      )
      VALUES ($1)
      RETURNING
        id,
        technician_profile_id,
        status,
        created_at
      `,
      [technicianProfile.id]
    );

    const changeRequest = requestResult.rows[0];

    await client.query(
      `
      INSERT INTO technician_specialization_change_items (
        request_id,
        specialization_id
      )
      SELECT $1, selected.id
      FROM UNNEST($2::BIGINT[]) AS selected(id)
      `,
      [changeRequest.id, requestedIds]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(202).json({
      success: true,
      message: 'تم إرسال طلب تعديل التخصصات للمراجعة',
      change_request: changeRequest,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError, userId },
          'Specialization change request rollback failed'
        );
      }
    }

    if (
      error.code === '23505' &&
      error.constraint ===
        'idx_specialization_change_one_pending'
    ) {
      return res.status(409).json({
        success: false,
        message: 'لديك طلب تعديل تخصصات قيد المراجعة بالفعل',
      });
    }

    logger.error(
      { err: error, userId },
      'Specialization change request creation failed'
    );

    return res.status(500).json({
      success: false,
      message: 'تعذر إرسال طلب تعديل التخصصات',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};
const updateMyTechnicianProfile = async (req, res) => {
  const userId = req.databaseUser.id;
  const updates = req.validatedBody;

  const columnMap = {
    phone: 'phone',
    bio: 'bio',
    workArea: 'work_area',
    yearsOfExperience: 'years_of_experience',
    serviceRadiusKm: 'service_radius_km',
    availabilityStatus: 'availability_status',
  };

  const entries = Object.entries(updates);

  if (
    entries.length === 0 ||
    entries.some(([field]) => !Object.hasOwn(columnMap, field))
  ) {
    return res.status(400).json({
      success: false,
      message: 'بيانات التحديث غير صالحة',
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const rollbackResponse = async (statusCode, message) => {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(statusCode).json({
        success: false,
        message,
      });
    };

    // منع تغيير حالة التوثيق أو التخصصات بالتزامن مع التحديث.
    const profileResult = await client.query(
      `
      SELECT id, is_verified
      FROM technician_profiles
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    const profile = profileResult.rows[0];

    if (!profile) {
      return await rollbackResponse(
        404,
        'لم يتم العثور على الملف المهني'
      );
    }

    if (updates.availabilityStatus === 'available') {
      if (profile.is_verified !== true) {
        return await rollbackResponse(
          403,
          'يجب توثيق حسابك قبل تفعيل استقبال الطلبات'
        );
      }

      // نبحث في التخصصات المعتمدة، وليس طلبات التعديل المعلّقة.
      const specializationResult = await client.query(
        `
        SELECT s.id
        FROM technician_specializations AS ts
        INNER JOIN specializations AS s
          ON s.id = ts.specialization_id
        WHERE ts.technician_profile_id = $1
          AND s.is_active = TRUE
        ORDER BY s.id
        LIMIT 1
        FOR SHARE OF ts, s
        `,
        [profile.id]
      );

      if (specializationResult.rows.length === 0) {
        return await rollbackResponse(
          409,
          'يجب أن يكون لديك تخصص معتمد وفعّال واحد على الأقل '
            + 'قبل تفعيل استقبال الطلبات. '
            + 'قدّم طلب تخصصات وانتظر موافقة المسؤول.'
        );
      }
    }

    const setClauses = [];
    const values = [];

    for (const [field, value] of entries) {
      values.push(value);

      setClauses.push(
        `${columnMap[field]} = $${values.length}`
      );
    }

    values.push(profile.id);
    const profileIdParameter = values.length;

    const result = await client.query(
      `
      UPDATE technician_profiles
      SET
        ${setClauses.join(', ')},
        updated_at = NOW()
      WHERE id = $${profileIdParameter}
      RETURNING
        id,
        user_id,
        phone,
        profile_image_url,
        bio,
        work_area,
        years_of_experience,
        service_radius_km,
        availability_status,
        average_rating,
        total_completed_jobs,
        is_verified,
        verification_date,
        created_at,
        updated_at
      `,
      values
    );

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'تم تحديث الملف المهني',
      technician: result.rows[0],
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError, userId },
          'Technician profile update rollback failed'
        );
      }
    }

    logger.error(
      { err: error, userId },
      'Technician profile update failed'
    );

    return res.status(500).json({
      success: false,
      message: 'تعذر تحديث الملف المهني',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const getAvailableTechnicians = async (req, res) => {
  const {
    specializationId,
    workArea,
  } = req.validatedQuery;

  try {
    const result = await pool.query(
      `
      SELECT
        tp.id,
        tp.user_id,
        u.name,
        tp.profile_image_url,
        tp.bio,
        tp.work_area,
        tp.years_of_experience,
        tp.service_radius_km,
        tp.availability_status,
        tp.average_rating,
        tp.total_completed_jobs,
        tp.is_verified,
        COALESCE(
          (
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id', s.id,
                'name_ar', s.name_ar,
                'name_en', s.name_en
              )
              ORDER BY s.id
            )
            FROM technician_specializations AS all_ts
            INNER JOIN specializations AS s
              ON s.id = all_ts.specialization_id
            WHERE all_ts.technician_profile_id = tp.id
              AND s.is_active = TRUE
          ),
          '[]'::JSONB
        ) AS specializations
      FROM technician_profiles AS tp
      INNER JOIN users AS u
        ON u.id = tp.user_id
      WHERE u.role = 'technician'
        AND u.is_active = TRUE
        AND tp.is_verified = TRUE
        AND tp.availability_status = 'available'
        AND EXISTS (
          SELECT 1
          FROM technician_specializations AS matching_ts
          WHERE matching_ts.technician_profile_id = tp.id
            AND matching_ts.specialization_id = $1
        )
      ORDER BY
        CASE
          WHEN $2::TEXT IS NOT NULL
            AND LOWER(BTRIM(COALESCE(tp.work_area, ''))) =
                LOWER(BTRIM($2::TEXT))
          THEN 0
          ELSE 1
        END,
        tp.average_rating DESC,
        tp.total_completed_jobs DESC,
        tp.years_of_experience DESC,
        tp.id
      LIMIT 50
      `,
      [specializationId, workArea]
    );

    return res.status(200).json({
      success: true,
      technicians: result.rows,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        specializationId,
      },
      'Available technician search failed'
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to load available technicians',
    });
  }
};

const getMySpecializations = async (req, res) => {
  const userId = req.databaseUser.id;

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

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name_ar,
        s.name_en,
        s.description,
        s.is_active
      FROM technician_specializations AS ts
      INNER JOIN specializations AS s
        ON s.id = ts.specialization_id
      WHERE ts.technician_profile_id = $1
      ORDER BY s.id
      `,
      [profile.id]
    );

    return res.status(200).json({
      success: true,
      specializations: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Technician specializations lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load technician specializations',
    });
  }
};
const getMySpecializationChangeRequest = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        cr.id,
        cr.status,
        cr.review_note,
        cr.created_at,
        cr.reviewed_at,

        COALESCE(
          (
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id', s.id::TEXT,
                'name_ar', s.name_ar,
                'is_active', s.is_active
              )
              ORDER BY s.id
            )
            FROM technician_specialization_change_items AS item
            INNER JOIN specializations AS s
              ON s.id = item.specialization_id
            WHERE item.request_id = cr.id
          ),
          '[]'::JSONB
        ) AS requested_specializations

      FROM technician_specialization_change_requests AS cr
      INNER JOIN technician_profiles AS tp
        ON tp.id = cr.technician_profile_id
      WHERE tp.user_id = $1
      ORDER BY
        CASE WHEN cr.status = 'pending' THEN 0 ELSE 1 END,
        cr.created_at DESC,
        cr.id DESC
      LIMIT 1
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      change_request: result.rows[0] || null,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Technician specialization change lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'تعذر تحميل حالة طلب تعديل التخصصات',
    });
  }
};

module.exports = {
  getMyTechnicianProfile,
  createMyTechnicianProfile,
  setMySpecializations,
  updateMyTechnicianProfile,
  getAvailableTechnicians,
  getMySpecializations,
  getMySpecializationChangeRequest,
};