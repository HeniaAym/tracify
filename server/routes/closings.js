const express = require('express');
const router  = express.Router();
const closingController = require('../controllers/closingController');
const { requireRole } = require('../middleware/auth');

// المشرف والمسؤول فقط
router.use(requireRole('supervisor', 'admin'));

router.post('/',     closingController.closeCash);
router.get('/',      closingController.getClosings);
router.get('/:id',   closingController.getClosingDetails);

module.exports = router;
