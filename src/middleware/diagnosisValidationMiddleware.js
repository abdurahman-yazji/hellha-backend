const allowedCategories = new Set([
  'الكهرباء',
  'السباكة',
  'التكييف والتبريد',
  'الأجهزة المنزلية',
  'البناء والتشققات',
  'غير متأكد',
]);

const allowedFields = new Set([
  'category',
  'description',
]);

const validateDiagnosisRequest = (req, res, next) => {
  const body = req.body;

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request body',
    });
  }

  const receivedFields = Object.keys(body);

  const hasUnknownField = receivedFields.some(
    (field) => !allowedFields.has(field)
  );

  if (hasUnknownField) {
    return res.status(400).json({
      success: false,
      message: 'Request contains unsupported fields',
    });
  }

  const description =
    typeof body.description === 'string'
      ? body.description.trim()
      : '';

  if (description.length < 10) {
    return res.status(400).json({
      success: false,
      message:
        'Description must contain at least 10 characters',
    });
  }

  if (description.length > 1000) {
    return res.status(400).json({
      success: false,
      message:
        'Description must not exceed 1000 characters',
    });
  }

  let category = null;

  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Category must be a string',
      });
    }

    category = body.category.trim();

    if (!allowedCategories.has(category)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported maintenance category',
      });
    }
  }

  req.validatedBody = {
    category,
    description,
  };

  return next();
};

module.exports = {
  validateDiagnosisRequest,
};