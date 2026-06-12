const express = require('express');
const router = express.Router();
const {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  addIngredientToRecipe,
  updateRecipeIngredient,
  removeIngredientFromRecipe,
} = require('../controllers/recipeController');

router.get('/',      getAllRecipes);
router.get('/:id',   getRecipeById);
router.post('/',     createRecipe);
router.put('/:id',   updateRecipe);
router.delete('/:id', deleteRecipe);

router.post('/:id/ingredients',          addIngredientToRecipe);
router.put('/:id/ingredients/:riId',     updateRecipeIngredient);
router.delete('/:id/ingredients/:riId',  removeIngredientFromRecipe);

module.exports = router;
