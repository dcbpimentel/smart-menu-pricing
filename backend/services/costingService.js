const { getConversionFactor } = require('../utils/units');

const VALID_SOURCES = ['dti', 'da', 'manual', 'latest'];

// Thrown when a recipe unit can't be converted into the unit the ingredient is priced in
const unitMismatchError = (rows) => {
  const list = rows.map((r) => `${r.name} (recipe uses "${r.unit}", priced per "${r.base_unit}")`).join(', ');
  const err = new Error(`Cannot convert units for: ${list}. Change the recipe unit to one that matches the ingredient's price unit.`);
  err.status = 400;
  return err;
};

// ── Rounding ──────────────────────────────────────────────────────────────────
// Costs are carried at full precision through every step and rounded only for
// display/storage. The owner's rounding rule applies to the final recommended
// price and never to intermediate values (paper §3.3, sixth layer).

// Round to centavos, half up. toFixed(6) first strips float noise
// (e.g. 1.005 * 100 = 100.49999999999999).
const round2 = (n) => Math.round(Number((n * 100).toFixed(6))) / 100;

// "none" = centavos; "nearest5" / "nearest10" = round UP to the next ₱5 / ₱10, so the
// menu price never falls below the target food cost.
// toFixed(9) keeps exact multiples exact (42 / 0.35 = 120.00000000000001 → 120, not 125).
const applyRoundingRule = (raw, rule) => {
  const step = rule === 'nearest5' ? 5 : rule === 'nearest10' ? 10 : null;
  if (!step) return round2(raw);
  return Math.ceil(Number((raw / step).toFixed(9))) * step;
};

const getPricingSetting = async (pricingSettingId, db) => {
  if (!pricingSettingId) throw new Error('pricing_setting_id is required');
  const [[setting]] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [pricingSettingId]);
  if (!setting) {
    const err = new Error(`Pricing setting ${pricingSettingId} not found`);
    err.status = 404;
    throw err;
  }
  return setting;
};

// Portion cost and recommended price from an unrounded recipe cost.
//   Portion Cost      = Recipe Cost ÷ Number of Servings
//   Recommended Price = Portion Cost ÷ (Target Food Cost % ÷ 100), then the rounding rule
const computePricing = (recipeCostExact, servings, setting) => {
  if (typeof recipeCostExact !== 'number' || isNaN(recipeCostExact)) {
    throw new Error('recipe cost must be a number');
  }
  if (!servings || servings <= 0) throw new Error('servings must be greater than zero');

  const target_food_cost_pct = parseFloat(setting.target_food_cost_pct);
  const portionExact = recipeCostExact / servings;
  const rawPrice     = portionExact / (target_food_cost_pct / 100);

  return {
    recipe_cost:       round2(recipeCostExact),
    portion_cost:      round2(portionExact),
    raw_price:         parseFloat(rawPrice.toFixed(4)),
    recommended_price: applyRoundingRule(rawPrice, setting.rounding_rule),
    target_food_cost_pct,
    rounding_rule:     setting.rounding_rule,
  };
};

// Contribution Margin = Selling Price − Portion Cost
const computeContributionMargin = (selling_price, portion_cost) => {
  if (selling_price == null || portion_cost == null) return null;
  return round2(selling_price - portion_cost);
};

// Effective quantity in the ingredient's price unit:
// quantity ÷ (1 − waste%) to cover trim/cooking loss, then converted to the price unit
const effectiveQuantity = (ing) => {
  const waste_pct = parseFloat(ing.waste_pct || 0);
  const quantity  = parseFloat(ing.quantity);
  return waste_pct > 0 ? quantity / (1 - waste_pct / 100) : quantity;
};

const RECIPE_INGREDIENTS_SQL =
  `SELECT ri.id AS recipe_ingredient_id, ri.ingredient_id, i.name, ri.quantity, ri.unit, COALESCE(ri.waste_pct, 0) AS waste_pct,
          i.unit AS base_unit
   FROM recipe_ingredients ri
   JOIN ingredients i ON i.id = ri.ingredient_id
   WHERE ri.recipe_id = ?`;

const loadRecipe = async (recipeId, db) => {
  const [[recipe]] = await db.query('SELECT id, name, servings FROM recipes WHERE id = ?', [recipeId]);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);
  if (recipe.servings === 0) throw new Error(`Recipe "${recipe.name}" has zero servings`);
  const [ingredients] = await db.query(RECIPE_INGREDIENTS_SQL, [recipeId]);
  return { recipe, ingredients };
};

