const VALID_SOURCES = ['dti', 'da', 'manual', 'latest'];

const computeRecipeCost = async (recipeId, priceSource, db) => {
  if (!recipeId) throw new Error('recipeId is required');
  if (!priceSource || !VALID_SOURCES.includes(priceSource)) {
    throw new Error(`priceSource must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  // Fetch recipe
  const [[recipe]] = await db.query('SELECT id, name, servings FROM recipes WHERE id = ?', [recipeId]);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);
  if (recipe.servings === 0) throw new Error(`Recipe "${recipe.name}" has zero servings`);

  // Fetch all recipe_ingredients joined with ingredient name
  const [ingredients] = await db.query(
    `SELECT ri.ingredient_id, i.name, ri.quantity, ri.unit
     FROM recipe_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = ?`,
    [recipeId]
  );

  if (ingredients.length === 0) {
    return {
      recipe_id:            recipe.id,
      recipe_name:          recipe.name,
      servings:             recipe.servings,
      recipe_cost:          0,
      ingredient_breakdown: [],
    };
  }

  // Fetch latest price for each ingredient (one query per ingredient avoids a complex lateral join)
  const breakdown = await Promise.all(
    ingredients.map(async (ing) => {
      const [priceRows] = priceSource === 'latest'
        ? await db.query(
            `SELECT price, source AS price_source
             FROM ingredient_prices
             WHERE ingredient_id = ?
             ORDER BY extraction_date DESC, id DESC
             LIMIT 1`,
            [ing.ingredient_id]
          )
        : await db.query(
            `SELECT price, source AS price_source
             FROM ingredient_prices
             WHERE ingredient_id = ? AND source = ?
             ORDER BY extraction_date DESC, id DESC
             LIMIT 1`,
            [ing.ingredient_id, priceSource]
          );

      const priceRow      = priceRows[0] ?? null;
      const unit_price    = priceRow ? parseFloat(priceRow.price) : null;
      const missing_price = unit_price === null;
      const ingredient_cost = missing_price ? null : parseFloat((ing.quantity * unit_price).toFixed(2));

      return {
        ingredient_id:    ing.ingredient_id,
        name:             ing.name,
        quantity:         parseFloat(ing.quantity),
        unit:             ing.unit,
        unit_price,
        ingredient_cost,
        price_source:     priceRow?.price_source ?? null,
        missing_price,
      };
    })
  );

  // Sum only ingredients with a known cost; null if any are missing
  const anyMissing  = breakdown.some((r) => r.missing_price);
  const recipe_cost = anyMissing
    ? null
    : parseFloat(breakdown.reduce((sum, r) => sum + r.ingredient_cost, 0).toFixed(2));

  return {
    recipe_id:            recipe.id,
    recipe_name:          recipe.name,
    servings:             recipe.servings,
    recipe_cost,
    ingredient_breakdown: breakdown,
  };
};

const computePortionCost = (recipe_cost, servings) => {
  if (recipe_cost === null || recipe_cost === undefined) {
    throw new Error('Cannot compute portion cost: recipe_cost is null (one or more ingredient prices are missing)');
  }
  if (typeof recipe_cost !== 'number' || isNaN(recipe_cost)) {
    throw new Error('recipe_cost must be a number');
  }
  if (!servings || servings <= 0) {
    throw new Error('servings must be greater than zero');
  }
  return parseFloat((recipe_cost / servings).toFixed(2));
};

const computeRecommendedPrice = async (portion_cost, pricing_setting_id, db) => {
  if (typeof portion_cost !== 'number' || isNaN(portion_cost) || portion_cost === null) {
    throw new Error('portion_cost must be a valid number');
  }
  if (!pricing_setting_id) throw new Error('pricing_setting_id is required');

  const [[setting]] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [pricing_setting_id]);
  if (!setting) {
    const err = new Error(`Pricing setting ${pricing_setting_id} not found`);
    err.status = 404;
    throw err;
  }

  const target_food_cost_pct = parseFloat(setting.target_food_cost_pct);
  const raw_price = portion_cost / (target_food_cost_pct / 100);

  let recommended_price;
  if (setting.rounding_rule === 'nearest5') {
    recommended_price = Math.ceil(raw_price / 5) * 5;
  } else if (setting.rounding_rule === 'nearest10') {
    recommended_price = Math.ceil(raw_price / 10) * 10;
  } else {
    recommended_price = parseFloat(raw_price.toFixed(2));
  }

  return {
    recommended_price,
    portion_cost,
    target_food_cost_pct,
    rounding_rule:  setting.rounding_rule,
    raw_price:      parseFloat(raw_price.toFixed(4)),
  };
};

const computeContributionMargin = (selling_price, portion_cost) => {
  if (typeof selling_price !== 'number' || isNaN(selling_price)) {
    throw new Error('selling_price must be a number');
  }
  if (typeof portion_cost !== 'number' || isNaN(portion_cost)) {
    throw new Error('portion_cost must be a number');
  }
  return parseFloat((selling_price - portion_cost).toFixed(2));
};

// ── Private helpers shared by computeRecommendedPrice and computeImpactAnalysis ─

const _applyRoundingRule = (raw, rule) => {
  if (rule === 'nearest5')  return Math.ceil(raw / 5)  * 5;
  if (rule === 'nearest10') return Math.ceil(raw / 10) * 10;
  return parseFloat(raw.toFixed(2));
};

// Compute recipe_cost / portion_cost / recommended_price from a plain { ingredient_id: price } map.
// Returns null for any tier when a price is missing for at least one ingredient.
const _computeFromPriceMap = (ingredients, priceMap, servings, setting) => {
  let total    = 0;
  let hasNull  = false;

  const costs = ingredients.map((ing) => {
    const raw = priceMap[ing.ingredient_id];
    const unit_price      = raw != null ? parseFloat(raw) : null;
    const ingredient_cost = unit_price !== null
      ? parseFloat((ing.quantity * unit_price).toFixed(2))
      : null;
    if (ingredient_cost === null) hasNull = true;
    else total += ingredient_cost;
    return { ingredient_id: ing.ingredient_id, unit_price, ingredient_cost };
  });

  const recipe_cost = hasNull ? null : parseFloat(total.toFixed(2));
  const portion_cost = recipe_cost !== null
    ? parseFloat((recipe_cost / servings).toFixed(2))
    : null;
  const recommended_price = portion_cost !== null
    ? _applyRoundingRule(
        portion_cost / (parseFloat(setting.target_food_cost_pct) / 100),
        setting.rounding_rule
      )
    : null;

  return { recipe_cost, portion_cost, recommended_price, costs };
};

// ── computeImpactAnalysis ─────────────────────────────────────────────────────

const computeImpactAnalysis = async (recipeId, oldPrices, newPrices, pricingSettingId, db) => {
  if (!recipeId)                                    throw new Error('recipeId is required');
  if (!oldPrices || typeof oldPrices !== 'object')  throw new Error('oldPrices must be an object');
  if (!newPrices || typeof newPrices !== 'object')  throw new Error('newPrices must be an object');
  if (!pricingSettingId)                            throw new Error('pricingSettingId is required');

  const [[recipe]] = await db.query('SELECT id, name, servings FROM recipes WHERE id = ?', [recipeId]);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);
  if (recipe.servings === 0) throw new Error(`Recipe "${recipe.name}" has zero servings`);

  const [ingredients] = await db.query(
    `SELECT ri.ingredient_id, i.name, ri.quantity, ri.unit
     FROM recipe_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = ?`,
    [recipeId]
  );

  const [[setting]] = await db.query('SELECT * FROM pricing_settings WHERE id = ?', [pricingSettingId]);
  if (!setting) {
    const err = new Error(`Pricing setting ${pricingSettingId} not found`);
    err.status = 404;
    throw err;
  }

  const oldSet = _computeFromPriceMap(ingredients, oldPrices, recipe.servings, setting);
  const newSet = _computeFromPriceMap(ingredients, newPrices, recipe.servings, setting);

  const numChange = (o, n) => (o === null || n === null) ? null : parseFloat((n - o).toFixed(2));
  const pctChange = (o, n) => (o === null || n === null || o === 0) ? null
    : parseFloat(((n - o) / o * 100).toFixed(2));

  const ingredient_impacts = ingredients.map((ing, i) => ({
    ingredient_id:       ing.ingredient_id,
    name:                ing.name,
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
    old: { recipe_cost: oldSet.recipe_cost, portion_cost: oldSet.portion_cost, recommended_price: oldSet.recommended_price },
    new: { recipe_cost: newSet.recipe_cost, portion_cost: newSet.portion_cost, recommended_price: newSet.recommended_price },
    diff: {
      recipe_cost_change:       numChange(oldSet.recipe_cost,        newSet.recipe_cost),
      recipe_cost_pct:          pctChange(oldSet.recipe_cost,        newSet.recipe_cost),
      portion_cost_change:      numChange(oldSet.portion_cost,       newSet.portion_cost),
      portion_cost_pct:         pctChange(oldSet.portion_cost,       newSet.portion_cost),
      recommended_price_change: numChange(oldSet.recommended_price,  newSet.recommended_price),
      recommended_price_pct:    pctChange(oldSet.recommended_price,  newSet.recommended_price),
    },
    ingredient_impacts,
  };
};

module.exports = { computeRecipeCost, computePortionCost, computeRecommendedPrice, computeContributionMargin, computeImpactAnalysis };
