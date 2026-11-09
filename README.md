# Smart Menu Pricing System

A web-based system that helps small restaurants in Kidapawan City, Philippines price their menu.
It reads current market prices from DA and DTI price bulletins, computes the cost of each dish
from its recipe, and recommends a selling price based on the owner's target food-cost percentage.

Capstone project. Live copy for the defense: https://smart-menu-pricing-wdeb.vercel.app

---

## What the system does

| Page | What it is for |
|---|---|
| Dashboard | Overview: counts, recent computations, price alerts |
| Ingredients | Ingredient list, price history, manual price entry |
| Market Prices | Upload a DA/DTI bulletin (PDF, image, HTML) or fetch a URL; review matched prices; save |
| Recipes / Recipe Detail | Dishes, servings, ingredients with quantities, units and waste % |
| Costing | Recipe cost, portion cost and recommended price, with an ingredient breakdown and history |
| Impact Analysis | Shows how a change in ingredient prices changes the dish cost, price and margin |
| Reports | Printable costing reports |
| Settings | Pricing profiles (target food-cost %, rounding), system reset |
| Team / Profile | User accounts and roles; own name and password |
| Help & Guide | How to use each page |

### Formulas

```
Recipe Cost        = Σ (quantity in the price unit × unit price)
                     (quantity is first divided by (1 − waste%) when a waste % is set)
Portion Cost       = Recipe Cost ÷ servings
Recommended Price  = Portion Cost ÷ (target food-cost % ÷ 100)
                     then rounded up to the next ₱5 or ₱10 if the profile says so
Margin             = Recommended Price − Portion Cost
```

Recipe units are converted to the ingredient's price unit within the same kind of unit
(g/mg/lb/oz → kg, ml/tsp/tbsp/cup → L, pcs → pc). See `backend/utils/units.js`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, Recharts 3 |
| Backend | Node.js, Express 5, JSON Web Token + bcrypt (sign-in and roles), multer (uploads) |
| Price extraction | pdf-parse (PDF), Tesseract.js (OCR for images), axios + cheerio (web pages), fastest-levenshtein (name matching) |
| Database | MySQL 8 or later (InnoDB, utf8mb4), via mysql2 |
| Online copy | Vercel (frontend), Render (backend), Aiven for MySQL (database) |

---

## Folder structure

```
smart-menu-pricing/
├── backend/                 Express REST API
│   ├── app.js               Entry point (routes, CORS, error handler, schema check)
│   ├── routes/              One file per API area (ingredients, prices, recipes, costing, extraction, ...)
│   ├── controllers/         Request handling and database queries
│   ├── services/
│   │   └── costingService.js   Recipe cost, portion cost, recommended price, impact analysis
│   ├── utils/
│   │   ├── db.js            MySQL connection pool
│   │   ├── extractor.js     Reads DA/DTI bulletins (HTML, PDF, OCR)
│   │   ├── matcher.js       Matches bulletin names to ingredients
│   │   ├── normalizer.js    Cleans up bulletin names and units
│   │   └── units.js         Unit conversion
│   ├── middleware/          Sign-in check (JWT) and admin-only check
│   └── tests/               Computation correctness test (TC01 to TC20)
├── frontend/                React app
│   └── src/
│       ├── pages/           One file per page
│       ├── components/      Layout (sidebar, mobile menu), shared parts
│       └── lib/             API client, formatting, unit conversion
└── database/
    ├── schema.sql           All tables
    ├── seed.sql             Starting data (base ingredients, Default profile, admin account)
    └── test_cases_computation.sql   The 20 computation test cases
```

---

## Running it on a computer

You need **Node.js 20.19 or later** (developed on Node 24) and **MySQL 8 or later**.

### 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE smart_menu_pricing CHARACTER SET utf8mb4"
mysql -u root -p smart_menu_pricing < database/schema.sql
mysql -u root -p smart_menu_pricing < database/seed.sql
```

The seed creates a default `admin` account. Its starting password is written in a comment in
`database/seed.sql`. Change it after the first sign-in (Profile page).

### 2. Backend

```bash
cd backend
cp .env.example .env      # then fill in DB_PASSWORD and a long random JWT_SECRET
npm install
npm start                 # runs on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:3001/api
npm install
npm run dev               # open http://localhost:5173
```

### Computation correctness test (paper Section 3.5.2)

```bash
mysql -u root -p smart_menu_pricing < database/test_cases_computation.sql
cd backend && npm run test:computation
```

Expected result: 60 of 60 computations correct (threshold 95%). Details in `backend/tests/README.md`.

---

## Scope and limitations

- One restaurant, Philippine peso only.
- Unit conversion works within the same kind of unit only (for example, grams cannot be turned into pieces).
- Extraction is tuned for the DA and DTI bulletin formats.
- Bulletin names can only be matched to ingredients that already exist in the system.
- Prices are updated when the user runs an extraction or enters a price; there is no automatic schedule.
