const axios           = require('axios');
const cheerio         = require('cheerio');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');
const pdf             = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { normalizeUnit, getConversionFactor } = require('./units');

// ── Shared helpers ────────────────────────────────────────────────────────────

const HEADER_KEYWORDS = ['commodity', 'price', 'unit', 'item', 'description', 'classification', 'variety'];
const isHeaderCell = (text) => HEADER_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));

// Strips ₱, commas, /kg-style suffixes → float or null
const parsePrice = (text) => {
  const cleaned = text
    .replace(/[₱₱,\s]/g, '')
    .replace(/\/[a-zA-Z]+.*$/, '')
    .replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const parseUnitFromPriceString = (text) => {
  const m = text.match(/\/([a-zA-Z]+)/i) || text.match(/per\s+([a-zA-Z]+)/i);
  return m ? m[1].toLowerCase() : null;
};

// ── HTML date detection ───────────────────────────────────────────────────────

const MONTH_MAP = { january:1,february:2,march:3,april:4,may:5,june:6,
                    july:7,august:8,september:9,october:10,november:11,december:12 };

const dateFromText = (text) => {
  let m = text.match(/\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/);
  if (m) return m[1].replace(/\//g, '-');

  m = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if (m) {
    const mm = String(MONTH_MAP[m[2].toLowerCase()]).padStart(2, '0');
    return `${m[3]}-${mm}-${String(m[1]).padStart(2, '0')}`;
  }
  m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m) {
    const mm = String(MONTH_MAP[m[1].toLowerCase()]).padStart(2, '0');
    return `${m[3]}-${mm}-${String(m[2]).padStart(2, '0')}`;
  }
  return null;
};

// Weekly bulletins are dated by a range ("For the period of October 19-25, 2026");
// the last day of the period is used as the price date.
const MONTH_NAMES = Object.keys(MONTH_MAP).join('|');
const PERIOD_RE = new RegExp(
  `for the (?:period|week) of\\s+(${MONTH_NAMES})\\s+(\\d{1,2})\\s*[-–]\\s*(?:(${MONTH_NAMES})\\s+)?(\\d{1,2}),?\\s*(\\d{4})`, 'i'
);
const periodEndDate = (text) => {
  const m = text.match(PERIOD_RE);
  if (!m) return null;
  const mm = String(MONTH_MAP[(m[3] || m[1]).toLowerCase()]).padStart(2, '0');
  return `${m[5]}-${mm}-${String(m[4]).padStart(2, '0')}`;
};

// Issue date of a PDF/OCR document. Footnotes such as "monitoring started on
// November 17, 2025" sit after the "Note:"/"Source:" line and are not the issue date.
const documentDate = (text) =>
  periodEndDate(text) ?? dateFromText(text.split(/\n\s*(?:Note|Source)\s*:/i)[0]);

// Returns the date found in the page, plus whether it was assumed (guessed as today)
const extractPageDate = ($) => {
  const body = $('body').text();
  const raw = periodEndDate(body) ?? dateFromText(body);
  return { date: raw ?? new Date().toISOString().slice(0, 10), dateAssumed: !raw };
};

// ── HTML column detection ─────────────────────────────────────────────────────

const detectColumns = (headerCells) => {
  const cols = { name: 0, unit: null, price: null };
  headerCells.forEach((text, i) => {
    const t = text.toLowerCase();
    if (t.includes('unit') || t.includes('uom'))                                               cols.unit  = i;
    if (t.includes('price') || t.includes('cost') || t.includes('srp') || t.includes('retail')) cols.price = i;
    if (i > 0 && (t.includes('commodity') || t.includes('item') || t.includes('description')))  cols.name  = i;
  });
  if (cols.price === null) cols.price = 2;
  if (cols.unit  === null) cols.unit  = 1;
  return cols;
};

// ── HTML extraction ───────────────────────────────────────────────────────────

const parseHTMLString = (html, source) => {
  const $ = cheerio.load(html);
  const { date, dateAssumed } = extractPageDate($);
  const results = [];

  $('table').each((_, table) => {
    const headerCells = [];
    $(table).find('tr').first().find('th, td').each((_, cell) => {
      headerCells.push($(cell).text().trim());
    });
    const cols = detectColumns(headerCells);

    $(table).find('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      const nameText  = $(cells[cols.name]).text().trim();
      const unitText  = cols.unit !== null ? $(cells[cols.unit]).text().trim() : '';
      const priceCell = cols.price < cells.length ? $(cells[cols.price]).text().trim() : '';

      if (!nameText || isHeaderCell(nameText)) return;
      if (/^\d+\.?\d*$/.test(nameText)) return;

      const rawPrice = parsePrice(priceCell);
      if (rawPrice === null || rawPrice === 0) return;

      const rawUnit = unitText || parseUnitFromPriceString(priceCell) || 'kg';
      results.push({
        raw_name: nameText, raw_unit: rawUnit, raw_price: rawPrice, date, source,
        ...(dateAssumed ? { flagged: true, flag_reason: 'date_assumed' } : {}),
      });
    });
  });

  return { success: true, data: results };
};

