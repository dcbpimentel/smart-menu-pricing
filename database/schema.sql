-- ============================================================
-- Smart Menu Pricing System — MySQL Schema
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. ingredients
--    Master list of all ingredients used across recipes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredients (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name         VARCHAR(150)     NOT NULL,
  unit         VARCHAR(30)      NOT NULL COMMENT 'Base unit for this ingredient (e.g. kg, g, L, pc)',
  category     VARCHAR(80)      NULL     COMMENT 'e.g. Meat, Vegetable, Dairy, Spice',
  created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ingredient_name (name),
  INDEX idx_ingredient_category (category)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Master ingredient records';


-- ------------------------------------------------------------
-- 2. ingredient_prices
--    Price history per ingredient, per source and date.
--    Supports DTI, DA, and manual overrides.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredient_prices (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  ingredient_id    INT UNSIGNED     NOT NULL,
  price            DECIMAL(10,2)    NOT NULL COMMENT 'Price per base unit of the ingredient',
  source           ENUM('dti','da','manual') NOT NULL DEFAULT 'manual',
  provenance_note  VARCHAR(255)     NULL     COMMENT 'Free-text: URL, bulletin reference, or market note',
  extraction_date  DATE             NOT NULL COMMENT 'Date the price was published or recorded',
  is_manual        BOOLEAN          NOT NULL DEFAULT FALSE COMMENT 'TRUE if owner-entered or overridden',
  created_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_ip_ingredient
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_ip_ingredient_id   (ingredient_id),
  INDEX idx_ip_extraction_date (extraction_date),
  INDEX idx_ip_source          (source)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Price history per ingredient with source provenance';


-- ------------------------------------------------------------
-- 3. recipes
--    Menu item / dish definitions.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name         VARCHAR(150)     NOT NULL,
  description  TEXT             NULL,
  servings     INT UNSIGNED     NOT NULL DEFAULT 1 COMMENT 'Number of portions this recipe yields',
  category     VARCHAR(80)      NULL     COMMENT 'e.g. Main Course, Appetizer, Dessert, Beverage, Side Dish',
  created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_recipe_name (name)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Dish/menu item definitions with serving counts';


-- ------------------------------------------------------------
-- 4. recipe_ingredients
--    Junction table: which ingredients go into each recipe,
--    in what quantity and unit.
--
--    NOTE: `unit` here is the recipe-level unit (may differ
--    from the ingredient base unit — normalization happens
--    in the costing layer).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  recipe_id      INT UNSIGNED     NOT NULL,
  ingredient_id  INT UNSIGNED     NOT NULL,
  quantity       DECIMAL(10,4)    NOT NULL COMMENT 'Amount of this ingredient used in the recipe',
  unit           VARCHAR(30)      NOT NULL COMMENT 'Unit matching the quantity (e.g. g, kg, pc)',
  waste_pct      DECIMAL(5,2)     NOT NULL DEFAULT 0.00 COMMENT 'Trim/waste %. Effective qty = quantity / (1 - waste_pct/100)',

  PRIMARY KEY (id),
  UNIQUE KEY uq_recipe_ingredient (recipe_id, ingredient_id),

  CONSTRAINT fk_ri_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_ri_ingredient
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_ri_recipe_id     (recipe_id),
  INDEX idx_ri_ingredient_id (ingredient_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-recipe ingredient quantities and units';


-- ------------------------------------------------------------
-- 5. pricing_settings
--    Owner-defined pricing rules used by the recommendation
--    engine. Multiple profiles are supported (e.g. "Default",
--    "High-margin", "Budget").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_settings (
  id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  label                VARCHAR(100)     NOT NULL COMMENT 'Human-readable profile name (e.g. Default, High Margin)',
  target_food_cost_pct DECIMAL(5,2)     NOT NULL COMMENT 'e.g. 30.00 means 30% food cost target',
  rounding_rule        ENUM('none','nearest5','nearest10') NOT NULL DEFAULT 'none',
  created_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_label (label),

  CONSTRAINT chk_food_cost_pct
    CHECK (target_food_cost_pct > 0 AND target_food_cost_pct <= 100)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Owner-defined pricing profiles (food cost % + rounding rules)';


-- ------------------------------------------------------------
-- 6. costing_outputs
--    Computed results snapshot per recipe + pricing setting.
--    Stores the calculation at the time of computation so
--    history is preserved even when prices change later.
--
--    Formulas applied:
--      recipe_cost       = Σ (quantity × unit_price)
--      portion_cost      = recipe_cost / servings
--      recommended_price = portion_cost / (target_food_cost_pct / 100)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS costing_outputs (
  id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  recipe_id            INT UNSIGNED     NOT NULL,
  pricing_setting_id   INT UNSIGNED     NOT NULL,
  recipe_cost          DECIMAL(10,2)    NOT NULL COMMENT 'Total cost for the full recipe batch',
  portion_cost         DECIMAL(10,2)    NOT NULL COMMENT 'Cost per single serving',
  recommended_price    DECIMAL(10,2)    NOT NULL COMMENT 'Suggested selling price after applying pricing rule',
  actual_selling_price DECIMAL(10,2)    NULL     COMMENT 'Actual price the owner charges — set manually after computation',
  applied_price_source VARCHAR(50)      NULL     COMMENT 'Snapshot label: e.g. "dti:2025-06-01" or "manual"',
  computed_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_co_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_co_pricing_setting
    FOREIGN KEY (pricing_setting_id) REFERENCES pricing_settings (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_co_recipe_id          (recipe_id),
  INDEX idx_co_pricing_setting_id (pricing_setting_id),
  INDEX idx_co_computed_at        (computed_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Computed costing snapshots per recipe and pricing profile';


-- ------------------------------------------------------------
-- 7. users
--    System accounts for login and role-based access.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  username      VARCHAR(80)      NOT NULL,
  full_name     VARCHAR(150)     NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  password_hash VARCHAR(255)     NOT NULL,
  is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='System user accounts with roles';


-- ------------------------------------------------------------
-- 8. ingredient_stock
--    Current on-hand quantity per ingredient plus optional
--    low-stock alert threshold.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredient_stock (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  ingredient_id   INT UNSIGNED     NOT NULL,
  quantity        DECIMAL(10,4)    NOT NULL DEFAULT 0.0000 COMMENT 'Current quantity on hand',
  unit            VARCHAR(30)      NOT NULL COMMENT 'Unit matching ingredient base unit',
  low_stock_qty   DECIMAL(10,4)    NULL     COMMENT 'Alert fires when quantity <= this value; NULL = no alert',
  updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_ingredient (ingredient_id),

  CONSTRAINT fk_stk_ingredient
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Current stock levels per ingredient';


-- ------------------------------------------------------------
-- 9. inventory_transactions
--    Ledger of every stock change: restocks, recipe usage,
--    spoilage losses, and manual adjustments.
--    quantity > 0 = stock added; quantity < 0 = stock removed.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  ingredient_id    INT UNSIGNED     NOT NULL,
  type             ENUM('restock','usage','spoilage','adjustment') NOT NULL,
  quantity         DECIMAL(10,4)    NOT NULL COMMENT 'Positive = in, negative = out',
  unit             VARCHAR(30)      NOT NULL,
  recipe_id        INT UNSIGNED     NULL     COMMENT 'Populated when type = usage',
  batches          TINYINT UNSIGNED NULL     DEFAULT 1 COMMENT 'Recipe batches prepared',
  notes            VARCHAR(255)     NULL,
  transaction_date DATE             NOT NULL,
  created_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_it_ingredient
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_it_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes (id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  INDEX idx_it_ingredient_id (ingredient_id),
  INDEX idx_it_recipe_id     (recipe_id),
  INDEX idx_it_type          (type),
  INDEX idx_it_date          (transaction_date)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Inventory ledger — every stock change with reason and date';


SET FOREIGN_KEY_CHECKS = 1;
