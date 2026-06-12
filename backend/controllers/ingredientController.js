const db = require('../utils/db');

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
      [name, unit, category]
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
    const [result] = await db.query(
      'UPDATE ingredients SET name = COALESCE(?, name), unit = COALESCE(?, unit), category = COALESCE(?, category) WHERE id = ?',
      [name ?? null, unit ?? null, category ?? null, req.params.id]
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
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { getAllIngredients, getIngredientById, createIngredient, updateIngredient, deleteIngredient };
