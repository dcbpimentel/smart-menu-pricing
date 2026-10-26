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

    // DELETE rather than TRUNCATE: TRUNCATE commits implicitly, so a failure halfway
    // would leave one restaurant's data partly in place. Children are cleared first.
    await conn.query('DELETE FROM inventory_transactions');
    await conn.query('DELETE FROM ingredient_stock');
    await conn.query('DELETE FROM costing_outputs');
    await conn.query('DELETE FROM recipe_ingredients');
    await conn.query('DELETE FROM recipes');
    await conn.query('DELETE FROM ingredient_prices');
    await conn.query('DELETE FROM ingredients');
    await conn.query('DELETE FROM pricing_settings');

    // Remove non-admin users added during testing
    await conn.query("DELETE FROM users WHERE role != 'admin'");

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

    // Sample prices so the system is usable right away; labeled so they are never
    // mistaken for a restaurant's own records
    const DEMO_NOTE = 'Sample price (demo data)';
    const prices = [
      ['Rice',           52.00,  DEMO_NOTE],
      ['Chicken Breast', 220.00, DEMO_NOTE],
      ['Pork Belly',     280.00, DEMO_NOTE],
      ['Onion',          80.00,  DEMO_NOTE],
      ['Garlic',         120.00, DEMO_NOTE],
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
