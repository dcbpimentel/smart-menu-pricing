const express = require('express');
const router  = express.Router();
const { login, me, logout, changePassword, updateProfile } = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

router.post('/login',    login);
router.post('/logout',   verifyToken, logout);
router.get('/me',        verifyToken, me);
router.put('/password',  verifyToken, changePassword);
router.put('/profile',   verifyToken, updateProfile);

module.exports = router;
