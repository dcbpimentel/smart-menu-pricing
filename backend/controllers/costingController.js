const db = require('../utils/db');
const { computeRecipeCost, computePortionCost, computeRecommendedPrice, computeImpactAnalysis } = require('../services/costingService');

const computeCosting = async (req, res) => {
  try {
    const { recipe_id, pricing_setting_id, price_source } = req.body;

    if (!recipe_id || !pricing_setting_id || !price_source) {
      return res.status(400).json({
        success: false, data: null,
        message: 'recipe_id, pricing_setting_id, and price_source are required',
      });
    }

    // computeRecommendedPrice owns the pricing_setting lookup; no need to pre-fetch it here
    const costResult = await computeRecipeCost(recipe_id, price_source, db);

    const missing_price_ingredients = costResult.ingredient_breakdown
      .filter((b) => b.missing_price)
      .map((b) => ({ ingredient_id: b.ingredient_id, name: b.name }));

    const availableBreakdown = costResult.ingredient_breakdown.filter((b) => !b.missing_price);
    const recipe_cost = availableBreakdown.length === 0
      ? null
      : parseFloat(availableBreakdown.reduce((sum, b) => sum + b.ingredient_cost, 0).toFixed(2));

    let portion_cost      = null;
    let priceResult       = null;
    let output_id         = null;

    if (recipe_cost !== null) {
      portion_cost = computePortionCost(recipe_cost, costResult.servings);
      priceResult  = await computeRecommendedPrice(portion_cost, pricing_setting_id, db);

      // Persist snapshot to costing_outputs
      const applied_price_source = `${price_source}:${new Date().toISOString().slice(0, 10)}`;
      const [insertResult] = await db.query(
        `INSERT INTO costing_outputs
           (recipe_id, pricing_setting_id, recipe_cost, portion_cost, recommended_price, applied_price_source, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          costResult.recipe_id,
          pricing_setting_id,
          recipe_cost,
          portion_cost,
          priceResult.recommended_price,
          applied_price_source,
        ]
      );
      output_id = insertResult.insertId;
    }

    const isPartial = missing_price_ingredients.length > 0;

    res.json({
      success: true,
      data: {
        output_id,
        recipe_id:                 costResult.recipe_id,
        recipe_name:               costResult.recipe_name,
        servings:                  costResult.servings,
        pricing_setting:           priceResult
          ? { id: pricing_setting_id, target_food_cost_pct: priceResult.target_food_cost_pct, rounding_rule: priceResult.rounding_rule }
          : { id: pricing_setting_id },
        price_source,
        recipe_cost,
        portion_cost,
        raw_price:                 priceResult?.raw_price ?? null,
        recommended_price:         priceResult?.recommended_price ?? null,
        ingredient_breakdown:      costResult.ingredient_breakdown,
        missing_price_ingredients,
      },
      message: isPartial
        ? `Partial costing: ${missing_price_ingredients.length} ingredient(s) have no ${price_source} price`
        : '',
    });
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
              co.recipe_cost, co.portion_cost, co.recommended_price,
              co.applied_price_source, co.computed_at
       FROM costing_outputs co
       JOIN pricing_settings ps ON ps.id = co.pricing_setting_id
       WHERE co.recipe_id = ?
       ORDER BY co.computed_at DESC`,
      [req.params.recipeId]
    );

    const normalized = rows.map((r) => ({
      ...r,
      recipe_cost:       parseFloat(r.recipe_cost),
      portion_cost:      parseFloat(r.portion_cost),
      recommended_price: parseFloat(r.recommended_price),
    }));

    res.json({ success: true, data: normalized, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { computeCosting, computeImpact, getHistory };
