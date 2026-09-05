const express = require('express');
const router = express.Router();
const { computeCosting, computeImpact, getHistory, updateActualPrice, getSummary, batchCosting } = require('../controllers/costingController');

router.get('/summary',                     getSummary);
router.post('/batch',                      batchCosting);
router.post('/compute',                    computeCosting);
router.post('/impact',                     computeImpact);
router.get('/history/:recipeId',           getHistory);
router.patch('/:id/actual-price',          updateActualPrice);

module.exports = router;
