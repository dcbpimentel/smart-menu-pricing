const db = require('../utils/db');
const { computeRecipeCost, computePricing, getPricingSetting, computeImpactAnalysis } = require('../services/costingService');

const VALID_SOURCES = ['latest', 'dti', 'da', 'manual'];

// Prices behind a snapshot, so each saved costing can be traced to the exact price records used
const priceSnapshot = (breakdown) => JSON.stringify(breakdown.map((b) => ({
  ingredient_id:   b.ingredient_id,
  name:            b.name,
  quantity:        b.quantity,
  unit:            b.unit,
  waste_pct:       b.waste_pct,
  price_id:        b.price_id,
  unit_price:      b.unit_price,
  base_unit:       b.base_unit,
  price_source:    b.price_source,
  price_date:      b.price_date,
  ingredient_cost: b.ingredient_cost,
})));

// Compute one recipe and save a snapshot. Nothing is saved when an ingredient has no price
// for the chosen source, because a total built from only some ingredients understates the cost.
const costRecipe = async (recipeId, priceSource, setting, { dedupe }) => {
  const costResult = await computeRecipeCost(recipeId, priceSource, db);
  const { missing_price_ingredients } = costResult;

  const base = {
    output_id:            null,
    is_duplicate:         false,
    saved:                false,
    recipe_id:            costResult.recipe_id,
    recipe_name:          costResult.recipe_name,
    servings:             costResult.servings,
    pricing_setting:      { id: setting.id, target_food_cost_pct: parseFloat(setting.target_food_cost_pct), rounding_rule: setting.rounding_rule },
    price_source:         priceSource,
    recipe_cost:          null,
    portion_cost:         null,
    raw_price:            null,
    recommended_price:    null,
    ingredient_breakdown: costResult.ingredient_breakdown,
    missing_price_ingredients,
    has_missing_prices:   missing_price_ingredients.length > 0,
  };

  if (costResult.recipe_cost_exact === null) return base;

  const pricing = computePricing(costResult.recipe_cost_exact, costResult.servings, setting);

  if (dedupe) {
    // Skip saving if the last entry for this recipe + profile has identical values
    const [[last]] = await db.query(
      `SELECT id, recipe_cost, portion_cost, recommended_price
       FROM costing_outputs
       WHERE recipe_id = ? AND pricing_setting_id = ?
       ORDER BY computed_at DESC, id DESC LIMIT 1`,
      [costResult.recipe_id, setting.id]
    );
    if (last
      && Math.abs(parseFloat(last.recipe_cost)       - pricing.recipe_cost)       < 0.005
      && Math.abs(parseFloat(last.portion_cost)      - pricing.portion_cost)      < 0.005
      && Math.abs(parseFloat(last.recommended_price) - pricing.recommended_price) < 0.005) {
      return { ...base, ...pricing, pricing_setting: base.pricing_setting, output_id: last.id, is_duplicate: true, saved: true };
    }
  }

  const applied_price_source = `${priceSource}:${new Date().toISOString().slice(0, 10)}`;
  const [insertResult] = await db.query(
    `INSERT INTO costing_outputs
       (recipe_id, pricing_setting_id, recipe_cost, portion_cost, recommended_price, applied_price_source, price_snapshot, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      costResult.recipe_id,
      setting.id,
      pricing.recipe_cost,
      pricing.portion_cost,
      pricing.recommended_price,
      applied_price_source,
      priceSnapshot(costResult.ingredient_breakdown),
    ]
  );

  return { ...base, ...pricing, pricing_setting: base.pricing_setting, output_id: insertResult.insertId, saved: true };
};

const computeCosting = async (req, res) => {
  try {
    const { recipe_id, pricing_setting_id, price_source } = req.body;

    if (!recipe_id || !pricing_setting_id || !price_source) {
      return res.status(400).json({
        success: false, data: null,
        message: 'recipe_id, pricing_setting_id, and price_source are required',
      });
    }

    const setting = await getPricingSetting(pricing_setting_id, db);
    const data = await costRecipe(recipe_id, price_source, setting, { dedupe: true });

    let message = '';
    if (data.has_missing_prices) {
      message = `Not computed: ${data.missing_price_ingredients.length} ingredient(s) have no ${price_source} price. Add a price for them, then compute again.`;
    } else if (!data.ingredient_breakdown.length) {
      message = 'This recipe has no ingredients yet';
    }

    res.json({ success: true, data, message });
  } catch (err) {
    const isClientError = /not found|zero servings|must be one of|is required/i.test(err.message);
    res.status(err.status ?? (isClientError ? 400 : 500)).json({ success: false, data: null, message: err.message });
  }
};

const computeImpact = async (req, res) => {
  try {
    const { recipe_id, old_prices, new_prices, pricing_setting_id } = req.body;

    if (!recipe_id || !old_prices || !new_prices || !pricing_setting_id) {
      return res.status(400).json({
        success: false, data: null,
        message: 'recipe_id, old_prices, new_prices, and pricing_setting_id are required',
      });
    }
    if (typeof old_prices !== 'object' || Array.isArray(old_prices) ||
        typeof new_prices !== 'object' || Array.isArray(new_prices)) {
      return res.status(400).json({
        success: false, data: null,
        message: 'old_prices and new_prices must be objects: { ingredient_id: price }',
      });
    }

    const result = await computeImpactAnalysis(recipe_id, old_prices, new_prices, pricing_setting_id, db);
    res.json({ success: true, data: result, message: '' });
  } catch (err) {
    const isClientError = /not found|zero servings|must be one of|is required/i.test(err.message);
    res.status(err.status ?? (isClientError ? 400 : 500)).json({ success: false, data: null, message: err.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT co.id, co.recipe_id, co.pricing_setting_id, ps.label AS pricing_setting_label,
              co.recipe_cost, co.portion_cost, co.recommended_price, co.actual_selling_price,
              co.applied_price_source, co.price_snapshot, co.computed_at
       FROM costing_outputs co
       JOIN pricing_settings ps ON ps.id = co.pricing_setting_id
       WHERE co.recipe_id = ?
       ORDER BY co.computed_at DESC`,
      [req.params.recipeId]
    );

    const normalized = rows.map((r) => ({
      ...r,
      recipe_cost:          parseFloat(r.recipe_cost),
      portion_cost:         parseFloat(r.portion_cost),
      recommended_price:    parseFloat(r.recommended_price),
      actual_selling_price: r.actual_selling_price != null ? parseFloat(r.actual_selling_price) : null,
      price_snapshot:       typeof r.price_snapshot === 'string' ? JSON.parse(r.price_snapshot) : r.price_snapshot ?? null,
    }));

    res.json({ success: true, data: normalized, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const updateActualPrice = async (req, res) => {
  try {
    const { actual_selling_price } = req.body;
    if (actual_selling_price === undefined || actual_selling_price === null) {
      return res.status(400).json({ success: false, data: null, message: 'actual_selling_price is required' });
    }
    const price = parseFloat(actual_selling_price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, data: null, message: 'actual_selling_price must be a positive number' });
    }
    const [result] = await db.query(
      'UPDATE costing_outputs SET actual_selling_price = ? WHERE id = ?',
      [price, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Costing output not found' });
    }
    res.json({ success: true, data: { actual_selling_price: price }, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// GET /api/costing/summary — latest costing output per recipe (for Reports page)
const getSummary = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         r.id AS recipe_id, r.name AS recipe_name, r.servings, r.category, r.image_data,
         co.id AS output_id,
         co.pricing_setting_id, ps.label AS pricing_setting_label,
         ps.target_food_cost_pct,
         co.recipe_cost, co.portion_cost, co.recommended_price,
         co.actual_selling_price, co.applied_price_source, co.computed_at
       FROM recipes r
       LEFT JOIN costing_outputs co ON co.id = (
         SELECT id FROM costing_outputs co2
         WHERE co2.recipe_id = r.id
         ORDER BY co2.computed_at DESC
         LIMIT 1
       )
       LEFT JOIN pricing_settings ps ON ps.id = co.pricing_setting_id
       ORDER BY r.name`
    );

    const normalized = rows.map((r) => ({
      ...r,
      recipe_cost:          r.recipe_cost          != null ? parseFloat(r.recipe_cost)          : null,
      portion_cost:         r.portion_cost         != null ? parseFloat(r.portion_cost)         : null,
      recommended_price:    r.recommended_price    != null ? parseFloat(r.recommended_price)    : null,
      actual_selling_price: r.actual_selling_price != null ? parseFloat(r.actual_selling_price) : null,
      target_food_cost_pct: r.target_food_cost_pct != null ? parseFloat(r.target_food_cost_pct) : null,
      computed_at:          r.computed_at           ? new Date(r.computed_at).toISOString()      : null,
    }));

    res.json({ success: true, data: normalized, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// POST /api/costing/batch — compute costs for all recipes in one request
const batchCosting = async (req, res) => {
  try {
    const { pricing_setting_id, price_source } = req.body;

    if (!pricing_setting_id || !price_source) {
      return res.status(400).json({
        success: false, data: null,
        message: 'pricing_setting_id and price_source are required',
      });
    }

    if (!VALID_SOURCES.includes(price_source)) {
      return res.status(400).json({
        success: false, data: null,
        message: `price_source must be one of: ${VALID_SOURCES.join(', ')}`,
      });
    }

    const setting = await getPricingSetting(pricing_setting_id, db);

    const [recipes] = await db.query('SELECT id, name FROM recipes ORDER BY name');
    if (recipes.length === 0) {
      return res.json({ success: true, data: [], message: 'No recipes found' });
    }

    const results = [];
    for (const recipe of recipes) {
      try {
        const r = await costRecipe(recipe.id, price_source, setting, { dedupe: false });
        results.push({
          output_id:                 r.output_id,
          recipe_id:                 r.recipe_id,
          recipe_name:               r.recipe_name,
          servings:                  r.servings,
          recipe_cost:               r.recipe_cost,
          portion_cost:              r.portion_cost,
          recommended_price:         r.recommended_price,
          target_food_cost_pct:      r.target_food_cost_pct ?? r.pricing_setting.target_food_cost_pct,
          price_source,
          missing_price_ingredients: r.missing_price_ingredients,
          has_missing_prices:        r.has_missing_prices,
        });
      } catch (err) {
        results.push({
          recipe_id:    recipe.id,
          recipe_name:  recipe.name,
          error:        err.message,
          recipe_cost:  null,
          portion_cost: null,
          recommended_price: null,
          has_missing_prices: false,
          missing_price_ingredients: [],
        });
      }
    }

    const computed = results.filter((r) => r.recipe_cost !== null).length;
    const partial  = results.filter((r) => r.has_missing_prices).length;

    res.json({
      success: true,
      data: results,
      message: `Computed ${computed} of ${results.length} recipe(s)${partial ? `; ${partial} not computed because of missing prices` : ''}`,
    });
  } catch (err) {
    res.status(err.status ?? 500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { computeCosting, computeImpact, getHistory, updateActualPrice, getSummary, batchCosting };
