require('dotenv').config({ quiet: true });

const app = require('./src/app');
const pool = require('./src/config/database');
const logger = require('./src/config/logger');

const {
  startNotificationPushWorker,
  stopNotificationPushWorker,
} = require('./src/workers/notificationPushWorker');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(
    { port: Number(PORT) },
    'Hellha API started'
  );

  startNotificationPushWorker();
});

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;

  shuttingDown = true;

  logger.info({ signal }, 'Hellha API stopping');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Server shutdown timed out');
    process.exit(1);
  }, 60000);

  shutdownTimeout.unref();

  try {
    const httpStopped = new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    await Promise.all([
      httpStopped,
      stopNotificationPushWorker(),
    ]);

    await pool.end();

    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error(
      { errorCode: error.code },
      'Server shutdown failed'
    );

    process.exit(1);
  }
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});