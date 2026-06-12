const express = require('express');
const router = express.Router();
const { addIngredientPrice, getPriceHistory, getLatestPrice } = require('../controllers/priceController');

router.post('/',                          addIngredientPrice);
router.get('/history/:ingredientId',      getPriceHistory);
router.get('/latest/:ingredientId',       getLatestPrice);

module.exports = router;
