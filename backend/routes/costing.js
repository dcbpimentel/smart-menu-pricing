const express = require('express');
const router = express.Router();
const { computeCosting, computeImpact, getHistory } = require('../controllers/costingController');

router.post('/compute',          computeCosting);
router.post('/impact',           computeImpact);
router.get('/history/:recipeId', getHistory);

module.exports = router;
