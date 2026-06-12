# Smart Menu Pricing — CLAUDE.md

Persistent context for all Claude Code sessions on this project.

---

## Project Overview

**Smart Menu Pricing System** — capstone project for small restaurants in Kidapawan City, Philippines.
Helps restaurant owners calculate accurate dish costs from live market prices (DTI/DA bulletins) and
recommends selling prices based on target food-cost percentages.

- **Backend:** Node.js + Express REST API
- **Database:** MySQL (`smart_menu_pricing`)
- **Frontend:** React + Vite + Tailwind CSS v4

---

## Folder Structure

```
smart-menu-pricing/
├── backend/
│   ├── app.js                         # Express entry point
│   ├── controllers/
│   │   ├── costingController.js
│   │   ├── ingredientController.js
│   │   ├── priceController.js
│   │   ├── recipeController.js
│   │   └── settingsController.js
│   ├── routes/
│   │   ├── costing.js
│   │   ├── extraction.js
│   │   ├── ingredients.js
│   │   ├── prices.js
│   │   ├── recipes.js
│   │   └── settings.js
│   ├── services/
│   │   └── costingService.js          # Recipe cost, portion cost, recommended price, impact analysis
│   ├── middleware/                    # auth/validation middleware (future)
│   └── utils/
│       ├── db.js                      # mysql2 promise pool
│       └── extractor.js               # HTML scraping, PDF parsing, OCR, fuzzy matching
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css                  # @import "tailwindcss" at top
│   │   ├── lib/
│   │   │   └── api.js                 # axios instance → http://localhost:3000/api
│   │   ├── components/
│   │   │   └── Layout.jsx             # Sidebar nav + <Outlet />
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Ingredients.jsx
│   │       ├── Recipes.jsx
│   │       ├── RecipeDetail.jsx
│   │       ├── Extraction.jsx
│   │       ├── Costing.jsx
│   │       ├── Impact.jsx
│   │       └── Settings.jsx
│   └── vite.config.js                 # @tailwindcss/vite plugin wired in
├── database/
│   ├── schema.sql                     # full 6-table schema
│   └── seed.sql                       # 5 ingredients + prices + Default pricing profile
├── .env.example
├── .gitignore
└── CLAUDE.md
```

---

## Tech Stack

### Backend (`/backend`)

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5 | Web framework / routing |
| `mysql2` | ^3 | MySQL driver — promise pool via `utils/db.js` |
| `dotenv` | ^17 | Loads `.env` into `process.env` |
| `cors` | ^2 | Cross-origin headers for frontend dev |
| `multer` | ^2 | Multipart file uploads (PDF/image ingestion) |
| `pdf-parse` | ^2 | Extract text from DTI/DA PDF bulletins |
| `tesseract.js` | ^7 | OCR fallback for scanned/image-based PDFs |
| `fastest-levenshtein` | ^1 | Fuzzy ingredient name matching / normalization |
| `axios` | ^1 | HTTP client for scraping DTI/DA HTML pages |
| `cheerio` | ^1 | Server-side HTML parsing (jQuery-like) |

### Frontend (`/frontend`)

| Package | Purpose |
|---|---|
| `react` + `vite` | UI framework + dev server / bundler |
| `@tailwindcss/vite` + `tailwindcss` v4 | Utility CSS — no `tailwind.config.js` needed |
| `postcss` + `autoprefixer` | CSS processing pipeline |
| `axios` | HTTP calls to backend API |
| `react-router-dom` | Client-side routing |
| `recharts` | Charts for cost breakdowns and price trends |

---

## Environment Variables (`backend/.env`)

```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<password>
DB_NAME=smart_menu_pricing
```

---

## Database Tables

### 1. `ingredients`
Master ingredient list.
| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `name` | VARCHAR(150) UNIQUE | |
| `unit` | VARCHAR(30) | Base unit: kg, g, L, pc |
| `category` | VARCHAR(80) | Meat, Vegetable, Grain, etc. |

