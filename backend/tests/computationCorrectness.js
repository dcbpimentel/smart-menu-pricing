// Computation Correctness Test (paper Section 3.5.2)
//
// Runs the 20 researcher-prepared recipe cases (TC01-TC20) through the same
// service functions the Costing page uses (computeRecipeCost + computePricing)
// and compares each result with the manual gold standard in computation-cases.json.
//
// A computation is correct when it is within ±₱0.01 of the gold standard.
// 20 cases x 3 values (recipe cost, portion cost, recommended price) = 60 computations.
// Correctness Rate (%) = (Correct Computations ÷ Total Computations Tested) × 100
//
// Usage (from the backend folder, with the backend .env pointing at your database):
//   1. Load the cases:  run database/test_cases_computation.sql once
//   2. npm run test:computation
//
// A CSV of the results is written to backend/tests/results/.

const fs   = require('fs');
const path = require('path');
const db   = require('../utils/db');
const { computeRecipeCost, computePricing, getPricingSetting } = require('../services/costingService');

const CASES_FILE  = path.join(__dirname, 'computation-cases.json');
const RESULTS_DIR = path.join(__dirname, 'results');
const THRESHOLD   = 95; // Table 3.4

const peso = (n) => (n === null || n === undefined ? '-' : Number(n).toFixed(2));

const findId = async (sql, value, what) => {
  const [[row]] = await db.query(sql, [value]);
  if (!row) {
    throw new Error(`${what} "${value}" not found. Run database/test_cases_computation.sql first.`);
  }
  return row.id;
};

const runCase = async (tc, tolerance) => {
  const recipeId  = await findId('SELECT id FROM recipes WHERE name = ?', tc.recipe_name, 'Recipe');
  const settingId = await findId('SELECT id FROM pricing_settings WHERE label = ?', tc.pricing_profile, 'Pricing profile');
  const setting   = await getPricingSetting(settingId, db);

  const cost = await computeRecipeCost(recipeId, 'manual', db);
  if (cost.recipe_cost_exact === null) {
    throw new Error(`${tc.code}: missing price for ${cost.missing_price_ingredients.map((i) => i.name).join(', ')}`);
  }
  const pricing = computePricing(cost.recipe_cost_exact, cost.servings, setting);

  const system = {
    recipe_cost:       pricing.recipe_cost,
    portion_cost:      pricing.portion_cost,
    recommended_price: pricing.recommended_price,
  };

  return ['recipe_cost', 'portion_cost', 'recommended_price'].map((field) => {
    const expected = tc.expected[field];
    const actual   = system[field];
    const diff     = Math.abs(actual - expected);
    return {
      code:     tc.code,
      recipe:   tc.recipe_name,
      profile:  tc.pricing_profile,
      field,
      expected,
      actual,
      diff:     Number(diff.toFixed(4)),
      correct:  diff <= tolerance + 1e-9,
    };
  });
};

const main = async () => {
  const spec      = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
  const tolerance = spec.tolerance_php;
  const rows      = [];

  for (const tc of spec.cases) {
    rows.push(...(await runCase(tc, tolerance)));
  }

  // Console report
  console.log('\nComputation Correctness Test (paper Section 3.5.2)');
  console.log(`Tolerance: ±₱${tolerance.toFixed(2)}   Price source: manual\n`);
  console.log('Case  Value               Gold standard    System   Diff   Result');
  for (const r of rows) {
    console.log(
      `${r.code}  ${r.field.padEnd(18)} ${peso(r.expected).padStart(13)} ${peso(r.actual).padStart(9)} ${r.diff.toFixed(2).padStart(6)}   ${r.correct ? 'CORRECT' : 'WRONG'}`
    );
  }

  const correct = rows.filter((r) => r.correct).length;
  const rate    = (correct / rows.length) * 100;
  console.log(`\nCorrect computations: ${correct} of ${rows.length}`);
  console.log(`Correctness rate:     ${rate.toFixed(2)}%  (threshold ${THRESHOLD}%: ${rate >= THRESHOLD ? 'MET' : 'NOT MET'})`);

  // CSV for the appendix
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const file  = path.join(RESULTS_DIR, `computation-results-${stamp}.csv`);
  const header = 'case,recipe,pricing_profile,value,gold_standard,system,abs_difference,correct';
  const lines  = rows.map((r) =>
    [r.code, `"${r.recipe}"`, `"${r.profile}"`, r.field, peso(r.expected), peso(r.actual), r.diff.toFixed(4), r.correct ? 'Y' : 'N'].join(',')
  );
  fs.writeFileSync(file, [header, ...lines].join('\n') + '\n');
  console.log(`Results saved to ${path.relative(process.cwd(), file)}\n`);

  return rate >= THRESHOLD;
};

main()
  .then((passed) => { process.exitCode = passed ? 0 : 1; })
  .catch((err) => { console.error(`\nTest could not run: ${err.message}\n`); process.exitCode = 1; })
  .finally(() => db.end());
