# Paper vs. Code Gap Analysis

**Paper:** *Smart Menu Pricing System Using Automated Ingredient Price Extraction and Recipe Cost Estimation* (Estanislao, Mearns, Pimentel, CPR2 Ch. 1–3, tracked draft, Oct 2026)
**Code:** `smart_menu_system` working tree on 2026-10-21. This includes changes not yet committed: unit conversion, waste handling and recipe photos.
**Method:** I read every section of Chapters 1–3 against the backend (`backend/`), the frontend (`frontend/src/`) and the schema (`database/schema.sql`). I checked the key divergences by running the code directly. Each finding is marked **[Verified by execution]**, **[Verified by code reading]** or **Requires Manual Inspection**.

> **Scope update (adviser guidance):** The DTI/DA extraction pipeline is out of focus. The system supports extraction, but the sources themselves are unreliable and inconsistent, so extraction quality depends on the source, not the system. The extraction findings (**H7, H8, H9, H11**, and the extraction side of **H1**) stay below for reference only and are marked *(deprioritized)*. The focus is **costing, pricing, impact analysis, and price records**. See **Focus Summary** right below.

## Focus Summary (costing, pricing, impact)

| Priority | Gap | Why it matters | Fix size |
| :--- | :--- | :--- | :--- |
| 1 | **H2**: Rounding always goes up instead of "nearest", plus a floating-point bug (₱42.00 portion at 35% gives ₱125 instead of ₱120) | Directly fails §3.5.2 computation correctness on every recipe that uses a rounding rule | Small |
| 2 | **H5**: Partial costs (missing prices) are computed, saved and recommended | Understated prices stored as normal history; contradicts §3.4.2 | Small |
| 3 | **H3**: Rounding at intermediate steps | Can exceed the ±₱0.01 tolerance in §3.5.2 on recipes with 3+ ingredients | Small |
| 4 | **H4**: Waste formula not in the paper | Cases with waste > 0 can't be reproduced from §3.3; use 0% waste in the 20 test recipes, add the formula in the camera-ready version | None (procedure) |
| 5 | **H10**: Impact analysis is per recipe, not "which menu items are most affected" | Objective 4, §3.3 layer 7 and §3.8.9 all claim it | Moderate |
| 6 | **Contribution margin** (Impact): uses the recommended price, not the actual selling price | The paper defines CM as selling price − portion cost | Small |
| 7 | **H6**: Outdated-price rules (the manual 30-day rule still applies without DTI/DA) | §3.4.2 says outdated prices are labeled in the price list and costing results | Moderate |
| 8 | Manual price has no "market purchase / supplier quotation" field | §3.4.2 and §3.4.3 say manual prices carry this source | Small |
| 9 | Costing snapshot traceability: records the compute date, not which prices were used | §2.7 and §3.8.8 traceability claims | Small–moderate |
| 10 | Ingredient unit can be edited after prices exist, which silently reinterprets stored prices | Can produce wrong costs (e.g. ₱/kg read as ₱/g) | Small |
| 11 | Reset leaves inventory data and loads demo "manual" prices | §3.4.6 step 5 and §3.7.5 require each restaurant's data to be removed | Small |

### Fix status (2026-10-21)

Code-only fixes. The paper is unchanged: each one makes the code do what the paper already states.

| Gap | Status | What changed |
| :--- | :--- | :--- |
| **H2** rounding | ✅ Fixed | Nearest ₱5/₱10 (half up), free of floating-point error. `costingService.js` `applyRoundingRule` |
| **H3** intermediate rounding | ✅ Fixed | Full precision through recipe cost and portion cost; only the final price uses the rounding rule. `costingService.js` `computePricing` |
| **H5** partial costs | ✅ Fixed | When any ingredient has no price, nothing is saved and no price is recommended; Costing and batch say which ingredients need a price. `costingController.js` `costRecipe` |
| Contribution margin | ✅ Fixed | CM = selling price − portion cost, using the saved menu price when there is one (otherwise the recommended price). `computeImpactAnalysis`; `Impact.jsx` card |
| Manual price source | ✅ Fixed | "Market purchase / Supplier quotation" field on both price forms, stored in `provenance_note` and shown in price history. `Ingredients.jsx` |
| Snapshot traceability | ✅ Fixed | New `costing_outputs.price_snapshot` (JSON): each ingredient's price ID, source, date, unit price and cost. Added automatically at startup |
| Ingredient unit edits | ✅ Fixed | The unit can't be changed once prices exist (409 with an explanation). `ingredientController.js` |
| Reset | ✅ Fixed | Also clears inventory tables; uses `DELETE` so a failure rolls back; demo prices labeled "Sample price (demo data)". `routes/reset.js`, `seed.sql` |
| Inventory module (matrix row) | ℹ️ Note | Its API isn't mounted in `app.js` and the page is removed from the menu, so it isn't reachable in the running system |

**Verification:** Compared `computePricing` with an exact-arithmetic (BigInt) version of the paper's formulas on 20,000 random recipes (60,000 values): **0 mismatches**. The old logic was outside ±₱0.01 on 7,804 of 60,000 values (87.0%), which is below the 95% threshold in §3.5.6. The API checks (compute, missing prices, batch, contribution margin, manual source, unit guard, reset) ran against a throwaway copy of the database and all passed.

