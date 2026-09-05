const db = require('../utils/db');

const getAllRecipes = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM recipes ORDER BY name');
    res.json({ success: true, data: rows, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const getRecipeById = async (req, res) => {
  try {
    const [recipes] = await db.query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!recipes.length) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }

    const [ingredients] = await db.query(
      `SELECT ri.id, ri.ingredient_id, i.name, ri.unit, ri.quantity, COALESCE(ri.waste_pct, 0) AS waste_pct
       FROM recipe_ingredients ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = ?
       ORDER BY i.name`,
      [req.params.id]
    );

    const { id, name, description, servings, category } = recipes[0];
    res.json({
      success: true,
      data: {
        id,
        name,
        description,
        servings,
        category: category ?? null,
        ingredients: ingredients.map((r) => ({
          id: r.id,
          ingredient_id: r.ingredient_id,
          name: r.name,
          unit: r.unit,
          quantity: parseFloat(r.quantity),
          waste_pct: parseFloat(r.waste_pct),
        })),
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const createRecipe = async (req, res) => {
  try {
    const { name, description, servings, category } = req.body;
    if (!name || description === undefined || !servings) {
      return res.status(400).json({ success: false, data: null, message: 'name, description, and servings are required' });
    }

    const [result] = await db.query(
      'INSERT INTO recipes (name, description, servings, category) VALUES (?, ?, ?, ?)',
      [name, description, servings, category ?? null]
    );
    const [rows] = await db.query('SELECT * FROM recipes WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Recipe '${req.body.name}' already exists` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const updateRecipe = async (req, res) => {
  try {
    const { name, description, servings, category } = req.body;
    const [result] = await db.query(
      `UPDATE recipes
       SET name        = COALESCE(?, name),
           description = COALESCE(?, description),
           servings    = COALESCE(?, servings),
           category    = COALESCE(?, category)
       WHERE id = ?`,
      [name ?? null, description ?? null, servings ?? null, category ?? null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    const [rows] = await db.query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0], message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Recipe '${req.body.name}' already exists` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    // recipe_ingredients cascade-deletes via FK ON DELETE CASCADE
    const [result] = await db.query('DELETE FROM recipes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    res.json({ success: true, data: null, message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const addIngredientToRecipe = async (req, res) => {
  try {
    const { ingredient_id, quantity, unit, waste_pct = 0 } = req.body;
    const recipe_id = req.params.id;

    if (!ingredient_id || quantity === undefined || !unit) {
      return res.status(400).json({ success: false, data: null, message: 'ingredient_id, quantity, and unit are required' });
    }

    const [[recipes], [ingredients]] = await Promise.all([
      db.query('SELECT id FROM recipes WHERE id = ?', [recipe_id]),
      db.query('SELECT id FROM ingredients WHERE id = ?', [ingredient_id]),
    ]);
    if (!recipes.length)     return res.status(404).json({ success: false, data: null, message: 'Recipe not found' });
    if (!ingredients.length) return res.status(404).json({ success: false, data: null, message: 'Ingredient not found' });

    const [result] = await db.query(
      'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_pct) VALUES (?, ?, ?, ?, ?)',
      [recipe_id, ingredient_id, quantity, unit, waste_pct]
    );
    const [rows] = await db.query('SELECT * FROM recipe_ingredients WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: { ...rows[0], quantity: parseFloat(rows[0].quantity), waste_pct: parseFloat(rows[0].waste_pct || 0) }, message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: 'Ingredient is already in this recipe' });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const updateRecipeIngredient = async (req, res) => {
  try {
    const { quantity, unit, waste_pct } = req.body;
    const [result] = await db.query(
      `UPDATE recipe_ingredients
       SET quantity  = COALESCE(?, quantity),
           unit      = COALESCE(?, unit),
           waste_pct = COALESCE(?, waste_pct)
       WHERE id = ? AND recipe_id = ?`,
      [quantity ?? null, unit ?? null, waste_pct ?? null, req.params.riId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Recipe ingredient not found' });
    }
    const [rows] = await db.query('SELECT * FROM recipe_ingredients WHERE id = ?', [req.params.riId]);
    res.json({ success: true, data: { ...rows[0], quantity: parseFloat(rows[0].quantity), waste_pct: parseFloat(rows[0].waste_pct || 0) }, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const removeIngredientFromRecipe = async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM recipe_ingredients WHERE id = ? AND recipe_id = ?',
      [req.params.riId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Recipe ingredient not found' });
    }
    res.json({ success: true, data: null, message: 'Ingredient removed from recipe' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  addIngredientToRecipe,
  updateRecipeIngredient,
  removeIngredientFromRecipe,
};
