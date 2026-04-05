const CashClosing  = require('../models/CashClosing');
const CashMovement = require('../models/CashMovement');
const MoneyBox     = require('../models/MoneyBox');
const AuditLog     = require('../models/AuditLog');

async function getLastClosingDate(boxId, stationId) {
  const last = await CashClosing.findOne({ boxId, stationId }).sort({ closedAt: -1 });
  return last ? last.closedAt : new Date(0);
}

exports.closeCash = async (req, res) => {
  try {
    const { actualAmount, notes, boxId } = req.body;
    if (!boxId) return res.status(400).json({ error: 'boxId مطلوب' });

    const stationId = req.user.stationId;
    const box = await MoneyBox.findOne({ _id: boxId, stationId });
    if (!box) return res.status(404).json({ error: 'الصندوق غير موجود' });

    const since = await getLastClosingDate(boxId, stationId);

    // كل الحركات (دفع طرود + مصاريف) منذ آخر إغلاق
    const movements = await CashMovement.find({
      boxId,
      stationId,
      createdAt: { $gt: since },
      type: { $ne: 'ADJUSTMENT' }
    });

    // الرصيد = مدفوعات الطرود - المصاريف
    const expectedAmount = movements.reduce((acc, cur) => acc + cur.amount, 0);
    const difference     = Number(actualAmount) - expectedAmount;

    // الطرود المدفوعة فقط للـ snapshot
    const paidMovements = await CashMovement.find({
      boxId, stationId,
      createdAt: { $gt: since },
      type: 'PARCEL_PAYMENT'
    }).populate('referenceId');

    const parcelsSnapshot = paidMovements.map(m => ({
      parcelId: m.referenceId?._id || m.referenceId,
      tracking: m.tracking || m.referenceId?.tracking || '—',
      customer: m.referenceId?.customer || '—',
      phone:    m.referenceId?.phone    || '—',
      price:    m.amount,
      paidAt:   m.createdAt
    }));

    // لا طرود مدفوعة → أغلق الصندوق فقط بدون تسجيل تجميعة
    if (parcelsSnapshot.length === 0) {
      await MoneyBox.findByIdAndUpdate(boxId, {
        isOpen: false, connectedBy: null,
        connectedByName: null, openedAt: null
      });
      return res.json({
        success: true, emptyClose: true,
        message: 'تم إغلاق الصندوق — لا توجد طرود للتجميع ولم يتم تسجيل تجميعة'
      });
    }

    const closing = new CashClosing({
      boxId, expectedAmount,
      actualAmount:   Number(actualAmount),
      difference,
      closedBy:       req.user.username,
      notes:          notes || '',
      stationId,
      parcels:        parcelsSnapshot,
      operatorName:   box.connectedByName || req.user.username,
      supervisorName: req.user.username
    });
    await closing.save();

    // ← الصندوق يُغلق في DB فقط — localStorage يُنظَّف من الـ frontend
    await MoneyBox.findByIdAndUpdate(boxId, {
      isOpen: false, openedAt: null,
      connectedBy: null, connectedByName: null
    });

    await AuditLog.create({
      userId: req.user.userId, username: req.user.username,
      stationId, action: 'CASH_CLOSING',
      target: 'CashClosing', targetId: closing._id,
      details: { receiptNumber: closing.receiptNumber, amount: expectedAmount }
    });

    res.json({
      success: true, closing, difference,
      // ← نُعيد boxId حتى يحذفه الـ frontend من localStorage
      releasedBoxId: boxId,
      message: `تم التجميع بنجاح — ${closing.receiptNumber}`
    });

  } catch (err) {
    console.error('closeCash error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getClosings = async (req, res) => {
  try {
    const { boxId, from, to } = req.query;
    const sid = req.user.stationId;
    let filter = {
      $or: [{ stationId: sid }, { stationId: { $exists: false } }]
    };
    if (boxId) filter.boxId = boxId;
    if (from || to) {
      filter.closedAt = {};
      if (from) filter.closedAt.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); filter.closedAt.$lte = d; }
    }
    const closings = await CashClosing.find(filter).sort({ closedAt: -1 });
    res.json(closings);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getClosingDetails = async (req, res) => {
  try {
    const closing = await CashClosing.findOne({
      _id: req.params.id,
      $or: [{ stationId: req.user.stationId }, { stationId: { $exists: false } }]
    });
    if (!closing) return res.status(404).json({ error: 'التجميعة غير موجودة' });
    res.json(closing);
  } catch (err) { res.status(500).json({ error: err.message }); }
};