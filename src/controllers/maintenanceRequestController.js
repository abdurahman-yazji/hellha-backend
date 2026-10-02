const pool = require('../config/database');
const logger = require('../config/logger');
const {
  createNotification,
} = require('../services/notificationService');

const createMaintenanceRequest = async (req, res) => {
  const userId = req.databaseUser.id;

  const {
    diagnosisId,
    requestDescription,
    specializationId,
    technicianProfileId,
    contactPhone,
    workArea,
    addressDetails,
    notes,
    latitude,
    longitude,
  } = req.validatedBody;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query(
      `
      WITH valid_request_data AS (
        SELECT
          d.id AS diagnosis_id,
          s.id AS specialization_id,
          tp.id AS technician_profile_id
        FROM specializations AS s
        INNER JOIN technician_profiles AS tp
          ON tp.id = $4
        INNER JOIN users AS technician_user
          ON technician_user.id = tp.user_id
        LEFT JOIN diagnoses AS d
          ON d.id = $2::BIGINT
          AND d.user_id = $1
        WHERE s.id = $3
          AND s.is_active = TRUE
          AND (
            $2::BIGINT IS NULL
            OR d.id IS NOT NULL
          )
          AND technician_user.role = 'technician'
          AND technician_user.is_active = TRUE
          AND tp.is_verified = TRUE
          AND tp.availability_status = 'available'
          AND EXISTS (
            SELECT 1
            FROM technician_specializations AS ts
            WHERE ts.technician_profile_id = tp.id
              AND ts.specialization_id = s.id
          )
      )
      INSERT INTO maintenance_requests (
        user_id,
        diagnosis_id,
        specialization_id,
        technician_profile_id,
        contact_phone,
        work_area,
        address_details,
        notes,
        latitude,
        longitude,
        request_description,
        status,
        assigned_at
      )
      SELECT
        $1,
        valid_request_data.diagnosis_id,
        valid_request_data.specialization_id,
        valid_request_data.technician_profile_id,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        'assigned',
        NOW()
      FROM valid_request_data
      RETURNING *
      `,
      [
        userId,
        diagnosisId,
        specializationId,
        technicianProfileId,
        contactPhone,
        workArea,
        addressDetails,
        notes,
        latitude,
        longitude,
        requestDescription,
      ]
    );

    const maintenanceRequest = result.rows[0];

    if (!maintenanceRequest) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message:
          'The diagnosis or selected technician is not available',
      });
    }

    const technicianResult = await client.query(
      `
      SELECT user_id
      FROM technician_profiles
      WHERE id = $1
      `,
      [maintenanceRequest.technician_profile_id]
    );

    const technician = technicianResult.rows[0];

    if (!technician) {
      throw new Error('Notification recipient was not found');
    }

    await createNotification(client, {
      userId: technician.user_id,
      maintenanceRequestId: maintenanceRequest.id,
      type: 'request_assigned',
      title: 'طلب صيانة جديد',
      body:
        `تم إسناد طلب الصيانة رقم ${maintenanceRequest.id} إليك. ` +
        'افتح الطلب للاطلاع على التفاصيل.',
    });

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: 'Maintenance request created successfully',
      maintenance_request: maintenanceRequest,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          'Maintenance request rollback failed'
        );
      }
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message:
          'A maintenance request already exists for this diagnosis',
      });
    }

    logger.error(
      {
        err: error,
        userId,
        diagnosisId,
        technicianProfileId,
      },
      'Maintenance request creation failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to create maintenance request',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const getMyMaintenanceRequests = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        mr.id,
        mr.user_id,
        mr.diagnosis_id,
        mr.request_description,
        mr.specialization_id,
        mr.technician_profile_id,
        mr.contact_phone,
        mr.work_area,
        mr.address_details,
        mr.notes,
        mr.latitude,
        mr.longitude,
        mr.status,
        mr.assigned_at,
        mr.started_at,
        mr.completed_at,
        mr.closed_at,
        mr.created_at,
        mr.updated_at,

               CASE
          WHEN d.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'predicted_fault', d.predicted_fault,
            'severity', d.severity,
            'description', d.description
          )
        END AS diagnosis,

        JSONB_BUILD_OBJECT(
          'id', s.id,
          'name_ar', s.name_ar,
          'name_en', s.name_en
        ) AS specialization,

        CASE
          WHEN tp.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'id', tp.id,
            'name', technician_user.name,
            'phone', tp.phone,
            'profile_image_url', tp.profile_image_url,
            'work_area', tp.work_area,
            'average_rating', tp.average_rating,
            'total_completed_jobs', tp.total_completed_jobs
          )
        END AS technician,

        CASE
          WHEN r.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'id', r.id::text,
            'rating', r.rating,
            'comment', r.comment,
            'created_at', r.created_at
          )
        END AS review

      FROM maintenance_requests AS mr
            LEFT JOIN diagnoses AS d
        ON d.id = mr.diagnosis_id
      INNER JOIN specializations AS s
        ON s.id = mr.specialization_id
      LEFT JOIN technician_profiles AS tp
        ON tp.id = mr.technician_profile_id
      LEFT JOIN users AS technician_user
        ON technician_user.id = tp.user_id
      LEFT JOIN maintenance_request_reviews AS r
        ON r.maintenance_request_id = mr.id
      WHERE mr.user_id = $1
      ORDER BY mr.created_at DESC, mr.id DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      maintenance_requests: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Maintenance request history lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load maintenance requests',
    });
  }
};


