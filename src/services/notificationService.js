const createNotification = async (
  db,
  {
    userId,
    maintenanceRequestId = null,
    type,
    title,
    body,
  }
) => {
  const result = await db.query(
    `
    WITH inserted_notification AS (
      INSERT INTO notifications (
        user_id,
        maintenance_request_id,
        type,
        title,
        body
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        maintenance_request_id,
        type,
        title,
        body,
        read_at,
        created_at
    ),
    inserted_push_job AS (
      INSERT INTO notification_push_jobs (
        notification_id
      )
      SELECT id
      FROM inserted_notification
      RETURNING notification_id
    )
    SELECT n.*
    FROM inserted_notification AS n
    INNER JOIN inserted_push_job AS j
      ON j.notification_id = n.id
    `,
    [
      userId,
      maintenanceRequestId,
      type,
      title,
      body,
    ]
  );

  return result.rows[0];
};

module.exports = {
  createNotification,
};