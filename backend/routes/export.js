const express = require('express');
const router = express.Router();
const { exportData } = require('../controllers/exportController');

router.get('/', exportData);

module.exports = router;
