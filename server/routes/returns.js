const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../controllers/returnsController');
const { requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// المشرف والمسؤول فقط
router.use(requireRole('supervisor', 'admin'));

router.post('/upload',   upload.single('file'), ctrl.uploadReturns);
router.get('/dashboard', ctrl.getDashboard);
router.get('/monthly',   ctrl.getMonthlyReport);
router.get('/all',       ctrl.getAllReturns);

module.exports = router;
