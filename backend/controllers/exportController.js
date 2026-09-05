const db = require('../utils/db');

const exportData = async (req, res) => {
  try {
    const [
      ingredients,
      prices,
      recipes,
      recipeIngredients,
      pricingSettings,
      costingOutputs,
    ] = await Promise.all([
      db.query('SELECT * FROM ingredients ORDER BY name').then(([r]) => r),
      db.query('SELECT * FROM ingredient_prices ORDER BY ingredient_id, extraction_date DESC').then(([r]) => r),
      db.query('SELECT * FROM recipes ORDER BY name').then(([r]) => r),
      db.query('SELECT * FROM recipe_ingredients ORDER BY recipe_id, id').then(([r]) => r),
      db.query('SELECT * FROM pricing_settings ORDER BY label').then(([r]) => r),
      db.query('SELECT * FROM costing_outputs ORDER BY computed_at DESC').then(([r]) => r),
    ]);

    const isoDate = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
    const isoDateOnly = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ?? null);
    const bool = (v) => v === 1 || v === true;

    const data = {
      exported_at: new Date().toISOString(),
      system: 'Smart Menu Pricing',
      ingredients: ingredients.map((r) => ({
        ...r,
        created_at: isoDate(r.created_at),
        updated_at: isoDate(r.updated_at),
      })),
      ingredient_prices: prices.map((r) => ({
        ...r,
        price: parseFloat(r.price),
        is_manual: bool(r.is_manual),
        extraction_date: isoDateOnly(r.extraction_date),
        created_at: isoDate(r.created_at),
      })),
      recipes: recipes.map((r) => ({
        ...r,
        created_at: isoDate(r.created_at),
        updated_at: isoDate(r.updated_at),
      })),
      recipe_ingredients: recipeIngredients.map((r) => ({
        ...r,
        quantity: parseFloat(r.quantity),
        waste_pct: parseFloat(r.waste_pct || 0),
      })),
      pricing_settings: pricingSettings.map((r) => ({
        ...r,
        target_food_cost_pct: parseFloat(r.target_food_cost_pct),
        created_at: isoDate(r.created_at),
      })),
      costing_outputs: costingOutputs.map((r) => ({
        ...r,
        recipe_cost: parseFloat(r.recipe_cost),
        portion_cost: parseFloat(r.portion_cost),
        recommended_price: parseFloat(r.recommended_price),
        actual_selling_price: r.actual_selling_price != null ? parseFloat(r.actual_selling_price) : null,
        computed_at: isoDate(r.computed_at),
      })),
    };

    res.json({ success: true, data, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { exportData };