Still open: **H4** (use 0% waste in the 20 test recipes), **H6** (outdated-price labels), **H10** (cross-recipe impact).

**Defense line for extraction, if it comes up:** "The system extracts from HTML, text PDFs and images, and every extracted row goes through human review before it is saved. Because the DTI and DA publications are inconsistent in format and coverage (§1.5 Limitations), owners can replace any reference price with a manual price, and that is the path used in our evaluation."

---

## 1. High-Risk Reviewer Vulnerabilities (Critical Gaps)

### H1. Extracted prices are saved without converting units *(deprioritized: extraction)*
- **Paper:** §3.4.2 *Units*: "Before costing, the normalization module converts each price to the unit used in the recipe." §3.3 layer 3 and §3.8.7: the module "standardizes units of measurement, converts values into comparable forms".
- **Code:** `backend/routes/extraction.js` `/save` (lines 162–175) inserts `entry.price` exactly as extracted. The extracted unit (`normalized_unit`) is never compared with the ingredient's own unit (`ingredients.unit`). Nothing is converted, and the `ingredient_prices` table has no unit column to record which unit the price was for.
- **Reviewer critique:** "A DA price of ₱180/kg matched to an ingredient whose base unit is `g` is stored as ₱180 per gram, which inflates that ingredient's cost 1,000×. DTI per-SKU prices (per 155 g can) are stored with no net-weight normalization." **[Verified by code reading]**
- Unit conversion does exist, but only at costing time (`backend/utils/units.js`). It converts recipe quantities to the ingredient's unit, not extracted prices.

### H2. The ₱5/₱10 rounding rule differs from the paper and has a floating-point bug
- **Paper:** §3.3 layer 6: "rounding rule (none, nearest ₱5, or nearest ₱10)".
- **Code:** `backend/services/costingService.js` lines 153, 155 (`computeRecommendedPrice`) and 182–183 (`_applyRoundingRule`) use `Math.ceil`, which always rounds **up**.
- **Reviewer critique 1 (semantic):** Raw ₱40.82 becomes ₱45 in the system but ₱40 under "nearest ₱5". Raw ₱95.24 becomes ₱100 instead of ₱95. Every recipe that uses a rounding rule can fail the correctness test in §3.5.2. **[Verified by execution]**
- **Reviewer critique 2 (bug):** At the seeded Default profile (35%), floating-point division pushes exact multiples just above the boundary. Portion ₱42.00 gives raw 120.00000000000001, which becomes ₱125 when the correct answer is ₱120. **26 portion values between ₱0.01 and ₱200** fail at 35%. Even the code's own "round up" intent is wrong for these values. **[Verified by execution]**

### H3. Costs are rounded at intermediate steps, which the paper forbids
- **Paper:** §3.3 layer 6: the rounding rule "is applied only to the final recommended price and **never to intermediate values** such as recipe cost or portion cost."
- **Code:** `costingService.js` rounds each ingredient's cost to 2 decimals (line 81), then the recipe cost (line 111), then the portion cost (line 132). The recommended price is then computed from the already-rounded portion cost (lines 135–157). The Impact path repeats this (lines 205, 212, 214).
- **Reviewer critique:** With ₱100 over 3 servings at 35% and no rounding rule, the system gives **₱95.23** while a hand calculation without intermediate rounding gives **₱95.24**. That is inside the ±₱0.01 tolerance, but per-ingredient rounding adds up. A recipe with *n* ingredients can drift by up to *n* × ₱0.005, which exceeds ₱0.01 at 3 or more ingredients. **[Verified by execution]**

### H4. The waste/yield formula is in the code but not in the paper
- **Paper:** §3.3 layer 5 and §3.8.4: `Recipe Cost = Σ (Ingredient Quantity × Ingredient Unit Price)`. The words "waste", "yield" and "trim" appear nowhere in Chapters 1–3.
- **Code:** `costingService.js` lines 70–72 and 197–199 apply `effective_qty = quantity ÷ (1 − waste_pct/100)`. The column is `recipe_ingredients.waste_pct`, and the Recipe Detail and Costing UIs expose it.
- **Reviewer critique:** "Recipe costs with waste > 0 cannot be reproduced from the published formula." Example: 1 kg garlic at ₱120/kg with 5% waste gives ₱126.32 in the system but ₱120.00 under the paper. **[Verified by execution]**

### H5. Partial costs are saved and shown as recommendations
- **Paper:** §3.4.2 *Unavailable prices*: an ingredient with no reference price "is flagged … and the user enters a manual price". There is no mention of computing a price from incomplete data.
- **Code:** `backend/controllers/costingController.js` lines 22–25 (compute) and 257–260 (batch) add up **only the ingredients that have prices**. The result is then saved to `costing_outputs` with a recommended price (lines 55, 271). The service itself returns `recipe_cost = null` when any price is missing (`costingService.js` line 109), and the controller overrides that.
- **Reviewer critique:** "The recommended price for a recipe missing one ingredient's price is understated and still stored in history as a normal snapshot." The response message says "Partial costing", but the saved row is not marked as partial. **[Verified by code reading]**

