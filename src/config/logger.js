const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'hellha-backend',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'authorization',
      'headers.authorization',
      'req.headers.authorization',
      'request.headers.authorization',
      'token',
      'idToken',
      'password',
      'privateKey',
      'private_key',
      'serviceAccount.private_key',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
