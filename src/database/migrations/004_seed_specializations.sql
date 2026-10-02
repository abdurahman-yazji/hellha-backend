INSERT INTO specializations (
  name_ar,
  name_en,
  description
)
VALUES
  (
    'الكهرباء',
    'Electrical',
    'صيانة الأعطال الكهربائية المنزلية والأسلاك والمقابس والقواطع'
  ),
  (
    'السباكة',
    'Plumbing',
    'صيانة تسربات المياه والأنابيب والصنابير والمصارف'
  ),
  (
    'التكييف والتبريد',
    'Air Conditioning and Refrigeration',
    'فحص وصيانة أجهزة التكييف والتبريد المنزلية'
  ),
  (
    'صيانة الأجهزة المنزلية',
    'Home Appliance Repair',
    'تشخيص وصيانة أعطال الأجهزة الكهربائية المنزلية'
  ),
  (
    'أعمال البناء والتشققات',
    'Building and Crack Repair',
    'فحص ومعالجة التشققات والأعطال البسيطة في المباني'
  )
ON CONFLICT (name_ar)
DO UPDATE SET
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();