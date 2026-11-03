# Computation Correctness Test (paper Section 3.5.2)

20 researcher-prepared recipe cases (TC01 to TC20) are run through the same functions the
Costing page uses. Each case checks 3 values: recipe cost, portion cost and recommended price.
That makes 60 computations. A computation is correct when it is within ±₱0.01 of the manual
gold standard. The target is at least 95% (Table 3.4).

## Files

| File | What it is |
|---|---|
| `computation-cases.json` | The 20 cases: ingredients, quantities, units, waste %, prices, servings, pricing profile, and the expected (gold standard) values |
| `computationCorrectness.js` | Runs all 20 cases and prints the results |
| `../../database/test_cases_computation.sql` | Loads the 20 cases into the database so they can also be opened in the app |
| `results/` | A CSV of each run, for the appendix |

## Run it

1. Load the cases into your database (only once, or again after a system reset):
   open `database/test_cases_computation.sql` in MySQL Workbench and execute it.
   The last query should show 4 profiles, 40 ingredients, 40 prices, 20 recipes, 95 recipe lines.
2. From the `backend` folder:

   ```
   npm run test:computation
   ```

   Expected last lines:

   ```
   Correct computations: 60 of 60
   Correctness rate:     100.00%  (threshold 95%: MET)
   ```

## Show it in the app (defense)

1. Open **Costing**.
2. Pick any recipe that starts with **TC** (for example *TC17 Chicken Tinola*).
3. Pick the pricing profile named in the recipe description (for example *TC 35% round up P5*).
4. Set the price source to **Manual** and compute.
5. Compare with the Results sheet of the validation workbook in the appendix.

All test data is named with the prefix `TC`, so it never mixes with real ingredients or recipes.
Running the SQL file again replaces the old TC data. The system reset (Settings) removes it.
