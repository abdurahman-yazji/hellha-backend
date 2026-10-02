const pool = require('../config/database');
const logger = require('../config/logger');
const {
  createNotification,
} = require('../services/notificationService');
const getPendingSpecializationChanges = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        cr.id,
        cr.technician_profile_id,
        cr.status,
        cr.created_at,

        u.name AS technician_name,
        tp.phone AS technician_phone,
        tp.work_area,
        tp.is_verified,

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
            FROM technician_specializations AS ts
            INNER JOIN specializations AS s
              ON s.id = ts.specialization_id
            WHERE ts.technician_profile_id =
              cr.technician_profile_id
          ),
          '[]'::JSONB
        ) AS current_specializations,

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
      INNER JOIN users AS u
        ON u.id = tp.user_id

      WHERE cr.status = 'pending'
      ORDER BY cr.created_at ASC, cr.id ASC
      `
    );

    return res.status(200).json({
      success: true,
      change_requests: result.rows,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        adminUserId: req.databaseUser.id,
      },
      'Pending specialization changes lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'تعذر تحميل طلبات تعديل التخصصات',
    });
  }
};

const reviewSpecializationChange = async (req, res) => {
  const adminUserId = req.databaseUser.id;
  const requestId = req.params.requestId;
  const body = req.body;

  if (
    !/^[1-9]\d{0,18}$/.test(requestId || '') ||
    BigInt(requestId) > 9223372036854775807n
  ) {
    return res.status(400).json({
      success: false,
      message: 'رقم طلب المراجعة غير صالح',
    });
  }

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return res.status(400).json({
      success: false,
      message: 'بيانات المراجعة غير صالحة',
    });
  }

  const allowedFields = new Set(['decision', 'review_note']);

  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return res.status(400).json({
      success: false,
      message: 'توجد حقول غير مدعومة',
    });
  }

  if (!['approved', 'rejected'].includes(body.decision)) {
    return res.status(400).json({
      success: false,
      message: 'القرار يجب أن يكون approved أو rejected',
    });
  }

  let reviewNote = null;

  if (body.review_note !== undefined && body.review_note !== null) {
    if (typeof body.review_note !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ملاحظة المراجعة يجب أن تكون نصًا',
      });
    }

    reviewNote = body.review_note.trim() || null;

    if (reviewNote && [...reviewNote].length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'ملاحظة المراجعة يجب ألا تتجاوز 1000 حرف',
      });
    }
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

    const lookupResult = await client.query(
      `
      SELECT technician_profile_id
      FROM technician_specialization_change_requests
      WHERE id = $1
      `,
      [requestId]
    );

    const lookup = lookupResult.rows[0];

    if (!lookup) {
      return await rollbackResponse(404, 'طلب المراجعة غير موجود');
    }

    // قفل ملف الفني أولًا، بنفس ترتيب دالة تقديم الطلب.
    const profileResult = await client.query(
      `
      SELECT id, user_id
      FROM technician_profiles
      WHERE id = $1
      FOR UPDATE
      `,
      [lookup.technician_profile_id]
    );

    const profile = profileResult.rows[0];

    if (!profile) {
      return await rollbackResponse(404, 'الملف المهني غير موجود');
    }

    const requestResult = await client.query(
      `
      SELECT id, status
      FROM technician_specialization_change_requests
      WHERE id = $1
        AND technician_profile_id = $2
      FOR UPDATE
      `,
      [requestId, profile.id]
    );

    const changeRequest = requestResult.rows[0];

    if (!changeRequest || changeRequest.status !== 'pending') {
      return await rollbackResponse(
        409,
        'تمت مراجعة هذا الطلب مسبقًا. حدّث القائمة.'
      );
    }

    if (body.decision === 'approved') {
      const userResult = await client.query(
        `
        SELECT role, is_active
        FROM users
        WHERE id = $1
        FOR SHARE
        `,
        [profile.user_id]
      );

      const technicianUser = userResult.rows[0];

      if (
        !technicianUser ||
        technicianUser.role !== 'technician' ||
        technicianUser.is_active !== true
      ) {
        return await rollbackResponse(
          409,
          'لا يمكن اعتماد التخصصات لحساب فني غير نشط'
        );
      }

      const itemsResult = await client.query(
        `
        SELECT s.id, s.is_active
        FROM technician_specialization_change_items AS item
        INNER JOIN specializations AS s
          ON s.id = item.specialization_id
        WHERE item.request_id = $1
        ORDER BY s.id
        FOR SHARE OF item, s
        `,
        [requestId]
      );

      const items = itemsResult.rows;

      if (
        items.length < 1 ||
        items.length > 10 ||
        items.some((item) => item.is_active !== true)
      ) {
        return await rollbackResponse(
          409,
          'القائمة المطلوبة غير صالحة أو تضم تخصصًا لم يعد متاحًا. '
            + 'يمكنك رفض الطلب وطلب تقديم قائمة جديدة.'
        );
      }

      await client.query(
        `
        DELETE FROM technician_specializations
        WHERE technician_profile_id = $1
        `,
        [profile.id]
      );

      await client.query(
        `
        INSERT INTO technician_specializations (
          technician_profile_id,
          specialization_id
        )
        SELECT $1, selected.id
        FROM UNNEST($2::BIGINT[]) AS selected(id)
        `,
        [profile.id, items.map((item) => item.id)]
      );

      await client.query(
        `
        UPDATE technician_profiles
        SET updated_at = NOW()
        WHERE id = $1
        `,
        [profile.id]
      );
    }

    const reviewedResult = await client.query(
      `
      UPDATE technician_specialization_change_requests
      SET
        status = $2,
        reviewed_by = $3,
        review_note = $4,
        reviewed_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        technician_profile_id,
        status,
        review_note,
        reviewed_at
      `,
      [requestId, body.decision, adminUserId, reviewNote]
    );
    const approved = body.decision === 'approved';

await createNotification(client, {
  userId: profile.user_id,
  type: approved
    ? 'specialization_change_approved'
    : 'specialization_change_rejected',
  title: approved
    ? 'تم اعتماد تخصصاتك الجديدة'
    : 'لم تتم الموافقة على تعديل التخصصات',
  body: approved
    ? 'وافق المسؤول على طلب تعديل تخصصاتك. '
      + 'افتح صفحة تخصصاتي للاطلاع على التخصصات المعتمدة.'
    : 'رفض المسؤول طلب تعديل تخصصاتك، وبقيت تخصصاتك الحالية دون تغيير. '
      + 'افتح صفحة تخصصاتي للاطلاع على القرار وملاحظة المسؤول.',
});

    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message:
        body.decision === 'approved'
          ? 'تم اعتماد التخصصات الجديدة'
          : 'تم رفض طلب تعديل التخصصات',
      change_request: reviewedResult.rows[0],
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError, requestId },
          'Specialization review rollback failed'
        );
      }
    }

    logger.error(
      { err: error, adminUserId, requestId },
      'Specialization change review failed'
    );

    return res.status(500).json({
      success: false,
      message: 'تعذر حفظ قرار المراجعة',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  getPendingSpecializationChanges,
  reviewSpecializationChange,
};