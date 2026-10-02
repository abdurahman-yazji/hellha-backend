const allowedFields = new Set([
  'phone',
  'bio',
  'work_area',
  'years_of_experience',
  'service_radius_km',
]);

const validateCreateTechnicianProfile = (req, res, next) => {
  const body = req.body;

  const isPlainObject =
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body);

  if (!isPlainObject) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a JSON object',
    });
  }

  const unexpectedFields = Object.keys(body).filter(
    (field) => !allowedFields.has(field)
  );

  if (unexpectedFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unsupported fields: ${unexpectedFields.join(', ')}`,
    });
  }

  const phone =
    typeof body.phone === 'string' ? body.phone.trim() : '';

  if (
    phone.length < 7 ||
    phone.length > 20 ||
    !/^\+?[0-9\s()-]+$/.test(phone)
  ) {
    return res.status(400).json({
      success: false,
      message: 'A valid phone number is required',
    });
  }

  const workArea =
    typeof body.work_area === 'string'
      ? body.work_area.trim()
      : '';

  if (workArea.length < 2 || workArea.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Work area must contain 2 to 100 characters',
    });
  }

  if (
    !Number.isInteger(body.years_of_experience) ||
    body.years_of_experience < 0 ||
    body.years_of_experience > 80
  ) {
    return res.status(400).json({
      success: false,
      message: 'Years of experience must be an integer from 0 to 80',
    });
  }

  let serviceRadiusKm = 10;

  if (body.service_radius_km !== undefined) {
    serviceRadiusKm = body.service_radius_km;

    if (
      typeof serviceRadiusKm !== 'number' ||
      !Number.isFinite(serviceRadiusKm) ||
      serviceRadiusKm <= 0 ||
      serviceRadiusKm > 100
    ) {
      return res.status(400).json({
        success: false,
        message: 'Service radius must be greater than 0 and at most 100',
      });
    }
  }

  let bio = null;

  if (body.bio !== undefined && body.bio !== null) {
    if (typeof body.bio !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Bio must be text',
      });
    }

    bio = body.bio.trim();

    if (bio.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Bio must not exceed 1000 characters',
      });
    }

    if (bio.length === 0) {
      bio = null;
    }
  }

  req.validatedBody = {
    phone,
    bio,
    work_area: workArea,
    years_of_experience: body.years_of_experience,
    service_radius_km: serviceRadiusKm,
  };

  return next();
};

const validateSpecializationSelection = (req, res, next) => {
  const body = req.body;

  const isPlainObject =
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body);

  if (!isPlainObject) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a JSON object',
    });
  }

  const fields = Object.keys(body);

  if (
    fields.length !== 1 ||
    fields[0] !== 'specialization_ids'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Only specialization_ids is accepted',
    });
  }

  const specializationIds = body.specialization_ids;

  if (
    !Array.isArray(specializationIds) ||
    specializationIds.length === 0 ||
    specializationIds.length > 10
  ) {
    return res.status(400).json({
      success: false,
      message: 'Select between 1 and 10 specializations',
    });
  }

  const normalizedIds = [];

  for (const id of specializationIds) {
    const isPositiveInteger =
      Number.isSafeInteger(id) && id > 0;

    const isPositiveIntegerString =
      typeof id === 'string' && /^[1-9]\d*$/.test(id);

    if (!isPositiveInteger && !isPositiveIntegerString) {
      return res.status(400).json({
        success: false,
        message: 'Every specialization ID must be a positive integer',
      });
    }

    normalizedIds.push(String(id));
  }

  const uniqueIds = [...new Set(normalizedIds)];

  if (uniqueIds.length !== normalizedIds.length) {
    return res.status(400).json({
      success: false,
      message: 'Specialization IDs must not be repeated',
    });
  }

  req.validatedBody = {
    specializationIds: uniqueIds,
  };

  return next();
};

const validateUpdateTechnicianProfile = (req, res, next) => {
  const body = req.body;

  const isPlainObject =
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body);

  if (!isPlainObject) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a JSON object',
    });
  }

  const allowedFields = new Set([
    'phone',
    'bio',
    'work_area',
    'years_of_experience',
    'service_radius_km',
    'availability_status',
  ]);

  const fields = Object.keys(body);

  if (fields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one field is required',
    });
  }

  const unsupportedFields = fields.filter(
    (field) => !allowedFields.has(field)
  );

  if (unsupportedFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unsupported fields: ${unsupportedFields.join(', ')}`,
    });
  }

  const validatedBody = {};

  if (body.phone !== undefined) {
    const phone =
      typeof body.phone === 'string'
        ? body.phone.trim()
        : '';

    if (
      phone.length < 7 ||
      phone.length > 20 ||
      !/^\+?[0-9\s()-]+$/.test(phone)
    ) {
      return res.status(400).json({
        success: false,
        message: 'A valid phone number is required',
      });
    }

    validatedBody.phone = phone;
  }

  if (body.bio !== undefined) {
    if (body.bio === null) {
      validatedBody.bio = null;
    } else if (typeof body.bio === 'string') {
      const bio = body.bio.trim();

      if (bio.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Bio must not exceed 1000 characters',
        });
      }

      validatedBody.bio = bio || null;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Bio must be text or null',
      });
    }
  }

  if (body.work_area !== undefined) {
    const workArea =
      typeof body.work_area === 'string'
        ? body.work_area.trim()
        : '';

    if (workArea.length < 2 || workArea.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          'Work area must contain 2 to 100 characters',
      });
    }

    validatedBody.workArea = workArea;
  }

  if (body.years_of_experience !== undefined) {
    const years = body.years_of_experience;

    if (
      !Number.isInteger(years) ||
      years < 0 ||
      years > 80
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Years of experience must be an integer from 0 to 80',
      });
    }

    validatedBody.yearsOfExperience = years;
  }

  if (body.service_radius_km !== undefined) {
    const radius = body.service_radius_km;

    if (
      typeof radius !== 'number' ||
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Service radius must be greater than 0 and at most 100',
      });
    }

    validatedBody.serviceRadiusKm = radius;
  }

  if (body.availability_status !== undefined) {
    const status = body.availability_status;

    if (
      status !== 'available' &&
      status !== 'unavailable'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Availability status must be available or unavailable',
      });
    }

    validatedBody.availabilityStatus = status;
  }

  req.validatedBody = validatedBody;

  return next();
};

module.exports = {
  validateCreateTechnicianProfile,
  validateSpecializationSelection,
  validateUpdateTechnicianProfile,
};