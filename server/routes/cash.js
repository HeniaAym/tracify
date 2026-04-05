const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/cashController');

router.get('/balance',     ctrl.getBalance);
router.get('/movements',   ctrl.getMovements);
router.get('/today-stats', ctrl.getTodayStats);
router.get('/today-total', ctrl.getTodayTotal);
router.get('/monthly-delivery-stats', ctrl.getMonthlyDeliveryStats);

module.exports = router;
