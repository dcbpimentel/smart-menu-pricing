const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../utils/db');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, data: null, message: 'Username and password are required' });
    }

    const [rows] = await db.query(
      'SELECT id, username, full_name, role, password_hash, is_active, created_at FROM users WHERE username = ?',
      [username]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, data: null, message: 'Incorrect username or password' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, data: null, message: 'Account is deactivated. Contact your administrator.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, data: null, message: 'Incorrect username or password' });
    }

    const payload = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      data: {
        token,
        user: {
          ...payload,
          is_active: user.is_active === 1 || user.is_active === true,
          created_at: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
        },
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, data: null, message: 'User not found' });
    }
    const u = rows[0];
    res.json({
      success: true,
      data: {
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active === 1 || u.is_active === true,
        created_at: u.created_at instanceof Date ? u.created_at.toISOString() : u.created_at,
      },
      message: '',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

const logout = (_req, res) => {
  res.json({ success: true, data: null, message: 'Logged out' });
};

const changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ success: false, data: null, message: 'old_password and new_password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, data: null, message: 'New password must be at least 6 characters' });
    }

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, data: null, message: 'User not found' });
    }

    const match = await bcrypt.compare(old_password, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ success: false, data: null, message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ success: true, data: null, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

module.exports = { login, me, logout, changePassword };
