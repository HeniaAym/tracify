const jwt      = require('jsonwebtoken');
const Station  = require('../models/Station');
const User     = require('../models/User');
const Parcel   = require('../models/Parcel');
const CashClosing = require('../models/CashClosing');
const Expense  = require('../models/Expense');
const bcrypt   = require('bcryptjs');

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || 'ecomanager-admin-secret-key-change-in-production';
const SUPERADMIN_USER = process.env.SUPERADMIN_USERNAME || 'superadmin';
const SUPERADMIN_PASS = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin!2026';

// التحقق من حساب السوبر أدمن
function requireSuperAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (decoded.isAdmin !== true) return res.status(403).json({ error: 'ليس لديك صلاحية' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'توكن غير صالح' });
  }
}

// ===================================================
// تسجيل دخول السوبر أدمن
// ===================================================
async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;
    if (username !== SUPERADMIN_USER || password !== SUPERADMIN_PASS) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ username, isAdmin: true }, ADMIN_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token, user: { username, role: 'superadmin' } });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
  }
}

// ===================================================
// لوحة التحكم — إحصائيات عامة
// ===================================================
async function getDashboard(req, res) {
  try {
    const totalStations = await Station.countDocuments();
    const activeStations = await Station.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const totalParcels = await Parcel.countDocuments();
    const totalClosings = await CashClosing.countDocuments();
    const totalExpenses = await Expense.countDocuments();

    // آخر الإحصائيات
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayParcels = await Parcel.countDocuments({ createdAt: { $gte: today } });

    // المحطات حسب الحالة
    const stationsByStatus = await Station.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalStations, activeStations, totalUsers,
        totalParcels, totalClosings, totalExpenses,
        todayParcels,
        stationsByStatus
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// ===================================================
// إدارة المحطات — قائمة كاملة
// ===================================================
async function getStations(req, res) {
  try {
    const stations = await Station.find().sort({ createdAt: -1 });
    // عدد المستخدمين لكل محطة
    const stationsWithUsers = await Promise.all(stations.map(async (s) => {
      const userCount = await User.countDocuments({ stationId: s._id });
      return { ...s.toObject(), userCount };
    }));
    res.json({ success: true, stations: stationsWithUsers });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب المحطات' });
  }
}

// إضافة محطة جديدة
async function createStation(req, res) {
  try {
    const { name, subscriptionEnd } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم المحطة مطلوب' });

    const station = await Station.create({
      name,
      status: 'active',
      subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null
    });

    res.json({ success: true, station });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'اسم المحطة موجود مسبقاً' });
    res.status(500).json({ error: 'خطأ في إنشاء المحطة' });
  }
}

// تحديث محطة
async function updateStation(req, res) {
  try {
    const { name, status, subscriptionEnd, isActive } = req.body;
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ error: 'المحطة غير موجودة' });

    if (name !== undefined) station.name = name;
    if (status !== undefined) station.status = status;
    if (isActive !== undefined) station.isActive = isActive;
    if (subscriptionEnd !== undefined) station.subscriptionEnd = new Date(subscriptionEnd);

    await station.save();
    res.json({ success: true, station });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث المحطة' });
  }
}

// حذف محطة
async function deleteStation(req, res) {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ error: 'المحطة غير موجودة' });

    // حذف المستخدمين المرتبطين
    await User.deleteMany({ stationId: station._id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في حذف المحطة' });
  }
}

// ===================================================
// إدارة المستخدمين — قائمة كاملة
// ===================================================
async function getUsers(req, res) {
  try {
    const users = await User.find().populate('stationId', 'name').sort({ createdAt: -1 })
      .select('-passwordHash');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب المستخدمين' });
  }
}

// إضافة مستخدم جديد
async function createUser(req, res) {
  try {
    const { username, password, role, stationId } = req.body;
    if (!username || !password || !role || !stationId) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ username, passwordHash, role, stationId });

    res.json({ success: true, user: { _id: user._id, username: user.username, role: user.role, stationId: user.stationId } });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إنشاء المستخدم' });
  }
}

// تحديث مستخدم
async function updateUser(req, res) {
  try {
    const { username, role, stationId, isActive, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    if (username !== undefined) user.username = username;
    if (role !== undefined) user.role = role;
    if (stationId !== undefined) user.stationId = stationId;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.passwordHash = await User.hashPassword(password);

    await user.save();
    res.json({ success: true, user: { _id: user._id, username: user.username, role: user.role, stationId: user.stationId, isActive: user.isActive } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
    res.status(500).json({ error: 'خطأ في تحديث المستخدم' });
  }
}

// حذف مستخدم
async function deleteUser(req, res) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في حذف المستخدم' });
  }
}

module.exports = {
  requireSuperAdmin,
  adminLogin,
  getDashboard,
  getStations,
  createStation,
  updateStation,
  deleteStation,
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
