CREATE TABLE maintenance_requests (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  diagnosis_id BIGINT NOT NULL UNIQUE
    REFERENCES diagnoses(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  specialization_id BIGINT
    REFERENCES specializations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  technician_profile_id BIGINT
    REFERENCES technician_profiles(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  contact_phone VARCHAR(30) NOT NULL,

  work_area VARCHAR(150) NOT NULL,

  address_details TEXT NOT NULL,

  notes TEXT,

  latitude NUMERIC(9, 6)
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  longitude NUMERIC(9, 6)
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    ),

  status VARCHAR(30) NOT NULL DEFAULT 'created'
    CHECK (
      status IN (
        'created',
        'assigned',
        'in_progress',
        'completed',
        'closed',
        'cancelled'
      )
    ),

  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (
      latitude IS NULL
      AND longitude IS NULL
    )
    OR
    (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
    )
  )
);

CREATE INDEX idx_maintenance_requests_user_created_at
ON maintenance_requests (user_id, created_at DESC);

CREATE INDEX idx_maintenance_requests_status
ON maintenance_requests (status);

CREATE INDEX idx_maintenance_requests_technician_status
ON maintenance_requests (
  technician_profile_id,
  status
);

CREATE INDEX idx_maintenance_requests_specialization
ON maintenance_requests (specialization_id);