const getMyAssignedMaintenanceRequests = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        mr.id,
        mr.user_id,
        mr.diagnosis_id,
        mr.request_description,
        mr.specialization_id,
        mr.technician_profile_id,
        mr.contact_phone,
        mr.work_area,
        mr.address_details,
        mr.notes,
        mr.latitude,
        mr.longitude,
        mr.status,
        mr.assigned_at,
        mr.started_at,
        mr.completed_at,
        mr.closed_at,
        mr.created_at,
        mr.updated_at,

        JSONB_BUILD_OBJECT(
          'name', customer.name,
          'email', customer.email
        ) AS customer,

                CASE
          WHEN d.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'predicted_fault', d.predicted_fault,
            'severity', d.severity,
            'description', d.description
          )
        END AS diagnosis,

        JSONB_BUILD_OBJECT(
          'id', s.id,
          'name_ar', s.name_ar,
          'name_en', s.name_en
        ) AS specialization,

        CASE
          WHEN r.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'id', r.id::text,
            'rating', r.rating,
            'comment', r.comment,
            'created_at', r.created_at
          )
        END AS review

      FROM maintenance_requests AS mr
      INNER JOIN technician_profiles AS tp
        ON tp.id = mr.technician_profile_id
      INNER JOIN users AS customer
        ON customer.id = mr.user_id
      LEFT JOIN diagnoses AS d
        ON d.id = mr.diagnosis_id
      INNER JOIN specializations AS s
        ON s.id = mr.specialization_id
      LEFT JOIN maintenance_request_reviews AS r
        ON r.maintenance_request_id = mr.id
      WHERE tp.user_id = $1
      ORDER BY
        CASE mr.status
          WHEN 'assigned' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'closed' THEN 4
          WHEN 'cancelled' THEN 5
          ELSE 6
        END,
        mr.created_at DESC,
        mr.id DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      maintenance_requests: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error, userId },
      'Technician maintenance requests lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load technician maintenance requests',
    });
  }
};

