-- ============================================================
-- Computation Correctness Test Cases (paper Section 3.5.2)
-- 20 researcher-prepared recipe cases (TC01-TC20) x 3 values
-- (recipe cost, portion cost, recommended price) = 60 computations.
--
-- Source of truth: backend/tests/computation-cases.json
-- Expected (gold standard) values are listed there and in the
-- validation workbook in the paper's appendix.
--
-- How to use:
--   1. Run this file on the smart_menu_pricing database
--      (MySQL Workbench: File > Open SQL Script, then Execute).
--   2. In the app: Costing page > pick a TC recipe > pick the
--      matching "TC ..." pricing profile > price source Manual.
--   3. Or run all 20 at once:  cd backend  &&  npm run test:computation
--
-- Safe to run more than once: it removes earlier TC data first.
-- It does not touch any non-TC ingredients, recipes or profiles.
-- ============================================================
USE smart_menu_pricing;

START TRANSACTION;

-- Remove earlier test-case data (children first)
DELETE co FROM costing_outputs co JOIN recipes r ON r.id = co.recipe_id WHERE r.name LIKE 'TC__ %';
DELETE co FROM costing_outputs co JOIN pricing_settings p ON p.id = co.pricing_setting_id WHERE p.label LIKE 'TC %';
DELETE FROM recipes WHERE name LIKE 'TC__ %';
DELETE FROM ingredients WHERE name LIKE 'TC %';
DELETE FROM pricing_settings WHERE label LIKE 'TC %';

-- Pricing profiles
INSERT INTO pricing_settings (label, target_food_cost_pct, rounding_rule) VALUES
  ('TC 35% round up P5', 35.00, 'nearest5'),
  ('TC 30% no rounding', 30.00, 'none'),
  ('TC 40% round up P10', 40.00, 'nearest10'),
  ('TC 28% round up P5', 28.00, 'nearest5');

-- Ingredients (base unit = the unit each price is quoted in)
INSERT INTO ingredients (name, unit, category) VALUES
  ('TC Chicken (whole, dressed)', 'kg', 'Meat'),
  ('TC Pork Kasim', 'kg', 'Meat'),
  ('TC Pork Belly (Liempo)', 'kg', 'Meat'),
  ('TC Ground Pork', 'kg', 'Meat'),
  ('TC Beef Rump', 'kg', 'Meat'),
  ('TC Bangus', 'kg', 'Fish'),
  ('TC Chicken Egg', 'pc', 'Poultry'),
  ('TC Rice (well-milled)', 'kg', 'Grain'),
  ('TC Canton Noodles', 'kg', 'Grain'),
  ('TC Misua', 'kg', 'Grain'),
  ('TC Lumpia Wrapper', 'pc', 'Grain'),
  ('TC Garlic', 'kg', 'Spice'),
  ('TC Onion (red)', 'kg', 'Vegetable'),
  ('TC Tomato', 'kg', 'Vegetable'),
  ('TC Eggplant', 'kg', 'Vegetable'),
  ('TC Ampalaya', 'kg', 'Vegetable'),
  ('TC Carrots', 'kg', 'Vegetable'),
  ('TC Cabbage', 'kg', 'Vegetable'),
  ('TC Kangkong (bundle)', 'pc', 'Vegetable'),
  ('TC Lemongrass', 'kg', 'Spice'),
  ('TC Calamansi', 'kg', 'Fruit'),
  ('TC Green Mango', 'kg', 'Fruit'),
  ('TC Chili (red)', 'kg', 'Spice'),
  ('TC Black Peppercorn', 'kg', 'Spice'),
  ('TC Bay Leaf', 'pc', 'Spice'),
  ('TC Salt (iodized)', 'kg', 'Condiment'),
  ('TC Sugar (refined)', 'kg', 'Condiment'),
  ('TC Brown Sugar', 'kg', 'Condiment'),
  ('TC Soy Sauce', 'L', 'Condiment'),
  ('TC White Vinegar', 'L', 'Condiment'),
  ('TC Cooking Oil (palm)', 'L', 'Condiment'),
  ('TC Annatto Oil', 'L', 'Condiment'),
  ('TC Mayonnaise', 'L', 'Condiment'),
  ('TC Ketchup', 'kg', 'Condiment'),
  ('TC Sinigang Mix (pack)', 'pc', 'Condiment'),
  ('TC Corned Beef (150 g can)', 'pc', 'Canned'),
  ('TC Sardines (155 g can)', 'pc', 'Canned'),
  ('TC Evaporated Milk', 'L', 'Dairy'),
  ('TC Drinking Water', 'L', 'Beverage'),
  ('TC Ice', 'kg', 'Beverage');

