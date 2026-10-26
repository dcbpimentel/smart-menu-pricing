require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const verifyToken = require('./middleware/auth');
const db          = require('./utils/db');

const authRouter        = require('./routes/auth');
const usersRouter       = require('./routes/users');
const ingredientsRouter = require('./routes/ingredients');
const pricesRouter      = require('./routes/prices');
const recipesRouter     = require('./routes/recipes');
const settingsRouter    = require('./routes/settings');
const extractionRouter  = require('./routes/extraction');
const costingRouter     = require('./routes/costing');
const exportRouter      = require('./routes/export');
const resetRouter       = require('./routes/reset');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : '*',
  credentials: true,
}));
// Recipe photos are sent as base64 data URLs, so allow large bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: '' });
});

// Public — no token required
app.use('/api/auth', authRouter);

// Protected — token required for all routes below
app.use('/api/users',       verifyToken, usersRouter);
app.use('/api/ingredients', verifyToken, ingredientsRouter);
app.use('/api/prices',      verifyToken, pricesRouter);
app.use('/api/recipes',     verifyToken, recipesRouter);
app.use('/api/settings',    verifyToken, settingsRouter);
app.use('/api/extraction',  verifyToken, extractionRouter);
app.use('/api/costing',     verifyToken, costingRouter);
app.use('/api/export',      verifyToken, exportRouter);
app.use('/api/reset',       verifyToken, resetRouter);

// Global error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, data: null, message: err.message || 'Internal server error' });
});

// Bring databases created from an older schema.sql up to date
const columnType = async (table, column) => {
  const [cols] = await db.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return cols[0]?.COLUMN_TYPE ?? null;
};

const ensureSchema = async () => {
  try {
    const imageType = await columnType('recipes', 'image_data');
    if (!imageType) {
      await db.query('ALTER TABLE recipes ADD COLUMN image_data LONGTEXT NULL AFTER category');
      console.log('Added recipes.image_data column');
    } else if (!/longtext/i.test(imageType)) {
      await db.query('ALTER TABLE recipes MODIFY COLUMN image_data LONGTEXT NULL');
      console.log('Widened recipes.image_data to LONGTEXT');
    }

    if (!(await columnType('costing_outputs', 'price_snapshot'))) {
      await db.query('ALTER TABLE costing_outputs ADD COLUMN price_snapshot JSON NULL AFTER applied_price_source');
      console.log('Added costing_outputs.price_snapshot column');
    }
  } catch (err) {
    console.error('Schema check failed:', err.message);
  }
};

const PORT = process.env.PORT || 3000;
ensureSchema().finally(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;
