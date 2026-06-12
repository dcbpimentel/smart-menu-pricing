const db = require('../utils/db');

const normalizeRow = (row) => ({
  ...row,
  target_food_cost_pct: parseFloat(row.target_food_cost_pct),
});

const getAllSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pricing_settings ORDER BY id');
    res.json({ success: true, data: rows.map(normalizeRow), message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const getSettingById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    res.json({ success: true, data: normalizeRow(rows[0]), message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const createSetting = async (req, res) => {
  try {
    const { label, target_food_cost_pct, rounding_rule } = req.body;
    if (!label || target_food_cost_pct === undefined || !rounding_rule) {
      return res.status(400).json({ success: false, data: null, message: 'label, target_food_cost_pct, and rounding_rule are required' });
    }

    const [result] = await db.query(
      'INSERT INTO pricing_settings (label, target_food_cost_pct, rounding_rule) VALUES (?, ?, ?)',
      [label, target_food_cost_pct, rounding_rule]
    );
    const [rows] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: normalizeRow(rows[0]), message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Label '${req.body.label}' already exists` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const updateSetting = async (req, res) => {
  try {
    const { label, target_food_cost_pct, rounding_rule } = req.body;
    const [result] = await db.query(
      `UPDATE pricing_settings
       SET label                = COALESCE(?, label),
           target_food_cost_pct = COALESCE(?, target_food_cost_pct),
           rounding_rule        = COALESCE(?, rounding_rule)
       WHERE id = ?`,
      [label ?? null, target_food_cost_pct ?? null, rounding_rule ?? null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    const [rows] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: normalizeRow(rows[0]), message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Label '${req.body.label}' already exists` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const deleteSetting = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM pricing_settings WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Not found' });
    }
    res.json({ success: true, data: null, message: 'Pricing setting deleted' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { getAllSettings, getSettingById, createSetting, updateSetting, deleteSetting };