### H6. The outdated-price rules in §3.4.2 are not implemented
- **Paper:** §3.4.2 *Outdated prices*: flag DA prices older than **7 days**, DTI older than **180 days**, manual older than **30 days**. "Outdated prices are labeled **in the price list and in the cost computation results**." §3.4.6 step 3 relies on these rules before each session.
- **Code:** `frontend/src/pages/Dashboard.jsx` lines 120 and 229 use **one** threshold for every source (`prefs.alertThresholdDays ?? 7`), and only on the Dashboard. There are no source-specific limits and no "outdated" label in `Ingredients.jsx` (the price list) or `Costing.jsx` (the computation results). The backend has no outdated logic at all.
- **Reviewer critique:** "Section 3.4.2 describes a validity policy that the prototype does not enforce. A DTI price 30 days old shows as outdated, and a manual price 25 days old does not." **[Verified by code reading]**

### H7. Scanned PDFs never fall back to OCR *(deprioritized: extraction)*
- **Paper:** §1.5 *Technical Approach*: "If the source is an image **or a scanned document** … the system will use OCR". §3.3 layer 2 and §3.8.6 describe OCR as the fallback.
- **Code:** `backend/utils/extractor.js` `extractFromPDF` (lines 217–228) only calls `pdf-parse`. A scanned PDF has no text layer, so it returns 0 rows with `success: true`. OCR (`extractFromImage`) runs only for `.png`/`.jpg` uploads (`routes/extraction.js` lines 116–129).
- **Reviewer critique:** "Upload a scanned DA bulletin PDF: the system reports 'Extracted 0 rows' and never tries OCR." **[Verified by code reading]**

### H8. The PDF/OCR line parser breaks on common bulletin layouts *(deprioritized: extraction)*
- **Paper:** §3.4.2: the module "identifies columns with headers such as commodity, price, and SRP". §3.5.1 requires 50 entries with the name, unit, price, source and date all correct.
- **Code:** `extractor.js` lines 181–213. There is no column detection for PDFs or images. Each line is kept only if it matches a standalone unit token, and the price is the **first** 1–5 digit number on the line.

  | Bulletin line (realistic shape) | Result |
  | :--- | :--- |
  | `Sardines in Tomato Sauce  Ligo  155g  22.50` | **Dropped**: "155g" is not a standalone unit |
  | `Evaporated Milk  Alaska  370ml  45.75` | **Dropped** |
  | `Whole Chicken (Dressed)  180.00  190.00` (DA style, unit only in the header) | **Dropped** |
  | `Instant Noodles  Lucky Me  55 g  9.50` | Kept, but price = **55** (the net weight), not 9.50 |
  | `Pork Liempo  kg  1,350.00` | Kept, but price = **1** (the comma splits the number) |

  **[Verified by execution on synthetic lines; Requires Manual Inspection against the actual DA Daily Price Index and DTI SRP PDFs you will use in §3.5.1]**
- The repository's test file `database/dti_srp_sample.pdf` parses well (23 rows) because it is a clean, made-up layout. It says "Region XII" and lists fresh chicken, pork and beef. That **contradicts the paper's own description of the DTI bulletin** (§3.4.2: nationwide, packaged goods only; §3.5.7: "the DTI SRP bulletin does not cover fresh chicken"). Do not present it as a real DTI bulletin during the defense.

### H9. Variant names collapse into one ingredient during matching *(deprioritized: extraction)*
- **Paper:** §2.6 and §3.8.7: entity matching aligns labels "to one standardized record so that recipe costing remains correct".
- **Code:** `backend/utils/normalizer.js` lines 18–23 and `matcher.js` lines 4–10 strip everything in brackets before matching.
- **Reviewer critique:** `Pork (kasim)` ₱270, `Pork (liempo)` ₱290 and `Pork (pigue)` ₱260 all normalize to "pork" and compete for the same ingredient. `Chicken (whole, dressed)` becomes "chicken". The "name" field in §3.5.1 then no longer matches the validated value. **[Verified by execution on `dti_srp_sample.pdf`]**

### H10. Impact analysis covers one recipe at a time, not "which menu items are most affected"
- **Paper:** Objective 4 (§1.3): "how specific ingredient price shifts affect **each menu item**". §3.3 layer 7: "helps users identify **which menu items are most affected**". §3.8.9: "which recipes are most affected".
- **Code:** `POST /api/costing/impact` (`costingService.js` `computeImpactAnalysis`, line 228) and `frontend/src/pages/Impact.jsx` take **one** `recipe_id`. No view takes a single ingredient price change and ranks every affected recipe.
- **Reviewer critique:** "Show me which dishes are hurt most if garlic rises 20%." The system cannot do this in one step. **[Verified by code reading]**

### H11. Flagged rows cannot be confirmed and saved *(deprioritized: extraction)*
- **Paper:** §3.3 layer 2: "entries marked for review or rejected are **not saved without confirmation from the user**", which implies they can be saved once confirmed.
- **Code:** `routes/extraction.js` lines 147–148 save only rows where `matched === true && flagged === false`. The Extraction page says flagged rows "will be skipped when you save" (`Extraction.jsx` line 748). There is no confirm, override or re-match action.
- **Reviewer critique:** "A correct DA price with a slightly different name ('Tomato' at distance 4) can never be saved through the extraction workflow." **[Verified by code reading]**

---

## 2. Full Feature & Implementation Coverage Matrix

