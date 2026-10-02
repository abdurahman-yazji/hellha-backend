-- جدول الملف المهني للفني
CREATE TABLE technician_profiles (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL UNIQUE
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  phone VARCHAR(30),
  profile_image_url TEXT,
  bio TEXT,
  work_area VARCHAR(150),

  years_of_experience SMALLINT NOT NULL DEFAULT 0
    CHECK (years_of_experience BETWEEN 0 AND 80),

  service_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 10
    CHECK (service_radius_km > 0 AND service_radius_km <= 100),

  availability_status VARCHAR(20) NOT NULL DEFAULT 'unavailable'
    CHECK (
      availability_status IN (
        'available',
        'unavailable'
      )
    ),

  average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0
    CHECK (average_rating BETWEEN 0 AND 5),

  total_completed_jobs INTEGER NOT NULL DEFAULT 0
    CHECK (total_completed_jobs >= 0),

  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- قائمة التخصصات المتاحة
CREATE TABLE specializations (
  id BIGSERIAL PRIMARY KEY,
  name_ar VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100) UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- العلاقة بين الفني والتخصصات
CREATE TABLE technician_specializations (
  technician_profile_id BIGINT NOT NULL
    REFERENCES technician_profiles(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  specialization_id BIGINT NOT NULL
    REFERENCES specializations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (technician_profile_id, specialization_id)
);

-- شهادات الفني
CREATE TABLE technician_certificates (
  id BIGSERIAL PRIMARY KEY,

  technician_profile_id BIGINT NOT NULL
    REFERENCES technician_profiles(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  certificate_name VARCHAR(200) NOT NULL,
  issuing_organization VARCHAR(200),
  issue_date DATE,
  expiry_date DATE,
  document_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    expiry_date IS NULL
    OR issue_date IS NULL
    OR expiry_date >= issue_date
  )
);

-- فهارس لتحسين البحث
CREATE INDEX idx_technician_profiles_availability
  ON technician_profiles (availability_status);

CREATE INDEX idx_technician_profiles_verified
  ON technician_profiles (is_verified);

CREATE INDEX idx_technician_profiles_work_area
  ON technician_profiles (work_area);

CREATE INDEX idx_technician_specializations_specialization
  ON technician_specializations (specialization_id);

CREATE INDEX idx_technician_certificates_profile
  ON technician_certificates (technician_profile_id);