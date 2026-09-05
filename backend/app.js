require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const verifyToken = require('./middleware/auth');

const authRouter        = require('./routes/auth');
const usersRouter       = require('./routes/users');
const ingredientsRouter = require('./routes/ingredients');
const pricesRouter      = require('./routes/prices');
const recipesRouter     = require('./routes/recipes');
const settingsRouter    = require('./routes/settings');
const extractionRouter  = require('./routes/extraction');
const costingRouter     = require('./routes/costing');
const exportRouter      = require('./routes/export');
const inventoryRouter   = require('./routes/inventory');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : '*',
  credentials: true,
}));
app.use(express.json());

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
app.use('/api/inventory',   verifyToken, inventoryRouter);

// Global error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, data: null, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
