const allowedQueryFields = new Set([
  'specialization_id',
  'work_area',
]);

const validateAvailableTechnicianSearch = (
  req,
  res,
  next
) => {
  const unknownFields = Object.keys(
    req.query
  ).filter(
    (field) => !allowedQueryFields.has(field)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unknown query fields: ${unknownFields.join(', ')}`,
    });
  }

  const specializationId =
    req.query.specialization_id?.toString();

  if (
    !specializationId ||
    !/^\d+$/.test(specializationId) ||
    Number(specializationId) <= 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        'A valid specialization_id is required',
    });
  }

  let workArea = null;

  if (req.query.work_area !== undefined) {
    workArea = req.query.work_area
      .toString()
      .trim();

    if (
      workArea.length < 2 ||
      workArea.length > 150
    ) {
      return res.status(400).json({
        success: false,
        message:
          'work_area must contain between 2 and 150 characters',
      });
    }
  }

  req.validatedQuery = {
    specializationId,
    workArea,
  };

  return next();
};

module.exports = {
  validateAvailableTechnicianSearch,
};