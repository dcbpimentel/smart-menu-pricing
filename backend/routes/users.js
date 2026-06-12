const express      = require('express');
const router       = express.Router();
const { getAll, create, update, toggleActive } = require('../controllers/userController');
const verifyToken  = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

router.use(verifyToken, requireAdmin);

router.get('/',                getAll);
router.post('/',               create);
router.put('/:id',             update);
router.patch('/:id/toggle',    toggleActive);

module.exports = router;