### 2. `ingredient_prices`
Price history per ingredient with source provenance.
| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `ingredient_id` | FK → ingredients | CASCADE on delete |
| `price` | DECIMAL(10,2) | Price per base unit |
| `source` | ENUM | `dti`, `da`, `manual` |
| `provenance_note` | VARCHAR(255) | URL, bulletin ref, or market note |
| `extraction_date` | DATE | Date price was published/recorded |
| `is_manual` | BOOLEAN | TRUE if owner-entered or overridden |

### 3. `recipes`
Dish / menu item definitions.
| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `name` | VARCHAR(150) UNIQUE | |
| `description` | TEXT | |
| `servings` | INT UNSIGNED | Number of portions the batch yields |

### 4. `recipe_ingredients`
Junction: which ingredients go into each recipe.
| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `recipe_id` | FK → recipes | CASCADE on delete |
| `ingredient_id` | FK → ingredients | RESTRICT on delete |
| `quantity` | DECIMAL(10,4) | Amount used in the recipe |
| `unit` | VARCHAR(30) | Recipe-level unit (may differ from ingredient base unit) |
| UNIQUE | `(recipe_id, ingredient_id)` | One row per ingredient per recipe |

### 5. `pricing_settings`
Owner-defined pricing profiles.
| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `label` | VARCHAR(100) UNIQUE | e.g. "Default", "High Margin" |
| `target_food_cost_pct` | DECIMAL(5,2) | e.g. 35.00 = 35% food cost target |
| `rounding_rule` | ENUM | `none`, `nearest5`, `nearest10` |

**Seeded default:** `{ label: 'Default', target_food_cost_pct: 35.00, rounding_rule: 'nearest5' }`

### 6. `costing_outputs`
Computed cost snapshots (history preserved even when prices change).
| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `recipe_id` | FK → recipes | CASCADE on delete |
| `pricing_setting_id` | FK → pricing_settings | RESTRICT on delete |
| `recipe_cost` | DECIMAL(10,2) | Total cost for the full batch |
| `portion_cost` | DECIMAL(10,2) | Cost per single serving |
| `recommended_price` | DECIMAL(10,2) | Suggested selling price |
| `applied_price_source` | VARCHAR(50) | Snapshot label e.g. `"dti:2025-06-01"` |
| `computed_at` | DATETIME | When the calculation was run |

---

## Key Formulas

```
Recipe Cost         = Σ (ingredient_quantity × ingredient_unit_price)
Portion Cost        = Recipe Cost ÷ servings
Recommended Price   = Portion Cost ÷ (target_food_cost_pct / 100)
Contribution Margin = Selling Price − Portion Cost
```

Rounding rules applied to `Recommended Price`: `none` (raw 2dp), `nearest5` (ceil to ₱5), `nearest10` (ceil to ₱10).

---

## API Routes

