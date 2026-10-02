CREATE TABLE notification_push_jobs (
  id BIGSERIAL PRIMARY KEY,

  notification_id BIGINT NOT NULL UNIQUE
    REFERENCES notifications(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,

  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  lock_token UUID,

  last_error_code VARCHAR(100),
  finished_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_push_jobs_status_check
    CHECK (
      status IN (
        'pending',
        'processing',
        'sent',
        'skipped',
        'failed'
      )
    ),

  CONSTRAINT notification_push_jobs_attempts_check
    CHECK (attempts >= 0)
);

CREATE INDEX notification_push_jobs_pending_idx
  ON notification_push_jobs (available_at, id)
  WHERE status = 'pending';

CREATE INDEX notification_push_jobs_processing_idx
  ON notification_push_jobs (locked_until)
  WHERE status = 'processing';