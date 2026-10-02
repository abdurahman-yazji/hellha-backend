const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const logger = require('../config/logger');
const { messaging } = require('../config/firebaseAdmin');

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5000;
const SEND_TIMEOUT_MS = 45000;

let timer = null;
let runningTask = null;
let stopped = true;

const invalidTokenCodes = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const errorCodeOf = (error) => {
  return String(error?.code || 'push/unknown-error').slice(0, 100);
};

const sendWithTimeout = async (message) => {
  let timeout;

  try {
    return await Promise.race([
      messaging.send(message),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          const error = new Error('Push send timed out');
          error.code = 'push/send-timeout';
          reject(error);
        }, SEND_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

const claimJob = async () => {
  // Finish jobs that exhausted their attempts before a worker stopped.
  await pool.query(
    `
    UPDATE notification_push_jobs
    SET
      status = 'failed',
      finished_at = NOW(),
      locked_until = NULL,
      lock_token = NULL,
      last_error_code = COALESCE(
        last_error_code,
        'push/attempts-exhausted'
      ),
      updated_at = NOW()
    WHERE attempts >= $1
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND locked_until <= NOW()
        )
      )
    `,
    [MAX_ATTEMPTS]
  );

  const lockToken = randomUUID();

  const result = await pool.query(
    `
    WITH candidate AS (
      SELECT id
      FROM notification_push_jobs
      WHERE attempts < $1
        AND (
          (
            status = 'pending'
            AND available_at <= NOW()
          )
          OR
          (
            status = 'processing'
            AND locked_until <= NOW()
          )
        )
      ORDER BY available_at, id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
      UPDATE notification_push_jobs AS j
      SET
        status = 'processing',
        attempts = j.attempts + 1,
        locked_until = NOW() + INTERVAL '2 minutes',
        lock_token = $2::UUID,
        updated_at = NOW()
      FROM candidate AS c
      WHERE j.id = c.id
      RETURNING j.*
    )
    SELECT
      c.*,
      n.user_id,
      n.maintenance_request_id,
      n.type,
      n.title,
      n.body
    FROM claimed AS c
    INNER JOIN notifications AS n
      ON n.id = c.notification_id
    `,
    [MAX_ATTEMPTS, lockToken]
  );

  return result.rows[0] || null;
};

const renewLock = async (job) => {
  const result = await pool.query(
    `
    UPDATE notification_push_jobs
    SET
      locked_until = NOW() + INTERVAL '2 minutes',
      updated_at = NOW()
    WHERE id = $1
      AND lock_token = $2::UUID
      AND status = 'processing'
      AND locked_until > NOW()
    RETURNING id
    `,
    [job.id, job.lock_token]
  );

  return result.rowCount === 1;
};

const finishJob = async (
  job,
  status,
  errorCode = null,
  retryDelaySeconds = 0
) => {
  const result = await pool.query(
    `
    UPDATE notification_push_jobs
    SET
      status = $3::TEXT,
      last_error_code = $4::VARCHAR(100),
      available_at =
        NOW() + ($5::INTEGER * INTERVAL '1 second'),
      finished_at = CASE
        WHEN $3::TEXT = 'pending' THEN NULL
        ELSE NOW()
      END,
      locked_until = NULL,
      lock_token = NULL,
      updated_at = NOW()
    WHERE id = $1::BIGINT
      AND lock_token = $2::UUID
      AND status = 'processing'
    RETURNING id
    `,
    [
      job.id,
      job.lock_token,
      status,
      errorCode,
      retryDelaySeconds,
    ]
  );

  if (result.rowCount !== 1) {
    logger.warn(
      {
        jobId: job.id,
        notificationId: job.notification_id,
        targetStatus: status,
      },
      'Push job finalization skipped: job ownership changed'
    );

    return;
  }

  logger.info(
    {
      jobId: job.id,
      notificationId: job.notification_id,
      status,
      attempt: job.attempts,
      errorCode,
    },
    'Push job processed'
  );
};


const updateDelivery = async (
  job,
  deliveryId,
  status,
  errorCode = null,
  messageId = null
) => {
  const result = await pool.query(
    `
    UPDATE notification_push_deliveries AS d
    SET
      status = $4::TEXT,
      last_error_code = $5::VARCHAR(100),
      firebase_message_id = $6::TEXT,
      sent_at = CASE
        WHEN $4::TEXT = 'sent' THEN NOW()
        ELSE d.sent_at
      END,
      updated_at = NOW()
    WHERE d.id = $1::BIGINT
      AND d.job_id = $2::BIGINT
      AND d.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM notification_push_jobs AS j
        WHERE j.id = d.job_id
          AND j.lock_token = $3::UUID
          AND j.status = 'processing'
          AND j.locked_until > NOW()
      )
    RETURNING d.id
    `,
    [
      deliveryId,
      job.id,
      job.lock_token,
      status,
      errorCode,
      messageId,
    ]
  );

  if (result.rowCount !== 1) {
    const error = new Error('Delivery update lost job ownership');
    error.code = 'push/lock-lost';
    throw error;
  }
};


const processJob = async (job) => {
  if (!(await renewLock(job))) return;

  // Capture the target devices once, atomically.
  // Retries will use the same list.
  await pool.query(
    `
    WITH initialized_job AS (
      UPDATE notification_push_jobs
      SET
        targets_initialized_at = NOW(),
        updated_at = NOW()
      WHERE id = $1::BIGINT
        AND lock_token = $2::UUID
        AND status = 'processing'
        AND locked_until > NOW()
        AND targets_initialized_at IS NULL
      RETURNING id
    )
    INSERT INTO notification_push_deliveries (
      job_id,
      device_token_id
    )
    SELECT
      j.id,
      dt.id
    FROM initialized_job AS j
    CROSS JOIN user_device_tokens AS dt
    INNER JOIN users AS u
      ON u.id = dt.user_id
    WHERE dt.user_id = $3::BIGINT
      AND u.is_active = TRUE
    ON CONFLICT (job_id, device_token_id)
    DO NOTHING
    `,
    [job.id, job.lock_token, job.user_id]
  );

  const pendingResult = await pool.query(
    `
    SELECT id
    FROM notification_push_deliveries
    WHERE job_id = $1
      AND status = 'pending'
    ORDER BY id
    `,
    [job.id]
  );

  for (const delivery of pendingResult.rows) {
    if (!(await renewLock(job))) return;

    // Recheck device ownership immediately before sending.
    const targetResult = await pool.query(
      `
      SELECT
        d.id,
        dt.id AS device_token_id,
        dt.token
      FROM notification_push_deliveries AS d
      LEFT JOIN user_device_tokens AS dt
        ON dt.id = d.device_token_id
        AND dt.user_id = $3::BIGINT
        AND EXISTS (
          SELECT 1
          FROM users AS u
          WHERE u.id = dt.user_id
            AND u.is_active = TRUE
        )
      WHERE d.id = $1::BIGINT
        AND d.job_id = $2::BIGINT
        AND d.status = 'pending'
      `,
      [delivery.id, job.id, job.user_id]
    );

    const target = targetResult.rows[0];

    if (!target) continue;

    if (!target.token) {
      await updateDelivery(
        job,
        delivery.id,
        'skipped',
        'push/device-unavailable'
      );

      continue;
    }

    const attemptResult = await pool.query(
      `
      UPDATE notification_push_deliveries AS d
      SET
        attempts = attempts + 1,
        updated_at = NOW()
      WHERE d.id = $1::BIGINT
        AND d.job_id = $2::BIGINT
        AND d.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM notification_push_jobs AS j
          WHERE j.id = d.job_id
            AND j.lock_token = $3::UUID
            AND j.status = 'processing'
            AND j.locked_until > NOW()
        )
      RETURNING d.id
      `,
      [delivery.id, job.id, job.lock_token]
    );

    if (attemptResult.rowCount !== 1) return;

    const data = {
      notification_id: String(job.notification_id),
      recipient_user_id: String(job.user_id),
      type: job.type,
    };

    if (job.maintenance_request_id !== null) {
      data.maintenance_request_id =
        String(job.maintenance_request_id);
    }

    let messageId;

    try {
      messageId = await sendWithTimeout({
        token: target.token,
        notification: {
          title: job.title,
          body: job.body,
        },
        data,
        android: {
          priority: 'high',
          ttl: 60 * 60 * 1000,
          notification: {
            tag: `hellha-notification-${job.notification_id}`,
            sound: 'default',
          },
        },
      });
    } catch (error) {
      const code = errorCodeOf(error);

      if (invalidTokenCodes.has(code)) {
        // Save the delivery result before removing the invalid token.
        await updateDelivery(
          job,
          delivery.id,
          'skipped',
          code
        );

        await pool.query(
          `
          DELETE FROM user_device_tokens
          WHERE id = $1
            AND user_id = $2
            AND token = $3
          `,
          [
            target.device_token_id,
            job.user_id,
            target.token,
          ]
        );
      } else {
        await updateDelivery(
          job,
          delivery.id,
          job.attempts < MAX_ATTEMPTS
            ? 'pending'
            : 'failed',
          code
        );
      }

      continue;
    }

    // A successful device will be excluded from subsequent retries.
    await updateDelivery(
      job,
      delivery.id,
      'sent',
      null,
      messageId
    );
  }

  const summaryResult = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'pending'
      )::INTEGER AS pending_count,

      COUNT(*) FILTER (
        WHERE status = 'sent'
      )::INTEGER AS sent_count,

      COUNT(*) FILTER (
        WHERE status = 'failed'
      )::INTEGER AS failed_count,

      MAX(last_error_code) FILTER (
        WHERE status IN ('pending', 'failed')
      ) AS error_code

    FROM notification_push_deliveries
    WHERE job_id = $1
    `,
    [job.id]
  );

  const summary = summaryResult.rows[0];

  if (summary.pending_count > 0) {
    const delay = Math.min(
      60 * (2 ** (job.attempts - 1)),
      900
    );

    await finishJob(
      job,
      'pending',
      summary.error_code || 'push/retry-required',
      delay
    );

    return;
  }

  if (summary.failed_count > 0) {
    await finishJob(
      job,
      'failed',
      summary.error_code || 'push/device-send-failed'
    );

    return;
  }

  await finishJob(
    job,
    summary.sent_count > 0 ? 'sent' : 'skipped'
  );
};

const runOnce = async () => {
  let job = null;

  try {
    job = await claimJob();

    if (job) {
      await processJob(job);
    }
  } catch (error) {
    const code = errorCodeOf(error);

    // Do not log raw errors: they could contain device tokens.
    logger.error(
      { jobId: job?.id, errorCode: code },
      'Push worker operation failed'
    );

    if (job) {
      try {
        const retry = job.attempts < MAX_ATTEMPTS;

        await finishJob(
          job,
          retry ? 'pending' : 'failed',
          code,
          retry ? 60 : 0
        );
    } catch (stateError) {
  logger.error(
    {
      jobId: job.id,
      errorCode: errorCodeOf(stateError),
    },
    'Could not update push job state'
  );
}
    }
  }
};

const tick = () => {
  if (stopped || runningTask) return;

  runningTask = runOnce().finally(() => {
    runningTask = null;
  });
};

const startNotificationPushWorker = () => {
  if (!stopped) return;

  stopped = false;
  timer = setInterval(tick, POLL_INTERVAL_MS);

  tick();

  logger.info('Notification push worker started');
};

const stopNotificationPushWorker = async () => {
  stopped = true;

  clearInterval(timer);
  timer = null;

  if (runningTask) {
    await runningTask;
  }
};

module.exports = {
  startNotificationPushWorker,
  stopNotificationPushWorker,
};