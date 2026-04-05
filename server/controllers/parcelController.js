const Parcel       = require('../models/Parcel');
const CashMovement = require('../models/CashMovement');
const CashClosing  = require('../models/CashClosing');
const AuditLog     = require('../models/AuditLog');
const xlsx         = require('xlsx');
const fs           = require('fs');
const path         = require('path');

// البحث عن الطرود مع فلتر المحطة
exports.searchParcels = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const regex = new RegExp(q, 'i');
    const parcels = await Parcel.find({
      stationId: req.user.stationId,
      $or: [{ tracking: regex }, { phone: regex }, { customer: regex }]
    }).limit(50);
    res.json(parcels);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// دفع طرد — boxId مطلوب من الـ body
exports.payParcel = async (req, res) => {
  try {
    const { id } = req.params;
    const { boxId } = req.body;

    if (!boxId) return res.status(400).json({ error: 'boxId مطلوب — يجب الاتصال بصندوق المال أولاً' });

    // التحقق أن الصندوق ينتمي للمحطة ومتصل
    const MoneyBox = require('../models/MoneyBox');
    const box = await MoneyBox.findOne({ _id: boxId, stationId: req.user.stationId, isOpen: true });
    if (!box) return res.status(400).json({ error: 'الصندوق غير متصل أو لا ينتمي لمحطتك' });

    const parcel = await Parcel.findOne({ _id: id, stationId: req.user.stationId });
    if (!parcel) return res.status(404).json({ error: 'الطرد غير موجود' });
    if (parcel.status === 'paid') return res.status(400).json({ error: 'الطرد مدفوع مسبقاً' });

    parcel.status = 'paid';
    await parcel.save();

    const movement = new CashMovement({
      boxId,                          // ← مهم جداً
      type: 'PARCEL_PAYMENT',
      amount: parcel.price,
      description: `دفع طرد ${parcel.tracking}`,
      referenceId: parcel._id,
      referenceModel: 'Parcel',
      tracking: parcel.tracking,
      createdBy: req.user.username,
      stationId: req.user.stationId
    });
    await movement.save();

    await AuditLog.create({
      userId: req.user.userId,
      username: req.user.username,
      stationId: req.user.stationId,
      action: 'PAY_PARCEL',
      target: 'Parcel',
      targetId: parcel._id,
      details: { tracking: parcel.tracking, amount: parcel.price, boxId }
    });

    res.json({ success: true, parcel, movement });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// الحصول على جميع الطرود
exports.getAllParcels = async (req, res) => {
  try {
    const parcels = await Parcel.find({ stationId: req.user.stationId })
      .sort({ createdAt: -1 }).limit(100);
    res.json(parcels);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// تعديل بيانات الطرد مع التحقق من التجميع
exports.updateParcel = async (req, res) => {
  try {
    const { customer, phone, price } = req.body;
    const { id } = req.params;
    if (!customer || !phone || price === undefined)
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });

    const parcel = await Parcel.findOne({ _id: id, stationId: req.user.stationId });
    if (!parcel) return res.status(404).json({ error: 'الطرد غير موجود' });

    const inClosing = await CashClosing.findOne({ 'parcels.parcelId': parcel._id });
    if (inClosing) return res.status(400).json({ error: 'لا يمكن تعديل طرد بعد التجميع' });

    const oldValues = {
      oldCustomer: parcel.customer, newCustomer: customer,
      oldPhone: parcel.phone,       newPhone: phone,
      oldPrice: parcel.price,       newPrice: Number(price)
    };

    parcel.customer     = customer;
    parcel.phone        = phone;
    parcel.price        = Number(price);
    parcel.lastEditedBy = req.user.username;
    parcel.lastEditedAt = new Date();
    parcel.wasEdited    = true;
    await parcel.save();

    if (parcel.status === 'paid') {
      await CashMovement.updateOne(
        { tracking: parcel.tracking, type: 'PARCEL_PAYMENT' },
        { $set: { amount: Number(price) } }
      );
    }

    await AuditLog.create({
      userId: req.user.userId, username: req.user.username,
      stationId: req.user.stationId, action: 'EDIT_PARCEL',
      target: 'Parcel', targetId: parcel._id, details: oldValues
    });

    res.json({ success: true, parcel });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// خريطة الأعمدة
const COLUMN_MAP = {
  tracking: ['id', 'tracking', 'رقم التتبع', 'barcode', 'code', 'ref', 'réf', 'référence', 'n°', 'numero'],
  customer: ['client', 'customer', 'العميل', 'nom', 'name', 'destinataire', 'اسم العميل', 'expediteur', 'expéditeur', 'sender'],
  phone:    ['tel 1', 'tel1', 'phone', 'téléphone', 'telephone', 'الهاتف', 'هاتف', 'mobile', 'gsm', 'contact'],
  price:    ['total', 'prix', 'price', 'المبلغ', 'montant', 'cod', 'valeur', 'مبلغ'],
};

function findCol(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toString().trim().toLowerCase();
    if (aliases.some(a => h === a || h.includes(a))) return i;
  }
  return -1;
}

// تسليم جماعي من Excel
exports.bulkDeliver = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    if (!req.body.boxId) return res.status(400).json({ error: 'boxId مطلوب' });

    const { boxId } = req.body;
    const stationId = req.user.stationId;
    const username  = req.user.username;

    const workbook  = xlsx.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows      = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let headerRowIndex = -1, headers = [];
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (!rows[i] || rows[i].length < 3) continue;
      const row = rows[i].map(c => (c || '').toString().trim().toLowerCase());
      const hasTracking = COLUMN_MAP.tracking.some(a => row.some(h => h === a || h.includes(a)));
      const hasCustomer = COLUMN_MAP.customer.some(a => row.some(h => h === a || h.includes(a)));
      if (hasTracking || hasCustomer) { headerRowIndex = i; headers = rows[i]; break; }
    }

    fs.unlinkSync(req.file.path);
    if (headerRowIndex === -1)
      return res.status(400).json({ error: 'لم يتم التعرف على عناوين الأعمدة' });

    const COL = {
      tracking: findCol(headers, COLUMN_MAP.tracking),
      customer: findCol(headers, COLUMN_MAP.customer),
      phone:    findCol(headers, COLUMN_MAP.phone),
      price:    findCol(headers, COLUMN_MAP.price),
    };

    const dataRows = rows.slice(headerRowIndex + 1);
    const details = [];
    let delivered = 0, alreadyPaid = 0, changedFromReturned = 0, addedAndDelivered = 0;
    const errors = [];

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      const tracking = row[COL.tracking]?.toString().trim();
      if (!tracking) continue;

      try {
        const alreadyInFile = details.some(
          d => d.tracking === tracking &&
          ['delivered','added_and_delivered','changed_from_returned'].includes(d.status)
        );
        if (alreadyInFile) { details.push({ status: 'duplicate_file', tracking }); continue; }

        const parcel = await Parcel.findOne({ tracking, stationId });

        if (!parcel) {
          const customer = COL.customer >= 0 ? (row[COL.customer]?.toString().trim() || '—') : '—';
          const phone    = COL.phone    >= 0 ? (row[COL.phone]?.toString().trim()    || '')   : '';
          const price    = COL.price    >= 0 ? (parseFloat(row[COL.price]) || 0) : 0;

          const newParcel = await new Parcel({
            tracking, customer, phone: phone || tracking, price, status: 'paid', stationId
          }).save();

          await CashMovement.create({
            boxId, type: 'PARCEL_PAYMENT', amount: price,
            description: `تسليم طرد (إضافة جديدة) ${tracking}`,
            referenceId: newParcel._id, referenceModel: 'Parcel',
            tracking, createdBy: username, stationId
          });

          addedAndDelivered++;
          details.push({ status: 'added_and_delivered', tracking, customer, price });

        } else if (parcel.status === 'pending') {
          parcel.status = 'paid';
          await parcel.save();
          await CashMovement.create({
            boxId, type: 'PARCEL_PAYMENT', amount: parcel.price,
            description: `تسليم طرد ${tracking}`,
            referenceId: parcel._id, referenceModel: 'Parcel',
            tracking, createdBy: username, stationId
          });
          delivered++;
          details.push({ status: 'delivered', tracking, customer: parcel.customer, price: parcel.price });

        } else if (parcel.status === 'paid') {
          alreadyPaid++;
          details.push({ status: 'already_paid', tracking });

        } else if (parcel.status === 'returned') {
          parcel.status = 'paid';
          await parcel.save();
          await CashMovement.create({
            boxId, type: 'PARCEL_PAYMENT', amount: parcel.price,
            description: `تسليم طرد ${tracking} (تحويل من مرتجع)`,
            referenceId: parcel._id, referenceModel: 'Parcel',
            tracking, createdBy: username, stationId
          });
          changedFromReturned++;
          details.push({ status: 'changed_from_returned', tracking, customer: parcel.customer, price: parcel.price });
        }
      } catch (err) { errors.push({ tracking, message: err.message }); }
    }

    await AuditLog.create({
      userId: req.user.userId, username, stationId, action: 'BULK_DELIVER',
      target: 'Parcel',
      details: { delivered, alreadyPaid, changedFromReturned, addedAndDelivered, total: details.length }
    });

    res.json({ success: true, summary: { delivered, alreadyPaid, changedFromReturned, addedAndDelivered, total: details.length }, details, errors });
  } catch (err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
};