All responses follow: `{ success: true/false, data: <object|array|null>, message: '' }`

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{ status: 'ok' }` |

### Ingredients — `/api/ingredients`
| Method | Path | Description |
|---|---|---|
| GET | `/` | All ingredients ordered by name |
| GET | `/:id` | Single ingredient — 404 if missing |
| POST | `/` | Create ingredient (`name`, `unit`, `category` required) — 409 on duplicate name |
| PUT | `/:id` | Partial update — 404 if missing, 409 on duplicate name |
| DELETE | `/:id` | Delete — 404 if missing |

### Prices — `/api/prices`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Add price entry (`ingredient_id`, `price`, `source` required) — 404 if ingredient missing |
| GET | `/history/:ingredientId` | All price entries for an ingredient, newest first |
| GET | `/latest/:ingredientId` | Most recent single price entry — **404 if none** (not 200+null) |

### Recipes — `/api/recipes`
| Method | Path | Description |
|---|---|---|
| GET | `/` | All recipes ordered by name |
| GET | `/:id` | Recipe + full ingredient list via JOIN — 404 if missing |
| POST | `/` | Create recipe (`name`, `description`, `servings` required) — 409 on duplicate name |
| PUT | `/:id` | Partial update — 404 if missing, 409 on duplicate name |
| DELETE | `/:id` | Delete recipe + cascade-delete recipe_ingredients — 404 if missing |
| POST | `/:id/ingredients` | Add ingredient to recipe (`ingredient_id`, `quantity`, `unit` required) — 404 if recipe/ingredient missing, 409 if already added |
| PUT | `/:id/ingredients/:riId` | Update quantity/unit for a recipe ingredient — 404 if missing |
| DELETE | `/:id/ingredients/:riId` | Remove ingredient from recipe — 404 if missing |

### Settings — `/api/settings`
| Method | Path | Description |
|---|---|---|
| GET | `/` | All pricing profiles |
| GET | `/:id` | Single profile — 404 if missing |
| POST | `/` | Create profile (`label`, `target_food_cost_pct`, `rounding_rule` required) — 409 on duplicate label |
| PUT | `/:id` | Partial update — 404 if missing, 409 on duplicate label |
| DELETE | `/:id` | Delete profile — 404 if missing |

### Costing — `/api/costing`
| Method | Path | Description |
|---|---|---|
| POST | `/compute` | Compute cost for a recipe (`recipe_id`, `pricing_setting_id`, `price_source` required). Saves a `costing_outputs` row. Returns full breakdown including `ingredient_breakdown[]` and `missing_price_ingredients[]`. |
| POST | `/impact` | Simulate price change impact (`recipe_id`, `pricing_setting_id`, `old_prices`, `new_prices` required). Returns `old`, `new`, `diff` (with `_change` and `_pct` fields), and `ingredient_impacts[]`. |
| GET | `/history/:recipeId` | All costing snapshots for a recipe, newest first |

**`/compute` request body:**
```json
{
  "recipe_id": 1,
  "pricing_setting_id": 1,
  "price_source": "latest"
}
```
`price_source` must be one of: `latest`, `dti`, `da`, `manual`.

**`/impact` request body:**
```json
{
  "recipe_id": 1,
  "pricing_setting_id": 1,
  "old_prices": { "2": 250.00, "4": 85.00 },
  "new_prices":  { "2": 280.00, "4": 95.00 }
}
```
Keys in `old_prices` / `new_prices` are ingredient IDs as strings.

### Price Extraction — `/api/extraction`
| Method | Path | Description |
|---|---|---|
| POST | `/html` | Scrape a URL (`url`, `source` required). Fetches HTML via axios, parses price table with cheerio, fuzzy-matches to ingredients, returns `processBatch` result. |
| POST | `/upload` | Upload a file (field `file`, plus `source` in form body). Accepts HTML, PDF, PNG, JPG. PDF → pdf-parse; image → tesseract.js OCR; HTML → cheerio parse. Returns batch result. |
| POST | `/save` | Persist reviewed extraction results (`entries[]` required). Saves rows where `matched === true && flagged === false`. Returns `{ saved, skipped, skipped_entries }`. |

**`processBatch` result item shape:**
```json
{
  "raw_name": "CHICKEN BREAST (WHOLE)",
  "normalized_name": "chicken breast",
  "price": 280.00,
  "date": "2025-06-01",
  "source": "dti",
  "matched": true,
  "flagged": false,
  "ingredient_id": 2,
  "ingredient_name": "Chicken Breast",
  "match_distance": 0
}
```
`flagged: true` means the match distance exceeded the threshold and requires human review before saving.

---

## Frontend Pages

All pages use the shared `Layout.jsx` sidebar. The React Router base is `/`.

| Route | Page file | Description |
|---|---|---|
| `/` | `Dashboard.jsx` | Overview: greeting, 4 stat cards, recent computations table, price alerts |
| `/ingredients` | `Ingredients.jsx` | Ingredient CRUD table; inline price history modal with manual price entry |
| `/recipes` | `Recipes.jsx` | Recipe cards with Edit / Delete / Manage actions |
| `/recipes/:id` | `RecipeDetail.jsx` | Recipe detail; inline form to add/edit/remove recipe ingredients |
| `/extraction` | `Extraction.jsx` | Upload File tab (PDF/image/HTML) and Fetch URL tab; review table with Save to DB action |
| `/costing` | `Costing.jsx` | Compute Cost form; summary cards; ingredient breakdown table with source badges; costing history |
| `/impact` | `Impact.jsx` | Price-change simulator; pre-filled price inputs; diff summary cards; Recharts grouped bar chart; ingredient impact table |
| `/settings` | `Settings.jsx` | Pricing profile CRUD; rounding rule explanation |

---

## Response Shape Rules

Every endpoint returns exactly `{ success, data, message }`:

```js
// Success with data
{ success: true,  data: <row|rows>,  message: '' }

