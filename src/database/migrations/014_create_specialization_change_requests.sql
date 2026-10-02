CREATE TABLE technician_specialization_change_requests (
  id BIGSERIAL PRIMARY KEY,

  technician_profile_id BIGINT NOT NULL
    REFERENCES technician_profiles(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  reviewed_by BIGINT
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  review_note TEXT
    CHECK (
      review_note IS NULL
      OR CHAR_LENGTH(BTRIM(review_note)) BETWEEN 1 AND 1000
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,

  CONSTRAINT specialization_change_review_state_check
    CHECK (
      (
        status = 'pending'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_note IS NULL
      )
      OR
      (
        status IN ('approved', 'rejected')
        AND reviewed_at IS NOT NULL
      )
    )
);

-- طلب واحد قيد المراجعة لكل فني.
CREATE UNIQUE INDEX idx_specialization_change_one_pending
ON technician_specialization_change_requests (
  technician_profile_id
)
WHERE status = 'pending';

-- قائمة الطلبات التي يراجعها المسؤول.
CREATE INDEX idx_specialization_change_status_created
ON technician_specialization_change_requests (
  status,
  created_at DESC
);

-- سجل طلبات الفني.
CREATE INDEX idx_specialization_change_technician_created
ON technician_specialization_change_requests (
  technician_profile_id,
  created_at DESC
);

-- القائمة الكاملة للتخصصات التي يريد الفني اعتمادها.
CREATE TABLE technician_specialization_change_items (
  request_id BIGINT NOT NULL
    REFERENCES technician_specialization_change_requests(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  specialization_id BIGINT NOT NULL
    REFERENCES specializations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  PRIMARY KEY (request_id, specialization_id)
);