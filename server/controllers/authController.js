const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const Station  = require('../models/Station');
const AuditLog = require('../models/AuditLog');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

// =================================================
// تسجيل الدخول
// =================================================
exports.login = async (req, res) => {
  try {
    const { username, password, stationId } = req.body;
    if (!username || !password || !stationId) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور واختيار المحطة مطلوب' });
    }

    // البحث عن المستخدم مع كلمة المرور
    const user = await User.findOne({ username }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // التحقق من المحطة
    if (user.stationId.toString() !== stationId) {
      await AuditLog.create({
        userId: user._id, username, action: 'LOGIN_FAILED',
        details: { reason: 'station_mismatch' }
      });
      return res.status(401).json({ error: 'هذا الحساب لا ينتمي للمحطة المختارة' });
    }

    // التحقق من كلمة المرور
    const match = await user.comparePassword(password);
    if (!match) {
      await AuditLog.create({
        userId: user._id, username, action: 'LOGIN_FAILED',
        details: { reason: 'wrong_password' }, ip: req.ip
      });
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // التحقق من حالة الحساب
    if (!user.isActive) {
      return res.status(401).json({ error: 'الحساب موقوف' });
    }

    // التحقق من حالة المحطة
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(401).json({ error: 'المحطة غير موجودة' });
    }
    if (station.status === 'suspended') {
      return res.status(401).json({ error: 'المحطة موقوفة' });
    }
    if (station.status === 'expired') {
      return res.status(401).json({ error: 'انتهى اشتراك المحطة' });
    }

    // إنشاء التوكن — JWT يأتي حصراً من process.env.JWT_SECRET
    const token = jwt.sign(
      {
        userId:     user._id.toString(),
        username:   user.username,
        role:       user.role,
        stationId:  user.stationId.toString(),
        stationName: station.name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // تسجيل الدخول بنجاح
    await AuditLog.create({
      userId: user._id, username, stationId,
      action: 'LOGIN_SUCCESS', ip: req.ip
    });

    const userObj = {
      _id:        user._id.toString(),
      username:   user.username,
      role:       user.role,
      stationId:  user.stationId.toString(),
      stationName: station.name
    };

    res.json({
      success: true,
      token,
      user: userObj,
      station: { name: station.name, status: station.status }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
  }
};

// =================================================
// جلب بيانات المستخدم الحالي
// =================================================
exports.getMe = async (req, res) => {
  try {
    const user = await req.user;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
};

// =================================================
// تسجيل الخروج
// =================================================
exports.logout = async (req, res) => {
  try {
    if (req.user) {
      await AuditLog.create({
        userId:     req.user.userId,
        username:   req.user.username,
        stationId:  req.user.stationId,
        action: 'LOGOUT'
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تسجيل الخروج' });
  }
};

// =================================================
// جلب المحطات النشطة
// =================================================
exports.getStations = async (req, res) => {
  try {
    const stations = await Station.find({ isActive: true }, { name: 1, status: 1, subscriptionEnd: 1 }).sort({ name: 1 });
    res.json({ success: true, stations });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب المحطات' });
  }
};