-- Manual prices (one per ingredient)
INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
SELECT i.id, t.price, 'manual', 'Computation correctness test case (paper 3.5.2)', '2026-10-30', TRUE
FROM ingredients i JOIN (
SELECT 'TC Chicken (whole, dressed)' AS name, 170.00 AS price
  UNION ALL SELECT 'TC Pork Kasim' AS name, 309.20 AS price
  UNION ALL SELECT 'TC Pork Belly (Liempo)' AS name, 366.66 AS price
  UNION ALL SELECT 'TC Ground Pork' AS name, 320.00 AS price
  UNION ALL SELECT 'TC Beef Rump' AS name, 502.18 AS price
  UNION ALL SELECT 'TC Bangus' AS name, 245.11 AS price
  UNION ALL SELECT 'TC Chicken Egg' AS name, 8.25 AS price
  UNION ALL SELECT 'TC Rice (well-milled)' AS name, 54.12 AS price
  UNION ALL SELECT 'TC Canton Noodles' AS name, 140.00 AS price
  UNION ALL SELECT 'TC Misua' AS name, 180.00 AS price
  UNION ALL SELECT 'TC Lumpia Wrapper' AS name, 1.20 AS price
  UNION ALL SELECT 'TC Garlic' AS name, 130.00 AS price
  UNION ALL SELECT 'TC Onion (red)' AS name, 123.61 AS price
  UNION ALL SELECT 'TC Tomato' AS name, 106.37 AS price
  UNION ALL SELECT 'TC Eggplant' AS name, 83.37 AS price
  UNION ALL SELECT 'TC Ampalaya' AS name, 113.84 AS price
  UNION ALL SELECT 'TC Carrots' AS name, 119.31 AS price
  UNION ALL SELECT 'TC Cabbage' AS name, 147.48 AS price
  UNION ALL SELECT 'TC Kangkong (bundle)' AS name, 15.00 AS price
  UNION ALL SELECT 'TC Lemongrass' AS name, 60.00 AS price
  UNION ALL SELECT 'TC Calamansi' AS name, 95.40 AS price
  UNION ALL SELECT 'TC Green Mango' AS name, 255.71 AS price
  UNION ALL SELECT 'TC Chili (red)' AS name, 290.66 AS price
  UNION ALL SELECT 'TC Black Peppercorn' AS name, 600.00 AS price
  UNION ALL SELECT 'TC Bay Leaf' AS name, 0.50 AS price
  UNION ALL SELECT 'TC Salt (iodized)' AS name, 43.00 AS price
  UNION ALL SELECT 'TC Sugar (refined)' AS name, 81.49 AS price
  UNION ALL SELECT 'TC Brown Sugar' AS name, 72.17 AS price
  UNION ALL SELECT 'TC Soy Sauce' AS name, 62.00 AS price
  UNION ALL SELECT 'TC White Vinegar' AS name, 45.00 AS price
  UNION ALL SELECT 'TC Cooking Oil (palm)' AS name, 101.91 AS price
  UNION ALL SELECT 'TC Annatto Oil' AS name, 180.00 AS price
  UNION ALL SELECT 'TC Mayonnaise' AS name, 220.00 AS price
  UNION ALL SELECT 'TC Ketchup' AS name, 150.00 AS price
  UNION ALL SELECT 'TC Sinigang Mix (pack)' AS name, 24.50 AS price
  UNION ALL SELECT 'TC Corned Beef (150 g can)' AS name, 34.00 AS price
  UNION ALL SELECT 'TC Sardines (155 g can)' AS name, 21.50 AS price
  UNION ALL SELECT 'TC Evaporated Milk' AS name, 129.73 AS price
  UNION ALL SELECT 'TC Drinking Water' AS name, 16.50 AS price
  UNION ALL SELECT 'TC Ice' AS name, 10.00 AS price
) t ON t.name = i.name;

