const validateTechnicianProfileId = (req, res, next) => {
  const profileId = req.params.profileId;

  if (
    typeof profileId !== 'string' ||
    !/^[1-9]\d*$/.test(profileId)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Technician profile ID must be a positive integer',
    });
  }

  req.validatedTechnicianProfileId = profileId;

  return next();
};

const validateVerificationUpdate = (req, res, next) => {
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
    fields[0] !== 'is_verified'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Only is_verified is accepted',
    });
  }

  if (typeof body.is_verified !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'is_verified must be true or false',
    });
  }

  req.validatedBody = {
    isVerified: body.is_verified,
  };

  return next();
};

module.exports = {
  validateTechnicianProfileId,
  validateVerificationUpdate,
};