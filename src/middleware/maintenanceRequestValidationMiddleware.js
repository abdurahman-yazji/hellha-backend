const allowedFields = new Set([
  'diagnosis_id',
  'specialization_id',
  'technician_profile_id',
  'contact_phone',
  'work_area',
  'address_details',
  'notes',
  'latitude',
  'longitude',
  'request_description',
  
]);

const isPositiveId = (value) => {
  return (
    typeof value === 'string' ||
    typeof value === 'number'
  ) &&
    /^\d+$/.test(value.toString()) &&
    Number(value) > 0;
};

const validateCreateMaintenanceRequest = (
  req,
  res,
  next
) => {
  const body = req.body;

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a JSON object',
    });
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.has(field)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unknown fields: ${unknownFields.join(', ')}`,
    });
  }

   let diagnosisId = null;

  if (body.diagnosis_id !== undefined && body.diagnosis_id !== null) {
    if (!isPositiveId(body.diagnosis_id)) {
      return res.status(400).json({
        success: false,
        message: 'A valid diagnosis_id is required',
      });
    }

    diagnosisId = body.diagnosis_id.toString();
  }

  let requestDescription = null;

  if (
    body.request_description !== undefined &&
    body.request_description !== null
  ) {
    if (typeof body.request_description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'وصف المشكلة يجب أن يكون نصًا',
      });
    }

    requestDescription = body.request_description.trim();

    const descriptionLength = [...requestDescription].length;

    if (descriptionLength < 10 || descriptionLength > 2000) {
      return res.status(400).json({
        success: false,
        message: 'وصف المشكلة يجب أن يحتوي بين 10 و2000 حرف',
      });
    }
  }

  if (diagnosisId === null && requestDescription === null) {
    return res.status(400).json({
      success: false,
      message: 'أدخل وصف المشكلة لإرسال طلب صيانة مباشر',
    });
  }

  if (!isPositiveId(body.specialization_id)) {
    return res.status(400).json({
      success: false,
      message: 'A valid specialization_id is required',
    });
  }


    if (!isPositiveId(body.technician_profile_id)) {
    return res.status(400).json({
      success: false,
      message:
        'A valid technician_profile_id is required',
    });
  }

  const contactPhone =
    typeof body.contact_phone === 'string'
      ? body.contact_phone.trim()
      : '';

  if (
    contactPhone.length < 7 ||
    contactPhone.length > 30 ||
    !/^[0-9+()\-\s]+$/.test(contactPhone)
  ) {
    return res.status(400).json({
      success: false,
      message: 'A valid contact_phone is required',
    });
  }

  const workArea =
    typeof body.work_area === 'string'
      ? body.work_area.trim()
      : '';

  if (workArea.length < 2 || workArea.length > 150) {
    return res.status(400).json({
      success: false,
      message:
        'work_area must contain between 2 and 150 characters',
    });
  }

  const addressDetails =
    typeof body.address_details === 'string'
      ? body.address_details.trim()
      : '';

  if (
    addressDetails.length < 5 ||
    addressDetails.length > 500
  ) {
    return res.status(400).json({
      success: false,
      message:
        'address_details must contain between 5 and 500 characters',
    });
  }

  let notes = null;

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'notes must be a string',
      });
    }

    notes = body.notes.trim();

    if (notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message:
          'notes must not exceed 1000 characters',
      });
    }

    if (notes.length === 0) {
      notes = null;
    }
  }

  const hasLatitude =
    body.latitude !== undefined &&
    body.latitude !== null;

  const hasLongitude =
    body.longitude !== undefined &&
    body.longitude !== null;

  if (hasLatitude !== hasLongitude) {
    return res.status(400).json({
      success: false,
      message:
        'latitude and longitude must be provided together',
    });
  }

  let latitude = null;
  let longitude = null;

  if (hasLatitude && hasLongitude) {
    latitude = Number(body.latitude);
    longitude = Number(body.longitude);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return res.status(400).json({
        success: false,
        message: 'latitude must be between -90 and 90',
      });
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message:
          'longitude must be between -180 and 180',
      });
    }
  }

   req.validatedBody = {
        diagnosisId,
    requestDescription,
    specializationId:
        body.specialization_id.toString(),
    technicianProfileId:
        body.technician_profile_id.toString(),
    contactPhone,
    workArea,
    addressDetails,
    notes,
    latitude,
    longitude,
  };

  return next();
};



const validateReassignMaintenanceRequest = (
  req,
  res,
  next
) => {
  const body = req.body;

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a JSON object',
    });
  }

  const fields = Object.keys(body);

  if (
    fields.length !== 1 ||
    fields[0] !== 'technician_profile_id'
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Only technician_profile_id is accepted',
    });
  }

  if (!isPositiveId(body.technician_profile_id)) {
    return res.status(400).json({
      success: false,
      message:
        'A valid technician_profile_id is required',
    });
  }

  req.validatedBody = {
    technicianProfileId:
      body.technician_profile_id.toString(),
  };

  return next();
};

module.exports = {
  validateCreateMaintenanceRequest,
  validateReassignMaintenanceRequest,

};