const updateMyMaintenanceRequestStatus = async (req, res) => {
  const userId = req.databaseUser.id;
  const { requestId } = req.validatedParams;
  const { status } = req.validatedBody;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query(
      `
      WITH updated_request AS (
        UPDATE maintenance_requests AS mr
        SET
          status = $3,

          started_at = CASE
            WHEN $3 = 'in_progress'
            THEN NOW()
            ELSE mr.started_at
          END,

          completed_at = CASE
            WHEN $3 = 'completed'
            THEN NOW()
            ELSE mr.completed_at
          END,

          updated_at = NOW()

        FROM technician_profiles AS tp
        WHERE mr.id = $1
          AND mr.technician_profile_id = tp.id
          AND tp.user_id = $2
          AND (
            (
              mr.status = 'assigned'
              AND $3 = 'in_progress'
            )
            OR
            (
              mr.status = 'in_progress'
              AND $3 = 'completed'
            )
          )
        RETURNING mr.*
      ),

      updated_technician AS (
        UPDATE technician_profiles AS tp
        SET
          total_completed_jobs =
            tp.total_completed_jobs + 1,
          updated_at = NOW()
        FROM updated_request AS ur
        WHERE tp.id = ur.technician_profile_id
          AND ur.status = 'completed'
        RETURNING tp.id
      )

      SELECT *
      FROM updated_request
      `,
      [requestId, userId, status]
    );

    const maintenanceRequest = result.rows[0];

    if (!maintenanceRequest) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          'Request was not found or status transition is not allowed',
      });
    }

    const isCompleted = maintenanceRequest.status === 'completed';

    await createNotification(client, {
      userId: maintenanceRequest.user_id,
      maintenanceRequestId: maintenanceRequest.id,
      type: isCompleted
        ? 'request_completed'
        : 'request_started',
      title: isCompleted
        ? 'اكتمل طلب الصيانة'
        : 'بدأ العمل على طلبك',
      body: isCompleted
        ? `أعلن الفني إكمال طلب الصيانة رقم ${maintenanceRequest.id}. ` +
          'راجع العمل ثم أكّد الإنجاز وأضف تقييمك.'
        : `بدأ الفني العمل على طلب الصيانة رقم ${maintenanceRequest.id}.`,
    });

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message:
        'Maintenance request status updated successfully',
      maintenance_request: maintenanceRequest,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          'Maintenance request status rollback failed'
        );
      }
    }

    logger.error(
      { err: error, userId, requestId, status },
      'Maintenance request status update failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to update maintenance request status',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const declineMyMaintenanceRequest = async (req, res) => {
  const userId = req.databaseUser.id;
  const { requestId } = req.validatedParams;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query(
      `
      UPDATE maintenance_requests AS mr
      SET
        technician_profile_id = NULL,
        status = 'created',
        assigned_at = NULL,
        updated_at = NOW()
      FROM technician_profiles AS tp
      WHERE mr.id = $1
        AND mr.technician_profile_id = tp.id
        AND tp.user_id = $2
        AND mr.status = 'assigned'
      RETURNING
        mr.id,
        mr.user_id,
        mr.diagnosis_id,
        mr.specialization_id,
        mr.contact_phone,
        mr.work_area,
        mr.address_details,
        mr.notes,
        mr.status,
        mr.created_at,
        mr.updated_at
      `,
      [requestId, userId]
    );

    const maintenanceRequest = result.rows[0];

    if (!maintenanceRequest) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          'Request was not found or can no longer be declined',
      });
    }

    await createNotification(client, {
      userId: maintenanceRequest.user_id,
      maintenanceRequestId: maintenanceRequest.id,
      type: 'request_declined',
      title: 'اعتذر الفني عن الطلب',
      body:
        `اعتذر الفني عن طلب الصيانة رقم ${maintenanceRequest.id}. ` +
        'يمكنك فتح طلباتي واختيار فني آخر لنفس الطلب.',
    });

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'Maintenance request declined successfully',
      maintenance_request: maintenanceRequest,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          'Maintenance request decline rollback failed'
        );
      }
    }

    logger.error(
      { err: error, userId, requestId },
      'Maintenance request decline failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to decline maintenance request',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const reassignMyMaintenanceRequest = async (req, res) => {
  const userId = req.databaseUser.id;
  const { requestId } = req.validatedParams;
  const { technicianProfileId } = req.validatedBody;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query(
      `
      UPDATE maintenance_requests AS mr
      SET
        technician_profile_id = tp.id,
        status = 'assigned',
        assigned_at = NOW(),
        updated_at = NOW()
      FROM technician_profiles AS tp
      INNER JOIN users AS technician_user
        ON technician_user.id = tp.user_id
      WHERE mr.id = $1
        AND mr.user_id = $2
        AND mr.status = 'created'
        AND mr.technician_profile_id IS NULL
        AND tp.id = $3
        AND technician_user.role = 'technician'
        AND technician_user.is_active = TRUE
        AND tp.is_verified = TRUE
        AND tp.availability_status = 'available'
        AND EXISTS (
          SELECT 1
          FROM technician_specializations AS ts
          INNER JOIN specializations AS s
            ON s.id = ts.specialization_id
          WHERE ts.technician_profile_id = tp.id
            AND s.id = mr.specialization_id
            AND s.is_active = TRUE
        )
      RETURNING mr.*
      `,
      [requestId, userId, technicianProfileId]
    );

    const maintenanceRequest = result.rows[0];

    if (!maintenanceRequest) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          'Request cannot be reassigned or selected technician is unavailable',
      });
    }

    const technicianResult = await client.query(
      `
      SELECT user_id
      FROM technician_profiles
      WHERE id = $1
      `,
      [maintenanceRequest.technician_profile_id]
    );

    const technician = technicianResult.rows[0];

    if (!technician) {
      throw new Error('Notification recipient was not found');
    }

    await createNotification(client, {
      userId: technician.user_id,
      maintenanceRequestId: maintenanceRequest.id,
      type: 'request_reassigned',
      title: 'تم إسناد طلب صيانة إليك',
      body:
        `اختارك المستخدم لتنفيذ طلب الصيانة رقم ${maintenanceRequest.id}. ` +
        'افتح الطلب للاطلاع على التفاصيل.',
    });

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'Maintenance request reassigned successfully',
      maintenance_request: maintenanceRequest,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          'Maintenance request reassignment rollback failed'
        );
      }
    }

    logger.error(
      {
        err: error,
        userId,
        requestId,
        technicianProfileId,
      },
      'Maintenance request reassignment failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to reassign maintenance request',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const reviewMyMaintenanceRequest = async (req, res) => {
  const userId = req.databaseUser.id;
  const { requestId } = req.validatedParams;
  const { rating, comment } = req.validatedBody;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const requestResult = await client.query(
      `
      SELECT id, technician_profile_id, status
      FROM maintenance_requests
      WHERE id = $1
        AND user_id = $2
      FOR UPDATE
      `,
      [requestId, userId]
    );

    const request = requestResult.rows[0];

    if (
      !request ||
      request.status !== 'completed' ||
      request.technician_profile_id === null
    ) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          'Request was not found or is not ready for review',
      });
    }

   // Serialize rating updates and obtain the notification recipient.