-- Recipes
INSERT INTO recipes (name, description, servings, category) VALUES
  ('TC01 Chicken Adobo', 'Test case for computation correctness. Use profile: TC 35% round up P5', 4, 'Test Case'),
  ('TC02 Chicken Inasal', 'Test case for computation correctness. Use profile: TC 35% round up P5', 6, 'Test Case'),
  ('TC03 Pork Sinigang', 'Test case for computation correctness. Use profile: TC 30% no rounding', 5, 'Test Case'),
  ('TC04 Garlic Fried Rice', 'Test case for computation correctness. Use profile: TC 40% round up P10', 8, 'Test Case'),
  ('TC05 Chicken Sisig', 'Test case for computation correctness. Use profile: TC 35% round up P5', 3, 'Test Case'),
  ('TC06 Beef Tapa', 'Test case for computation correctness. Use profile: TC 35% round up P5', 4, 'Test Case'),
  ('TC07 Tortang Talong', 'Test case for computation correctness. Use profile: TC 30% no rounding', 2, 'Test Case'),
  ('TC08 Pancit Canton', 'Test case for computation correctness. Use profile: TC 40% round up P10', 10, 'Test Case'),
  ('TC09 Fried Bangus', 'Test case for computation correctness. Use profile: TC 35% round up P5', 2, 'Test Case'),
  ('TC10 Chicksilog', 'Test case for computation correctness. Use profile: TC 35% round up P5', 1, 'Test Case'),
  ('TC11 Grilled Liempo', 'Test case for computation correctness. Use profile: TC 28% round up P5', 6, 'Test Case'),
  ('TC12 Ginisang Ampalaya', 'Test case for computation correctness. Use profile: TC 30% no rounding', 4, 'Test Case'),
  ('TC13 Corned Beef Silog', 'Test case for computation correctness. Use profile: TC 40% round up P10', 1, 'Test Case'),
  ('TC14 Ginisang Sardinas with Misua', 'Test case for computation correctness. Use profile: TC 35% round up P5', 3, 'Test Case'),
  ('TC15 Mango Shake', 'Test case for computation correctness. Use profile: TC 28% round up P5', 2, 'Test Case'),
  ('TC16 BBQ Chicken (batch)', 'Test case for computation correctness. Use profile: TC 35% round up P5', 40, 'Test Case'),
  ('TC17 Chicken Tinola', 'Test case for computation correctness. Use profile: TC 35% round up P5', 4, 'Test Case'),
  ('TC18 Calamansi Juice', 'Test case for computation correctness. Use profile: TC 30% no rounding', 4, 'Test Case'),
  ('TC19 Lumpiang Shanghai', 'Test case for computation correctness. Use profile: TC 40% round up P10', 50, 'Test Case'),
  ('TC20 Bistek Tagalog', 'Test case for computation correctness. Use profile: TC 28% round up P5', 4, 'Test Case');

