const express = require('express');
const router  = express.Router();
const db      = require('../utils/db');

router.post('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, data: null, message: 'Admin access required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await conn.query('TRUNCATE TABLE costing_outputs');
    await conn.query('TRUNCATE TABLE recipe_ingredients');
    await conn.query('TRUNCATE TABLE recipes');
    await conn.query('TRUNCATE TABLE ingredient_prices');
    await conn.query('TRUNCATE TABLE ingredients');
    await conn.query('TRUNCATE TABLE pricing_settings');

    // Remove non-admin users added during testing
    await conn.query("DELETE FROM users WHERE role != 'admin'");

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Re-seed 5 base ingredients
    const today = new Date().toISOString().slice(0, 10);
    await conn.query(`
      INSERT INTO ingredients (name, unit, category) VALUES
        ('Rice',           'kg', 'Grain'),
        ('Chicken Breast', 'kg', 'Meat'),
        ('Pork Belly',     'kg', 'Meat'),
        ('Onion',          'kg', 'Vegetable'),
        ('Garlic',         'kg', 'Vegetable')
    `);

    const prices = [
      ['Rice',           52.00,  'NFA accredited rice retailer'],
      ['Chicken Breast', 220.00, 'Local poultry farm gate price'],
      ['Pork Belly',     280.00, 'Wet market pork section'],
      ['Onion',          80.00,  'Divisoria vegetable stall'],
      ['Garlic',         120.00, 'Divisoria vegetable stall'],
    ];
    for (const [name, price, note] of prices) {
      await conn.query(
        `INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
         SELECT id, ?, 'manual', ?, ?, TRUE FROM ingredients WHERE name = ?`,
        [price, note, today, name]
      );
    }

    // Restore Default pricing profile
    await conn.query(`
      INSERT INTO pricing_settings (label, target_food_cost_pct, rounding_rule)
      VALUES ('Default', 35.00, 'nearest5')
    `);

    await conn.commit();
    res.json({ success: true, data: null, message: 'System reset. Ready for new tester.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, data: null, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
