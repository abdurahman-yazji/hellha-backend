const pool = require('../config/database');
const logger = require('../config/logger');

const getActiveSpecializations = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name_ar,
        name_en,
        description
      FROM specializations
      WHERE is_active = TRUE
      ORDER BY id
      `
    );

    return res.status(200).json({
      success: true,
      specializations: result.rows,
    });
  } catch (error) {
    logger.error(
      { err: error },
      'Active specializations lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to get specializations',
    });
  }
};

module.exports = {
  getActiveSpecializations,
};