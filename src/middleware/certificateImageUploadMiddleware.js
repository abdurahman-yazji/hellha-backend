const multer = require('multer');

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldSize: 16 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error(
        'Only JPEG, PNG and WebP images are accepted'
      );

      error.code = 'INVALID_IMAGE_TYPE';
      return callback(error);
    }

    return callback(null, true);
  },
}).single('image');

const uploadCertificateImage = (req, res, next) => {
  // Keep supporting existing JSON requests without an image.
  if (req.is('application/json')) {
    return next();
  }

  if (!req.is('multipart/form-data')) {
    return res.status(415).json({
      success: false,
      message:
        'Use application/json or multipart/form-data',
    });
  }

  upload(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'Image must not exceed 5 MB',
        });
      }

      if (error.code === 'INVALID_IMAGE_TYPE') {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message:
            'Send certificate fields and at most one image in the image field',
        });
      }

      return next(error);
    }

    // Multipart text fields arrive as strings.
    // Normalize empty optional values for the existing validator.
    const optionalFields = [
      'issuing_organization',
      'issue_date',
      'expiry_date',
      'document_url',
    ];

    for (const field of optionalFields) {
      if (
        typeof req.body[field] === 'string' &&
        req.body[field].trim() === ''
      ) {
        req.body[field] = null;
      }
    }

    return next();
  });
};

module.exports = {
  uploadCertificateImage,
};