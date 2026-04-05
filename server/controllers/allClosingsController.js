const CashClosing    = require('../models/CashClosing');
const DriverSettlement = require('../models/DriverSettlement');

// ===================================================
// جلب كل التجميعات (صندوق + سائقين)
// ===================================================
exports.getAllClosings = async (req, res) => {
  try {
    const { from, to, type, search } = req.query;
    const stationId = req.user.stationId;

    // دعم البيانات القديمة (بدون stationId)
    const cashFilter = {
      $or: [
        { stationId: stationId },
        { stationId: { $exists: false } }
      ]
    };
    const driverFilter = {
      $or: [
        { stationId: stationId },
        { stationId: { $exists: false } }
      ]
    };

    if (from || to) {
      if (from) {
        cashFilter.closedAt = cashFilter.closedAt || {};
        cashFilter.closedAt.$gte = new Date(from);
        driverFilter.settledAt = driverFilter.settledAt || {};
        driverFilter.settledAt.$gte = new Date(from);
      }
      if (to) {
        const toD = new Date(to);
        toD.setHours(23, 59, 59, 999);
        cashFilter.closedAt = cashFilter.closedAt || {};
        cashFilter.closedAt.$lte = toD;
        driverFilter.settledAt = driverFilter.settledAt || {};
        driverFilter.settledAt.$lte = toD;
      }
    }

    if (!type || type === 'cash') {
      if (search) cashFilter.receiptNumber = { $regex: search, $options: 'i' };
    }
    if (!type || type === 'driver') {
      if (search) driverFilter.settlementNumber = { $regex: search, $options: 'i' };
    }

    const cashClosings = (!type || type === 'cash')
      ? await CashClosing.find(cashFilter).sort({ closedAt: -1 })
      : [];

    const driverSettlements = (!type || type === 'driver')
      ? await DriverSettlement.find(driverFilter).sort({ settledAt: -1 })
      : [];

    const combined = [];

    cashClosings.forEach(c => {
      combined.push({
        _id: c._id,
        type: 'cash',
        reference: c.receiptNumber,
        date: c.closedAt,
        amount: c.actualAmount,
        supervisor: c.closedBy,
        operator: c.operatorName,
        status: c.difference === 0 ? 'متطابق' : c.difference > 0 ? 'زيادة' : 'نقص',
        parcelsCount: (c.parcels || []).length
      });
    });

    driverSettlements.forEach(s => {
      combined.push({
        _id: s._id,
        type: 'driver',
        reference: s.settlementNumber,
        date: s.settledAt,
        amount: s.amountDueToCompany,
        supervisor: s.settledBy,
        driver: s.driverName,
        status: 'مكتمل',
        parcelsCount: s.totalParcels
      });
    });

    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
