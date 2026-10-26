const db = require('../utils/db');
const { normalizeUnit } = require('../utils/units');

// Title-case and trim category so "condiments" and "Condiments" don't split the filter pills
const normalizeCategory = (cat) => {
  if (!cat) return cat;
  return cat.trim().replace(/\b\w/g, c => c.toUpperCase());
};

const getAllIngredients = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ingredients ORDER BY name');
    res.json({ success: true, data: rows, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const getIngredientById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ingredients WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    res.json({ success: true, data: rows[0], message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const createIngredient = async (req, res) => {
  try {
    const { name, unit, category } = req.body;
    if (!name || !unit || !category) {
      return res.status(400).json({ success: false, data: null, message: 'name, unit, and category are required' });
    }
    const [result] = await db.query(
      'INSERT INTO ingredients (name, unit, category) VALUES (?, ?, ?)',
      [name.trim(), unit.trim(), normalizeCategory(category)]
    );
    const [rows] = await db.query('SELECT * FROM ingredients WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Ingredient '${req.body.name}' already exists` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const updateIngredient = async (req, res) => {
  try {
    const { name, unit, category } = req.body;

    // Stored prices are per the ingredient's unit, so changing the unit would silently
    // reinterpret them (₱/kg read as ₱/g). Only allow it while there are no prices.
    if (unit) {
      const [[current]] = await db.query('SELECT unit FROM ingredients WHERE id = ?', [req.params.id]);
      if (current && normalizeUnit(unit) !== normalizeUnit(current.unit)) {
        const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM ingredient_prices WHERE ingredient_id = ?', [req.params.id]);
        if (n > 0) {
          return res.status(409).json({
            success: false, data: null,
            message: `This ingredient has ${n} price${n === 1 ? '' : 's'} recorded per ${current.unit}. Changing the unit would change what those prices mean. Add a new ingredient with the ${unit.trim()} unit instead.`,
          });
        }
      }
    }

    const [result] = await db.query(
      'UPDATE ingredients SET name = COALESCE(?, name), unit = COALESCE(?, unit), category = COALESCE(?, category) WHERE id = ?',
      [name?.trim() ?? null, unit?.trim() ?? null, normalizeCategory(category) ?? null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    const [rows] = await db.query('SELECT * FROM ingredients WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0], message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Ingredient '${req.body.name}' already exists` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const deleteIngredient = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM ingredients WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    res.json({ success: true, data: null, message: 'Ingredient deleted' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      const [rows] = await db.query(
        `SELECT r.name FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id
         WHERE ri.ingredient_id = ? ORDER BY r.name`,
        [req.params.id]
      );
      const names = rows.map((r) => r.name).join(', ');
      return res.status(409).json({
        success: false, data: null,
        message: `This ingredient is used in ${rows.length} recipe${rows.length === 1 ? '' : 's'}${names ? ` (${names})` : ''}. Remove it from ${rows.length === 1 ? 'that recipe' : 'those recipes'} first.`,
      });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { getAllIngredients, getIngredientById, createIngredient, updateIngredient, deleteIngredient };
