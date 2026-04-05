const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'محاولات تسجيل الدخول كثيرة جداً، يرجى الانتظار 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login',          loginLimiter, ctrl.login);
router.get('/me',              authenticateToken, ctrl.getMe);
router.post('/logout',         authenticateToken, ctrl.logout);
router.get('/stations',                        ctrl.getStations);

module.exports = router;
