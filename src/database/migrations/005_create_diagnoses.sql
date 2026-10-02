CREATE TABLE diagnoses (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  category VARCHAR(100),

  description TEXT NOT NULL
    CHECK (
      CHAR_LENGTH(BTRIM(description))
      BETWEEN 10 AND 1000
    ),

  predicted_fault VARCHAR(300) NOT NULL,

  severity VARCHAR(20) NOT NULL
    CHECK (
      severity IN (
        'low',
        'medium',
        'high',
        'critical'
      )
    ),

  tools JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (JSONB_TYPEOF(tools) = 'array'),

  guide JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (JSONB_TYPEOF(guide) = 'array'),

  safety_warnings JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (
      JSONB_TYPEOF(safety_warnings) = 'array'
    ),

  requires_technician BOOLEAN NOT NULL DEFAULT FALSE,

  model_name VARCHAR(100) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnoses_user_created_at
ON diagnoses (user_id, created_at DESC);

CREATE INDEX idx_diagnoses_severity
ON diagnoses (severity);

CREATE INDEX idx_diagnoses_requires_technician
ON diagnoses (requires_technician);