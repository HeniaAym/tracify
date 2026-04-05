const jwt = require('jsonwebtoken');

// التحقق من التوكن
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log('JWT_VERIFY_ERROR:', err.message, '| SECRET:', process.env.JWT_SECRET ? 'SET' : 'UNSET');
    return res.status(401).json({ error: 'توكن غير صالح أو منتهي الصلاحية' });
  }
};

// التحقق من الصلاحية حسب الدور
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }
  next();
};

module.exports = { authenticateToken, requireRole };
