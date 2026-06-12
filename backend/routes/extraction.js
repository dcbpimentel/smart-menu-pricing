const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const { extractFromHTML, parseHTMLString, extractFromPDF, extractFromImage, processBatch } = require('../utils/extractor');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = ['.html', '.htm', '.pdf', '.png', '.jpg', '.jpeg'];

const MIME_TO_TYPE = {
  'text/html':        'html',
  'application/pdf':  'pdf',
  'image/png':        'image',
  'image/jpeg':       'image',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) return cb(null, true);
  cb(new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const VALID_SOURCES = ['dti', 'da', 'manual'];

// ── POST /api/extraction/html  (URL-based) ────────────────────────────────────
router.post('/html', async (req, res) => {
  const { url, source } = req.body;

  if (!url || !source) {
    return res.status(400).json({ success: false, data: null, message: 'url and source are required' });
  }
  if (!VALID_SOURCES.includes(source)) {
    return res.status(400).json({ success: false, data: null, message: `source must be one of: ${VALID_SOURCES.join(', ')}` });
  }

  const result = await extractFromHTML(url, source);
  if (!result.success) {
    return res.status(502).json({ success: false, data: null, message: `Extraction failed: ${result.error}` });
  }

  const processed = await processBatch(result.data, source, db);
  res.json({ success: true, data: processed, message: `Extracted ${processed.length} price entries` });
});

// ── POST /api/extraction/upload  (file-based) ─────────────────────────────────
router.post('/upload', (req, res, next) => {
  // Run multer first so we can return clean 400s for file errors
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, data: null, message: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, data: null, message: 'No file uploaded. Field name must be "file".' });
  }

  const { source } = req.body;
  const filePath = req.file.path;

  const cleanup = () => { try { fs.unlinkSync(filePath); } catch (_) {} };

  if (!source || !VALID_SOURCES.includes(source)) {
    cleanup();
    return res.status(400).json({ success: false, data: null, message: `source must be one of: ${VALID_SOURCES.join(', ')}` });
  }

  // Determine file type: prefer mimetype, fall back to extension
  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileType = MIME_TO_TYPE[req.file.mimetype]
    ?? (ext === '.html' || ext === '.htm' ? 'html' : null);

  try {
    if (fileType === 'html') {
      const html = fs.readFileSync(filePath, 'utf8');
      cleanup();
      const result = parseHTMLString(html, source);
      const processed = await processBatch(result.data, source, db);
      return res.json({
        success: true,
        data: processed,
        message: `Extracted ${processed.length} price entries from uploaded HTML`,
      });
    }

    if (fileType === 'pdf') {
      const result = await extractFromPDF(filePath, source);
      cleanup();
      if (!result.success) {
        return res.status(502).json({ success: false, data: null, message: `PDF extraction failed: ${result.error}` });
      }
      const processed = await processBatch(result.data, source, db);
      const flaggedCount = processed.filter((r) => r.flagged).length;
      return res.json({
        success: true,
        data: processed,
        message: `Extracted ${processed.length} rows from PDF (${flaggedCount} flagged for review)`,
      });
    }

    if (fileType === 'image') {
      const result = await extractFromImage(filePath, source);
      cleanup();
      if (!result.success) {
        return res.status(502).json({ success: false, data: null, message: `OCR extraction failed: ${result.error}` });
      }
      const processed = await processBatch(result.data, source, db);
      const flaggedCount = processed.filter((r) => r.flagged).length;
      return res.json({
        success: true,
        data: processed,
        message: `Extracted ${processed.length} rows from image (${flaggedCount} flagged for review)`,
      });
    }

    cleanup();
    return res.status(400).json({ success: false, data: null, message: 'Could not determine file type' });
  } catch (err) {
    cleanup();
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── POST /api/extraction/save ─────────────────────────────────────────────────
router.post('/save', async (req, res) => {
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, data: null, message: 'entries must be a non-empty array' });
  }

  const toSave   = entries.filter((e) => e.matched === true && e.flagged === false);
  const skipped  = entries.filter((e) => e.matched !== true || e.flagged === true);

  if (toSave.length === 0) {
    return res.json({
      success: true,
      data: { saved: 0, skipped: skipped.length, skipped_entries: skipped },
      message: 'No eligible entries to save',
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const errors = [];
  let saved = 0;

  for (const entry of toSave) {
    try {
      await db.query(
        `INSERT INTO ingredient_prices (ingredient_id, price, source, provenance_note, extraction_date, is_manual)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entry.ingredient_id,
          entry.price,
          entry.source,
          entry.matched_name ? `auto-matched from "${entry.normalized_name}"` : null,
          entry.date ?? today,
          false,
        ]
      );
      saved++;
    } catch (err) {
      errors.push({ entry, error: err.message });
    }
  }

  // Any rows that errored during INSERT are appended to skipped
  const allSkipped = [
    ...skipped,
    ...errors.map((e) => ({ ...e.entry, skip_reason: e.error })),
  ];

  res.status(errors.length > 0 && saved === 0 ? 500 : 207).json({
    success: true,
    data: { saved, skipped: allSkipped.length, skipped_entries: allSkipped },
    message: `Saved ${saved} price entr${saved === 1 ? 'y' : 'ies'}; skipped ${allSkipped.length}`,
  });
});

module.exports = router;
