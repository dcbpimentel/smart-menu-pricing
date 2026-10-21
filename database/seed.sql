-- Seed data for Smart Menu Pricing System
USE smart_menu_pricing;

-- 5 core Filipino market ingredients
INSERT INTO ingredients (name, unit, category) VALUES
  ('Rice',          'kg', 'Grain'),
  ('Chicken Breast','kg', 'Meat'),
  ('Pork Belly',    'kg', 'Meat'),
  ('Onion',         'kg', 'Vegetable'),
  ('Garlic',        'kg', 'Vegetable');

-- Sample prices (demo data) so the system is usable right away
INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
SELECT id,  52.00, 'manual', 'Sample price (demo data)',         '2025-06-01', TRUE FROM ingredients WHERE name = 'Rice';

INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
SELECT id, 220.00, 'manual', 'Sample price (demo data)',         '2025-06-01', TRUE FROM ingredients WHERE name = 'Chicken Breast';

INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
SELECT id, 280.00, 'manual', 'Sample price (demo data)',               '2025-06-01', TRUE FROM ingredients WHERE name = 'Pork Belly';

INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
SELECT id,  80.00, 'manual', 'Sample price (demo data)',             '2025-06-01', TRUE FROM ingredients WHERE name = 'Onion';

INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
SELECT id, 120.00, 'manual', 'Sample price (demo data)',             '2025-06-01', TRUE FROM ingredients WHERE name = 'Garlic';

-- Default admin account (password: admin123)
INSERT INTO users (username, full_name, role, password_hash)
VALUES ('admin', 'Administrator', 'admin', '$2b$10$Joos6vsJrouUkT6hd86SS.SG99yYI.avkB8iG9ozmfGZv2vJD7eDq')
ON DUPLICATE KEY UPDATE full_name = 'Administrator', role = 'admin';

-- Default pricing profile (idempotent: update if label already exists)
INSERT INTO pricing_settings (label, target_food_cost_pct, rounding_rule)
VALUES ('Default', 35.00, 'nearest5')
ON DUPLICATE KEY UPDATE target_food_cost_pct = 35.00, rounding_rule = 'nearest5';