| Paper Claim / Section | System Status | Exact File / Function / Line | Risk Level & Explanation |
| :--- | :--- | :--- | :--- |
| Recipe Cost = Σ(Qty × Unit Price) — §3.3 L5, §3.8.4 | **Divergence** (adds waste factor and unit conversion) | `costingService.js` `computeRecipeCost` L70–81 | **High.** See H4. Unit conversion is defensible (§2.6, §3.4.2); waste is not documented. |
| Portion Cost = Recipe Cost ÷ Servings — §3.3 L5 | **Exact Match** (but rounded to 2 dp) | `costingService.js` `computePortionCost` L122–132 | **Med.** Formula matches; intermediate rounding conflicts with §3.3 L6 (H3). |
| Recommended Price = Portion ÷ (Target% ÷ 100) — §3.3 L6, §3.8.4 | **Exact Match** (formula) | `costingService.js` `computeRecommendedPrice` L135–157 | **Med.** Uses the rounded portion cost as input (H3). |
| Rounding: none / nearest ₱5 / nearest ₱10, final value only — §3.3 L6 | **Divergence** | `costingService.js` L153, L155, L182–183 | **High.** Ceiling instead of nearest, plus a floating-point bug (H2). |
| Contribution Margin = Selling Price − Portion Cost — Terms, §3.3 L7 | **Divergence** | `Impact.jsx` L369–374; `costingService.js` `computeContributionMargin` L176 (never called) | **Med.** The Impact "Margin Impact" card is Δrecommended − Δportion. It uses the recommended price as the selling price and ignores the saved menu price (`actual_selling_price`). The service helper is dead code. |
| Food Cost % = Portion ÷ Selling Price — Terms | **Exact Match** (display) | `Costing.jsx` stat tiles; `Dashboard.jsx` L424 | **Low.** |
| Unit normalization (kg, g, L, ml → base unit) — §2.6, §3.3 L3, §3.4.2 | **Divergence** (only at costing time, not at extraction) | `utils/units.js`; `extraction.js` `/save` L162–175 | **High.** See H1. |
| HTML parsing with cheerio — §3.3 L2, Table 3.1 | **Exact Match** | `extractor.js` `parseHTMLString` L74–109 | **Low.** Note the unstated defaults: price column = 2 and unit column = 1 when headers aren't found (L67–68), and a missing unit silently becomes `'kg'` (L100). |
| Text PDF parsing with pdf-parse — §3.3 L2 | **Divergence** (regex per line, no column detection) | `extractor.js` `extractFromPDF` L217–228, `parsePriceLine` L187–204 | **High.** See H8. |
| OCR with Tesseract.js for images and scanned docs — §1.5, §3.3, §3.8.6 | **Incomplete** (images only) | `extractor.js` `extractFromImage` L235–250 | **High.** See H7. |
| "Identifies columns with headers such as commodity, price, and SRP" — §3.4.2 | **Exact Match for HTML / Missing for PDF and OCR** | `extractor.js` `detectColumns` L59–70 | **Med.** |
| Extracted fields: name, unit, price, source, date — §3.3 L2, §3.5.1 | **Incomplete** (unit not saved) | `schema.sql` `ingredient_prices` L34–56 (no unit column) | **Med.** The unit appears in the review table but is never stored, so the "unit" field in §3.5.1 can only be checked on the review screen. |
| Source label assigned by the user — §3.4.2 | **Exact Match** | `extraction.js` L37, L46, L78 | **Low.** The `manual` value is also accepted for extraction, which the paper doesn't mention. |
| Date not detected → assumed as extraction date, flagged — §3.3 L3 | **Exact Match** | `extractor.js` L52–55, L221–223; flag `date_assumed` | **Low.** Takes the **first** date anywhere in the document (L35–47), which could be a footer or "posted on" date. |
| Levenshtein matching — §3.3 L3, §3.8.7 | **Exact Match** (algorithm); thresholds not stated in the paper | `matcher.js` L12–35 | **Med.** Distance ≤3 = matched, 4–6 = needs review, >6 = no match. These are absolute character counts, so short names are fragile (e.g. "beef" vs "beer" = 1). |
| Classification: ready / needs review / rejected — §3.3 L3 | **Divergence** (labels) | `Extraction.jsx` L34–43 ("Matched", "Partial", "No match", "Needs review") | **Low.** Map the terms in the defense. |
| Review/rejected entries need user confirmation to save — §3.3 L3 | **Divergence** (can never be saved) | `extraction.js` L147–148; `Extraction.jsx` L748 | **Med.** See H11. |
| Validation: missing units, unusual values — §2.6, §3.3 L3 | **Partial** | `normalizer.js` L29–39 | **Med.** Flags a missing unit, price 0, or price above ₱5,000 (unstated threshold). No check for unusually *low* prices. |
| Duplicate / repeated entries flagged — §2.6, §3.8.7 | **Missing in Code** | `extraction.js` `/save` | **Med.** Saving the same bulletin twice inserts duplicate price rows. |
| Provenance (source + date, traceable origin) — §2.1, §2.6, §3.3 L2 | **Partial** | `extraction.js` L171 (`provenance_note = 'auto-matched from "…"'`) | **Med.** The source URL and file name are not stored, so a price can't be traced back to a specific bulletin. |
| Manual price with its source (market purchase / supplier quotation) and date — §3.4.2, §3.4.3 | **Partial** | `Ingredients.jsx` L205–211 (sends `source: 'manual'` with no `provenance_note`) | **Med.** No field to record market purchase vs. supplier quotation. |
| User selects the applied price (official vs. manual) — §2.1 | **Exact Match** | `costingService.js` L45–58; `Costing.jsx` Price Source select | **Low.** |
| Outdated prices: DA 7 d / DTI 180 d / manual 30 d, labeled in the price list and costing results — §3.4.2 | **Missing in Code** (one 7-day Dashboard warning) | `Dashboard.jsx` L120, L229 | **High.** See H6. |
| Unavailable prices flagged; user enters manual — §3.4.2 | **Partial** | `costingController.js` L18–25 | **High.** Flagged in the response, but a partial cost is still computed and saved (H5). |
| Centralized MySQL storage of ingredients, price history, recipes, servings, settings, costing outputs — §2.7, §3.3 L4, §3.8.8 | **Exact Match** | `database/schema.sql` | **Low.** |
| Costing snapshots traceable over time — §2.7, §3.8.8 | **Partial** | `costingController.js` L53 (`applied_price_source = "<source>:<compute date>"`) | **Med.** The snapshot records the compute date, not the date or ID of each price used. Per-ingredient breakdowns are not saved. |
| Recommendation not enforced; owner decides — §2.3, §3.3 L6, §3.8.3 | **Exact Match** | `costing_outputs.actual_selling_price`; `PATCH /costing/:id/actual-price` | **Low.** |
| Impact analysis: updated recipe cost, portion cost, recommended price, CM differences — §3.3 L7 | **Partial** | `computeImpactAnalysis` L228–290; `Impact.jsx` | **Med.** Per-recipe only (H10); CM definition differs (see the CM row above). |
| Impact: identify most-affected menu items — §1.2 #5, §3.3 L7, §3.8.9 | **Missing in Code** | — | **High.** See H10. |
| Admin tools for ingredients, recipes, pricing settings — §3.2.1 #6, §3.3 final layer | **Exact Match** | `routes/ingredients.js`, `routes/recipes.js`, `routes/settings.js` | **Low.** |
| "Authorized users / authorized staff" — §3.3 L1, final layer | **Exact Match** | `middleware/auth.js`, `middleware/requireAdmin.js`, `routes/auth.js`, `routes/users.js` | **Low.** The project's `CLAUDE.md` still says "No authentication", but the paper is consistent with the code. |
| Stack: Node + Express, React + Vite, Tailwind CSS v4, MySQL — §1.5, §3.2.2, Table 3.1 | **Divergence** (Tailwind barely used) | `frontend/src/index.css` L1 (`@import "tailwindcss"`); ~1,289 inline `style={{}}` blocks vs. 3 Tailwind utility classes | **Low–Med.** A reviewer reading the frontend will see that Tailwind isn't really the styling method. |
| cheerio / pdf-parse / Tesseract.js — Table 3.1 | **Exact Match** | `backend/package.json` (pdf-parse **1.1.4**, not ^2 as `CLAUDE.md` says) | **Low.** |
| Researchers remove each restaurant's data after a session — §3.4.6 step 5, §3.7.5 | **Partial** | `routes/reset.js` L16–24 | **Med.** Reset clears recipes, prices and costing, but **not** `ingredient_stock` or `inventory_transactions`. It also reloads demo prices labeled "Divisoria vegetable stall" etc. (L39–45) as `manual` prices. The `TRUNCATE` calls inside the transaction commit immediately, so a failed reset can leave partial deletions. |
| Database stored locally on the researchers' laptop — §3.7.5 | **Requires Manual Inspection** | `frontend/vercel.json`; `.env.example` (`DB_HOST=localhost`) | **Med.** A Vercel deployment config exists. If any evaluation uses a hosted backend or database, that contradicts §3.7.5. |
| Time-efficiency task: update a price, then see the updated recipe and portion cost — §3.5.3 | **Exact Match** (workflow possible) | `Ingredients.jsx` (add price) → `Costing.jsx` (Compute) | **Low.** Takes two pages and a manual Compute click, so it adds to the timed duration. |
| Unit conversion of prices when ingredient units are edited | **Extra hazard in code** | `ingredientController.js` L52–55 | **Med.** An ingredient's base unit can be changed after prices exist, which silently reinterprets every stored price (₱/kg becomes ₱/g). |
| Inventory module (stock, restock, use-recipe) | **Extra in Code** | `routes/inventory.js`, `controllers/inventoryController.js`, tables `ingredient_stock`, `inventory_transactions` | **Med.** Not in the scope (§1.5) or objectives. §1.5 says the system "does not fully replace … POS operations". Be ready to explain it as an add-on outside the evaluation. |
| Batch "Compute All", Reports page, CSV export, data reset, user management, recipe photos | **Extra in Code** | `costingController.js` `computeBatch`, `getSummary`; `routes/export.js`; `routes/reset.js`; `routes/users.js`; `recipes.image_data` | **Low.** Supporting features; none contradicts the paper. |
| Extraction from a URL that links to a PDF (follows the first PDF link) | **Extra in Code** | `extractor.js` `findDocumentLinks`, `extractFromHTML` L152–172 | **Low.** Undocumented behavior; only the first PDF link is used. |

