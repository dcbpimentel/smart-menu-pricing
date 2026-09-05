const express = require('express');
const router  = express.Router();
const {
  getInventory, getLowStock, getHistory,
  restock, adjust, useRecipe, setThreshold,
} = require('../controllers/inventoryController');

router.get('/',                          getInventory);
router.get('/low-stock',                 getLowStock);
router.get('/history/:ingredientId',     getHistory);
router.post('/restock',                  restock);
router.post('/adjust',                   adjust);
router.post('/use-recipe',               useRecipe);
router.put('/:ingredientId/threshold',   setThreshold);

module.exports = router;
