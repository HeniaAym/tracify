const CashMovement = require('../models/CashMovement');
const CashClosing  = require('../models/CashClosing');
const Parcel       = require('../models/Parcel');

async function getLastClosingDate(boxId) {
  const last = await CashClosing.findOne({ boxId }).sort({ closedAt: -1 });
  return last ? last.closedAt : new Date(0);
}

// الرصيد الحالي للصندوق مع فلتر المحطة
exports.getBalance = async (req, res) => {
  try {
    const { boxId } = req.query;
    if (!boxId) return res.status(400).json({ error: 'boxId مطلوب' });

    // التحقق أن الصندوق ينتمي للمحطة
    const stationId = req.user.stationId;
    const box = await require('../models/MoneyBox').findOne({ _id: boxId, stationId });
    if (!box) return res.status(404).json({ error: 'الصندوق غير موجود' });

    const since = await getLastClosingDate(boxId);
    const movements = await CashMovement.find({
      boxId,
      stationId,
      createdAt: { $gt: since },
      type: { $ne: 'ADJUSTMENT' }
    });

    const balance = movements.reduce((acc, cur) => acc + cur.amount, 0);
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// آخر الحركات مع فلتر المحطة
exports.getMovements = async (req, res) => {
  try {
    const { boxId } = req.query;
    if (!boxId) return res.status(400).json({ error: 'boxId مطلوب' });

    const stationId = req.user.stationId;
    const since = await getLastClosingDate(boxId);
    const movements = await CashMovement.find({
      boxId,
      stationId,
      createdAt: { $gt: since },
      type: { $ne: 'ADJUSTMENT' }
    }).sort({ createdAt: -1 }).limit(100);

    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// إحصائيات اليوم مع فلتر المحطة
exports.getTodayStats = async (req, res) => {
  try {
    const { boxId } = req.query;
    if (!boxId) return res.status(400).json({ error: 'boxId مطلوب' });

    const stationId = req.user.stationId;
    const since = await getLastClosingDate(boxId);

    const TIMEZONE_OFFSET = 1 * 60 * 60 * 1000;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    startOfDay.setTime(startOfDay.getTime() - TIMEZONE_OFFSET);
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    endOfDay.setTime(endOfDay.getTime() - TIMEZONE_OFFSET);

    const effectiveStart = since > startOfDay ? since : startOfDay;

    const payments = await CashMovement.find({
      boxId,
      stationId,
      type:      'PARCEL_PAYMENT',
      createdAt: { $gt: effectiveStart, $lte: endOfDay }
    }).populate('referenceId').sort({ createdAt: -1 });

    const totalCollected = payments.reduce((acc, cur) => acc + cur.amount, 0);
    const paidCount      = payments.length;

    const recentParcels = payments.slice(0, 15).map(p => ({
      parcelId: p.referenceId?._id || p.referenceId,
      tracking: p.tracking || p.referenceId?.tracking || p.description.replace('دفع طرد ', '') || 'غير معروف',
      price:    p.amount,
      paidAt:   p.createdAt
    }));

    const pendingCount = await Parcel.countDocuments({ status: 'pending', stationId });

    res.json({ totalCollected, paidCount, pendingCount, recentParcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// إجمالي تحصيل اليوم (محطتنا فقط)
exports.getTodayTotal = async (req, res) => {
  try {
    const stationId = req.user.stationId;
    const TIMEZONE_OFFSET = 1 * 60 * 60 * 1000;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    startOfDay.setTime(startOfDay.getTime() - TIMEZONE_OFFSET);
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    endOfDay.setTime(endOfDay.getTime() - TIMEZONE_OFFSET);

    const payments = await CashMovement.find({
      stationId,
      type:      'PARCEL_PAYMENT',
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const total = payments.reduce((acc, cur) => acc + cur.amount, 0);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// إحصائيات التوصيل الشهرية
exports.getMonthlyDeliveryStats = async (req, res) => {
  try {
    const settlementModel = require('../models/DriverSettlement');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const settlements = await settlementModel.find({
      stationId: req.user.stationId,
      settledAt: { $gte: startOfMonth }
    });

    const monthlyDeliveries = settlements.reduce((sum, s) => sum + (s.totalParcels || 0), 0);
    const monthName = startOfMonth.toLocaleString('ar-DZ', { month: 'long', year: 'numeric' });

    res.json({ monthlyDeliveries, currentMonth: monthName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
