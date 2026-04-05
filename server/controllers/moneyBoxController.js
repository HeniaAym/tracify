const MoneyBox    = require('../models/MoneyBox');
const CashMovement = require('../models/CashMovement');
const CashClosing  = require('../models/CashClosing');
const AuditLog    = require('../models/AuditLog');
const { generateBoxCode } = require('../utils/boxCode');

// ===================================================
// جلب الصناديق مع فلتر المحطة
// ===================================================
exports.getBoxes = async (req, res) => {
  try {
    let boxes = await MoneyBox.find({ stationId: req.user.stationId });

    if (!boxes.length) {
      const defaultBox = await MoneyBox.create({
        name: 'Money Box 1',
        stationId: req.user.stationId
      });
      boxes = [defaultBox];
    }
    res.json(boxes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =================================================
// الاتصال بصندوق مع التحقق من الحالة واسم المتصل
// ===================================================
exports.connectBox = async (req, res) => {
  try {
    const { boxId } = req.body;
    const box = await MoneyBox.findOne({ _id: boxId, stationId: req.user.stationId });
    if (!box) return res.status(404).json({ error: 'الصندوق غير موجود' });

    if (box.isOpen && box.connectedBy && box.connectedByName && box.connectedBy.toString() !== req.user.userId) {
      return res.status(400).json({
        error: `الصندوق مستخدم بواسطة ${box.connectedByName}`
      });
    }

    box.isOpen          = true;
    box.openedAt        = new Date();
    box.connectedBy     = req.user.userId;
    box.connectedByName = req.user.username;
    await box.save();

    await AuditLog.create({
      userId: req.user.userId,
      username: req.user.username,
      stationId: req.user.stationId,
      action: 'BOX_CONNECT',
      target: 'MoneyBox',
      targetId: box._id,
      details: { boxId: box._id.toString(), boxName: box.name }
    });

    res.json({ success: true, box });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// رصيد صندوق محدد مع فلتر المحطة
// ===================================================
exports.getBoxBalance = async (req, res) => {
  try {
    const { boxId } = req.params;
    const box = await MoneyBox.findOne({ _id: boxId, stationId: req.user.stationId });
    if (!box) return res.status(404).json({ error: 'الصندوق غير موجود' });

    const lastClosing = await CashClosing
      .findOne({ boxId, stationId: req.user.stationId })
      .sort({ closedAt: -1 });
    const since = lastClosing ? lastClosing.closedAt : new Date(0);

    const movements = await CashMovement.find({
      boxId,
      stationId: req.user.stationId,
      createdAt: { $gt: since },
      type: { $ne: 'ADJUSTMENT' }
    });

    const balance = movements.reduce((acc, cur) => acc + cur.amount, 0);
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// الصناديق المتصلة حالياً (لصفحة الإقفال)
// ===================================================
exports.getConnectedBoxes = async (req, res) => {
  try {
    const stationId = req.user.stationId;
    const boxes = await MoneyBox.find({
      isOpen: true,
      stationId
    });

    const result = [];
    for (const box of boxes) {
      const lastClosing = await CashClosing
        .findOne({ boxId: box._id, stationId })
        .sort({ closedAt: -1 });
      const since = lastClosing ? lastClosing.closedAt : new Date(0);

      const movements = await CashMovement.find({
        boxId: box._id,
        stationId,
        createdAt: { $gt: since },
        type: { $ne: 'ADJUSTMENT' }
      });
      const balance = movements.reduce((acc, cur) => acc + cur.amount, 0);

      result.push({
        _id: box._id,
        stationId: box.stationId,
        name: box.boxCode || box.name,
        boxCode: box.boxCode,
        connectedByName: box.connectedByName,
        balance
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// قطع الاتصال بصندوق
// ===================================================
exports.disconnectBox = async (req, res) => {
  try {
    const { boxId } = req.body;
    if (!boxId) return res.status(400).json({ error: 'boxId مطلوب' });

    const box = await MoneyBox.findOne({ _id: boxId, stationId: req.user.stationId });
    if (!box) return res.status(404).json({ error: 'الصندوق غير موجود' });

    if (!box.isOpen) {
      return res.status(400).json({ error: 'الصندوق غير متصل' });
    }

    // المستخدم العادي لا يستطيع قطع الاتصال
    if (req.user.role === 'user') {
      return res.status(403).json({
        error: 'لا يمكنك قطع الاتصال بالصندوق — أخبر مشرفك أو المسؤول',
        showSupervisor: true
      });
    }

    box.isOpen = false;
    box.connectedBy = null;
    box.connectedByName = null;
    box.openedAt = null;
    await box.save();

    await AuditLog.create({
      userId: req.user.userId,
      username: req.user.username,
      stationId: req.user.stationId,
      action: 'BOX_DISCONNECT',
      target: 'MoneyBox',
      targetId: box._id,
      details: { boxId: box._id.toString(), boxName: box.boxCode || box.name }
    });

    res.json({ success: true, box });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// إنشاء صندوق مال جديد
// ===================================================
exports.createBox = async (req, res) => {
  try {
    const code = await generateBoxCode(MoneyBox);
    const box = await MoneyBox.create({
      name: code,
      boxCode: code,
      stationId: req.user.stationId,
      isOpen: false
    });

    await AuditLog.create({
      userId: req.user.userId,
      username: req.user.username,
      stationId: req.user.stationId,
      action: 'BOX_CREATE',
      target: 'MoneyBox',
      targetId: box._id,
      details: { boxCode: code }
    });

    res.json({ success: true, box });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