---

## 3. Hyperparameter & Configuration Audit

None of these values appear in the paper. A reviewer can fairly ask for the ones marked ⚠.

| Parameter | Value in code | Location | Paper says |
| :--- | :--- | :--- | :--- |
| ⚠ Levenshtein "matched" threshold | distance ≤ 3 (absolute) | `matcher.js` L31 | Not stated |
| ⚠ Levenshtein "needs review" band | 4–6; >6 = no match | `matcher.js` L28, L34 | Not stated |
| ⚠ Name normalization | lowercase; **delete everything in brackets**; non-alphanumerics → space | `normalizer.js` L18–23, `matcher.js` L4–10 | "standardizes … matched records" |
| ⚠ "Unusual price" threshold | > ₱5,000 or = 0 | `normalizer.js` L36 | "unusually high or low values" (§2.6) |
| ⚠ Default unit when the HTML unit is missing | `'kg'`, **not flagged** | `extractor.js` L100 | Not stated. A silent assumption that affects the §3.5.1 unit field. |
| HTML header keywords | commodity, price, unit, item, description, classification, variety | `extractor.js` L11 | "commodity, price, and SRP" |
| HTML column fallbacks | price = column 2, unit = column 1 | `extractor.js` L67–68 | Not stated |
| PDF/OCR unit tokens | kg, g, mL/ml, L, pc/pcs, bundle, pack | `extractor.js` L181 | Not stated. Excludes can, bottle, sachet, tray, dozen, which DTI uses. |
| PDF/OCR price pattern | first 1–5 digit number, optional 1–2 decimals | `extractor.js` L183 | Not stated |
| OCR language / whitelist | `eng`; A–Z a–z 0–9 space ₱ / . , ( ) - | `extractor.js` L232–239; `backend/eng.traineddata` | "Tesseract.js" |
| Date formats detected | YYYY-MM-DD, YYYY/MM/DD, "11 June 2026", "June 11, 2026" (first match wins) | `extractor.js` L34–49 | "marking entries where the bulletin date could not be detected" |
| Upload limits | 10 MB; .html .htm .pdf .png .jpg .jpeg | `extraction.js` L12, L35 | Not stated |
| Network timeouts | 20 s (page), 30 s (linked PDF) | `extractor.js` L141, L131 | Not stated |
| ⚠ Rounding implementation | `Math.ceil` (always up) | `costingService.js` L153–155, L182–183 | "nearest ₱5 / nearest ₱10" |
| ⚠ Intermediate precision | 2 dp per ingredient, recipe and portion | `costingService.js` L81, L111, L132, L205, L212, L214 | "never to intermediate values" |
| ⚠ Waste formula | qty ÷ (1 − waste%/100) | `costingService.js` L70–72, L197–199 | Not in the paper |
| Unit conversion factors | g 0.001, mg 1e-6, lb 0.453592, oz 0.0283495, ml 0.001, tsp 0.00492892, tbsp 0.0147868, cup 0.236588, … | `backend/utils/units.js` (mirrored in `frontend/src/lib/units.js`) | "converting values into a base unit" |
| Costing de-duplication | Doesn't save a new snapshot if recipe, portion and recommended values all differ by < ₱0.005 from the last one | `costingController.js` L45–49 | Not stated. History can show fewer rows than compute runs. |
| ⚠ Outdated-price threshold | one value, 7 days (user preference), Dashboard only | `Dashboard.jsx` L120 | DA 7 d / DTI 180 d / manual 30 d |
| Seeded pricing profile | Default, 35%, `nearest5` | `database/seed.sql`; `routes/reset.js` L55–58 | Example targets only |
| Seeded "manual" prices with market notes | Rice ₱52 "NFA accredited rice retailer", Garlic ₱120 "Divisoria vegetable stall", … | `routes/reset.js` L39–45 | §3.4.6: the prototype must contain no data from other restaurants |
| Auth token lifetime | JWT 8 h | `authController.js` L31 | Not stated |
| CORS | `*` unless `ALLOWED_ORIGIN` is set | `backend/app.js` | Not stated. Relevant to §3.7.5 data protection. |
| Request body limit | 50 MB (for recipe photos) | `backend/app.js` | Not stated |

