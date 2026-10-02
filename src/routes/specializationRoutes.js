const express = require('express');

const {
  getActiveSpecializations,
} = require('../controllers/specializationController');

const router = express.Router();

router.get('/', getActiveSpecializations);

module.exports = router;