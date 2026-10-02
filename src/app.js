const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const pool = require('./config/database');
const logger = require('./config/logger');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const diagnosisRoutes = require(
  './routes/diagnosisRoutes'
);
const maintenanceRequestRoutes = require(
  './routes/maintenanceRequestRoutes'
);
const {
  handleJsonSyntaxError,
} = require('./middleware/validationMiddleware');
const specializationRoutes = require(
  './routes/specializationRoutes'
);
const deviceTokenRoutes = require('./routes/deviceTokenRoutes');

const certificateRoutes = require('./routes/certificateRoutes');

const app = express();
const allowedOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:8080'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/specializations', specializationRoutes);
app.use(
  '/api/technicians/me/certificates',
  certificateRoutes
);
app.use('/api/device-tokens', deviceTokenRoutes);
app.use('/api/diagnoses', diagnosisRoutes);
app.use(
  '/api/maintenance-requests',
  maintenanceRequestRoutes
);
app.use('/api/admin', adminRoutes);
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hellha API is running',
  });
});
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.status(200).json({
      success: true,
      message: 'Database connected successfully',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    logger.error({ err: error }, 'Database connection check failed');

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

app.use(handleJsonSyntaxError);

module.exports = app;
