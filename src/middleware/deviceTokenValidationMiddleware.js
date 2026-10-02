const validateDeviceToken = (req, res, next) => {
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

  const allowedFields = new Set(['token', 'platform']);

  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.has(field)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unknown fields: ${unknownFields.join(', ')}`,
    });
  }

  const token =
    typeof body.token === 'string'
      ? body.token.trim()
      : '';

  if (
    token.length === 0 ||
    token.length > 4096 ||
    /\s/.test(token)
  ) {
    return res.status(400).json({
      success: false,
      message: 'A valid device token is required',
    });
  }

  const platform = body.platform;

  if (
    platform !== 'android' &&
    platform !== 'ios' &&
    platform !== 'web'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Platform must be android, ios or web',
    });
  }

  req.validatedBody = {
    token,
    platform,
  };

  return next();
};

module.exports = {
  validateDeviceToken,
};