// Success without data (deletes)
{ success: true,  data: null,        message: 'Resource deleted' }

// Client error (400, 404, 409)
{ success: false, data: null,        message: 'Human-readable reason' }

// Server error (500) — also caught by global handler in app.js
{ success: false, data: null,        message: err.message }
```

**mysql2 type normalizations applied in controllers:**
- `DECIMAL` columns → `parseFloat()` (mysql2 returns them as strings)
- `DATE` columns → `.toISOString().slice(0, 10)` (avoids UTC timezone shift)
- `TINYINT(1)` / BOOLEAN columns → explicit `=== 1 || === true` coercion

---

## Error Handling Conventions

- `ER_DUP_ENTRY` (MySQL unique constraint) → 409 Conflict with friendly message
- Missing FK target → 404 with `'<Resource> not found'`
- Missing required fields → 400 with field list
- Global error handler in `app.js` catches any `next(err)` calls

---

## Running the Project

```bash
# Backend
cd backend && node app.js          # production
cd backend && node --watch app.js  # dev (auto-restart)

# Frontend
cd frontend && npm run dev

# Apply schema to MySQL
mysql -u root -p smart_menu_pricing < database/schema.sql

# Run seed data
mysql -u root -p smart_menu_pricing < database/seed.sql
```

---

## Evaluation Criteria

These are the acceptance thresholds defined in the capstone paper. All must be met for the system to be considered successful.

| Criterion | Metric | Threshold |
|---|---|---|
| **Extraction Accuracy** | % of scraped price rows correctly matched to the ingredients table | ≥ 90% |
| **Computation Correctness** | % of cost computations matching manual calculation by evaluator | ≥ 95% |
| **Time Efficiency** | Reduction in time to price a dish vs. the restaurant's current manual method | ≥ 20% reduction |
| **Usability (SUS)** | System Usability Scale score from respondent surveys | ≥ 68.00 (industry "Good" threshold) |
| **User Acceptance** | % of respondents rating the system as acceptable or better | ≥ 70% favorable responses |

---

## Known Limitations

Scope boundaries established in the capstone paper:

1. **Single-restaurant, single-currency** — the system is designed for one restaurant at a time; there is no multi-tenant or multi-branch support. All prices are in Philippine Peso (₱).

2. **No unit conversion engine** — recipe quantities and ingredient base units must match (e.g., both in `kg`). The system does not convert grams to kilograms or millilitres to litres automatically.

3. **No authentication or access control** — the system has no login, roles, or session management. It is intended for use on a trusted local network or single-device deployment.

4. **Extraction limited to DTI and DA bulletin formats** — the HTML scraper and PDF parser are tuned for the table structures used in Department of Trade and Industry and Department of Agriculture price bulletins. Other sources may not parse correctly without custom extractor logic.

5. **Fuzzy matching requires a populated ingredients table** — the extraction pipeline can only match scraped names to ingredients that already exist in the database. New ingredients must be added manually before their prices can be auto-matched.

6. **No real-time price feeds** — prices are updated by manually triggering an extraction or entering a price. The system does not poll sources automatically on a schedule.

7. **Offline-first assumption** — the backend is designed to run locally (`localhost:3000`). Deployment to a remote server or cloud is outside the scope of the capstone but the codebase is stateless enough to support it.
