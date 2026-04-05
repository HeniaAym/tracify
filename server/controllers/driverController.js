const Driver           = require('../models/Driver');
const DriverSettlement = require('../models/DriverSettlement');
const Parcel           = require('../models/Parcel');

// ===================================================
// قائمة السائقين
// ===================================================
exports.listDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ stationId: req.user.stationId }).sort({ createdAt: -1 });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// إنشاء سائق
// ===================================================
exports.createDriver = async (req, res) => {
  try {
    const { name, vehicleType, deliveryPrice, workArea } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم السائق مطلوب' });

    const driver = await Driver.create({
      name, vehicleType, deliveryPrice: Number(deliveryPrice) || 0,
      workArea, stationId: req.user.stationId
    });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// تحديث سائق
// ===================================================
exports.updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findOne({ _id: id, stationId: req.user.stationId });
    if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });

    const { name, vehicleType, workArea, isActive } = req.body;
    if (name !== undefined)        driver.name = name;
    if (vehicleType !== undefined) driver.vehicleType = vehicleType;
    if (workArea !== undefined)    driver.workArea = workArea;
    if (isActive !== undefined)    driver.isActive = isActive;

    await driver.save();
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// تحديث سعر التوصيل
// ===================================================
exports.updateDeliveryPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPrice } = req.body;
    if (deliveryPrice == null) return res.status(400).json({ error: 'سعر التوصيل مطلوب' });

    const driver = await Driver.findOne({ _id: id, stationId: req.user.stationId });
    if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });

    driver.deliveryPrice = Number(deliveryPrice);
    await driver.save();
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// تسوية سائق (إنشاء تسوية جديدة)
// ===================================================
exports.createSettlement = async (req, res) => {
  try {
    const { driverId, parcels } = req.body;
    if (!driverId) return res.status(400).json({ error: 'السائق مطلوب' });
    if (!parcels || !parcels.length) return res.status(400).json({ error: 'لا توجد طرود للتسوية' });

    const driver = await Driver.findOne({ _id: driverId, stationId: req.user.stationId });
    if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });
    if (!driver.isActive) return res.status(400).json({ error: 'هذا السائق غير نشط' });

    // فحص الطرود التي سبقت تسويتها
    const trackingList = parcels.map(p => p.tracking).filter(Boolean);
    const alreadySettled = await DriverSettlement.find({
      stationId: req.user.stationId,
      'parcels.tracking': { $in: trackingList }
    });

    const settledTrackings = new Set();
    alreadySettled.forEach(s => {
      s.parcels.forEach(p => {
        if (trackingList.includes(p.tracking)) settledTrackings.add(p.tracking);
      });
    });

    if (settledTrackings.size > 0) {
      return res.json({
        alreadySettled: true,
        settledList: [...settledTrackings],
        message: `${settledTrackings.size} طرود تم تسويتها سابقاً`
      });
    }

    // بناء بيانات الطرود
    const parcelData = parcels.map(p => ({
      tracking: p.tracking || '',
      customer: p.customer || '',
      price:    Number(p.price) || 0,
      settled:  true
    }));

    const totalParcels       = parcelData.length;
    const totalAmount        = parcelData.reduce((a, p) => a + p.price, 0);
    const zeroPriceParcels   = parcelData.filter(p => p.price === 0).length;
    const driverDeliveryFee  = totalParcels * driver.deliveryPrice;
    const companyDeduction   = zeroPriceParcels * driver.deliveryPrice;
    const amountDueToCompany = totalAmount - driverDeliveryFee - companyDeduction;

    const settlement = await DriverSettlement.create({
      driverId:          driver._id,
      driverName:        driver.name,
      vehicleType:       driver.vehicleType,
      deliveryPrice:     driver.deliveryPrice,
      parcels:           parcelData,
      totalParcels,
      totalAmount,
      zeroPriceParcels,
      companyDeduction,
      driverDeliveryFee,
      amountDueToCompany,
      settledBy:         req.user.username,
      stationId:         req.user.stationId,
      notes:             req.body.notes || ''
    });

    res.json({ success: true, settlement });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// سجل تسويات السائق
// ===================================================
exports.getSettlements = async (req, res) => {
  try {
    const filter = { stationId: req.user.stationId };
    if (req.params.id) filter.driverId = req.params.id;

    if (req.query.from || req.query.to) {
      filter.settledAt = {};
      if (req.query.from) filter.settledAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.settledAt.$lte = to;
      }
    }

    const settlements = await DriverSettlement.find(filter).sort({ settledAt: -1 });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// إحصائيات الشهر للتوصيل
// ===================================================
exports.getMonthlyStats = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const settlements = await DriverSettlement.find({
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