// Find PDF/Excel links embedded in a page (for JS-rendered pages that link to bulletins)
const findDocumentLinks = ($) => {
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/\.(pdf|xlsx?)(\?|$)/i.test(href)) links.push(href);
  });
  // Also scan raw HTML for S3 / direct doc URLs not wrapped in <a> tags
  const rawHtml = $.html();
  const matches = rawHtml.match(/https?:\/\/[^\s"'<>]+\.(?:pdf|xlsx?)(?:[?#][^\s"'<>]*)?/gi) || [];
  matches.forEach((u) => { if (!links.includes(u)) links.push(u); });
  return [...new Set(links)];
};

// Download a remote file to a temp path and return that path
const downloadToTemp = async (fileUrl) => {
  const ext = (fileUrl.match(/\.(pdf|xlsx?)(?:[?#]|$)/i) || ['', '.pdf'])[1].toLowerCase();
  const tmpPath = path.join(os.tmpdir(), `smp-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
  const response = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMenuPricing/1.0)' },
  });
  fs.writeFileSync(tmpPath, response.data);
  return tmpPath;
};

const extractFromHTML = async (url, source) => {
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const tableResult = parseHTMLString(response.data, source);

    // If static HTML had table rows, return them directly
    if (tableResult.data.length > 0) return tableResult;

    // Page is likely JS-rendered (SPA). Look for linked document files.
    const $ = cheerio.load(response.data);
    const docLinks = findDocumentLinks($);
    if (docLinks.length === 0) {
      return { success: true, data: [], meta: { note: 'No tables or document links found. Page may require JS rendering.' } };
    }

    // Chain-extract from the first PDF link found
    const pdfLink = docLinks.find((l) => /\.pdf/i.test(l));
    if (!pdfLink) {
      return { success: true, data: [], meta: { note: 'Only non-PDF document links found.', links: docLinks } };
    }

    let tmpPath;
    try {
      tmpPath = await downloadToTemp(pdfLink);
      const pdfResult = await extractFromPDF(tmpPath, source);
      return { ...pdfResult, meta: { source_url: pdfLink, note: 'Extracted from linked PDF bulletin' } };
    } finally {
      if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch (_) {} }
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ── Shared plain-text line parser (PDF + OCR) ─────────────────────────────────

// Standalone unit abbreviations
const UNIT_RE  = /\b(kg|g|mL|ml|L|pcs?|bundle|pack)\b/i;
// Price: 1–5 digits, optional decimal, not glued to letters
const PRICE_RE = /(?<![a-zA-Z])(\d{1,5}(?:\.\d{1,2})?)(?![a-zA-Z])/;

const looksLikePriceRow = (line) => PRICE_RE.test(line) && UNIT_RE.test(line);

const parsePriceLine = (line, source, date, dateAssumed = false) => {
  const unitMatch  = line.match(UNIT_RE);
  const rawUnit    = unitMatch ? unitMatch[1].toLowerCase() : null;

  const priceMatch = line.match(PRICE_RE);
  const rawPrice   = priceMatch ? parseFloat(priceMatch[1]) : null;

  let rawName = priceMatch ? line.slice(0, priceMatch.index) : line;
  rawName = rawName
    .replace(UNIT_RE, '')
    .replace(/[₱₱,\-–—\/|\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const flagged = !rawUnit || rawPrice === null || !rawName || dateAssumed;
  const flag_reason = !rawUnit ? 'missing_unit' : (!rawPrice ? 'missing_price' : (dateAssumed ? 'date_assumed' : null));
  return { raw_name: rawName || line.trim(), raw_unit: rawUnit ?? '', raw_price: rawPrice, date, source, flagged, flag_reason };
};

// Shared helper: split raw text into lines and parse each price row
const parseLines = (text, source, date, dateAssumed = false) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .filter(looksLikePriceRow)
    .map((line) => parsePriceLine(line, source, date, dateAssumed));

// ── DA Bantay Presyo layout ───────────────────────────────────────────────────
// In DA price bulletins (Daily Price Index, Weekly Average Retail Prices) pdf-parse
// returns each table row as commodity + specification + unit with no spaces between
// them ("Whole Chicken, LocalFully Dressedkg"), and the price on the next line
// ("215.14", or "-" when the item was not sold).

const DA_UNIT        = '(kg|pcs|pc|ml|L|g)';
const DA_ROW_END     = new RegExp(`^(.*?)${DA_UNIT}$`);
const DA_UNIT_ONLY   = new RegExp(`^${DA_UNIT}$`);
const DA_GLUED_PRICE = new RegExp(`^(.*?)${DA_UNIT}(\\d{1,5}\\.\\d{2})$`);
const DA_PRICE_LINE  = /^(-|\d{1,5}(?:\.\d{1,2})?)$/;
const SUPERSCRIPTS   = /[²³¹ᴬ-ᵪ⁰-₟]/g;

// The specification starts where a lowercase letter or ")" runs straight into an
// uppercase letter or digit: "Whole Chicken, Local|Fully Dressed", "Tomato|15-18 pcs/kg".
const splitSpecification = (text) => {
  const m = text.match(/^(.*?[a-z)])(?=[A-Z0-9])(.*)$/);
  return m ? { name: m[1].trim(), spec: m[2].trim() } : { name: text.trim(), spec: '' };
};

// "350 ml/bottle" items are priced per bottle; convert to a price per L (or per kg)
const perBottleToBaseUnit = (spec, unit, price) => {
  const m = spec.match(/(\d+(?:\.\d+)?)\s*(ml|l|liters?|litres?|g|gm|kg)\s*\/\s*(?:bottle|pack|can|pouch|sachet)/i);
  if (!m) return { unit, price };
  const packUnit = normalizeUnit(m[2]);
  const base = getConversionFactor(packUnit, 'L') !== null ? 'L' : 'kg';
  const qtyInBase = parseFloat(m[1]) * getConversionFactor(packUnit, base);
  return { unit: base, price: Math.round((price / qtyInBase) * 100) / 100 };
};

const parseDALayout = (text, source, date, dateAssumed = false) => {
  const lines = text.split('\n').map((l) => l.replace(SUPERSCRIPTS, '').trim()).filter(Boolean);
  const rows = [];
  let section = '';

  const push = (nameAndSpec, unit, priceText) => {
    if (priceText === '-') return; // "(-) not sold in the market": no reference price
    let { name, spec } = splitSpecification(nameAndSpec);
    if (!name) return;
    // Rice varieties ("Premium", "Well Milled") repeat under the imported and local headings
    if (/RICE/.test(section) && /IMPORTED|LOCAL/.test(section)) {
      if (!/rice/i.test(name)) name = `${name} Rice`;
      name = `${name}, ${/IMPORTED/.test(section) ? 'Imported' : 'Local'}`;
    }
    const converted = perBottleToBaseUnit(spec, unit, parseFloat(priceText));
    rows.push({
      raw_name: name, raw_spec: spec, raw_unit: converted.unit, raw_price: converted.price, date, source,
      ...(dateAssumed ? { flagged: true, flag_reason: 'date_assumed' } : {}),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    if (/^[A-Z][A-Z\s&/-]{3,}$/.test(line) && !/COMMODITY|PRICE/.test(line)) { section = line; continue; }

    const glued = line.match(DA_GLUED_PRICE);
    if (glued && glued[1]) { push(glued[1], glued[2], glued[3]); continue; }

    if (!next || !DA_PRICE_LINE.test(next)) continue;
    const row = line.match(DA_ROW_END);
    if (row && row[1]) { push(row[1], row[2], next); i++; continue; }
    // Unit wrapped onto its own line: "Pork Picnic Shoulder (Kasim), Imported" / "kg" / "239.93"
    if (DA_UNIT_ONLY.test(line) && i > 0) { push(lines[i - 1], line, next); i++; }
  }
  return rows;
};

// ── PDF extraction ────────────────────────────────────────────────────────────

const extractFromPDF = async (filePath, source) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdf(buffer);
    const rawDate = documentDate(parsed.text);
    const date = rawDate ?? new Date().toISOString().slice(0, 10);
    const dateAssumed = !rawDate;
    const daRows = parseDALayout(parsed.text, source, date, dateAssumed);
    const data = daRows.length >= 3 ? daRows : parseLines(parsed.text, source, date, dateAssumed);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ── OCR (image) extraction ────────────────────────────────────────────────────

const OCR_WHITELIST =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ₱/.,()-';

const extractFromImage = async (filePath, source) => {
  let worker;
  try {
    worker = await createWorker('eng');
    await worker.setParameters({ tessedit_char_whitelist: OCR_WHITELIST });
    const { data: { text } } = await worker.recognize(filePath);
    const rawDate = documentDate(text);
    const date = rawDate ?? new Date().toISOString().slice(0, 10);
    const dateAssumed = !rawDate;
    return { success: true, data: parseLines(text, source, date, dateAssumed) };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    if (worker) await worker.terminate();
  }
};

// ── Batch processing: normalize + match every raw entry ──────────────────────

const { normalizeEntry }    = require('./normalizer');
const { matchToIngredient } = require('./matcher');

const processBatch = async (rawEntries, source, db) => {
  const results = await Promise.all(
    rawEntries.map(async (entry) => {
      const normalized = normalizeEntry({ ...entry, source });
      const match      = await matchToIngredient(normalized.normalized_name, db);

      // Stored prices are read as "per the ingredient's unit", so a bulletin price in a
      // different unit (₱/kg saved to an ingredient priced per g) would be off by 1000×.
      // Not converted here because prices are stored to the centavo (₱0.12/g loses precision).
      const unitMismatch = !!(match.ingredient_unit && normalized.normalized_unit
        && getConversionFactor(normalized.normalized_unit, match.ingredient_unit) !== 1);

      return {
        raw_name:      entry.raw_name ?? null,
        specification: entry.raw_spec || null,
        ...normalized,
        ...match,
        // flag_reason: normalizer takes precedence, then unit mismatch, then the matcher's reason
        flag_reason: normalized.flag_reason ?? (unitMismatch ? 'unit_mismatch' : null) ?? match.flag_reason ?? null,
        flagged: normalized.flagged || unitMismatch || match.matched !== true,
      };
    })
  );

  // Several bulletin rows matched to one ingredient (e.g. every egg size to "Chicken Egg")
  // would all be saved with the same date; hold them for review instead.
  const perIngredient = {};
  results.forEach((r) => { if (r.matched === true) perIngredient[r.ingredient_id] = (perIngredient[r.ingredient_id] ?? 0) + 1; });
  return results.map((r) => (r.matched === true && perIngredient[r.ingredient_id] > 1
    ? { ...r, flagged: true, flag_reason: r.flag_reason ?? 'duplicate_match' }
    : r));
};

module.exports = { extractFromHTML, parseHTMLString, extractFromPDF, extractFromImage, processBatch };
