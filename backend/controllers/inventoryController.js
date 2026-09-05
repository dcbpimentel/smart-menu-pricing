const db = require('../utils/db');

// GET /api/inventory
const getInventory = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         i.id, i.name, i.unit, i.category,
         COALESCE(s.quantity, 0)  AS quantity,
         s.low_stock_qty,
         s.updated_at             AS stock_updated_at,
         (s.low_stock_qty IS NOT NULL AND COALESCE(s.quantity, 0) <= s.low_stock_qty) AS is_low_stock
       FROM ingredients i
       LEFT JOIN ingredient_stock s ON s.ingredient_id = i.id
       ORDER BY i.name`
    );
    const data = rows.map(r => ({
      ...r,
      quantity:       parseFloat(r.quantity),
      low_stock_qty:  r.low_stock_qty != null ? parseFloat(r.low_stock_qty) : null,
      is_low_stock:   r.is_low_stock === 1 || r.is_low_stock === true,
    }));
    res.json({ success: true, data, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// GET /api/inventory/low-stock
const getLowStock = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.id, i.name, i.unit, i.category,
              COALESCE(s.quantity, 0) AS quantity,
              s.low_stock_qty
       FROM ingredient_stock s
       JOIN ingredients i ON i.id = s.ingredient_id
       WHERE s.low_stock_qty IS NOT NULL AND COALESCE(s.quantity, 0) <= s.low_stock_qty
       ORDER BY (COALESCE(s.quantity, 0) / s.low_stock_qty) ASC`
    );
    const data = rows.map(r => ({
      ...r,
      quantity:      parseFloat(r.quantity),
      low_stock_qty: parseFloat(r.low_stock_qty),
    }));
    res.json({ success: true, data, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// GET /api/inventory/history/:ingredientId
const getHistory = async (req, res) => {
  try {
    const { ingredientId } = req.params;
    const [rows] = await db.query(
      `SELECT it.id, it.type, it.quantity, it.unit, it.notes, it.batches,
              it.transaction_date, it.created_at,
              r.name AS recipe_name
       FROM inventory_transactions it
       LEFT JOIN recipes r ON r.id = it.recipe_id
       WHERE it.ingredient_id = ?
       ORDER BY it.transaction_date DESC, it.created_at DESC
       LIMIT 100`,
      [ingredientId]
    );
    const data = rows.map(r => ({
      ...r,
      quantity:         parseFloat(r.quantity),
      transaction_date: r.transaction_date instanceof Date
        ? r.transaction_date.toISOString().slice(0, 10)
        : r.transaction_date,
    }));
    res.json({ success: true, data, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// POST /api/inventory/restock
const restock = async (req, res) => {
  try {
    const { ingredient_id, quantity, notes, transaction_date } = req.body;
    if (!ingredient_id || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ success: false, data: null, message: 'ingredient_id and a positive quantity are required' });
    }

    const [[ingredient]] = await db.query('SELECT id, unit FROM ingredients WHERE id = ?', [ingredient_id]);
    if (!ingredient) return res.status(404).json({ success: false, data: null, message: 'Ingredient not found' });

    const qty  = parseFloat(quantity);
    const date = transaction_date || new Date().toISOString().slice(0, 10);

    await db.query(
      `INSERT INTO inventory_transactions (ingredient_id, type, quantity, unit, notes, transaction_date) VALUES (?, 'restock', ?, ?, ?, ?)`,
      [ingredient_id, qty, ingredient.unit, notes || null, date]
    );
    await db.query(
      `INSERT INTO ingredient_stock (ingredient_id, quantity, unit) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [ingredient_id, qty, ingredient.unit, qty]
    );

    const [[stock]] = await db.query('SELECT quantity FROM ingredient_stock WHERE ingredient_id = ?', [ingredient_id]);
    res.json({ success: true, data: { quantity: parseFloat(stock.quantity) }, message: 'Stock restocked' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// POST /api/inventory/adjust  (spoilage / manual adjustment)
const adjust = async (req, res) => {
  try {
    const { ingredient_id, type, quantity, notes, transaction_date } = req.body;
    const VALID = ['spoilage', 'adjustment'];
    if (!ingredient_id || !VALID.includes(type) || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ success: false, data: null, message: 'ingredient_id, type (spoilage|adjustment), and a positive quantity are required' });
    }

    const [[ingredient]] = await db.query('SELECT id, unit FROM ingredients WHERE id = ?', [ingredient_id]);
    if (!ingredient) return res.status(404).json({ success: false, data: null, message: 'Ingredient not found' });

    const qty  = parseFloat(quantity);
    const date = transaction_date || new Date().toISOString().slice(0, 10);

    await db.query(
      `INSERT INTO inventory_transactions (ingredient_id, type, quantity, unit, notes, transaction_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [ingredient_id, type, -qty, ingredient.unit, notes || null, date]
    );
    await db.query(
      `INSERT INTO ingredient_stock (ingredient_id, quantity, unit) VALUES (?, GREATEST(0, -?), ?)
       ON DUPLICATE KEY UPDATE quantity = GREATEST(0, quantity - ?)`,
      [ingredient_id, qty, ingredient.unit, qty]
    );

    const [[stock]] = await db.query('SELECT quantity FROM ingredient_stock WHERE ingredient_id = ?', [ingredient_id]);
    res.json({ success: true, data: { quantity: parseFloat(stock.quantity) }, message: `${type} logged` });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// POST /api/inventory/use-recipe
const useRecipe = async (req, res) => {
  try {
    const { recipe_id, batches = 1 } = req.body;
    if (!recipe_id) return res.status(400).json({ success: false, data: null, message: 'recipe_id is required' });

    const [recipeIngredients] = await db.query(
      `SELECT ri.ingredient_id, ri.quantity, ri.unit, ri.waste_pct, i.name
       FROM recipe_ingredients ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = ?`,
      [recipe_id]
    );
    if (recipeIngredients.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Recipe not found or has no ingredients' });
    }

    const batchCount = Math.max(1, parseInt(batches, 10));
    const date       = new Date().toISOString().slice(0, 10);
    const deductions = [];

    for (const ri of recipeIngredients) {
      const effQty      = ri.waste_pct > 0 ? ri.quantity / (1 - ri.waste_pct / 100) : ri.quantity;
      const totalDeduct = parseFloat((effQty * batchCount).toFixed(4));

      await db.query(
        `INSERT INTO inventory_transactions (ingredient_id, type, quantity, unit, recipe_id, batches, notes, transaction_date) VALUES (?, 'usage', ?, ?, ?, ?, 'Recipe batch', ?)`,
        [ri.ingredient_id, -totalDeduct, ri.unit, recipe_id, batchCount, date]
      );
      await db.query(
        `INSERT INTO ingredient_stock (ingredient_id, quantity, unit) VALUES (?, GREATEST(0, -?), ?)
         ON DUPLICATE KEY UPDATE quantity = GREATEST(0, quantity - ?)`,
        [ri.ingredient_id, totalDeduct, ri.unit, totalDeduct]
      );

      deductions.push({ ingredient_id: ri.ingredient_id, name: ri.name, deducted: totalDeduct, unit: ri.unit });
    }

    res.json({ success: true, data: { deductions, batches: batchCount }, message: `Stock updated for ${batchCount} batch${batchCount !== 1 ? 'es' : ''}` });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// PUT /api/inventory/:ingredientId/threshold
const setThreshold = async (req, res) => {
  try {
    const { ingredientId } = req.params;
    const { low_stock_qty } = req.body;

    const [[ingredient]] = await db.query('SELECT id, unit FROM ingredients WHERE id = ?', [ingredientId]);
    if (!ingredient) return res.status(404).json({ success: false, data: null, message: 'Ingredient not found' });

    const threshold = low_stock_qty != null ? parseFloat(low_stock_qty) : null;
    await db.query(
      `INSERT INTO ingredient_stock (ingredient_id, quantity, unit, low_stock_qty) VALUES (?, 0, ?, ?)
       ON DUPLICATE KEY UPDATE low_stock_qty = ?`,
      [ingredientId, ingredient.unit, threshold, threshold]
    );
    res.json({ success: true, data: null, message: 'Threshold updated' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { getInventory, getLowStock, getHistory, restock, adjust, useRecipe, setThreshold };
