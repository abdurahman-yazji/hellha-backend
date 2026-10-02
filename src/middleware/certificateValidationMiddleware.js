const allowedFields = new Set([
  'certificate_name',
  'issuing_organization',
  'issue_date',
  'expiry_date',
  'document_url',
]);

const isValidDate = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const validateCreateCertificate = (req, res, next) => {
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

  const certificateName =
    typeof body.certificate_name === 'string'
      ? body.certificate_name.trim()
      : '';

  if (
    certificateName.length < 2 ||
    certificateName.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Certificate name must contain 2 to 200 characters',
    });
  }

  let issuingOrganization = null;

  if (
    body.issuing_organization !== undefined &&
    body.issuing_organization !== null
  ) {
    if (typeof body.issuing_organization !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Issuing organization must be text',
      });
    }

    issuingOrganization =
      body.issuing_organization.trim() || null;

    if (
      issuingOrganization !== null &&
      issuingOrganization.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Issuing organization must not exceed 200 characters',
      });
    }
  }

  const issueDate = body.issue_date ?? null;
  const expiryDate = body.expiry_date ?? null;

  if (issueDate !== null && !isValidDate(issueDate)) {
    return res.status(400).json({
      success: false,
      message: 'Issue date must use YYYY-MM-DD format',
    });
  }

  if (expiryDate !== null && !isValidDate(expiryDate)) {
    return res.status(400).json({
      success: false,
      message: 'Expiry date must use YYYY-MM-DD format',
    });
  }

  if (
    issueDate !== null &&
    expiryDate !== null &&
    expiryDate < issueDate
  ) {
    return res.status(400).json({
      success: false,
      message: 'Expiry date cannot be before issue date',
    });
  }

  let documentUrl = null;

  if (
    body.document_url !== undefined &&
    body.document_url !== null
  ) {
    if (typeof body.document_url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Document URL must be text',
      });
    }

    documentUrl = body.document_url.trim() || null;

    if (documentUrl !== null) {
      try {
        const parsedUrl = new URL(documentUrl);

        if (
          parsedUrl.protocol !== 'http:' &&
          parsedUrl.protocol !== 'https:'
        ) {
          throw new Error('Unsupported URL protocol');
        }
      } catch (_) {
        return res.status(400).json({
          success: false,
          message: 'Document URL must be a valid HTTP or HTTPS URL',
        });
      }
    }
  }

  req.validatedBody = {
    certificateName,
    issuingOrganization,
    issueDate,
    expiryDate,
    documentUrl,
  };

  return next();
};

const validateCertificateId = (req, res, next) => {
  const certificateId = req.params.certificateId;

  if (
    typeof certificateId !== 'string' ||
    !/^[1-9]\d*$/.test(certificateId)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Certificate ID must be a positive integer',
    });
  }

  req.validatedCertificateId = certificateId;

  return next();
};


module.exports = {
  validateCreateCertificate,
  validateCertificateId,
};