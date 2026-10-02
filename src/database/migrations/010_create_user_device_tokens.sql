CREATE TABLE user_device_tokens (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,

  platform VARCHAR(20) NOT NULL DEFAULT 'android',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_device_tokens_token_check
    CHECK (
      CHAR_LENGTH(BTRIM(token)) BETWEEN 1 AND 4096
      AND token = BTRIM(token)
    ),

  CONSTRAINT user_device_tokens_platform_check
    CHECK (platform IN ('android', 'ios', 'web'))
);

CREATE INDEX user_device_tokens_user_id_idx
  ON user_device_tokens (user_id);