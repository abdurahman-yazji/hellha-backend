const { auth } = require('../config/firebaseAdmin');
const logger = require('../config/logger');

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Token is missing',
      });
    }

    const idToken = authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Token is missing',
      });
    }
    const decodedToken = await auth.verifyIdToken(idToken);

    req.user = decodedToken;

    next();
  } catch (error) {
    logger.warn(
      { firebaseErrorCode: error.code || 'unknown' },
      'Firebase authentication failed'
    );

    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid token',
    });
  }
};

module.exports = verifyFirebaseToken;
