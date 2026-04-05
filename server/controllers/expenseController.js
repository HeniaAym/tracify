const Expense      = require('../models/Expense');
const MoneyBox     = require('../models/MoneyBox');
const CashClosing  = require('../models/CashClosing');
const CashMovement = require('../models/CashMovement');
const AuditLog     = require('../models/AuditLog');
const { CATEGORIES } = require('../models/Expense');

exports.createExpense = async (req, res) => {
  try {
    const { amount, description, category, sourceType, boxId, closingId } = req.body;
    const stationId = req.user.stationId;

    if (!amount || !description || !sourceType)
      return res.status(400).json({ error: 'المبلغ والوصف ونوع المصدر مطلوبة' });
    if (sourceType === 'box'     && !boxId)     return res.status(400).json({ error: 'يجب تحديد الصندوق' });
    if (sourceType === 'closing' && !closingId) return res.status(400).json({ error: 'يجب تحديد التجميعة' });

    // التحقق من ملكية الصندوق أو التجميعة
    if (sourceType === 'box') {
      const box = await MoneyBox.findOne({ _id: boxId, stationId });
      if (!box) return res.status(404).json({ error: 'الصندوق غير موجود' });
    }
    if (sourceType === 'closing') {
      const cl = await CashClosing.findOne({ _id: closingId, stationId });
      if (!cl) return res.status(404).json({ error: 'التجميعة غير موجودة' });
    }

    const expense = await Expense.create({
      amount:    Number(amount),
      description,
      category:  category || 'أخرى',
      sourceType,
      boxId:     sourceType === 'box'     ? boxId     : undefined,
      closingId: sourceType === 'closing' ? closingId : undefined,
      createdBy: req.user.username,
      stationId
    });

    // ← إنشاء حركة مالية سالبة في الصندوق (مهما كان المصدر)
    // إذا المصدر صندوق → استخدم boxId مباشرة
    // إذا المصدر تجميعة → جلب boxId من التجميعة
    let targetBoxId = boxId;
    if (sourceType === 'closing' && closingId) {
      const cl = await CashClosing.findById(closingId);
      if (cl) targetBoxId = cl.boxId;
    }

    if (targetBoxId) {
      await CashMovement.create({
        boxId:       targetBoxId,
        type:        'EXPENSE',
        amount:      -Number(amount),  // ← سالب ينقص من الرصيد
        description: `مصروف: ${category || 'أخرى'} — ${description}`,
        createdBy:   req.user.username,
        stationId
      });
    }

    await AuditLog.create({
      userId: req.user.userId, username: req.user.username, stationId,
      action: 'CREATE_EXPENSE', target: 'Expense', targetId: expense._id,
      details: { amount: Number(amount), category: category || 'أخرى', sourceType }
    });

    res.json({ success: true, expense });
  } catch (err) {
    console.error('createExpense error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { from, to, category, sourceType } = req.query;
    const filter = { stationId: req.user.stationId };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }
    if (category)   filter.category   = category;
    if (sourceType) filter.sourceType = sourceType;

    const expenses = await Expense.find(filter)
      .populate('boxId',     'name boxCode')
      .populate('closingId', 'receiptNumber closedAt')
      .sort({ createdAt: -1 });

    const total = expenses.reduce((acc, e) => acc + e.amount, 0);
    const byCategory = {};
    expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

    res.json({ expenses, total, byCategory });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFormData = async (req, res) => {
  try {
    const stationId = req.user.stationId;
    const boxes     = await MoneyBox.find({ stationId });
    const closings  = await CashClosing
      .find({ stationId }, { receiptNumber: 1, closedAt: 1, expectedAmount: 1 })
      .sort({ closedAt: -1 }).limit(20);
    res.json({ boxes, closings, categories: CATEGORIES });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, stationId: req.user.stationId });
    if (!expense) return res.status(404).json({ error: 'المصروف غير موجود' });

    // حذف الحركة المالية المرتبطة
    if (expense.sourceType === 'box' && expense.boxId) {
      await CashMovement.deleteOne({ boxId: expense.boxId, type: 'EXPENSE', amount: -expense.amount });
    }
    if (expense.sourceType === 'closing' && expense.closingId) {
      const cl = await CashClosing.findById(expense.closingId);
      if (cl) await CashMovement.deleteOne({ boxId: cl.boxId, type: 'EXPENSE', amount: -expense.amount });
    }

    await AuditLog.create({
      userId: req.user.userId, username: req.user.username,
      stationId: req.user.stationId, action: 'DELETE_EXPENSE',
      target: 'Expense', targetId: expense._id,
      details: { amount: expense.amount, category: expense.category }
    });

    await expense.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};