---

## 4. Input/Output & Pipeline Logic Verification

**Execution order (paper §3.3 layers 1 → 7) vs. code:**

| Layer | Paper | Code path | Verdict |
| :--- | :--- | :--- | :--- |
| 1 Input | DTI, DA, manual | `POST /api/extraction/html` · `/upload` · `POST /api/prices` | Match |
| 2 Extraction & validation | Rule-based first, OCR only for image or non-copyable sources | Routed **by file type**: `.pdf` → pdf-parse only; image → OCR | Divergence: no "try text, then OCR" fallback (H7) |
| 3 Normalization | Units, decimals, Levenshtein matching, flagging, date assumed, ready/review/rejected | `normalizer.js` → `matcher.js` → `processBatch` | Partial: no unit conversion against the ingredient (H1), brackets stripped (H9), no duplicate check |
| 4 Storage | MySQL | `POST /api/extraction/save` → `ingredient_prices` | Partial: unit and source URL not persisted |
| 5 Costing | Σ(qty × price); ÷ servings | `computeRecipeCost` + controller partial sum | Divergence: waste (H4), partial sums (H5), intermediate rounding (H3) |
| 6 Recommendation | Portion ÷ (target/100), rounding on the final value only | `computeRecommendedPrice` | Divergence: ceiling and floating-point bug (H2) |
| 7 Impact | Recipe/portion/recommended deltas, CM differences, most-affected items | `computeImpactAnalysis` + `Impact.jsx` | Partial (H10, CM definition) |

