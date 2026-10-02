CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  maintenance_request_id BIGINT
    REFERENCES maintenance_requests(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  type VARCHAR(50) NOT NULL
    CHECK (
      type IN (
        'request_assigned',
        'request_started',
        'request_completed',
        'request_declined',
        'request_reassigned',
        'request_cancelled',
        'request_reviewed'
      )
    ),

  title VARCHAR(150) NOT NULL
    CHECK (LENGTH(BTRIM(title)) > 0),

  body TEXT NOT NULL
    CHECK (
      LENGTH(BTRIM(body)) > 0
      AND LENGTH(body) <= 1000
    ),

  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created
  ON notifications (
    user_id,
    created_at DESC,
    id DESC
  );

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_maintenance_request
  ON notifications (maintenance_request_id);