-- Recipe ingredients
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_pct)
SELECT r.id, i.id, t.quantity, t.unit, t.waste_pct
FROM (
  SELECT 'TC01 Chicken Adobo' AS recipe, 'TC Chicken (whole, dressed)' AS ingredient, 1.0 AS quantity, 'kg' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC01 Chicken Adobo' AS recipe, 'TC Soy Sauce' AS ingredient, 120.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC01 Chicken Adobo' AS recipe, 'TC White Vinegar' AS ingredient, 100.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC01 Chicken Adobo' AS recipe, 'TC Garlic' AS ingredient, 30.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC01 Chicken Adobo' AS recipe, 'TC Bay Leaf' AS ingredient, 3.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC01 Chicken Adobo' AS recipe, 'TC Black Peppercorn' AS ingredient, 5.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC01 Chicken Adobo' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 2.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC02 Chicken Inasal' AS recipe, 'TC Chicken (whole, dressed)' AS ingredient, 1.5 AS quantity, 'kg' AS unit, 10.00 AS waste_pct
  UNION ALL SELECT 'TC02 Chicken Inasal' AS recipe, 'TC Lemongrass' AS ingredient, 100.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC02 Chicken Inasal' AS recipe, 'TC Calamansi' AS ingredient, 150.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC02 Chicken Inasal' AS recipe, 'TC Garlic' AS ingredient, 40.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC02 Chicken Inasal' AS recipe, 'TC Annatto Oil' AS ingredient, 60.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC02 Chicken Inasal' AS recipe, 'TC Salt (iodized)' AS ingredient, 10.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC03 Pork Sinigang' AS recipe, 'TC Pork Kasim' AS ingredient, 1.0 AS quantity, 'kg' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC03 Pork Sinigang' AS recipe, 'TC Tomato' AS ingredient, 250.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC03 Pork Sinigang' AS recipe, 'TC Onion (red)' AS ingredient, 150.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC03 Pork Sinigang' AS recipe, 'TC Sinigang Mix (pack)' AS ingredient, 2.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC03 Pork Sinigang' AS recipe, 'TC Kangkong (bundle)' AS ingredient, 2.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC03 Pork Sinigang' AS recipe, 'TC Salt (iodized)' AS ingredient, 8.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC04 Garlic Fried Rice' AS recipe, 'TC Rice (well-milled)' AS ingredient, 1.0 AS quantity, 'kg' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC04 Garlic Fried Rice' AS recipe, 'TC Garlic' AS ingredient, 50.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC04 Garlic Fried Rice' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 3.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC04 Garlic Fried Rice' AS recipe, 'TC Salt (iodized)' AS ingredient, 5.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC05 Chicken Sisig' AS recipe, 'TC Chicken (whole, dressed)' AS ingredient, 600.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC05 Chicken Sisig' AS recipe, 'TC Onion (red)' AS ingredient, 100.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC05 Chicken Sisig' AS recipe, 'TC Chili (red)' AS ingredient, 20.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC05 Chicken Sisig' AS recipe, 'TC Mayonnaise' AS ingredient, 3.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC05 Chicken Sisig' AS recipe, 'TC Calamansi' AS ingredient, 50.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC05 Chicken Sisig' AS recipe, 'TC Chicken Egg' AS ingredient, 1.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC06 Beef Tapa' AS recipe, 'TC Beef Rump' AS ingredient, 800.0 AS quantity, 'g' AS unit, 5.00 AS waste_pct
  UNION ALL SELECT 'TC06 Beef Tapa' AS recipe, 'TC Soy Sauce' AS ingredient, 60.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC06 Beef Tapa' AS recipe, 'TC Sugar (refined)' AS ingredient, 30.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC06 Beef Tapa' AS recipe, 'TC Garlic' AS ingredient, 20.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC07 Tortang Talong' AS recipe, 'TC Eggplant' AS ingredient, 300.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC07 Tortang Talong' AS recipe, 'TC Chicken Egg' AS ingredient, 3.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC07 Tortang Talong' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 0.25 AS quantity, 'cup' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC07 Tortang Talong' AS recipe, 'TC Salt (iodized)' AS ingredient, 3.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC08 Pancit Canton' AS recipe, 'TC Canton Noodles' AS ingredient, 1.0 AS quantity, 'kg' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC08 Pancit Canton' AS recipe, 'TC Pork Belly (Liempo)' AS ingredient, 300.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC08 Pancit Canton' AS recipe, 'TC Carrots' AS ingredient, 200.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC08 Pancit Canton' AS recipe, 'TC Cabbage' AS ingredient, 400.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC08 Pancit Canton' AS recipe, 'TC Soy Sauce' AS ingredient, 0.5 AS quantity, 'cup' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC08 Pancit Canton' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 4.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC09 Fried Bangus' AS recipe, 'TC Bangus' AS ingredient, 500.0 AS quantity, 'g' AS unit, 15.00 AS waste_pct
  UNION ALL SELECT 'TC09 Fried Bangus' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 0.5 AS quantity, 'cup' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC09 Fried Bangus' AS recipe, 'TC Salt (iodized)' AS ingredient, 5.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC09 Fried Bangus' AS recipe, 'TC White Vinegar' AS ingredient, 2.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC10 Chicksilog' AS recipe, 'TC Chicken (whole, dressed)' AS ingredient, 150.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC10 Chicksilog' AS recipe, 'TC Rice (well-milled)' AS ingredient, 200.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC10 Chicksilog' AS recipe, 'TC Chicken Egg' AS ingredient, 1.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC10 Chicksilog' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 1.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC11 Grilled Liempo' AS recipe, 'TC Pork Belly (Liempo)' AS ingredient, 1.2 AS quantity, 'kg' AS unit, 8.00 AS waste_pct
  UNION ALL SELECT 'TC11 Grilled Liempo' AS recipe, 'TC Soy Sauce' AS ingredient, 100.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC11 Grilled Liempo' AS recipe, 'TC Calamansi' AS ingredient, 60.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC11 Grilled Liempo' AS recipe, 'TC Garlic' AS ingredient, 25.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC12 Ginisang Ampalaya' AS recipe, 'TC Ampalaya' AS ingredient, 500.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC12 Ginisang Ampalaya' AS recipe, 'TC Chicken Egg' AS ingredient, 2.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC12 Ginisang Ampalaya' AS recipe, 'TC Tomato' AS ingredient, 150.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC12 Ginisang Ampalaya' AS recipe, 'TC Onion (red)' AS ingredient, 80.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC12 Ginisang Ampalaya' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 2.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC13 Corned Beef Silog' AS recipe, 'TC Corned Beef (150 g can)' AS ingredient, 1.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC13 Corned Beef Silog' AS recipe, 'TC Rice (well-milled)' AS ingredient, 200.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC13 Corned Beef Silog' AS recipe, 'TC Chicken Egg' AS ingredient, 1.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC13 Corned Beef Silog' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 1.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC14 Ginisang Sardinas with Misua' AS recipe, 'TC Sardines (155 g can)' AS ingredient, 2.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC14 Ginisang Sardinas with Misua' AS recipe, 'TC Misua' AS ingredient, 100.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC14 Ginisang Sardinas with Misua' AS recipe, 'TC Onion (red)' AS ingredient, 50.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC14 Ginisang Sardinas with Misua' AS recipe, 'TC Garlic' AS ingredient, 15.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC14 Ginisang Sardinas with Misua' AS recipe, 'TC Drinking Water' AS ingredient, 750.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC15 Mango Shake' AS recipe, 'TC Green Mango' AS ingredient, 300.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC15 Mango Shake' AS recipe, 'TC Evaporated Milk' AS ingredient, 0.5 AS quantity, 'cup' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC15 Mango Shake' AS recipe, 'TC Sugar (refined)' AS ingredient, 30.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC15 Mango Shake' AS recipe, 'TC Ice' AS ingredient, 200.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC16 BBQ Chicken (batch)' AS recipe, 'TC Chicken (whole, dressed)' AS ingredient, 5.0 AS quantity, 'kg' AS unit, 12.00 AS waste_pct
  UNION ALL SELECT 'TC16 BBQ Chicken (batch)' AS recipe, 'TC Ketchup' AS ingredient, 500.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC16 BBQ Chicken (batch)' AS recipe, 'TC Soy Sauce' AS ingredient, 300.0 AS quantity, 'ml' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC16 BBQ Chicken (batch)' AS recipe, 'TC Brown Sugar' AS ingredient, 250.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC16 BBQ Chicken (batch)' AS recipe, 'TC Garlic' AS ingredient, 100.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC17 Chicken Tinola' AS recipe, 'TC Chicken (whole, dressed)' AS ingredient, 800.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC17 Chicken Tinola' AS recipe, 'TC Kangkong (bundle)' AS ingredient, 2.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC17 Chicken Tinola' AS recipe, 'TC Bay Leaf' AS ingredient, 4.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC18 Calamansi Juice' AS recipe, 'TC Calamansi' AS ingredient, 200.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC18 Calamansi Juice' AS recipe, 'TC Sugar (refined)' AS ingredient, 50.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC18 Calamansi Juice' AS recipe, 'TC Drinking Water' AS ingredient, 1.0 AS quantity, 'L' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC18 Calamansi Juice' AS recipe, 'TC Ice' AS ingredient, 300.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC19 Lumpiang Shanghai' AS recipe, 'TC Ground Pork' AS ingredient, 1.0 AS quantity, 'kg' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC19 Lumpiang Shanghai' AS recipe, 'TC Carrots' AS ingredient, 150.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC19 Lumpiang Shanghai' AS recipe, 'TC Onion (red)' AS ingredient, 100.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC19 Lumpiang Shanghai' AS recipe, 'TC Chicken Egg' AS ingredient, 2.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC19 Lumpiang Shanghai' AS recipe, 'TC Lumpia Wrapper' AS ingredient, 50.0 AS quantity, 'pc' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC19 Lumpiang Shanghai' AS recipe, 'TC Cooking Oil (palm)' AS ingredient, 2.0 AS quantity, 'cup' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC20 Bistek Tagalog' AS recipe, 'TC Beef Rump' AS ingredient, 2.0 AS quantity, 'lb' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC20 Bistek Tagalog' AS recipe, 'TC Soy Sauce' AS ingredient, 4.0 AS quantity, 'tbsp' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC20 Bistek Tagalog' AS recipe, 'TC Calamansi' AS ingredient, 3.0 AS quantity, 'oz' AS unit, 0.00 AS waste_pct
  UNION ALL SELECT 'TC20 Bistek Tagalog' AS recipe, 'TC Onion (red)' AS ingredient, 200.0 AS quantity, 'g' AS unit, 0.00 AS waste_pct
) t
JOIN recipes r ON r.name = t.recipe
JOIN ingredients i ON i.name = t.ingredient;

COMMIT;

-- Quick check: expect 4 profiles, 40 ingredients, 40 prices, 20 recipes, 95 recipe lines
SELECT
  (SELECT COUNT(*) FROM pricing_settings WHERE label LIKE 'TC %') AS profiles,
  (SELECT COUNT(*) FROM ingredients WHERE name LIKE 'TC %') AS ingredients,
  (SELECT COUNT(*) FROM ingredient_prices ip JOIN ingredients i ON i.id = ip.ingredient_id WHERE i.name LIKE 'TC %') AS prices,
  (SELECT COUNT(*) FROM recipes WHERE name LIKE 'TC__ %') AS recipes,
  (SELECT COUNT(*) FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id WHERE r.name LIKE 'TC__ %') AS recipe_lines;