// ── computeRecipeCost ─────────────────────────────────────────────────────────
// Recipe Cost = Σ (Ingredient Quantity × Ingredient Unit Price)
// recipe_cost_exact is unrounded and is what pricing is computed from.
// When any ingredient has no price for the chosen source, recipe_cost is null:
// a cost built from only some of the ingredients would understate the price.

const computeRecipeCost = async (recipeId, priceSource, db) => {
  if (!recipeId) throw new Error('recipeId is required');
  if (!priceSource || !VALID_SOURCES.includes(priceSource)) {
    throw new Error(`priceSource must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  const { recipe, ingredients } = await loadRecipe(recipeId, db);

  const breakdown = await Promise.all(
    ingredients.map(async (ing) => {
      const [priceRows] = priceSource === 'latest'
        ? await db.query(
            `SELECT id, price, source AS price_source, extraction_date
             FROM ingredient_prices
             WHERE ingredient_id = ?
             ORDER BY extraction_date DESC, id DESC
             LIMIT 1`,
            [ing.ingredient_id]
          )
        : await db.query(
            `SELECT id, price, source AS price_source, extraction_date
             FROM ingredient_prices
             WHERE ingredient_id = ? AND source = ?
             ORDER BY extraction_date DESC, id DESC
             LIMIT 1`,
            [ing.ingredient_id, priceSource]
          );

      const priceRow      = priceRows[0] ?? null;
      const unit_price    = priceRow ? parseFloat(priceRow.price) : null;
      const missing_price = unit_price === null;
      const waste_pct     = parseFloat(ing.waste_pct || 0);
      const raw_quantity  = parseFloat(ing.quantity);
      const effectiveQty  = effectiveQuantity(ing);

      // Convert recipe unit → ingredient base unit before pricing
      const conversion_factor = getConversionFactor(ing.unit, ing.base_unit);
      const unit_mismatch     = conversion_factor === null;
      const convertedQty      = unit_mismatch ? null : effectiveQty * conversion_factor;
      const costExact         = (missing_price || unit_mismatch) ? null : convertedQty * unit_price;

      const priceDate = priceRow?.extraction_date instanceof Date
        ? priceRow.extraction_date.toISOString().slice(0, 10)
        : priceRow?.extraction_date ?? null;

      return {
        recipe_ingredient_id: ing.recipe_ingredient_id,
        ingredient_id:        ing.ingredient_id,
        name:                 ing.name,
        quantity:             raw_quantity,
        unit:                 ing.unit,
        base_unit:            ing.base_unit,
        waste_pct,
        // Display values are rounded; the totals use costExact
        effective_quantity:   parseFloat(effectiveQty.toFixed(4)),
        converted_quantity:   convertedQty === null ? null : parseFloat(convertedQty.toFixed(6)),
        conversion_factor,
        unit_mismatch,
        unit_price,
        ingredient_cost:      costExact === null ? null : round2(costExact),
        cost_exact:           costExact,
        price_id:             priceRow?.id ?? null,
        price_source:         priceRow?.price_source ?? null,
        price_date:           priceDate,
        missing_price,
      };
    })
  );

  // Pricing an ingredient in the wrong unit gives silently wrong costs, so refuse instead
  const mismatched = breakdown.filter((r) => r.unit_mismatch);
  if (mismatched.length) throw unitMismatchError(mismatched);

  const missing_price_ingredients = breakdown
    .filter((r) => r.missing_price)
    .map((r) => ({ ingredient_id: r.ingredient_id, name: r.name }));

  const recipe_cost_exact = missing_price_ingredients.length || breakdown.length === 0
    ? null
    : breakdown.reduce((sum, r) => sum + r.cost_exact, 0);

  return {
    recipe_id:            recipe.id,
    recipe_name:          recipe.name,
    servings:             recipe.servings,
    recipe_cost:          recipe_cost_exact === null ? null : round2(recipe_cost_exact),
    recipe_cost_exact,
    ingredient_breakdown: breakdown.map(({ cost_exact, ...row }) => row),
    missing_price_ingredients,
  };
};

// ── computeImpactAnalysis ─────────────────────────────────────────────────────

// recipe_cost / portion_cost / recommended_price from a plain { ingredient_id: price } map.
// Every tier is null when any ingredient has no price in the map.
const computeFromPriceMap = (ingredients, priceMap, servings, setting) => {
  let total   = 0;
  let hasNull = false;

  const costs = ingredients.map((ing) => {
    const raw        = priceMap[ing.ingredient_id];
    const unit_price = raw != null && raw !== '' ? parseFloat(raw) : null;
    const costExact  = unit_price !== null
      ? effectiveQuantity(ing) * getConversionFactor(ing.unit, ing.base_unit) * unit_price
      : null;
    if (costExact === null) hasNull = true;
    else total += costExact;
    return { ingredient_id: ing.ingredient_id, unit_price, ingredient_cost: costExact === null ? null : round2(costExact) };
  });

  if (hasNull) return { recipe_cost: null, portion_cost: null, recommended_price: null, costs };
  const { recipe_cost, portion_cost, recommended_price } = computePricing(total, servings, setting);
  return { recipe_cost, portion_cost, recommended_price, costs };
};

const computeImpactAnalysis = async (recipeId, oldPrices, newPrices, pricingSettingId, db) => {
  if (!recipeId)                                    throw new Error('recipeId is required');
  if (!oldPrices || typeof oldPrices !== 'object')  throw new Error('oldPrices must be an object');
  if (!newPrices || typeof newPrices !== 'object')  throw new Error('newPrices must be an object');
  if (!pricingSettingId)                            throw new Error('pricingSettingId is required');

  const { recipe, ingredients } = await loadRecipe(recipeId, db);
  const setting = await getPricingSetting(pricingSettingId, db);

  const mismatched = ingredients.filter((ing) => getConversionFactor(ing.unit, ing.base_unit) === null);
  if (mismatched.length) throw unitMismatchError(mismatched);

  const oldSet = computeFromPriceMap(ingredients, oldPrices, recipe.servings, setting);
  const newSet = computeFromPriceMap(ingredients, newPrices, recipe.servings, setting);

  // Margin between the recommended price and the portion cost (paper §3.3, seventh layer)
  const cmOld = computeContributionMargin(oldSet.recommended_price, oldSet.portion_cost);
  const cmNew = computeContributionMargin(newSet.recommended_price, newSet.portion_cost);

  const numChange = (o, n) => (o === null || n === null) ? null : round2(n - o);
  const pctChange = (o, n) => (o === null || n === null || o === 0) ? null
    : parseFloat(((n - o) / o * 100).toFixed(2));

  const ingredient_impacts = ingredients.map((ing, i) => ({
    ingredient_id:       ing.ingredient_id,
    name:                ing.name,
    quantity:            parseFloat(ing.quantity),
    unit:                ing.unit,
    old_price:           oldSet.costs[i].unit_price,
    new_price:           newSet.costs[i].unit_price,
    price_change:        numChange(oldSet.costs[i].unit_price, newSet.costs[i].unit_price),
    ingredient_cost_old: oldSet.costs[i].ingredient_cost,
    ingredient_cost_new: newSet.costs[i].ingredient_cost,
  }));

  return {
    recipe_id:   recipe.id,
    recipe_name: recipe.name,
    servings:    recipe.servings,
    old: { recipe_cost: oldSet.recipe_cost, portion_cost: oldSet.portion_cost, recommended_price: oldSet.recommended_price, contribution_margin: cmOld },
    new: { recipe_cost: newSet.recipe_cost, portion_cost: newSet.portion_cost, recommended_price: newSet.recommended_price, contribution_margin: cmNew },
    diff: {
      recipe_cost_change:         numChange(oldSet.recipe_cost,        newSet.recipe_cost),
      recipe_cost_pct:            pctChange(oldSet.recipe_cost,        newSet.recipe_cost),
      portion_cost_change:        numChange(oldSet.portion_cost,       newSet.portion_cost),
      portion_cost_pct:           pctChange(oldSet.portion_cost,       newSet.portion_cost),
      recommended_price_change:   numChange(oldSet.recommended_price,  newSet.recommended_price),
      recommended_price_pct:      pctChange(oldSet.recommended_price,  newSet.recommended_price),
      contribution_margin_change: numChange(cmOld, cmNew),
      // A % change is meaningless once the margin is zero or turns into a loss
      contribution_margin_pct:    cmOld > 0 && cmNew >= 0 ? pctChange(cmOld, cmNew) : null,
    },
    ingredient_impacts,
  };
};

module.exports = {
  computeRecipeCost,
  computePricing,
  getPricingSetting,
  applyRoundingRule,
  round2,
  computeContributionMargin,
  computeImpactAnalysis,
};
