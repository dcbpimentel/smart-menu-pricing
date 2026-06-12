const express = require('express');
const router = express.Router();
const {
  getAllSettings,
  getSettingById,
  createSetting,
  updateSetting,
  deleteSetting,
} = require('../controllers/settingsController');

router.get('/',      getAllSettings);
router.get('/:id',   getSettingById);
router.post('/',     createSetting);
router.put('/:id',   updateSetting);
router.delete('/:id', deleteSetting);

module.exports = router;