const technicianResult = await client.query(
  `
  SELECT id, user_id
  FROM technician_profiles
  WHERE id = $1
  FOR UPDATE
  `,
  [request.technician_profile_id]
);

const technician = technicianResult.rows[0];

if (!technician) {
  throw new Error('Notification recipient was not found');
}

    const reviewResult = await client.query(
      `
      INSERT INTO maintenance_request_reviews (
        maintenance_request_id,
        rating,
        comment
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        maintenance_request_id,
        rating,
        comment,
        created_at
      `,
      [requestId, rating, comment]
    );

    const updatedRequest = await client.query(
      `
      UPDATE maintenance_requests
      SET
        status = 'closed',
        closed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, status, closed_at
      `,
      [requestId]
    );

    await client.query(
      `
      UPDATE technician_profiles
      SET
        average_rating = (
          SELECT ROUND(AVG(r.rating), 2)
          FROM maintenance_request_reviews AS r
          INNER JOIN maintenance_requests AS mr
            ON mr.id = r.maintenance_request_id
          WHERE mr.technician_profile_id = $1
        ),
        updated_at = NOW()
      WHERE id = $1
      `,
      [request.technician_profile_id]
    );
    await createNotification(client, {
  userId: technician.user_id,
  maintenanceRequestId: requestId,
  type: 'request_reviewed',
  title: 'تقييم جديد لخدمتك',
  body:
    `قيّم المستخدم طلب الصيانة رقم ${requestId} ` +
    `بـ ${rating} من 5. افتح تفاصيل الطلب للاطلاع على التقييم.`,
});

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: 'Request closed and review saved successfully',
      review: reviewResult.rows[0],
      maintenance_request: updatedRequest.rows[0],
    });
  } catch (error) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK');
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'This request has already been reviewed',
      });
    }

    logger.error(
      { err: error, userId, requestId },
      'Maintenance request review failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to save maintenance request review',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const cancelMyMaintenanceRequest = async (req, res) => {
  const userId = req.databaseUser.id;
  const { requestId } = req.validatedParams;

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query(
      `
      UPDATE maintenance_requests
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND status IN ('created', 'assigned')
        AND started_at IS NULL
      RETURNING
        id,
        user_id,
        diagnosis_id,
        technician_profile_id,
        status,
        updated_at
      `,
      [requestId, userId]
    );

    const maintenanceRequest = result.rows[0];

    if (!maintenanceRequest) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          'Request was not found or can no longer be cancelled',
      });
    }

    if (maintenanceRequest.technician_profile_id !== null) {
      const technicianResult = await client.query(
        `
        SELECT user_id
        FROM technician_profiles
        WHERE id = $1
        `,
        [maintenanceRequest.technician_profile_id]
      );

      const technician = technicianResult.rows[0];

      if (!technician) {
        throw new Error('Notification recipient was not found');
      }

      await createNotification(client, {
        userId: technician.user_id,
        maintenanceRequestId: maintenanceRequest.id,
        type: 'request_cancelled',
        title: 'ألغى المستخدم طلب الصيانة',
        body:
          `ألغى المستخدم طلب الصيانة رقم ${maintenanceRequest.id} ` +
          'قبل بدء العمل.',
      });
    }

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'Maintenance request cancelled successfully',
      maintenance_request: maintenanceRequest,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          'Maintenance request cancellation rollback failed'
        );
      }
    }

    logger.error(
      { err: error, userId, requestId },
      'Maintenance request cancellation failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to cancel maintenance request',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};