// استيراد Excel مع منع التكرار
exports.importExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const workbook  = xlsx.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows      = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let headerRowIndex = -1, headers = [];
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (!rows[i] || rows[i].length < 3) continue;
      const row = rows[i].map(c => (c || '').toString().trim().toLowerCase());
      const hasTracking = COLUMN_MAP.tracking.some(a => row.some(h => h === a || h.includes(a)));
      const hasCustomer = COLUMN_MAP.customer.some(a => row.some(h => h === a || h.includes(a)));
      if (hasTracking || hasCustomer) { headerRowIndex = i; headers = rows[i]; break; }
    }

    if (headerRowIndex === -1) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'لم يتم التعرف على عناوين الأعمدة' });
    }

    const COL = {
      tracking: findCol(headers, COLUMN_MAP.tracking),
      customer: findCol(headers, COLUMN_MAP.customer),
      phone:    findCol(headers, COLUMN_MAP.phone),
      price:    findCol(headers, COLUMN_MAP.price),
    };

    const dataRows = rows.slice(headerRowIndex + 1);
    const errors = [], skipped = [];
    let imported = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      const tracking = row[COL.tracking]?.toString().trim();
      if (!tracking) continue;
      if (skipped.some(s => s.tracking === tracking)) continue;

      // تحقق من التكرار في قاعدة البيانات (عالمي)
      const existing = await Parcel.findOne({ tracking });
      if (existing) { skipped.push({ tracking, reason: 'موجود مسبقاً' }); continue; }

      const customer = row[COL.customer]?.toString().trim();
      const phone    = row[COL.phone]?.toString().trim();
      const price    = parseFloat(row[COL.price]);

      if (!customer || !phone || isNaN(price)) {
        errors.push(`الصف ${headerRowIndex + i + 2}: بيانات ناقصة (${tracking})`);
        continue;
      }

      try {
        await new Parcel({ tracking, phone, customer, price, status: 'pending', stationId: req.user.stationId }).save();
        imported++;
      } catch (err) { errors.push(`خطأ في إدخال ${tracking}: ${err.message}`); }
    }

    fs.unlinkSync(req.file.path);

    await AuditLog.create({
      userId: req.user.userId, username: req.user.username,
      stationId: req.user.stationId, action: 'IMPORT_PARCELS',
      target: 'Parcel', details: { count: imported }
    });

    res.json({ success: true, imported, skipped, errors });
  } catch (err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
};