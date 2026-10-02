const requireEmptyBody = (req, res, next) => {
  const body = req.body;
  const isEmptyObject =
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.keys(body).length === 0;

  if (body === undefined || isEmptyObject) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: 'Invalid request body - No fields are accepted',
  });
};

const handleJsonSyntaxError = (error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON body',
    });
  }

  return next(error);
};

module.exports = {
  requireEmptyBody,
  handleJsonSyntaxError,
};