const getMyMaintenanceRequestById = async (req, res) => {
  const userId = req.databaseUser.id;
  const role = req.databaseUser.role;
  const { requestId } = req.validatedParams;

  try {
    const result = await pool.query(
      `
      SELECT
        mr.id,
        mr.user_id,
        mr.diagnosis_id,
        mr.request_description,
        mr.specialization_id,
        mr.technician_profile_id,
        mr.contact_phone,
        mr.work_area,
        mr.address_details,
        mr.notes,
        mr.latitude,
        mr.longitude,
        mr.status,
        mr.assigned_at,
        mr.started_at,
        mr.completed_at,
        mr.closed_at,
        mr.created_at,
        mr.updated_at,

               CASE
          WHEN d.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'predicted_fault', d.predicted_fault,
            'severity', d.severity,
            'description', d.description
          )
        END AS diagnosis,

        CASE
          WHEN s.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'id', s.id,
            'name_ar', s.name_ar,
            'name_en', s.name_en
          )
        END AS specialization,

        CASE
          WHEN tp.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'id', tp.id,
            'name', technician_user.name,
            'phone', tp.phone,
            'profile_image_url', tp.profile_image_url,
            'work_area', tp.work_area,
            'average_rating', tp.average_rating,
            'total_completed_jobs', tp.total_completed_jobs
          )
        END AS technician,

        JSONB_BUILD_OBJECT(
          'name', customer.name,
          'email', customer.email
        ) AS customer,

        CASE
          WHEN r.id IS NULL THEN NULL
          ELSE JSONB_BUILD_OBJECT(
            'id', r.id::text,
            'rating', r.rating,
            'comment', r.comment,
            'created_at', r.created_at
          )
        END AS review

      FROM maintenance_requests AS mr
            LEFT JOIN diagnoses AS d
        ON d.id = mr.diagnosis_id
      INNER JOIN users AS customer
        ON customer.id = mr.user_id
      LEFT JOIN specializations AS s
        ON s.id = mr.specialization_id
      LEFT JOIN technician_profiles AS tp
        ON tp.id = mr.technician_profile_id
      LEFT JOIN users AS technician_user
        ON technician_user.id = tp.user_id
      LEFT JOIN maintenance_request_reviews AS r
        ON r.maintenance_request_id = mr.id
      WHERE mr.id = $1
        AND (
          ($3::TEXT = 'user' AND mr.user_id = $2)
          OR
          ($3::TEXT = 'technician' AND tp.user_id = $2)
        )
      `,
      [requestId, userId, role]
    );

    const maintenanceRequest = result.rows[0];

    if (!maintenanceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Request was not found or is no longer accessible',
      });
    }

    return res.status(200).json({
      success: true,
      maintenance_request: maintenanceRequest,
      viewer_role: role,
    });
  } catch (error) {
    logger.error(
      { err: error, userId, requestId },
      'Maintenance request details lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load maintenance request details',
    });
  }
};

module.exports = {
  createMaintenanceRequest,
  getMyMaintenanceRequests,
  getMyAssignedMaintenanceRequests,
  updateMyMaintenanceRequestStatus,
  declineMyMaintenanceRequest,
  reassignMyMaintenanceRequest,
  reviewMyMaintenanceRequest,
  cancelMyMaintenanceRequest,
  getMyMaintenanceRequestById,
  
};