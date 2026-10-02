const pool = require('../config/database');
const logger = require('../config/logger');
const {
  diagnoseMaintenanceIssue,
} = require('../services/geminiService');

const getMyDiagnoses = async (req, res) => {
  const userId = req.databaseUser.id;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        category,
        description,
        predicted_fault,
        severity,
        tools,
        guide,
        safety_warnings,
        requires_technician,
        model_name,
        created_at
      FROM diagnoses
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 50
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      diagnoses: result.rows,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        userId,
      },
      'Diagnosis history lookup failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load diagnosis history',
    });
  }
};

const diagnoseIssue = async (req, res) => {
  const userId = req.databaseUser.id;
  const { category, description } = req.validatedBody;

  try {
    const diagnosis = await diagnoseMaintenanceIssue({
      category,
      description,
    });

    const result = await pool.query(
      `
      INSERT INTO diagnoses (
        user_id,
        category,
        description,
        predicted_fault,
        severity,
        tools,
        guide,
        safety_warnings,
        requires_technician,
        model_name
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        $9,
        $10
      )
      RETURNING
        id,
        created_at
      `,
      [
        userId,
        category,
        description,
        diagnosis.predicted_fault,
        diagnosis.severity,
        JSON.stringify(diagnosis.tools),
        JSON.stringify(diagnosis.guide),
        JSON.stringify(diagnosis.safety_warnings),
        diagnosis.requires_technician,
        process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      ]
    );

    const savedDiagnosis = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Issue diagnosed successfully',
      diagnosis_id: savedDiagnosis.id,
      created_at: savedDiagnosis.created_at,
      diagnosis,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        userId,
      },
      'Issue diagnosis failed'
    );

    return res.status(502).json({
      success: false,
      message: 'Unable to diagnose the issue currently',
    });
  }
};

module.exports = {
  getMyDiagnoses,
  diagnoseIssue,
};