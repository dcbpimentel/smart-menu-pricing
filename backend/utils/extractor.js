const axios           = require('axios');
const cheerio         = require('cheerio');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');
const pdf             = require('pdf-parse');
const { createWorker } = require('tesseract.js');

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

// Returns the date found in the page, plus whether it was assumed (guessed as today)
const extractPageDate = ($) => {
  const raw = dateFromText($('body').text());
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

// ── PDF extraction ────────────────────────────────────────────────────────────

const extractFromPDF = async (filePath, source) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdf(buffer);
    const rawDate = dateFromText(parsed.text);
    const date = rawDate ?? new Date().toISOString().slice(0, 10);
    const dateAssumed = !rawDate;
    return { success: true, data: parseLines(parsed.text, source, date, dateAssumed) };
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
    const rawDate = dateFromText(text);
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

      return {
        ...normalized,
        ...match,
        // flag_reason: normalizer takes precedence; matcher reason added only if not already set
        flag_reason: normalized.flag_reason ?? match.flag_reason ?? null,
        flagged: normalized.flagged || match.matched !== true,
      };
    })
  );
  return results;
};

module.exports = { extractFromHTML, parseHTMLString, extractFromPDF, extractFromImage, processBatch };
