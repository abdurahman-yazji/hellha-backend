const validateMaintenanceRequestReview = (
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

  const allowedFields = new Set([
    'rating',
    'comment',
  ]);

  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.has(field)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      message:
        'Only rating and comment are accepted',
    });
  }

  if (
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5
  ) {
    return res.status(400).json({
      success: false,
      message: 'rating must be an integer from 1 to 5',
    });
  }

  let comment = null;

  if (
    body.comment !== undefined &&
    body.comment !== null
  ) {
    if (typeof body.comment !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'comment must be a string',
      });
    }

    const trimmedComment = body.comment.trim();

    if (trimmedComment.length > 1000) {
      return res.status(400).json({
        success: false,
        message:
          'comment must not exceed 1000 characters',
      });
    }

    comment = trimmedComment || null;
  }

  req.validatedBody = {
    rating: body.rating,
    comment,
  };

  return next();
};

module.exports = {
  validateMaintenanceRequestReview,
};