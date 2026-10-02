ALTER TABLE notification_push_jobs
ADD COLUMN targets_initialized_at TIMESTAMPTZ;

CREATE TABLE notification_push_deliveries (
  id BIGSERIAL PRIMARY KEY,

  job_id BIGINT NOT NULL
    REFERENCES notification_push_jobs(id)
    ON DELETE CASCADE,

  device_token_id BIGINT
    REFERENCES user_device_tokens(id)
    ON DELETE SET NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,

  firebase_message_id TEXT,
  last_error_code VARCHAR(100),
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_push_deliveries_unique_device
    UNIQUE (job_id, device_token_id),

  CONSTRAINT notification_push_deliveries_status_check
    CHECK (
      status IN ('pending', 'sent', 'skipped', 'failed')
    ),

  CONSTRAINT notification_push_deliveries_attempts_check
    CHECK (attempts >= 0)
);

CREATE INDEX notification_push_deliveries_pending_idx
  ON notification_push_deliveries (job_id, id)
  WHERE status = 'pending';
  