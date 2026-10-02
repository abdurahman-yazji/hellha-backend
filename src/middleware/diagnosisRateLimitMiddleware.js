const {
  rateLimit,
} = require('express-rate-limit');

const diagnosisRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,

  standardHeaders: 'draft-8',
  legacyHeaders: false,

  keyGenerator: (req) => {
    return req.user.uid;
  },

  skipFailedRequests: true,

  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message:
        'تم تجاوز عدد محاولات التشخيص المسموح. حاول مرة أخرى بعد عدة دقائق.',
    });
  },
});

module.exports = diagnosisRateLimiter;