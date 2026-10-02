const allowedStatuses = new Set([
  'in_progress',
  'completed',
]);

const validateMaintenanceRequestStatus = (
  req,
  res,
  next
) => {
  const requestId = req.params.requestId;

  if (
    !requestId ||
    !/^\d+$/.test(requestId) ||
    Number(requestId) <= 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        'A valid maintenance request ID is required',
    });
  }

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
    fields[0] !== 'status'
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Only the status field is accepted',
    });
  }

  if (!allowedStatuses.has(body.status)) {
    return res.status(400).json({
      success: false,
      message:
        'status must be in_progress or completed',
    });
  }

  req.validatedParams = {
    requestId,
  };

  req.validatedBody = {
    status: body.status,
  };

  return next();
};

const validateMaintenanceRequestId = (
  req,
  res,
  next
) => {
  const requestId = req.params.requestId;

  if (
    !requestId ||
    !/^\d+$/.test(requestId) ||
    Number(requestId) <= 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        'A valid maintenance request ID is required',
    });
  }

  req.validatedParams = {
    requestId,
  };

  return next();
};

module.exports = {
  validateMaintenanceRequestStatus,
  validateMaintenanceRequestId,
};