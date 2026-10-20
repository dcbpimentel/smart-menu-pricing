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
    let isDuplicate       = false;

    if (recipe_cost !== null) {
      portion_cost = computePortionCost(recipe_cost, costResult.servings);
      priceResult  = await computeRecommendedPrice(portion_cost, pricing_setting_id, db);

      // Deduplication: skip save if last entry for this recipe+settings has identical values
      const [existing] = await db.query(
        `SELECT id, recipe_cost, portion_cost, recommended_price
         FROM costing_outputs
         WHERE recipe_id = ? AND pricing_setting_id = ?
         ORDER BY computed_at DESC LIMIT 1`,
        [costResult.recipe_id, pricing_setting_id]
      );
      const last = existing[0];
      isDuplicate = !!(last
        && Math.abs(parseFloat(last.recipe_cost)        - recipe_cost)                   < 0.005
        && Math.abs(parseFloat(last.portion_cost)       - portion_cost)                  < 0.005
        && Math.abs(parseFloat(last.recommended_price)  - priceResult.recommended_price) < 0.005);

      if (isDuplicate) {
        output_id = last.id;
      } else {
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
    }

    const isPartial = missing_price_ingredients.length > 0;

    res.json({
      success: true,
      data: {
        output_id,
        is_duplicate:              isDuplicate,
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
              co.recipe_cost, co.portion_cost, co.recommended_price, co.actual_selling_price,
              co.applied_price_source, co.computed_at
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
         r.id AS recipe_id, r.name AS recipe_name, r.servings, r.category,
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

    const VALID_SOURCES = ['latest', 'dti', 'da', 'manual'];
    if (!VALID_SOURCES.includes(price_source)) {
      return res.status(400).json({
        success: false, data: null,
        message: `price_source must be one of: ${VALID_SOURCES.join(', ')}`,
      });
    }

    const [[setting]] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [pricing_setting_id]);
    if (!setting) {
      return res.status(404).json({ success: false, data: null, message: `Pricing setting ${pricing_setting_id} not found` });
    }

    const [recipes] = await db.query('SELECT id FROM recipes ORDER BY name');
    if (recipes.length === 0) {
      return res.json({ success: true, data: [], message: 'No recipes found' });
    }

    const applied_price_source = `${price_source}:${new Date().toISOString().slice(0, 10)}`;
    const results = [];

    for (const recipe of recipes) {
      try {
        const costResult = await computeRecipeCost(recipe.id, price_source, db);

        const missing_price_ingredients = costResult.ingredient_breakdown
          .filter((b) => b.missing_price)
          .map((b) => ({ ingredient_id: b.ingredient_id, name: b.name }));

        const availableBreakdown = costResult.ingredient_breakdown.filter((b) => !b.missing_price);
        const recipe_cost = availableBreakdown.length === 0
          ? null
          : parseFloat(availableBreakdown.reduce((sum, b) => sum + b.ingredient_cost, 0).toFixed(2));

        let portion_cost = null;
        let priceResult  = null;
        let output_id    = null;

        if (recipe_cost !== null) {
          portion_cost = computePortionCost(recipe_cost, costResult.servings);
          priceResult  = await computeRecommendedPrice(portion_cost, pricing_setting_id, db);

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

        results.push({
          output_id,
          recipe_id:               costResult.recipe_id,
          recipe_name:             costResult.recipe_name,
          servings:                costResult.servings,
          recipe_cost,
          portion_cost,
          recommended_price:       priceResult?.recommended_price       ?? null,
          target_food_cost_pct:    priceResult?.target_food_cost_pct    ?? null,
          price_source,
          missing_price_ingredients,
          has_missing_prices:      missing_price_ingredients.length > 0,
        });
      } catch (err) {
        results.push({
          recipe_id:    recipe.id,
          recipe_name:  null,
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
      message: `Computed ${computed} of ${results.length} recipe(s)${partial ? `; ${partial} have missing prices` : ''}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { computeCosting, computeImpact, getHistory, updateActualPrice, getSummary, batchCosting };