**API response format:** Every route returns `{ success, data, message }`, which matches the project convention (the paper doesn't specify one). Exceptions to note:
- `POST /api/extraction/save` returns HTTP **207** on success (`extraction.js` L188). That's a non-standard status for a plain JSON body. Harmless, but a reviewer may ask.
- `POST /api/extraction/upload` with a scanned PDF returns `success: true` with an empty array instead of an error or an OCR retry (H7).

**Edge cases:**

| Case | Behavior | Verdict |
| :--- | :--- | :--- |
| Ingredient missing a price for the selected source | Partial cost computed and **saved** | Conflicts with §3.4.2 (H5) |
| Recipe unit can't convert to the price unit (e.g. g vs pcs) | 400 with a clear message; adding such an ingredient is blocked | Sensible, but undocumented |
| Servings = 0 | Error | OK |
| Extracted "n/a" price | HTML: row skipped. PDF: line dropped | Consistent with §3.4.2 "no reference price is assigned" |
| Bulletin date not found | Today's date used, flagged `date_assumed` | Match |
| Same bulletin saved twice | Duplicate price rows | Missing (duplicate check) |
| Ingredient base unit edited after prices exist | Historical prices silently reinterpreted | Hazard |
| Same ingredient listed twice in a recipe | Blocked (UNIQUE constraint → 409) | OK |

**Requires Manual Inspection:**
1. Run §3.5.1 on the **actual** DA Daily Price Index and DTI SRP PDFs you plan to use, not on `database/dti_srp_sample.pdf`.
2. Confirm whether evaluation sessions use a local backend and database only (§3.7.5) or the Vercel-hosted frontend.
3. Re-check the Figure 3.1 architecture diagram against the routing in Section 4 above. The PDF text extract does not include the figure.
4. Confirm whether a rejected extraction can be fixed and saved anywhere outside the Extraction page (e.g. by adding a manual price), and decide how to describe "confirmation" in the defense.

---

## 5. Defense & Q&A Strategy Guide

Each item gives a justification you can use now, then a code patch that makes the system follow the paper exactly. Patches are small unless noted.

**H1 — Extracted prices not unit-converted**
- *Justification:* "Conversion is applied at costing time: recipe quantities are converted into each ingredient's price unit (`utils/units.js`), which is mathematically equivalent to converting the price into the recipe unit (§3.4.2). For the evaluation, ingredients are encoded in the same unit as the bulletin (kg for DA, per SKU for DTI)."
- *Patch:* In `/save`, look up `ingredients.unit`, compute `getConversionFactor(ingredient.unit, entry.normalized_unit)`, and save `price × factor`. Flag rows where the units can't convert. Add a `unit` column to `ingredient_prices` so the source unit is kept.

**H2 — Ceiling rounding and floating-point bug**
- *Justification:* "Rounding up is a deliberate pricing safeguard so a menu price never falls below the target food cost." This doesn't cover the floating-point bug, so fix it regardless.
- *Patch:* `Math.round(raw / 5) * 5` (and the ₱10 version) in both `computeRecommendedPrice` and `_applyRoundingRule`. If you keep rounding up, use `Math.ceil(Number((raw / 5).toFixed(9))) * 5` to remove the floating-point error. Change both functions so they can't drift apart.

**H3 — Intermediate rounding**
- *Justification:* "Stored values are rounded to centavos for display and storage. The ±₱0.01 tolerance in §3.5.2 covers this."
- *Patch:* Compute with full precision through ingredient cost, recipe cost and portion cost. Round only for display, for the stored `DECIMAL(10,2)` values, and at the final rounding rule. Base `computeRecommendedPrice` on the unrounded portion cost.

**H4 — Waste formula not in the paper**
- *Justification:* "Waste % is optional and defaults to 0%, where the formula reduces exactly to §3.3 layer 5. It applies the standard yield-based method in the cited source [3] (Egan, Ch. 7: yield %, EP cost = AP cost ÷ yield %). The 20 correctness cases in §3.5.2 use 0% waste."
- *Patch (for strict replication):* Add a feature flag (e.g. `WASTE_ENABLED=false`) that treats `waste_pct` as 0 during evaluation, or set waste to 0 in the 20 test recipes. *Camera-ready:* add the Effective Quantity formula to §3.3 and §3.8.4 (text drafted earlier in this session).

**H5 — Partial costs saved**
- *Justification:* "The system shows a partial-costing warning listing the ingredients with no price, so the owner can add manual prices before relying on the result."
- *Patch:* In `computeCosting` and `computeBatch`, don't insert into `costing_outputs` (and return no recommended price) when `missing_price_ingredients.length > 0`. Alternatively, add an `is_partial` column and show it in history.

**H6 — Outdated-price rules**
- *Justification:* "The Dashboard flags prices older than a configurable number of days, and every price shows its source and date in the price list."
- *Patch (moderate):* Add a shared helper `isOutdated(source, date)` that returns true when the price is older than `{da: 7, dti: 180, manual: 30}[source]` days. Return `is_outdated` from `/prices/latest`, `/prices/history` and each `ingredient_breakdown` row. Show an "Outdated" badge in `Ingredients.jsx` and the `Costing.jsx` breakdown, and use the same helper on the Dashboard instead of the single threshold.

**H7 — No OCR fallback for scanned PDFs**
- *Justification:* "Scanned bulletins can be uploaded as images (PNG/JPG), which go through OCR. Official DA and DTI PDFs are text-based."
- *Patch (moderate):* In `extractFromPDF`, if `parsed.text.trim().length < 50` or no rows come out, render the pages to PNG and send them through `extractFromImage`. pdf-parse 1.1.4 can't render pages, so this needs an added library.

**H8 — PDF/OCR line parser**
- *Justification:* "The parser is rule-based as described in §1.5 and was tuned on the bulletin layouts used in the study. Rows it can't parse are flagged or left out rather than saved wrongly. Every saved entry passes through human review."
- *Patch (moderate):* Strip thousands separators before matching numbers. Treat units glued to numbers (`155g`, `370ml`) as part of the item description. Take the **last** price-like number on the line as the price. Accept a header-level unit ("Price/kg") when a row has none. Add DTI unit words (can, bottle, sachet, pouch, tray, dozen). Test against the real §3.5.1 PDFs.

**H9 — Variant collapse**
- *Justification:* "Variants are deliberately routed to review so the owner chooses which cut matches their ingredient." This only holds if they actually end up flagged.
- *Patch:* Keep bracketed qualifiers in `normalized_name` (drop only punctuation). Or match against both forms, and flag a row whenever two or more extracted rows match the same ingredient.

**H10 — No cross-recipe impact**
- *Justification:* "Impact analysis is run per menu item. The Reports page summarizes all recipes after a price update, which shows which items need repricing."
- *Patch (moderate):* Add an endpoint `POST /api/costing/impact-by-ingredient` that takes `{ ingredient_id, new_price, pricing_setting_id }`, runs `computeImpactAnalysis` for every recipe using that ingredient, and returns the results sorted by portion-cost change. Add a "Which dishes are affected?" view on the Impact page.

**H11 — Flagged rows can't be confirmed**
- *Justification:* "Rows needing review are never saved automatically. The owner records the confirmed value as a manual price with its source, which keeps provenance clear."
- *Patch:* Add a per-row "Confirm" control on the Extraction page (with an ingredient picker for partial or no matches) that sets `matched = true`, `flagged = false` and `confirmed_by_user = true`, and record that confirmation in `provenance_note`.

**Medium and low items:**

| Item | Justification | Patch |
| :--- | :--- | :--- |
| Contribution margin definition (Impact) | "Uses the recommended price as the selling-price reference for a what-if comparison." | Use `actual_selling_price` when one is saved; show CM = selling price − portion cost for both current and simulated. Remove or use the unused `computeContributionMargin`. |
| Extracted unit not stored | "The unit is checked during review before saving." | Add a `unit` column to `ingredient_prices`. |
| Source URL / file name not stored | "Source and date are stored for every price." | Save `url` or `originalname` in `provenance_note`. |
| Manual sub-source (market vs. supplier) | "Owners record this in the note field." | Add a select (Market purchase / Supplier quotation) that writes to `provenance_note`. |
| No duplicate detection | — | Before inserting, skip a row if the same `(ingredient_id, source, extraction_date, price)` already exists. |
| Snapshot traceability | "Each snapshot records the price source and date of computation." | Store the per-ingredient breakdown as JSON, or the price IDs used, in `costing_outputs`. |
| Tailwind barely used | "Tailwind v4 is the styling base (imported globally). Components use design tokens via inline styles for theme control." | No code change needed; reword in the camera-ready version. |
| Inventory module out of scope | "An exploratory add-on outside the evaluation scope (§1.5). It isn't used in any evaluation task." | Optionally hide it behind a feature flag during sessions. |
| Reset leaves inventory data; demo seed prices | — | Add `TRUNCATE ingredient_stock` and `inventory_transactions` to `reset.js`. Remove the transaction wrapper or switch to `DELETE`. Seed with no prices, or label them clearly as demo data. |
| Ingredient unit editable after prices exist | — | Block unit changes when prices exist (409), or convert stored prices. |
| Classification labels | "Matched = ready, Partial / Needs review = needs review, No match = rejected." | Rename the UI labels to match §3.3. |
| Fixed match thresholds | "Chosen during iterative testing (§3.2.4)." | Optionally use a length-normalized similarity, e.g. `1 − d / max(len)`. Report the thresholds in Chapter 4. |

**Suggested priority before evaluation (re-scoped):** follow the Focus Summary at the top: H2 → H5 → H3 → H10 → contribution margin → H6 (manual 30-day rule) → the smaller price-record items. Keep H4 as 0% waste in the 20 test recipes, with the formula added in the camera-ready version. The extraction items (H1, H7, H8, H9, H11) are deprioritized per adviser guidance.
