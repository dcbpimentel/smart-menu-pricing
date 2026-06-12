const bcrypt = require('bcrypt');
const db     = require('../utils/db');

const getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at ASC'
    );
    const users = rows.map(u => ({ ...u, is_active: u.is_active === 1 || u.is_active === true }));
    res.json({ success: true, data: users, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { username, full_name, role = 'staff', password } = req.body;
    if (!username || !full_name || !password) {
      return res.status(400).json({ success: false, data: null, message: 'username, full_name, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, data: null, message: 'Password must be at least 6 characters' });
    }
    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, data: null, message: 'role must be admin or staff' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, full_name, role, password_hash) VALUES (?, ?, ?, ?)',
      [username.trim(), full_name.trim(), role, hash]
    );
    const [rows] = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    const u = rows[0];
    res.status(201).json({ success: true, data: { ...u, is_active: u.is_active === 1 || u.is_active === true }, message: '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, data: null, message: `Username '${req.body.username}' is already taken` });
    }
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { full_name, role } = req.body;
    if (role && !['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, data: null, message: 'role must be admin or staff' });
    }

    const [result] = await db.query(
      'UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role) WHERE id = ?',
      [full_name ?? null, role ?? null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, data: null, message: 'User not found' });
    }

    const [rows] = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    const u = rows[0];
    res.json({ success: true, data: { ...u, is_active: u.is_active === 1 || u.is_active === true }, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const toggleActive = async (req, res) => {
  try {
    // Prevent admin from deactivating their own account
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, data: null, message: 'You cannot deactivate your own account' });
    }

    const [rows] = await db.query('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, data: null, message: 'User not found' });
    }

    const newStatus = !(rows[0].is_active === 1 || rows[0].is_active === true);
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    res.json({
      success: true,
      data: { is_active: newStatus },
      message: newStatus ? 'Account activated' : 'Account deactivated',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { getAll, create, update, toggleActive };
