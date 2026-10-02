-- السماح بطلب صيانة دون تشخيص ذكاء اصطناعي.
ALTER TABLE maintenance_requests
  ALTER COLUMN diagnosis_id DROP NOT NULL;

-- وصف المشكلة الذي يكتبه المستخدم عند الحجز المباشر.
ALTER TABLE maintenance_requests
  ADD COLUMN request_description TEXT;

-- الوصف، إن وُجد، يجب أن يكون بين 10 و2000 حرف.
ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_description_length_check
  CHECK (
    request_description IS NULL
    OR CHAR_LENGTH(BTRIM(request_description)) BETWEEN 10 AND 2000
  );

-- كل طلب يجب أن يرتبط بتشخيص أو يحتوي وصفًا للمشكلة.
ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_source_check
  CHECK (
    diagnosis_id IS NOT NULL
    OR request_description IS NOT NULL
  );