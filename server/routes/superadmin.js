const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/superAdminController');

// تسجيل دخول السوبر أدمن (بدون حماية)
router.post('/login', ctrl.adminLogin);

// المحمية
router.use(ctrl.requireSuperAdmin);

router.get('/dashboard',     ctrl.getDashboard);

// إدارة المحطات
router.get('/stations',      ctrl.getStations);
router.post('/stations',     ctrl.createStation);
router.put('/stations/:id',  ctrl.updateStation);
router.delete('/stations/:id', ctrl.deleteStation);

// إدارة المستخدمين
router.get('/users',         ctrl.getUsers);
router.post('/users',        ctrl.createUser);
router.put('/users/:id',     ctrl.updateUser);
router.delete('/users/:id',  ctrl.deleteUser);

module.exports = router;
