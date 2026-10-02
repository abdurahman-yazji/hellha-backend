CREATE TABLE maintenance_request_reviews (
  id BIGSERIAL PRIMARY KEY,

  maintenance_request_id BIGINT NOT NULL UNIQUE
    REFERENCES maintenance_requests(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  rating SMALLINT NOT NULL
    CHECK (rating BETWEEN 1 AND 5),

  comment TEXT
    CHECK (
      comment IS NULL
      OR CHAR_LENGTH(BTRIM(comment)) BETWEEN 1 AND 1000
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);