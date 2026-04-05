const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/driverController');

// عام (كل الأدوار)
router.get('/',                  ctrl.listDrivers);
router.get('/monthly-stats',     ctrl.getMonthlyStats);
router.get('/settlements',       ctrl.getSettlements);

// مشرف ومسؤول فقط
router.post('/',                 ctrl.createDriver);
router.post('/settlements',      ctrl.createSettlement);
router.put('/:id',               ctrl.updateDriver);
router.put('/:id/price',         ctrl.updateDeliveryPrice);
router.get('/:id/settlements',   ctrl.getSettlements);
router.post('/:id/settle',       ctrl.createSettlement);  // ← المسار المستخدم في drivers.html

module.exports = router;