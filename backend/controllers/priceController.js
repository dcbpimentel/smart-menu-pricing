const db = require('../utils/db');

const normalizeRow = (row) => ({
  ...row,
  price: parseFloat(row.price),
  is_manual: row.is_manual === 1 || row.is_manual === true,
  extraction_date: row.extraction_date instanceof Date
    ? row.extraction_date.toISOString().slice(0, 10)
    : row.extraction_date,
});

const addIngredientPrice = async (req, res) => {
  try {
    const { ingredient_id, price, source, provenance_note, extraction_date, is_manual } = req.body;

    if (!ingredient_id || price === undefined || !source) {
      return res.status(400).json({ success: false, data: null, message: 'ingredient_id, price, and source are required' });
    }

    const [ingredient] = await db.query('SELECT id FROM ingredients WHERE id = ?', [ingredient_id]);
    if (!ingredient.length) {
      return res.status(404).json({ success: false, data: null, message: 'Ingredient not found' });
    }

    const [result] = await db.query(
      `INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ingredient_id,
        price,
        source,
        provenance_note ?? null,
        extraction_date ?? new Date().toISOString().slice(0, 10),
        is_manual ?? false,
      ]
    );

    const [rows] = await db.query('SELECT * FROM ingredient_prices WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: normalizeRow(rows[0]), message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const getPriceHistory = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ingredient_prices WHERE ingredient_id = ? ORDER BY extraction_date DESC',
      [req.params.ingredientId]
    );
    res.json({ success: true, data: rows.map(normalizeRow), message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const getLatestPrice = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ingredient_prices WHERE ingredient_id = ? ORDER BY extraction_date DESC LIMIT 1',
      [req.params.ingredientId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, data: null, message: 'No price found for this ingredient' });
    }
    res.json({ success: true, data: normalizeRow(rows[0]), message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { addIngredientPrice, getPriceHistory, getLatestPrice };
