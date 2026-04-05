const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/expenseController');
const { requireRole } = require('../middleware/auth');

// المشرف والمسؤول فقط
router.use(requireRole('supervisor', 'admin'));

router.get('/form-data',  ctrl.getFormData);
router.post('/',          ctrl.createExpense);
router.get('/',           ctrl.getExpenses);
router.delete('/:id',     ctrl.deleteExpense);

module.exports = router;
